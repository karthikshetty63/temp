import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PASSWORD, createClient, donorData, login, registerActive, startTestServer } from "./helpers.js";

describe("security hardening (rate limits on)", () => {
    let server;
    before(async () => {
        server = await startTestServer({ rateLimits: { login: { windowMs: 60_000, limit: 3 }, register: { windowMs: 60_000, limit: 50 } } });
    });
    after(() => server.stop());

    test("security headers are present (helmet)", async () => {
        const res = await createClient(server.baseUrl).get("/api/test");
        assert.equal(res.headers.get("x-content-type-options"), "nosniff");
        assert.ok(res.headers.get("content-security-policy"));
        assert.ok(res.headers.get("x-frame-options") || /frame-ancestors/.test(res.headers.get("content-security-policy")));
        assert.equal(res.headers.get("x-powered-by"), null);
    });

    test("CORS only trusts the configured frontend origin", async () => {
        const res = await fetch(`${server.baseUrl}/api/test`, { headers: { Origin: "https://evil.example" } });
        assert.notEqual(res.headers.get("access-control-allow-origin"), "https://evil.example");
    });

    test("failed logins are rate-limited; successful ones are not counted", async () => {
        const c = createClient(server.baseUrl);
        const data = donorData();
        await registerActive(c, data);
        assert.equal((await login(c, data.email, PASSWORD, "donor")).status, 200, "success does not count");
        for (let i = 0; i < 3; i += 1) assert.equal((await login(c, data.email, "Wrong-pass-99", "donor")).status, 401);
        const blocked = await login(c, data.email, PASSWORD, "donor");
        assert.equal(blocked.status, 429);
        assert.match(blocked.body.message, /Too many failed login attempts/);
    });
});

describe("error handling", () => {
    let server;
    before(async () => {
        server = await startTestServer();
    });
    after(() => server.stop());

    test("malformed JSON → 400 JSON message (no stack trace)", async () => {
        const res = await createClient(server.baseUrl).post("/api/auth/login", { json: "{bad json" });
        assert.equal(res.status, 400);
        assert.equal(res.body.message, "Request body is not valid JSON.");
        assert.ok(!JSON.stringify(res.body).includes("at "), "no stack trace");
    });

    test("oversized JSON body → 413", async () => {
        const res = await createClient(server.baseUrl).post("/api/auth/register", { json: { ...donorData(), address: "x".repeat(200_000) } });
        assert.equal(res.status, 413);
    });

    test("unknown API route → 404 JSON", async () => {
        const res = await createClient(server.baseUrl).get("/api/does-not-exist");
        assert.equal(res.status, 404);
        assert.equal(res.body.message, "API route not found.");
    });

    test("register with a non-object body → 400", async () => {
        const res = await createClient(server.baseUrl).post("/api/auth/register", { json: "[1,2,3]" });
        assert.equal(res.status, 400);
    });
});
