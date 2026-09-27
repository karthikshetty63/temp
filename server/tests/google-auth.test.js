import assert from "node:assert/strict";
import { createHash, createHmac, generateKeyPairSync, randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { Buffer } from "node:buffer";
import jwt from "jsonwebtoken";
import process from "node:process";
import { FRONTEND_ORIGIN, PASSWORD, createAdmin, createClient, donorData, login, ngoData, register, registerActive, schoolData, startTestServer } from "./helpers.js";

const { setGoogleKeySource } = await import("../services/googleAuth.js");

const CLIENT_ID = "test-client-123.apps.googleusercontent.com";
const KID = "test-key-1";
const NEW_PASSWORD = "N3w-secure-pass";

// Stand-in for Google's signing key: tokens are signed exactly the way Google signs them.
const googleKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const strangerKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = { ...googleKeys.publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };
const googleKeySource = async () => ({ keys: [publicJwk], maxAge: 3600 });

let uid = 0;
const gmail = (label = "user") => `${label}.${Date.now().toString(36)}${(uid += 1)}@gmail.com`;

/** An ID token as Google would issue it. Override claims or signing details to forge bad ones. */
const idToken = (claims = {}, { key = googleKeys.privateKey, kid = KID, expiresIn = "1h" } = {}) =>
    jwt.sign(
        { iss: "https://accounts.google.com", aud: CLIENT_ID, sub: `g-${randomUUID()}`, email: gmail(), email_verified: true, name: "Asha Rao", ...claims },
        key,
        { algorithm: "RS256", keyid: kid, expiresIn }
    );

const base64url = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

let server;
let User;
const newClient = () => createClient(server.baseUrl);
const googleSignIn = (client, credential, role = "donor", extra = {}) => client.post("/api/auth/google", { json: { credential, role, ...extra } });
const stored = (email) => User.findOne({ email }).select("+password +passwordResetToken").lean();

before(async () => {
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    setGoogleKeySource(googleKeySource);
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
});
after(() => server.stop());

/** An approved donor who then signs in with Google once: linked, password removed (Google-only). */
const googleOnlyDonor = async (email = gmail("donor"), sub = `g-${randomUUID()}`) => {
    await registerActive(newClient(), donorData({ email }));
    const res = await googleSignIn(newClient(), idToken({ email, sub }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.linked, true);
    return { email, sub, id: res.body.user.id };
};

describe("Sign in with Google: accounts only come from registration", () => {
    test("an unknown Google account gets 'register first' on every portal, and nothing is created", async () => {
        for (const role of ["donor", "school", "ngo"]) {
            const email = gmail(`new.${role}`);
            const res = await googleSignIn(newClient(), idToken({ email }), role);
            assert.equal(res.status, 404, role);
            assert.equal(res.body.code, "GOOGLE_NO_ACCOUNT");
            assert.match(res.body.message, /Register first/);
            assert.equal(res.setCookie, "", `${role}: not signed in`);
            assert.equal(await User.countDocuments({ email }), 0, `${role}: no account created`);
        }
    });

    test("a donor registered but not yet approved can't get in through Google, and isn't linked", async () => {
        const email = gmail("pending.donor");
        await register(newClient(), donorData({ email }));
        const res = await googleSignIn(newClient(), idToken({ email }));
        assert.equal(res.status, 403);
        assert.equal(res.body.code, "ACCOUNT_PENDING");
        assert.equal((await stored(email)).googleId, undefined);
    });

    test("signing in again uses the same account", async () => {
        const { email, sub, id } = await googleOnlyDonor();
        const second = await googleSignIn(newClient(), idToken({ email, sub }));
        assert.equal(second.status, 200);
        assert.equal(second.body.linked, false);
        assert.equal(second.body.user.id, id);
        assert.equal(await User.countDocuments({ email }), 1);
    });

    test("a Google-only account can't be signed into with a password (same generic error)", async () => {
        const { email } = await googleOnlyDonor();
        const res = await login(newClient(), email, PASSWORD, "donor");
        assert.equal(res.status, 401);
        assert.equal(res.body.message, "Invalid email or password.");
    });

    test("registering again with the same email is refused", async () => {
        const { email } = await googleOnlyDonor();
        const res = await register(newClient(), donorData({ email }));
        assert.equal(res.status, 409);
    });

    test("a Google-only account can add a password through password reset, and both then work", async () => {
        const { email, sub } = await googleOnlyDonor();
        const token = "a".repeat(64);
        await User.updateOne({ email }, { $set: { passwordResetToken: createHash("sha256").update(token).digest("hex"), passwordResetExpires: new Date(Date.now() + 60_000) } });
        const reset = await newClient().post(`/api/auth/reset-password/${token}`, { json: { password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD } });
        assert.equal(reset.status, 200, JSON.stringify(reset.body));
        assert.equal((await login(newClient(), email, NEW_PASSWORD, "donor")).status, 200, "password works");
        assert.equal((await googleSignIn(newClient(), idToken({ email, sub }))).status, 200, "Google still works");
    });
});

describe("Sign in with Google: existing accounts", () => {
    test("password donor: linked, old password removed, other sessions signed out", async () => {
        const data = donorData({ email: gmail("linkme") });
        await registerActive(newClient(), data);
        const oldSession = newClient();
        assert.equal((await login(oldSession, data.email, PASSWORD, "donor")).status, 200);
        const before = await stored(data.email);

        const c = newClient();
        const sub = `g-${randomUUID()}`;
        const res = await googleSignIn(c, idToken({ email: data.email.toUpperCase(), sub }));
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.linked, true);

        const after = await stored(data.email);
        assert.equal(after.googleId, sub);
        assert.equal(after.password, undefined, "unverified password removed");
        assert.equal(after.tokenVersion, (before.tokenVersion ?? 0) + 1);
        assert.equal((await oldSession.get("/api/auth/me")).status, 401, "other device signed out");
        assert.equal((await c.get("/api/auth/me")).status, 200, "this device signed in");
        assert.equal((await login(newClient(), data.email, PASSWORD, "donor")).status, 401, "old password no longer works");

        const again = await googleSignIn(newClient(), idToken({ email: data.email, sub }));
        assert.equal(again.body.linked, false);
    });

    test("approved school and NGO sign in on their own portals", async () => {
        for (const [role, data] of [["school", schoolData({ email: gmail("school") })], ["ngo", ngoData({ email: gmail("ngo") })]]) {
            await register(newClient(), data);
            await User.updateOne({ email: data.email }, { $set: { accountStatus: "active" } });
            const res = await googleSignIn(newClient(), idToken({ email: data.email }), role);
            assert.equal(res.status, 200, `${role}: ${JSON.stringify(res.body)}`);
            assert.equal(res.body.user.role, role);
        }
    });

    test("pending and rejected accounts are refused and not linked", async () => {
        const pending = schoolData({ email: gmail("pending") });
        await register(newClient(), pending);
        const res = await googleSignIn(newClient(), idToken({ email: pending.email }), "school");
        assert.equal(res.status, 403);
        assert.equal(res.body.code, "ACCOUNT_PENDING");
        assert.equal(res.setCookie, "");
        assert.equal((await stored(pending.email)).googleId, undefined);

        const rejected = ngoData({ email: gmail("rejected") });
        await register(newClient(), rejected);
        await User.updateOne({ email: rejected.email }, { $set: { accountStatus: "rejected", rejectionReason: "Documents unclear" } });
        const res2 = await googleSignIn(newClient(), idToken({ email: rejected.email }), "ngo");
        assert.equal(res2.status, 403);
        assert.equal(res2.body.code, "ACCOUNT_REJECTED");
        assert.equal((await stored(rejected.email)).googleId, undefined);
    });

    test("wrong portal: refused with the right portal, not linked", async () => {
        const data = donorData({ email: gmail("portal") });
        await register(newClient(), data);
        const res = await googleSignIn(newClient(), idToken({ email: data.email }), "ngo");
        assert.equal(res.status, 403);
        assert.equal(res.body.code, "WRONG_PORTAL");
        assert.equal(res.body.role, "donor");
        const user = await stored(data.email);
        assert.equal(user.googleId, undefined);
        assert.ok(user.password, "password untouched");
    });

    test("admin console is password-only", async () => {
        assert.equal((await googleSignIn(newClient(), idToken(), "admin")).status, 400);
        const admin = await createAdmin({ email: gmail("admin") });
        const res = await googleSignIn(newClient(), idToken({ email: admin.email }), "donor");
        assert.equal(res.status, 403);
        assert.equal(res.body.role, "admin");
        const user = await stored(admin.email);
        assert.equal(user.googleId, undefined);
        assert.equal((await login(newClient(), admin.email, PASSWORD, "admin")).status, 200, "admin password untouched");
    });

    test("an account linked to one Google account can't be taken over by another", async () => {
        const { email } = await googleOnlyDonor(gmail("owned"), "g-original");
        const res = await googleSignIn(newClient(), idToken({ email, sub: "g-someone-else" }));
        assert.equal(res.status, 409);
        assert.equal(res.body.code, "GOOGLE_ACCOUNT_MISMATCH");
    });

    test("a Google account whose email changed still reaches its account", async () => {
        const { sub, id } = await googleOnlyDonor(gmail("before"));
        const res = await googleSignIn(newClient(), idToken({ email: gmail("after"), sub }));
        assert.equal(res.status, 200);
        assert.equal(res.body.user.id, id);
    });
});

describe("Sign in with Google: token checks", () => {
    const assertRejected = async (credential, label) => {
        const email = gmail("never");
        const res = await googleSignIn(newClient(), credential ?? idToken({ email }));
        assert.equal(res.status, 401, `${label}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.code, "GOOGLE_TOKEN_INVALID", label);
        assert.equal(res.setCookie, "", label);
    };

    test("forged, expired, foreign and incomplete tokens are rejected", async () => {
        const claims = { iss: "https://accounts.google.com", aud: CLIENT_ID, sub: "g-x", email: gmail("forged"), email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600 };
        const publicPem = googleKeys.publicKey.export({ type: "spki", format: "pem" });
        const hsHeader = base64url({ alg: "HS256", typ: "JWT", kid: KID });
        const hsBody = base64url(claims);
        const hsToken = `${hsHeader}.${hsBody}.${createHmac("sha256", publicPem).update(`${hsHeader}.${hsBody}`).digest("base64url")}`;

        await assertRejected(idToken({ aud: "someone-else.apps.googleusercontent.com" }), "other app's token");
        await assertRejected(idToken({ iss: "https://evil.example.com" }), "wrong issuer");
        await assertRejected(idToken({}, { expiresIn: "-10m" }), "expired");
        await assertRejected(idToken({}, { key: strangerKeys.privateKey }), "signed by someone else");
        await assertRejected(idToken({}, { kid: "unknown-key" }), "unknown key");
        await assertRejected(`${base64url({ alg: "none", typ: "JWT", kid: KID })}.${base64url(claims)}.`, "alg none");
        await assertRejected(hsToken, "HS256 with Google's public key");
        await assertRejected(idToken({ email_verified: false }), "unverified email");
        await assertRejected(idToken({ sub: undefined }), "no Google account id");
        await assertRejected("not-a-token", "garbage");
    });

    test("missing or oversized credential → 400", async () => {
        assert.equal((await newClient().post("/api/auth/google", { json: { role: "donor" } })).status, 400);
        assert.equal((await googleSignIn(newClient(), "x".repeat(5000))).status, 400);
        assert.equal((await googleSignIn(newClient(), { $gt: "" })).status, 400);
        assert.equal((await googleSignIn(newClient(), idToken(), "superuser")).status, 400);
    });

    test("not configured → 503 and nothing is created", async () => {
        delete process.env.GOOGLE_CLIENT_ID;
        try {
            const email = gmail("unconfigured");
            const res = await googleSignIn(newClient(), idToken({ email }));
            assert.equal(res.status, 503);
            assert.equal(res.body.code, "GOOGLE_UNAVAILABLE");
            assert.equal(await User.countDocuments({ email }), 0);
        } finally {
            process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
        }
    });

    test("Google's keys unreachable → 503 (not a crash), then recovers", async () => {
        setGoogleKeySource(async () => {
            throw new Error("network down (simulated)");
        });
        try {
            const res = await googleSignIn(newClient(), idToken());
            assert.equal(res.status, 503);
            assert.equal(res.body.code, "GOOGLE_UNAVAILABLE");
        } finally {
            setGoogleKeySource(googleKeySource);
        }
        const { email, sub } = await googleOnlyDonor();
        assert.equal((await googleSignIn(newClient(), idToken({ email, sub }))).status, 200, "works again once Google is reachable");
    });

    test("failed Google sign-ins count toward the login rate limit", async () => {
        const { createApp } = await import("../app.js");
        const app = createApp({ corsOrigin: FRONTEND_ORIGIN, rateLimits: { login: { windowMs: 60_000, limit: 2 } } });
        const limited = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        try {
            const c = createClient(`http://127.0.0.1:${limited.address().port}`);
            for (let i = 0; i < 2; i += 1) assert.equal((await googleSignIn(c, "not-a-token")).status, 401);
            assert.equal((await googleSignIn(c, "not-a-token")).status, 429);
        } finally {
            await new Promise((resolve) => limited.close(resolve));
        }
    });
});
