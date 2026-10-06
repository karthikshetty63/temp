import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import process from "node:process";
import { after, before, describe, test } from "node:test";
import { PASSWORD, createAdmin, createClient, donorData, login, ngoData, paymentForm, registerActive, schoolData, startTestServer } from "./helpers.js";
import { ONLINE_PAYMENT_METHOD, validateOnlinePayment } from "../../shared/paymentRules.js";

// Razorpay test-mode keys for this run only. The secret is random: nothing here is a real credential,
// and no request ever reaches Razorpay (the fake below answers instead).
const KEY_ID = "rzp_test_VidyadaanNgoTests";
const KEY_SECRET = randomBytes(24).toString("hex");
process.env.RAZORPAY_KEY_ID = KEY_ID;
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;

let server;
let Project;
let FundingPayment;
let admin;
const newClient = () => createClient(server.baseUrl);
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
let n = 0;
let ref = 0;

// ─── A fake Razorpay Orders API ──────────────────────────────────────────────
const razorpay = { requests: [], failWith: null };
const fakeRazorpay = async (url, init) => {
    const body = JSON.parse(init.body);
    razorpay.requests.push({ url, headers: init.headers, body });
    if (razorpay.failWith === "network") throw new TypeError("fetch failed");
    return Response.json({ id: `order_${randomBytes(7).toString("hex")}`, entity: "order", amount: body.amount, currency: body.currency, receipt: body.receipt, status: "created" });
};
/** What Razorpay Checkout hands the browser after paying `orderId` (HMAC-SHA256 of "<order>|<payment>"). */
const checkoutSuccess = (orderId, paymentId = `pay_${randomBytes(7).toString("hex")}`, secret = KEY_SECRET) => ({
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const signedIn = async (factory, role, overrides) => {
    const data = factory(overrides);
    await registerActive(newClient(), data);
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, role)).status, 200);
    return { c, data };
};
/** An approved ₹1,00,000 need (five parts of ₹20,000) and an NGO that has committed to `parts`. */
const committedNeed = async (parts = [1, 2]) => {
    const school = await signedIn(schoolData, "school");
    const created = await school.c.post("/api/school/projects", {
        json: {
            title: `Science lab equipment ${(n += 1)}`, category: "Science Laboratory", priority: "High", budget: "100000", studentsBenefited: "200",
            problem: "The school has no lab equipment; 200 students learn science only from the textbook.", expectedCompletion: inDays(90),
        },
    });
    const project = created.body.project;
    assert.equal((await admin.patch(`/api/admin/projects/${project.id}/approve`)).status, 200);
    const ngo = await signedIn(ngoData, "ngo", { ngoName: "Vidya Seva Trust" });
    assert.equal((await ngo.c.post(`/api/projects/${project.id}/commitments`, { json: { parts } })).status, 201);
    return { school, ngo, project };
};
const startOnline = (c, projectId, body) => c.post(`/api/projects/${projectId}/payments/online`, { json: body });
const verify = (c, paymentId, values) => c.post(`/api/projects/payments/${paymentId}/verify`, { json: values });
const raisedOf = async (projectId) => (await Project.findById(projectId).lean()).raised;
const myParts = async (c, projectId) => (await c.get("/api/projects/committed")).body.projects.find((p) => p.id === projectId).parts.filter((p) => p.takenBy === "you");
const payDirect = (c, projectId, parts) =>
    c.post(`/api/projects/${projectId}/payments`, {
        form: paymentForm({ parts, method: "Bank transfer (NEFT/RTGS/IMPS)", reference: `UTR${String((ref += 1)).padStart(9, "0")}`, paidOn: inDays(0), note: "" }),
    });

before(async () => {
    server = await startTestServer();
    Project = (await import("../models/Project.js")).default;
    FundingPayment = (await import("../models/FundingPayment.js")).default;
    await FundingPayment.init(); // unique indexes in place
    (await import("../services/razorpay.js")).setRazorpayFetch(fakeRazorpay);
    const credentials = await createAdmin();
    admin = newClient();
    assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
});
after(() => server.stop());

