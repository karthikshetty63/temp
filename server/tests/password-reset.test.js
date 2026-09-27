import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";
import process from "node:process";
import { FRONTEND_ORIGIN, PASSWORD, createClient, donorData, login, register, registerActive, schoolData, startTestServer } from "./helpers.js";

const { setEmailTransport } = await import("../services/emailService.js");

const NEW_PASSWORD = "N3w-secure-pass";
const GENERIC = "If an account exists for this email, a password reset link has been sent.";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// In-memory stand-in for the SMTP server: every "sent" email lands here.
const outbox = [];
let failSending = false;
const testTransport = {
    sendMail: async (message) => {
        if (failSending) throw new Error("SMTP unavailable (simulated)");
        outbox.push(message);
        return { messageId: `test-${outbox.length}` };
    },
};

let server;
let User;
const newClient = () => createClient(server.baseUrl);
const forgot = (client, email) => client.post("/api/auth/forgot-password", { json: { email } });
const reset = (client, token, password = NEW_PASSWORD, confirmPassword = password) =>
    client.post(`/api/auth/reset-password/${token}`, { json: { password, confirmPassword } });

/** Emails are sent after the response, so wait for the one addressed to `to`. */
const waitForEmail = async (to, { timeout = 2000 } = {}) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const email = outbox.find((m) => m.to === to);
        if (email) return email;
        await new Promise((r) => setTimeout(r, 20));
    }
    return null;
};
const tokenFrom = (email) => email.text.match(/\/reset-password\/([a-f0-9]{64})/)[1];
const resetFields = (email) => User.findOne({ email }).select("+passwordResetToken +passwordResetExpires +password").lean();

/** Register a donor, request a reset and return { data, token }. */
const requestReset = async () => {
    const c = newClient();
    const data = donorData();
    await registerActive(c, data);
    assert.equal((await forgot(c, data.email)).status, 200);
    const email = await waitForEmail(data.email);
    assert.ok(email, "reset email was sent");
    return { data, token: tokenFrom(email) };
};

before(async () => {
    process.env.EMAIL_FROM = "VIDYADAAN <no-reply@vidyadaan.test>";
    setEmailTransport(testTransport);
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
});
after(() => server.stop());
beforeEach(() => {
    outbox.length = 0;
    failSending = false;
});

