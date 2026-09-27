import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import jwt from "jsonwebtoken";
import process from "node:process";
import { PASSWORD, createClient, donorData, registerActive, startTestServer } from "./helpers.js";

const DAY = 24 * 60 * 60;

let server;
let User;
let RevokedSession;
const newClient = () => createClient(server.baseUrl);
const tokenOf = (cookie) => jwt.decode(cookie.replace(/^vidyaadaan_auth=/, "").split(";")[0]);

const signIn = async (email, remember) => {
    const c = newClient();
    const res = await c.post("/api/auth/login", { json: { email, password: PASSWORD, role: "donor", remember } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return { c, res };
};

const newDonor = async () => {
    const data = donorData();
    await registerActive(newClient(), data);
    return data.email;
};

/** A session cookie exactly as the server would have issued it `ageSeconds` ago. */
const agedCookie = async (email, { remember, ageSeconds, sid = randomUUID(), legacy = false }) => {
    const user = await User.findOne({ email });
    const iat = Math.floor(Date.now() / 1000) - ageSeconds;
    const payload = { userId: user._id.toString(), role: user.role, tv: user.tokenVersion ?? 0, iat, exp: iat + (remember ? 30 * DAY : DAY) };
    // Sessions issued before this change had neither a session id nor the remember flag.
    if (!legacy) Object.assign(payload, { sid, rm: remember });
    return `vidyaadaan_auth=${jwt.sign(payload, process.env.JWT_SECRET, { algorithm: "HS256" })}`;
};

before(async () => {
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
    RevokedSession = (await import("../models/RevokedSession.js")).default;
});
after(() => server.stop());

describe("Remember me", () => {
    test("ticked: 30-day cookie; unticked: ends with the browser (1 day max); both have a session id", async () => {
        const email = await newDonor();

        const remembered = (await signIn(email, true)).res;
        assert.match(remembered.setCookie, /Max-Age=2592000/);
        const r = tokenOf(remembered.setCookie);
        assert.equal(r.rm, true);
        assert.equal(r.exp - r.iat, 30 * DAY);
        assert.match(r.sid, /^[0-9a-f-]{36}$/);

        const normal = (await signIn(email, false)).res;
        assert.doesNotMatch(normal.setCookie, /Max-Age|Expires/i);
        const n = tokenOf(normal.setCookie);
        assert.equal(n.rm, false);
        assert.equal(n.exp - n.iat, DAY);
        assert.notEqual(n.sid, r.sid, "every sign-in is its own session");
    });
});

describe("Sign out", () => {
    test("ends only this device; a copied cookie from it stops working too", async () => {
        const email = await newDonor();
        const laptop = await signIn(email, true);
        const phone = await signIn(email, false);
        const phoneCookie = phone.c.cookie;

        const out = await phone.c.post("/api/auth/logout");
        assert.equal(out.status, 200);
        assert.match(out.setCookie, /Max-Age=0/);
        assert.equal((await phone.c.get("/api/auth/me")).status, 401, "phone signed out");
        const thief = newClient();
        thief.cookie = phoneCookie;
        assert.equal((await thief.get("/api/auth/me")).status, 401, "copied phone cookie rejected");
        assert.equal((await laptop.c.get("/api/auth/me")).status, 200, "laptop still signed in");

        const record = await RevokedSession.findOne({ sid: tokenOf(phoneCookie).sid }).lean();
        assert.equal(record.expiresAt.getTime(), tokenOf(phoneCookie).exp * 1000, "record lives only as long as the session could");
    });

    test("ended-session records delete themselves (TTL index)", async () => {
        const indexes = await RevokedSession.collection.indexes();
        assert.ok(indexes.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0), JSON.stringify(indexes));
    });

    test("a session from before this change (no id) signs out everywhere, as before", async () => {
        const email = await newDonor();
        const other = await signIn(email, true);
        const old = newClient();
        old.cookie = await agedCookie(email, { remember: false, ageSeconds: 60, legacy: true });
        assert.equal((await old.get("/api/auth/me")).status, 200);
        assert.equal((await old.post("/api/auth/logout")).status, 200);
        assert.equal((await other.c.get("/api/auth/me")).status, 401);
    });
});

describe("Staying signed in while active (sliding expiry)", () => {
    test("a fresh session is not re-issued on every request", async () => {
        const email = await newDonor();
        const { c } = await signIn(email, true);
        const me = await c.get("/api/auth/me");
        assert.equal(me.status, 200);
        assert.equal(me.setCookie, "");
    });

    test("a remembered session a day old gets a fresh 30 days, keeping its session id", async () => {
        const email = await newDonor();
        const sid = randomUUID();
        const c = newClient();
        c.cookie = await agedCookie(email, { remember: true, ageSeconds: DAY + 3600, sid });
        const oldCookie = c.cookie;

        const me = await c.get("/api/auth/me");
        assert.equal(me.status, 200);
        assert.match(me.setCookie, /Max-Age=2592000/);
        const renewed = tokenOf(me.setCookie);
        assert.equal(renewed.sid, sid);
        assert.equal(renewed.rm, true);
        assert.ok(renewed.exp - Math.floor(Date.now() / 1000) > 30 * DAY - 60, "30 days from now");

        // Signing out ends the whole session, including the cookie from before the renewal.
        await c.post("/api/auth/logout");
        const thief = newClient();
        thief.cookie = oldCookie;
        assert.equal((await thief.get("/api/auth/me")).status, 401);
    });

    test("a normal session is renewed hourly and stays a browser-session cookie", async () => {
        const email = await newDonor();
        const young = newClient();
        young.cookie = await agedCookie(email, { remember: false, ageSeconds: 30 * 60 });
        assert.equal((await young.get("/api/auth/me")).setCookie, "", "30 minutes old: not yet");

        const c = newClient();
        c.cookie = await agedCookie(email, { remember: false, ageSeconds: 2 * 3600 });
        const me = await c.get("/api/auth/me");
        assert.equal(me.status, 200);
        assert.match(me.setCookie, /^vidyaadaan_auth=/);
        assert.doesNotMatch(me.setCookie, /Max-Age|Expires/i);
        assert.equal(tokenOf(me.setCookie).rm, false);
    });

    test("an older remembered session (no flag) is still treated as remembered when renewed", async () => {
        const email = await newDonor();
        const c = newClient();
        c.cookie = await agedCookie(email, { remember: true, ageSeconds: DAY + 3600, legacy: true });
        const me = await c.get("/api/auth/me");
        assert.equal(me.status, 200);
        assert.match(me.setCookie, /Max-Age=2592000/);
        const renewed = tokenOf(me.setCookie);
        assert.equal(renewed.rm, true);
        assert.ok(renewed.sid, "upgraded to a session with an id");
    });

    test("security events still end every session, renewed or not", async () => {
        const email = await newDonor();
        const a = await signIn(email, true);
        const b = await signIn(email, false);
        await User.updateOne({ email }, { $inc: { tokenVersion: 1 } }); // what password reset / linking Google / rejection do
        assert.equal((await a.c.get("/api/auth/me")).status, 401);
        assert.equal((await b.c.get("/api/auth/me")).status, 401);
    });
});
