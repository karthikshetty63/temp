import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import jwt from "jsonwebtoken";
import { Buffer } from "node:buffer";
import process from "node:process";
import { PASSWORD, createAdmin, createClient, donorData, login, ngoData, register, registerActive, schoolData, startTestServer } from "./helpers.js";

let server;
let User;

const newClient = () => createClient(server.baseUrl);

const approve = async (email) => {
    await User.updateOne({ email }, { $set: { accountStatus: "active" } });
};

before(async () => {
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
});
after(() => server.stop());

describe("login", () => {
    test("valid donor login: 200, safe user, httpOnly cookie", async () => {
        const c = newClient();
        const data = donorData();
        await registerActive(c, data);
        const res = await login(c, data.email.toUpperCase(), PASSWORD, "donor");
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual(Object.keys(res.body.user).sort(), ["accountStatus", "email", "id", "name", "role"]);
        assert.equal(res.body.user.role, "donor");
        assert.match(res.setCookie, /^vidyaadaan_auth=[^;]+;/);
        assert.match(res.setCookie, /HttpOnly/i);
        assert.match(res.setCookie, /SameSite=Lax/i);
        assert.match(res.setCookie, /Path=\//i);
        assert.doesNotMatch(res.setCookie, /Max-Age/i, "without remember-me it is a session cookie");
        assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
        assert.equal(res.headers.get("access-control-allow-credentials"), "true");
    });

    test("remember me sets a 30-day cookie", async () => {
        const c = newClient();
        const data = donorData();
        await registerActive(c, data);
        const res = await c.post("/api/auth/login", { json: { email: data.email, password: PASSWORD, role: "donor", remember: true } });
        assert.equal(res.status, 200);
        assert.match(res.setCookie, /Max-Age=2592000/);
    });

    test("wrong password and unknown email give the same generic 401", async () => {
        const c = newClient();
        const data = donorData();
        await registerActive(c, data);
        const wrong = await login(c, data.email, "Wrong-password-1", "donor");
        const unknown = await login(c, "nobody@example.com", PASSWORD, "donor");
        for (const res of [wrong, unknown]) {
            assert.equal(res.status, 401);
            assert.equal(res.body.message, "Invalid email or password.");
            assert.equal(res.setCookie, "");
        }
    });

    test("empty input → 400", async () => {
        const c = newClient();
        assert.equal((await c.post("/api/auth/login", { json: { email: "", password: "" } })).status, 400);
        assert.equal((await c.post("/api/auth/login", { json: {} })).status, 400);
    });

    test("operator injection in login is rejected", async () => {
        const c = newClient();
        const res = await c.post("/api/auth/login", { json: { email: { $ne: null }, password: { $ne: null } } });
        assert.equal(res.status, 400);
        assert.equal(res.setCookie, "");
    });

    test("pending school: 403 ACCOUNT_PENDING, no cookie", async () => {
        const c = newClient();
        const data = schoolData();
        await register(c, data);
        const res = await login(c, data.email, PASSWORD, "school");
        assert.equal(res.status, 403);
        assert.equal(res.body.code, "ACCOUNT_PENDING");
        assert.equal(res.setCookie, "");
    });

    test("pending NGO: 403 ACCOUNT_PENDING", async () => {
        const c = newClient();
        const data = ngoData();
        await register(c, data);
        const res = await login(c, data.email, PASSWORD, "ngo");
        assert.equal(res.status, 403);
        assert.equal(res.body.code, "ACCOUNT_PENDING");
    });

    test("rejected account: 403 ACCOUNT_REJECTED with reason", async () => {
        const c = newClient();
        const data = ngoData();
        await register(c, data);
        await User.updateOne({ email: data.email }, { $set: { accountStatus: "rejected", rejectionReason: "PAN does not match certificate." } });
        const res = await login(c, data.email, PASSWORD, "ngo");
        assert.equal(res.status, 403);
        assert.equal(res.body.code, "ACCOUNT_REJECTED");
        assert.equal(res.body.reason, "PAN does not match certificate.");
        assert.equal(res.setCookie, "");
    });

    test("pending account with WRONG password still gets the generic 401 (status not revealed)", async () => {
        const c = newClient();
        const data = schoolData();
        await register(c, data);
        const res = await login(c, data.email, "Wrong-password-1", "school");
        assert.equal(res.status, 401);
    });

    test("approved school logs in by email AND by UDISE code", async () => {
        const data = schoolData();
        await register(newClient(), data);
        await approve(data.email);
        const byEmail = await login(newClient(), data.email, PASSWORD, "school");
        assert.equal(byEmail.status, 200, JSON.stringify(byEmail.body));
        const byUdise = await login(newClient(), data.udise, PASSWORD, "school");
        assert.equal(byUdise.status, 200, JSON.stringify(byUdise.body));
        assert.equal(byUdise.body.user.email, data.email);
    });

    test("UDISE login only works on the school portal", async () => {
        const data = schoolData();
        await register(newClient(), data);
        await approve(data.email);
        const res = await login(newClient(), data.udise, PASSWORD, "donor");
        assert.equal(res.status, 400);
    });

    test("approved NGO logs in", async () => {
        const data = ngoData();
        await register(newClient(), data);
        await approve(data.email);
        const res = await login(newClient(), data.email, PASSWORD, "ngo");
        assert.equal(res.status, 200);
        assert.equal(res.body.user.role, "ngo");
    });

    test("admin logs in on the admin portal", async () => {
        const admin = await createAdmin();
        const res = await login(newClient(), admin.email, PASSWORD, "admin");
        assert.equal(res.status, 200);
        assert.equal(res.body.user.role, "admin");
    });

    test("wrong portal: 403 WRONG_PORTAL and NO cookie", async () => {
        const data = donorData();
        await register(newClient(), data);
        for (const portal of ["school", "ngo", "admin"]) {
            const res = await login(newClient(), data.email, PASSWORD, portal);
            assert.equal(res.status, 403, portal);
            assert.equal(res.body.code, "WRONG_PORTAL");
            assert.equal(res.setCookie, "", `no session may be created on the ${portal} portal`);
        }
    });

    test("unknown portal role → 400", async () => {
        const res = await login(newClient(), "a@b.co", PASSWORD, "superadmin");
        assert.equal(res.status, 400);
    });
});

describe("session", () => {
    test("/me without cookie → 401", async () => {
        const res = await newClient().get("/api/auth/me");
        assert.equal(res.status, 401);
    });

    test("/me with forged tokens → 401", async () => {
        const data = donorData();
        await register(newClient(), data);
        const user = await User.findOne({ email: data.email });
        const forged = [
            "not.a.jwt",
            jwt.sign({ userId: user._id.toString(), role: "donor", tv: 0 }, "wrong-secret"),
            jwt.sign({ userId: user._id.toString(), role: "admin", tv: 0 }, process.env.JWT_SECRET), // role escalation
            jwt.sign({ userId: user._id.toString(), role: "donor", tv: 0 }, process.env.JWT_SECRET, { expiresIn: -10 }), // expired
            // alg=none token, built by hand
            `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ userId: user._id.toString(), role: "donor", tv: 0 })).toString("base64url")}.`,
        ];
        for (const token of forged) {
            const c = newClient();
            c.cookie = `vidyaadaan_auth=${token}`;
            assert.equal((await c.get("/api/auth/me")).status, 401, token.slice(0, 20));
        }
    });

    test("login → /me → logout → /me, and the old token is revoked", async () => {
        const c = newClient();
        const data = donorData();
        await registerActive(c, data);
        await login(c, data.email, PASSWORD, "donor");
        const oldCookie = c.cookie;

        const me = await c.get("/api/auth/me");
        assert.equal(me.status, 200);
        assert.equal(me.body.user.email, data.email);

        const out = await c.post("/api/auth/logout");
        assert.equal(out.status, 200);
        assert.match(out.setCookie, /^vidyaadaan_auth=;/);
        assert.match(out.setCookie, /Max-Age=0/);
        assert.equal(c.cookie, "");

        assert.equal((await c.get("/api/auth/me")).status, 401);

        // Someone who copied the old cookie before logout can no longer use it.
        const thief = newClient();
        thief.cookie = oldCookie;
        assert.equal((await thief.get("/api/auth/me")).status, 401);
    });

    test("logout without / with an invalid session still succeeds and clears the cookie", async () => {
        const c = newClient();
        assert.equal((await c.post("/api/auth/logout")).status, 200);
        c.cookie = "vidyaadaan_auth=garbage";
        const res = await c.post("/api/auth/logout");
        assert.equal(res.status, 200);
        assert.match(res.setCookie, /Max-Age=0/);
    });

    test("an account rejected after login loses its session immediately", async () => {
        const c = newClient();
        const data = schoolData();
        await register(c, data);
        await approve(data.email);
        await login(c, data.email, PASSWORD, "school");
        assert.equal((await c.get("/api/auth/me")).status, 200);
        await User.updateOne({ email: data.email }, { $set: { accountStatus: "rejected" } });
        assert.equal((await c.get("/api/auth/me")).status, 401);
    });
});

describe("authorization", () => {
    const loggedIn = async (factory, role) => {
        const c = newClient();
        const data = factory();
        await registerActive(c, data);
        assert.equal((await login(c, data.email, PASSWORD, role)).status, 200);
        return c;
    };

    test("unauthenticated user cannot reach protected endpoints", async () => {
        const c = newClient();
        for (const path of ["/api/admin/accounts", "/api/profile/me", "/api/files/64b000000000000000000000"]) {
            assert.equal((await c.get(path)).status, 401, path);
        }
    });

    test("donor, school and NGO get 403 on admin endpoints", async () => {
        for (const [factory, role] of [[donorData, "donor"], [schoolData, "school"], [ngoData, "ngo"]]) {
            const c = await loggedIn(factory, role);
            assert.equal((await c.get("/api/admin/accounts")).status, 403, role);
            assert.equal((await c.patch("/api/admin/accounts/64b000000000000000000000/approve")).status, 403, role);
        }
    });

    test("role cannot be escalated through query/body/URL", async () => {
        const c = await loggedIn(donorData, "donor");
        assert.equal((await c.get("/api/admin/accounts?role=admin")).status, 403);
        assert.equal((await c.patch("/api/admin/accounts/64b000000000000000000000/approve", { json: { role: "admin" } })).status, 403);
        const me = await c.get("/api/auth/me?role=admin");
        assert.equal(me.body.user.role, "donor");
    });

    test("school-only endpoints reject donor and NGO (e.g. school photo)", async () => {
        for (const [factory, role] of [[donorData, "donor"], [ngoData, "ngo"]]) {
            const c = await loggedIn(factory, role);
            assert.equal((await c.delete("/api/profile/photo")).status, 403, role);
        }
    });
});