describe("POST /api/auth/forgot-password", () => {
    test("registered email: generic 200, email with a reset link, only the token's hash stored", async () => {
        const c = newClient();
        const data = donorData();
        await register(c, data);

        const res = await forgot(c, `  ${data.email.toUpperCase()} `);
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { message: GENERIC });

        const email = await waitForEmail(data.email);
        assert.ok(email, "email was sent");
        assert.equal(email.from, process.env.EMAIL_FROM);
        assert.equal(email.subject, "Reset your VIDYADAAN password");
        assert.match(email.text, /expires in 15 minutes/);
        assert.match(email.text, /ignore this email/);
        const token = tokenFrom(email);
        assert.ok(email.text.includes(`${FRONTEND_ORIGIN}/reset-password/${token}`));
        assert.ok(email.html.includes(`${FRONTEND_ORIGIN}/reset-password/${token}`));

        const stored = await resetFields(data.email);
        assert.equal(stored.passwordResetToken, sha256(token), "SHA-256 of the token is stored");
        assert.notEqual(stored.passwordResetToken, token, "raw token is never stored");
        const minutesLeft = (stored.passwordResetExpires.getTime() - Date.now()) / 60000;
        assert.ok(minutesLeft > 14 && minutesLeft <= 15, `expires in ~15 minutes (got ${minutesLeft})`);
        assert.ok(!JSON.stringify(res.body).includes(token), "token is not in the response");
    });

    test("unknown email: identical response and no email", async () => {
        const c = newClient();
        const res = await forgot(c, "nobody.here@example.com");
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { message: GENERIC });
        assert.equal(await waitForEmail("nobody.here@example.com", { timeout: 200 }), null);
        assert.equal(outbox.length, 0);
    });

    test("empty, invalid and non-string emails → 400 (no operator injection)", async () => {
        const c = newClient();
        for (const email of ["", "   ", "not-an-email", { $gt: "" }, ["a@b.co"]]) {
            const res = await forgot(c, email);
            assert.equal(res.status, 400, JSON.stringify(email));
            assert.ok(res.body.errors?.email);
        }
        assert.equal((await c.post("/api/auth/forgot-password", { json: {} })).status, 400);
        assert.equal(outbox.length, 0);
    });

    test("repeat requests within a minute send only one email; the first link still works", async () => {
        const c = newClient();
        const data = donorData();
        await register(c, data);
        await forgot(c, data.email);
        const first = await waitForEmail(data.email);
        const again = await forgot(c, data.email);
        assert.deepEqual(again.body, { message: GENERIC });
        await new Promise((r) => setTimeout(r, 150));
        assert.equal(outbox.filter((m) => m.to === data.email).length, 1);
        assert.equal((await reset(c, tokenFrom(first))).status, 200);
    });

    test("email sending failure: still the generic response, and the unsent token is discarded", async () => {
        const c = newClient();
        const data = donorData();
        await register(c, data);
        failSending = true;
        const res = await forgot(c, data.email);
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { message: GENERIC });
        // The background send fails, then removes the token so the user can retry immediately.
        let stored;
        for (let i = 0; i < 50; i += 1) {
            stored = await resetFields(data.email);
            if (!stored.passwordResetToken) break;
            await new Promise((r) => setTimeout(r, 20));
        }
        assert.equal(stored.passwordResetToken, undefined);
        failSending = false;
        await forgot(c, data.email);
        assert.ok(await waitForEmail(data.email), "retry works without waiting for the cooldown");
    });

    test("email not configured: 503 for every address (no enumeration)", async () => {
        const c = newClient();
        const data = donorData();
        await register(c, data);
        const from = process.env.EMAIL_FROM;
        delete process.env.EMAIL_FROM;
        try {
            const known = await forgot(c, data.email);
            const unknown = await forgot(c, "unknown.person@example.com");
            for (const res of [known, unknown]) {
                assert.equal(res.status, 503);
                assert.equal(res.body.code, "EMAIL_UNAVAILABLE");
            }
            assert.deepEqual(known.body, unknown.body);
        } finally {
            process.env.EMAIL_FROM = from;
        }
    });
});