describe("online payment rules", () => {
    test("only the parts may be sent", () => {
        assert.deepEqual(validateOnlinePayment({ parts: [2, 1] }), { errors: {}, values: { parts: [1, 2] } });
        assert.deepEqual(validateOnlinePayment({ parts: "1,3" }).values, { parts: [1, 3] });
        for (const bad of [{}, { parts: [] }, { parts: [0] }, { parts: [6] }, { parts: [1, 1] }, { parts: "a" }]) assert.ok(validateOnlinePayment(bad).errors.parts, JSON.stringify(bad));
        assert.deepEqual(Object.keys(validateOnlinePayment({ parts: [1], amount: 1, status: "ACCEPTED" }).errors).sort(), ["amount", "status"]);
    });
});

describe("an NGO pays its parts online through Razorpay", () => {
    test("starting a payment: the server prices the parts and creates the order; nothing counts yet", async () => {
        const { ngo, project } = await committedNeed([1, 2]);
        const before = razorpay.requests.length;
        const res = await startOnline(ngo.c, project.id, { parts: [2, 1] });
        assert.equal(res.status, 201);
        assert.equal(razorpay.requests.length, before + 1);
        const sent = razorpay.requests.at(-1);
        assert.deepEqual({ amount: sent.body.amount, currency: sent.body.currency, receipt: sent.body.receipt }, { amount: 40000 * 100, currency: "INR", receipt: res.body.payment.id });
        assert.equal(res.body.payment.amount, 40000);
        assert.deepEqual(res.body.payment.parts, [1, 2]);
        assert.equal(res.body.checkout.keyId, KEY_ID);
        assert.match(res.body.checkout.orderId, /^order_/);
        assert.ok(!JSON.stringify(res.body).includes(KEY_SECRET), "the key secret was sent to the browser");

        assert.equal(await raisedOf(project.id), 0);
        assert.ok((await myParts(ngo.c, project.id)).every((p) => p.status === "AWAITING_PAYMENT"), "parts locked before payment");
        assert.equal((await ngo.c.get("/api/projects/payments")).body.payments.length, 0, "an unpaid order is listed");
    });

    test("a verified payment marks the parts paid and adds to 'raised' once; both sides see it as online", async () => {
        const { ngo, school, project } = await committedNeed([1, 2]);
        const started = (await startOnline(ngo.c, project.id, { parts: [1, 2] })).body;
        const values = checkoutSuccess(started.checkout.orderId);

        const res = await verify(ngo.c, started.payment.id, values);
        assert.equal(res.status, 200);
        assert.match(res.body.message, /confirmed/);
        assert.equal(res.body.payment.status, "ACCEPTED");
        assert.equal(res.body.payment.channel, "ONLINE");
        assert.equal(res.body.payment.method, ONLINE_PAYMENT_METHOD);
        assert.equal(res.body.payment.reference, values.razorpay_payment_id);
        assert.equal(res.body.payment.proof, null);
        assert.equal(res.body.payment.mode, "test");
        assert.equal(await raisedOf(project.id), 40000);
        assert.ok((await myParts(ngo.c, project.id)).every((p) => p.status === "RECEIVED"));

        // The same values again (a retry): still confirmed, still counted once.
        assert.equal((await verify(ngo.c, started.payment.id, values)).status, 200);
        assert.equal(await raisedOf(project.id), 40000);

        const history = (await ngo.c.get("/api/projects/payments")).body.payments;
        assert.equal(history.length, 1);
        assert.equal(history[0].channel, "ONLINE");
        const schoolView = (await school.c.get("/api/school/payments")).body.payments;
        assert.equal(schoolView.length, 1);
        assert.equal(schoolView[0].status, "ACCEPTED");
        assert.equal(schoolView[0].proof, null);
        assert.equal(schoolView[0].ngo.name, "Vidya Seva Trust");
        // Nothing for the school to accept or reject.
        assert.equal((await school.c.patch(`/api/school/payments/${schoolView[0].id}/accept`)).status, 409);
        // Paid parts can't be paid again, online or directly.
        assert.equal((await startOnline(ngo.c, project.id, { parts: [1] })).status, 400);
        assert.equal((await payDirect(ngo.c, project.id, [1])).status, 400);
    });

    test("forged, mismatched or someone else's payment details are refused and count nothing", async () => {
        const { ngo, project } = await committedNeed([1]);
        const started = (await startOnline(ngo.c, project.id, { parts: [1] })).body;
        const forged = checkoutSuccess(started.checkout.orderId, "pay_Forged0001", "not-the-secret");
        assert.equal((await verify(ngo.c, started.payment.id, forged)).status, 400);
        const otherOrder = checkoutSuccess("order_SomethingElse1");
        assert.equal((await verify(ngo.c, started.payment.id, otherOrder)).status, 400);
        assert.equal((await verify(ngo.c, started.payment.id, { razorpay_order_id: started.checkout.orderId })).status, 400);

        const stranger = await signedIn(ngoData, "ngo");
        assert.equal((await verify(stranger.c, started.payment.id, checkoutSuccess(started.checkout.orderId))).status, 404);
        assert.equal((await verify(ngo.c, "0123456789abcdef01234567", checkoutSuccess(started.checkout.orderId))).status, 404);
        assert.equal(await raisedOf(project.id), 0);
        assert.equal((await FundingPayment.findById(started.payment.id).lean()).status, "CREATED");
    });

    test("the parts must be the NGO's own unpaid parts; nothing else may be sent", async () => {
        const { ngo, project } = await committedNeed([1, 2]);
        const before = razorpay.requests.length;
        assert.match((await startOnline(ngo.c, project.id, { parts: [3] })).body.errors.parts, /isn't one of your parts/);
        assert.equal((await startOnline(ngo.c, project.id, { parts: [1], amount: 1 })).status, 400, "an amount from the browser");
        assert.equal((await startOnline(ngo.c, project.id, {})).status, 400);
        assert.equal((await startOnline(ngo.c, "not-an-id", { parts: [1] })).status, 404);
        // A direct payment waiting for the school blocks paying the same part online.
        assert.equal((await payDirect(ngo.c, project.id, [1])).status, 201);
        assert.match((await startOnline(ngo.c, project.id, { parts: [1] })).body.errors.parts, /already has a payment/);
        assert.equal(razorpay.requests.length, before, "an order was requested for a refused payment");
    });

    test("parts paid another way while the NGO was in Razorpay: the money is recorded as REFUND_DUE, never counted twice", async () => {
        const { ngo, school, project } = await committedNeed([1]);
        const started = (await startOnline(ngo.c, project.id, { parts: [1] })).body;
        // Meanwhile the same part is paid directly and the school accepts it.
        const direct = await payDirect(ngo.c, project.id, [1]);
        assert.equal(direct.status, 201);
        assert.equal((await school.c.patch(`/api/school/payments/${direct.body.payment.id}/accept`)).status, 200);
        assert.equal(await raisedOf(project.id), 20000);

        const res = await verify(ngo.c, started.payment.id, checkoutSuccess(started.checkout.orderId));
        assert.equal(res.status, 409);
        assert.equal(res.body.code, "REFUND_DUE");
        assert.match(res.body.message, /refund/);
        assert.equal(await raisedOf(project.id), 20000, "counted twice");
        const history = (await ngo.c.get("/api/projects/payments")).body.payments;
        assert.ok(history.some((p) => p.status === "REFUND_DUE"), "the NGO can't see the refund due");
        assert.ok((await school.c.get("/api/school/payments")).body.payments.every((p) => p.status !== "REFUND_DUE"));
    });

    test("Razorpay unreachable: a clear error and no payment record", async () => {
        const { ngo, project } = await committedNeed([1]);
        const count = await FundingPayment.countDocuments();
        razorpay.failWith = "network";
        try {
            const res = await startOnline(ngo.c, project.id, { parts: [1] });
            assert.equal(res.status, 502);
        } finally {
            razorpay.failWith = null;
        }
        assert.equal(await FundingPayment.countDocuments(), count);
    });

    test("only NGOs pay online; without test keys online payment is off and the direct way still works", async () => {
        const { ngo, project } = await committedNeed([1, 2]);
        assert.equal((await startOnline(newClient(), project.id, { parts: [1] })).status, 401);
        const donor = await signedIn(donorData, "donor");
        assert.equal((await startOnline(donor.c, project.id, { parts: [1] })).status, 403);
        const school = await signedIn(schoolData, "school");
        assert.equal((await startOnline(school.c, project.id, { parts: [1] })).status, 403);

        const saved = process.env.RAZORPAY_KEY_SECRET;
        delete process.env.RAZORPAY_KEY_SECRET;
        try {
            const res = await startOnline(ngo.c, project.id, { parts: [1] });
            assert.equal(res.status, 503);
            assert.match(res.body.message, /pay the school directly/);
            assert.equal((await payDirect(ngo.c, project.id, [2])).status, 201);
        } finally {
            process.env.RAZORPAY_KEY_SECRET = saved;
        }
    });
});