describe("POST /api/auth/reset-password/:token", () => {
    test("valid token: password changes, old password fails, new works, token cleared, sessions revoked", async () => {
        const { data, token } = await requestReset();

        // An existing session from before the reset.
        const oldSession = newClient();
        assert.equal((await login(oldSession, data.email, PASSWORD, "donor")).status, 200);
        assert.equal((await oldSession.get("/api/auth/me")).status, 200);

        const res = await reset(newClient(), token);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.match(res.body.message, /password has been reset/);
        assert.equal(res.setCookie, "", "reset does not log the user in");
        for (const secret of [token, sha256(token)]) assert.ok(!JSON.stringify(res.body).includes(secret));

        const stored = await resetFields(data.email);
        assert.equal(stored.passwordResetToken, undefined);
        assert.equal(stored.passwordResetExpires, undefined);
        assert.match(stored.password, /^\$2[aby]\$/, "stored as a bcrypt hash");

        assert.equal((await login(newClient(), data.email, PASSWORD, "donor")).status, 401, "old password fails");
        assert.equal((await login(newClient(), data.email, NEW_PASSWORD, "donor")).status, 200, "new password works (hashed exactly once)");
        assert.equal((await oldSession.get("/api/auth/me")).status, 401, "sessions from before the reset are signed out");
    });

    test("token cannot be reused", async () => {
        const { data, token } = await requestReset();
        assert.equal((await reset(newClient(), token)).status, 200);
        const again = await reset(newClient(), token, "An0ther-password");
        assert.equal(again.status, 400);
        assert.equal(again.body.code, "INVALID_RESET_TOKEN");
        assert.equal((await login(newClient(), data.email, NEW_PASSWORD, "donor")).status, 200, "second attempt changed nothing");
    });

    test("the same link submitted twice at once succeeds only once", async () => {
        const { token } = await requestReset();
        const results = await Promise.all([reset(newClient(), token), reset(newClient(), token, "An0ther-password")]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
    });

    test("invalid tokens → the same safe 400", async () => {
        const c = newClient();
        for (const token of ["a".repeat(64), "not-a-token", "A".repeat(64), `${"b".repeat(64)}0`]) {
            const res = await reset(c, token);
            assert.equal(res.status, 400, token);
            assert.equal(res.body.code, "INVALID_RESET_TOKEN");
            assert.equal(res.body.message, "This password reset link is invalid or has expired. Please request a new one.");
        }
    });

    test("expired token is rejected and the password is unchanged", async () => {
        const { data, token } = await requestReset();
        await User.updateOne({ email: data.email }, { $set: { passwordResetExpires: new Date(Date.now() - 1000) } });
        const res = await reset(newClient(), token);
        assert.equal(res.status, 400);
        assert.equal(res.body.code, "INVALID_RESET_TOKEN");
        assert.equal((await login(newClient(), data.email, PASSWORD, "donor")).status, 200, "old password still works");
    });

    test("password mismatch, weak or missing password → 400 and the token stays usable", async () => {
        const { token } = await requestReset();
        const c = newClient();

        const mismatch = await reset(c, token, NEW_PASSWORD, "Different-pass-1");
        assert.equal(mismatch.status, 400);
        assert.equal(mismatch.body.errors.confirmPassword, "Passwords do not match.");

        const weak = await reset(c, token, "short");
        assert.equal(weak.status, 400);
        assert.equal(weak.body.errors.password, "Password must be at least 8 characters.");

        const tooLong = await reset(c, token, "x".repeat(73));
        assert.equal(tooLong.status, 400);
        assert.match(tooLong.body.errors.password, /too long/);

        const missing = await c.post(`/api/auth/reset-password/${token}`, { json: {} });
        assert.equal(missing.status, 400);
        assert.ok(missing.body.errors.password && missing.body.errors.confirmPassword);

        const notStrings = await c.post(`/api/auth/reset-password/${token}`, { json: { password: { $gt: "" }, confirmPassword: [1] } });
        assert.equal(notStrings.status, 400);

        assert.equal((await reset(c, token)).status, 200, "none of the failed attempts used up the token");
    });

    test("a pending school can reset its password but still cannot sign in until approved", async () => {
        const c = newClient();
        const data = schoolData();
        await register(c, data);
        await forgot(c, data.email);
        const token = tokenFrom(await waitForEmail(data.email));
        assert.equal((await reset(c, token)).status, 200);
        const res = await login(newClient(), data.email, NEW_PASSWORD, "school");
        assert.equal(res.status, 403);
        assert.equal(res.body.code, "ACCOUNT_PENDING");
    });

    test("reset fields never appear in user JSON", async () => {
        const { data } = await requestReset();
        const user = await User.findOne({ email: data.email }).select("+passwordResetToken +passwordResetExpires");
        const json = JSON.stringify(user.toJSON());
        assert.ok(!json.includes("passwordReset"));
    });
});

describe("password reset rate limits", () => {
    let limited;
    before(async () => {
        // A second app on the same in-memory database, with tiny limits.
        const { createApp } = await import("../app.js");
        const app = createApp({ corsOrigin: FRONTEND_ORIGIN, rateLimits: { forgotPassword: { windowMs: 60_000, limit: 2 }, resetPassword: { windowMs: 60_000, limit: 2 } } });
        limited = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
    });
    after(() => new Promise((resolve) => limited.close(resolve)));

    test("forgot-password and reset-password are limited per IP", async () => {
        const c = createClient(`http://127.0.0.1:${limited.address().port}`);
        for (let i = 0; i < 2; i += 1) assert.equal((await forgot(c, "someone@example.com")).status, 200);
        const blocked = await forgot(c, "someone@example.com");
        assert.equal(blocked.status, 429);
        assert.match(blocked.body.message, /Too many password reset requests/);

        for (let i = 0; i < 2; i += 1) assert.equal((await reset(c, "c".repeat(64))).status, 400);
        assert.equal((await reset(c, "c".repeat(64))).status, 429);
    });
});
