import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHmac, randomBytes } from "node:crypto";
import process from "node:process";
import { after, before, describe, test } from "node:test";
import { FRONTEND_ORIGIN, PASSWORD, createAdmin, createClient, donorData, login, ngoData, paymentForm, registerActive, schoolData, startTestServer } from "./helpers.js";
import { getUnexpectedDonationFields, validateDonation, validateDonationAmount } from "../../shared/donationRules.js";

// Razorpay test-mode keys for this run only. The secret is random: nothing here is a real credential,
// and no request ever reaches Razorpay (the fake below answers instead).
const KEY_ID = "rzp_test_VidyadaanTests1";
const KEY_SECRET = randomBytes(24).toString("hex");
process.env.RAZORPAY_KEY_ID = KEY_ID;
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;

let server;
let User;
let Project;
let Donation;
let admin;
let donor;
let donorEmail;
const newClient = () => createClient(server.baseUrl);

// ─── A fake Razorpay Orders API ──────────────────────────────────────────────
// `failWith`: an HTTP status, "network", or "wrong-amount" (an order that doesn't match the request).
const razorpay = { requests: [], failWith: null };
const fakeRazorpay = async (url, init) => {
    const body = JSON.parse(init.body);
    razorpay.requests.push({ url, method: init.method, headers: init.headers, body });
    if (razorpay.failWith === "network") throw new TypeError("fetch failed");
    if (typeof razorpay.failWith === "number") {
        return Response.json({ error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" } }, { status: razorpay.failWith });
    }
    return Response.json({
        id: `order_${randomBytes(7).toString("hex")}`,
        entity: "order",
        amount: razorpay.failWith === "wrong-amount" ? body.amount + 100 : body.amount,
        amount_paid: 0,
        amount_due: body.amount,
        currency: body.currency,
        receipt: body.receipt,
        status: "created",
        attempts: 0,
        notes: body.notes,
        created_at: Math.floor(Date.now() / 1000),
    });
};

/**
 * What Razorpay Checkout hands the browser after a successful payment of `orderId`: the signature is an
 * HMAC-SHA256 of "<order id>|<payment id>" with the key secret (Razorpay's documented algorithm).
 */
const checkoutSuccess = (orderId, paymentId = `pay_${randomBytes(7).toString("hex")}`, secret = KEY_SECRET) => ({
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
let n = 0;
const signedIn = async (factory, role, overrides) => {
    const data = factory(overrides);
    await registerActive(newClient(), data);
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, role)).status, 200);
    return { c, data };
};
const createProject = async (c, overrides = {}) => {
    const res = await c.post("/api/school/projects", {
        json: {
            title: `Computer lab with 10 PCs ${(n += 1)}`, category: "Computer Lab", priority: "High", budget: "100000", studentsBenefited: "200",
            problem: "The school has no computers; 200 students have never used one before class 10.", expectedCompletion: inDays(90), ...overrides,
        },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.project;
};
const approve = async (id) => assert.equal((await admin.patch(`/api/admin/projects/${id}/approve`)).status, 200);
/** An approved ₹1,00,000 need (NGO parts of ₹20,000 each) and its school. */
const approvedNeed = async (overrides) => {
    const school = await signedIn(schoolData, "school");
    const project = await createProject(school.c, overrides);
    await approve(project.id);
    return { school, project };
};
const donate = (c, projectId, amount, extra = {}) => c.post("/api/donations", { json: { projectId, amount, ...extra } });
const verify = (c, donationId, payload) => c.post(`/api/donations/${donationId}/verify`, { json: payload });
/** Start a donation and return { donation, checkout } from the server. */
const started = async (c, projectId, amount) => {
    const res = await donate(c, projectId, amount);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body;
};
const raisedOf = async (projectId) => (await Project.findById(projectId).lean()).raised;
const countedOf = async (projectId) => (await Project.findById(projectId).select("+countedDonations").lean()).countedDonations;
/** Nothing new: no Razorpay order requested and no donation saved since `snapshot()`. */
const snapshot = async () => ({ requests: razorpay.requests.length, donations: await Donation.countDocuments() });
const assertNothingNew = async (before, message) => {
    assert.equal(razorpay.requests.length, before.requests, `${message}: a Razorpay order was requested`);
    assert.equal(await Donation.countDocuments(), before.donations, `${message}: a donation was saved`);
};

before(async () => {
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
    Project = (await import("../models/Project.js")).default;
    Donation = (await import("../models/Donation.js")).default;
    await Donation.init(); // unique indexes in place before the duplicate-payment tests
    (await import("../services/razorpay.js")).setRazorpayFetch(fakeRazorpay);
    const credentials = await createAdmin();
    admin = newClient();
    assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
    const signedInDonor = await signedIn(donorData, "donor");
    donor = signedInDonor.c;
    donorEmail = signedInDonor.data.email.toLowerCase();
});
after(() => server.stop());

describe("donation rules (shared with the website)", () => {
    test("amounts are whole rupees from ₹10 to ₹5,00,000; only projectId, amount and currency may be sent", () => {
        assert.deepEqual(validateDonationAmount(500), { value: 500 });
        assert.deepEqual(validateDonationAmount(" 2500 "), { value: 2500 });
        for (const bad of [undefined, null, "", 0, -500, "-500", 12.5, "12.50", "abc", "5,000", "₹500", "1e3", true, [500], { value: 500 }, 9, 500001]) {
            assert.ok(validateDonationAmount(bad).error, `accepted ${JSON.stringify(bad)}`);
        }
        assert.deepEqual(getUnexpectedDonationFields({ projectId: "x", amount: 1, currency: "INR", donor: "y", raised: 5 }), ["donor", "raised"]);
        assert.ok(validateDonation({ projectId: "x", amount: 500, currency: "USD" }).errors.currency);
        assert.deepEqual(validateDonation({ projectId: " abc ", amount: "750" }), { errors: {}, values: { currency: "INR", projectId: "abc", amount: 750 } });
    });
});

describe("starting a donation (the Razorpay order)", () => {
    test("a donor starts a donation: the server creates a Razorpay order for exactly that amount and saves it as CREATED", async () => {
        const { project } = await approvedNeed();
        const res = await donate(donor, project.id, 500);
        assert.equal(res.status, 201, JSON.stringify(res.body));
        const { donation, checkout } = res.body;

        // What the browser gets: the donation, and what Razorpay Checkout needs (the public key ID only).
        assert.deepEqual(Object.keys(checkout).sort(), ["amount", "currency", "description", "keyId", "name", "orderId"]);
        assert.equal(checkout.keyId, KEY_ID);
        assert.match(checkout.orderId, /^order_/);
        assert.equal(checkout.amount, 50000, "₹500 in paise");
        assert.equal(checkout.currency, "INR");
        assert.equal(checkout.description, project.title);
        assert.deepEqual(donation.project, { id: project.id, title: project.title });
        assert.equal(donation.amount, 500);
        assert.equal(donation.status, "CREATED");
        assert.equal(donation.mode, "test");
        assert.equal(donation.paymentId, null);
        assert.ok(!JSON.stringify(res.body).includes(KEY_SECRET), "the key secret was sent to the browser");

        // What Razorpay was asked for: an authenticated order in paise, pointing back at the donation.
        const request = razorpay.requests.at(-1);
        assert.equal(request.url, "https://api.razorpay.com/v1/orders");
        assert.equal(request.method, "POST");
        assert.equal(request.headers.Authorization, `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`);
        assert.deepEqual(request.body, { amount: 50000, currency: "INR", receipt: donation.id, notes: { projectId: project.id } });

        // What was saved: the signed-in donor, the project's own school, and nothing counted yet.
        const stored = await Donation.findById(donation.id).lean();
        const donorUser = await User.findOne({ email: donorEmail }).lean();
        const schoolUser = await Project.findById(project.id).select("school").lean();
        assert.ok(stored.donor.equals(donorUser._id));
        assert.ok(stored.school.equals(schoolUser.school));
        assert.equal(stored.orderId, checkout.orderId);
        assert.equal(stored.status, "CREATED");
        assert.equal(stored.paymentId, undefined);
        assert.equal(await raisedOf(project.id), 0, "an unpaid donation counts for nothing");
    });

    test("signed-out users get 401 on both endpoints", async () => {
        const { project } = await approvedNeed();
        const { donation, checkout } = await started(donor, project.id, 500);
        const anonymous = newClient();
        assert.equal((await donate(anonymous, project.id, 500)).status, 401);
        assert.equal((await verify(anonymous, donation.id, checkoutSuccess(checkout.orderId))).status, 401);
        assert.equal(await raisedOf(project.id), 0);
    });

    test("NGOs, schools and admins get 403 on both endpoints; no order is created and nothing is confirmed", async () => {
        const { school, project } = await approvedNeed();
        const { donation, checkout } = await started(donor, project.id, 500);
        const ngo = (await signedIn(ngoData, "ngo")).c;
        const before = await snapshot();
        for (const [who, c] of [["NGO", ngo], ["school", school.c], ["admin", admin]]) {
            assert.equal((await donate(c, project.id, 500)).status, 403, who);
            assert.equal((await verify(c, donation.id, checkoutSuccess(checkout.orderId))).status, 403, who);
        }
        await assertNothingNew(before, "another role");
        assert.equal((await Donation.findById(donation.id).lean()).status, "CREATED");
        assert.equal(await raisedOf(project.id), 0);
    });

    test("a missing, malformed or unknown project ID is refused", async () => {
        const before = await snapshot();
        for (const [projectId, status] of [[undefined, 400], ["", 400], [12345, 400], ["not-an-id", 404], ["64b000000000000000000000", 404]]) {
            const res = await donate(donor, projectId, 500);
            assert.equal(res.status, status, `projectId ${JSON.stringify(projectId)}`);
        }
        await assertNothingNew(before, "bad project ID");
    });

    test("pending, rejected and completed projects, and projects of an inactive school, can't receive donations", async () => {
        const school = await signedIn(schoolData, "school");
        const pending = await createProject(school.c);
        const rejected = await createProject(school.c);
        assert.equal((await admin.patch(`/api/admin/projects/${rejected.id}/reject`, { json: { reason: "Please attach a quotation." } })).status, 200);
        const completed = await createProject(school.c);
        await approve(completed.id);
        assert.equal((await school.c.patch(`/api/school/projects/${completed.id}`, { json: { status: "Completed" } })).status, 200);
        const inactive = await approvedNeed();
        await User.updateOne({ email: inactive.school.data.email.toLowerCase() }, { $set: { accountStatus: "rejected" } });

        const before = await snapshot();
        for (const [label, project] of [["pending", pending], ["rejected", rejected], ["completed", completed], ["inactive school", inactive.project]]) {
            const res = await donate(donor, project.id, 500);
            assert.equal(res.status, 404, label);
            assert.equal(res.body.message, "This school need is no longer available.", label);
        }
        await assertNothingNew(before, "ineligible project");
    });

    test("zero, negative, fractional and badly formatted amounts are refused before anything is created", async () => {
        const { project } = await approvedNeed();
        const before = await snapshot();
        for (const amount of [0, -500, "-500", 12.5, "12.50", "abc", "5,000", "₹500", "1e3", "", null, true, [500], { value: 500 }, 9, 500001]) {
            const res = await donate(donor, project.id, amount);
            assert.equal(res.status, 400, `amount ${JSON.stringify(amount)}`);
            assert.ok(res.body.errors?.amount, `amount ${JSON.stringify(amount)}: no field error`);
        }
        await assertNothingNew(before, "bad amount");
        assert.equal((await donate(donor, project.id, "750")).status, 201, "the digits a form sends are fine");
    });

    test("the currency can only be INR, and the donor, school, title or amounts raised can't be sent", async () => {
        const { project } = await approvedNeed();
        const otherDonor = await signedIn(donorData, "donor");
        const otherId = (await User.findOne({ email: otherDonor.data.email.toLowerCase() }).lean())._id.toString();
        const before = await snapshot();

        const usd = await donate(donor, project.id, 500, { currency: "USD" });
        assert.equal(usd.status, 400);
        assert.match(usd.body.errors.currency, /INR/);
        for (const extra of [{ donor: otherId }, { donorId: otherId }, { title: "Something else" }, { schoolName: "Another school" }, { raised: 99999 }, { budget: 1 }, { status: "PAID" }, { paymentId: "pay_FAKE12345678" }]) {
            const res = await donate(donor, project.id, 500, extra);
            assert.equal(res.status, 400, JSON.stringify(extra));
            assert.match(res.body.message, /Unexpected field/);
        }
        assert.equal((await donor.post("/api/donations", { json: [] })).status, 400);
        assert.equal((await donor.post("/api/donations", { json: "{bad" })).status, 400);
        await assertNothingNew(before, "refused body");

        assert.equal((await donate(donor, project.id, 500, { currency: "INR" })).status, 201);
    });

    test("a donor can give only what's left: the budget minus NGO commitments minus earlier donations", async () => {
        const { project } = await approvedNeed();
        const ngo = (await signedIn(ngoData, "ngo")).c;
        // An NGO commits to two ₹20,000 parts (not paid yet): that money is promised, so donors can't give it.
        assert.equal((await ngo.post(`/api/projects/${project.id}/commitments`, { json: { parts: [1, 2] } })).status, 201);
        const tooMuch = await donate(donor, project.id, 60001);
        assert.equal(tooMuch.status, 400);
        assert.match(tooMuch.body.errors.amount, /up to ₹60,000/);

        const first = await started(donor, project.id, 10000);
        assert.equal((await verify(donor, first.donation.id, checkoutSuccess(first.checkout.orderId))).status, 200);
        assert.match((await donate(donor, project.id, 50001)).body.errors.amount, /up to ₹50,000/);
        // An unpaid order doesn't hold money back from anyone else.
        await started(donor, project.id, 50000);
        await started(donor, project.id, 50000);

        // A need whose every part is taken by NGOs has nothing left for donors.
        const full = await approvedNeed();
        assert.equal((await ngo.post(`/api/projects/${full.project.id}/commitments`, { json: { parts: [1, 2, 3, 4, 5] } })).status, 201);
        const none = await donate(donor, full.project.id, 500);
        assert.equal(none.status, 409);
        assert.match(none.body.message, /fully funded or promised/);
    });

    test("when Razorpay fails, sends an unexpected order, or isn't set up with test keys, nothing is saved", async () => {
        const { project } = await approvedNeed();
        const { donation, checkout } = await started(donor, project.id, 500);
        const before = await snapshot();
        try {
            for (const failure of [401, 500, "network", "wrong-amount"]) {
                razorpay.failWith = failure;
                const res = await donate(donor, project.id, 500);
                assert.equal(res.status, 502, String(failure));
                assert.ok(!JSON.stringify(res.body).includes(KEY_SECRET));
            }
        } finally {
            razorpay.failWith = null;
        }
        assert.equal(await Donation.countDocuments(), before.donations, "a failed order was saved");

        const unavailable = async (label) => {
            const started2 = await snapshot();
            const res = await donate(donor, project.id, 500);
            assert.equal(res.status, 503, label);
            assert.equal(res.body.code, "DONATIONS_UNAVAILABLE", label);
            assert.equal((await verify(donor, donation.id, checkoutSuccess(checkout.orderId))).status, 503, label);
            await assertNothingNew(started2, label);
        };
        try {
            delete process.env.RAZORPAY_KEY_SECRET;
            await unavailable("no secret");
            process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
            process.env.RAZORPAY_KEY_ID = "rzp_live_RealMoneyKey123";
            await unavailable("a live key");
        } finally {
            process.env.RAZORPAY_KEY_ID = KEY_ID;
            process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
        }
        assert.equal(await raisedOf(project.id), 0);
        assert.equal((await Donation.findById(donation.id).lean()).status, "CREATED");
    });
});

describe("verifying the payment", () => {
    test("an invalid or missing signature is refused: the donation stays CREATED and the project's funding doesn't change", async () => {
        const { project } = await approvedNeed();
        const { donation, checkout } = await started(donor, project.id, 700);
        const other = await started(donor, project.id, 300);
        const good = checkoutSuccess(checkout.orderId);
        const flipped = good.razorpay_signature.slice(0, -1) + (good.razorpay_signature.endsWith("0") ? "1" : "0");
        const attempts = {
            "signed with another secret": checkoutSuccess(checkout.orderId, good.razorpay_payment_id, randomBytes(24).toString("hex")),
            "the signature of a different payment": { ...good, razorpay_signature: checkoutSuccess(checkout.orderId).razorpay_signature },
            "one character changed": { ...good, razorpay_signature: flipped },
            "no signature": { razorpay_order_id: good.razorpay_order_id, razorpay_payment_id: good.razorpay_payment_id },
            "just saying it worked": { razorpay_order_id: good.razorpay_order_id, razorpay_payment_id: good.razorpay_payment_id, status: "success" },
            "another donation's order": checkoutSuccess(other.checkout.orderId),
            "malformed IDs": { razorpay_order_id: "order_<script>", razorpay_payment_id: "1 OR 1=1", razorpay_signature: good.razorpay_signature },
            "an empty body": {},
        };
        for (const [label, payload] of Object.entries(attempts)) {
            const res = await verify(donor, donation.id, payload);
            assert.equal(res.status, 400, label);
        }
        const stored = await Donation.findById(donation.id).lean();
        assert.equal(stored.status, "CREATED");
        assert.equal(stored.paymentId, undefined);
        assert.equal(stored.verifiedAt, undefined);
        assert.equal(await raisedOf(project.id), 0, "an unverified payment never counts");
        assert.deepEqual(await countedOf(project.id), []);
        assert.equal((await verify(donor, "not-an-id", good)).status, 404);
        assert.equal((await verify(donor, "64b000000000000000000000", good)).status, 404);
    });

    test("a valid signature confirms the donation and adds it to the project's raised amount", async () => {
        const { school, project } = await approvedNeed();
        const { donation, checkout } = await started(donor, project.id, 2500);
        const payment = checkoutSuccess(checkout.orderId);
        const res = await verify(donor, donation.id, payment);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.message, "Your donation of ₹2,500 is confirmed. Thank you!");
        assert.equal(res.body.donation.id, donation.id);
        assert.equal(res.body.donation.status, "PAID");
        assert.equal(res.body.donation.paymentId, payment.razorpay_payment_id);
        assert.ok(res.body.donation.verifiedAt);

        const stored = await Donation.findById(donation.id).lean();
        assert.equal(stored.status, "PAID");
        assert.equal(stored.paymentId, payment.razorpay_payment_id);
        assert.ok(stored.verifiedAt instanceof Date);
        assert.equal(await raisedOf(project.id), 2500);
        // The same project, seen from every side.
        assert.equal((await donor.get("/api/projects")).body.projects.find((p) => p.id === project.id).raised, 2500, "donor view");
        assert.equal((await school.c.get(`/api/school/projects/${project.id}`)).body.project.raised, 2500, "school view");
    });

    test("verifying the same payment again, even at the same moment, records one donation and counts it once", async () => {
        const { project } = await approvedNeed();
        const { donation, checkout } = await started(donor, project.id, 1000);
        const payment = checkoutSuccess(checkout.orderId);
        const [a, b] = await Promise.all([verify(donor, donation.id, payment), verify(donor, donation.id, payment)]);
        assert.equal(a.status, 200);
        assert.equal(b.status, 200);
        assert.equal((await verify(donor, donation.id, payment)).status, 200, "a later repeat is fine too");
        assert.equal(await raisedOf(project.id), 1000, "counted once");
        assert.equal(await Donation.countDocuments({ paymentId: payment.razorpay_payment_id }), 1);
        assert.equal((await countedOf(project.id)).length, 1);
    });

    test("one Razorpay payment can't confirm two donations", async () => {
        const { project } = await approvedNeed();
        const first = await started(donor, project.id, 300);
        const second = await started(donor, project.id, 400);
        const paid = checkoutSuccess(first.checkout.orderId);
        assert.equal((await verify(donor, first.donation.id, paid)).status, 200);
        // Even correctly signed for the second order, the same payment ID is refused.
        const reused = await verify(donor, second.donation.id, checkoutSuccess(second.checkout.orderId, paid.razorpay_payment_id));
        assert.equal(reused.status, 409);
        assert.equal((await Donation.findById(second.donation.id).lean()).status, "CREATED");
        assert.equal(await raisedOf(project.id), 300);
    });

    test("a donation the server confirmed but hadn't yet added to the project (a crash) is counted once when verified again", async () => {
        const { project } = await approvedNeed();
        const { donation, checkout } = await started(donor, project.id, 800);
        const payment = checkoutSuccess(checkout.orderId);
        // The claim succeeded, then the server stopped before updating the project.
        await Donation.updateOne({ _id: donation.id }, { $set: { status: "PAID", paymentId: payment.razorpay_payment_id, verifiedAt: new Date() } });
        assert.equal(await raisedOf(project.id), 0);
        assert.equal((await verify(donor, donation.id, payment)).status, 200);
        assert.equal(await raisedOf(project.id), 800);
        assert.equal((await verify(donor, donation.id, payment)).status, 200);
        assert.equal(await raisedOf(project.id), 800, "still once");
    });

    test("a donor can't confirm another donor's donation, or create one in their name", async () => {
        const { project } = await approvedNeed();
        const { donation, checkout } = await started(donor, project.id, 600);
        const payment = checkoutSuccess(checkout.orderId);
        const otherDonor = await signedIn(donorData, "donor");
        const other = otherDonor.c;
        assert.equal((await verify(other, donation.id, payment)).status, 404, "someone else's donation looks like it doesn't exist");
        assert.equal((await Donation.findById(donation.id).lean()).status, "CREATED");
        assert.equal(await raisedOf(project.id), 0);

        // A donation is always the signed-in donor's: naming another donor is refused, and their own is theirs.
        const donorId = (await User.findOne({ email: donorEmail }).lean())._id;
        const otherId = (await User.findOne({ email: otherDonor.data.email.toLowerCase() }).lean())._id;
        assert.equal((await donate(other, project.id, 500, { donor: donorId.toString() })).status, 400);
        const own = await started(other, project.id, 500);
        const ownStored = await Donation.findById(own.donation.id).lean();
        assert.ok(ownStored.donor.equals(otherId), "saved under the donor who is signed in");
        assert.ok(!ownStored.donor.equals(donorId));

        assert.equal((await verify(donor, donation.id, payment)).status, 200, "the donor it belongs to can still confirm it");
        assert.equal(await raisedOf(project.id), 600);
    });

    test("a stored donation holds no card data, no signature and no key secret", async () => {
        const { project } = await approvedNeed();
        const start = await donate(donor, project.id, 1200);
        const payment = checkoutSuccess(start.body.checkout.orderId);
        const done = await verify(donor, start.body.donation.id, payment);
        assert.equal(done.status, 200);

        const stored = await Donation.findById(start.body.donation.id).lean();
        assert.deepEqual(Object.keys(stored).sort(), [
            "__v", "_id", "amount", "createdAt", "currency", "donor", "mode", "orderId", "paymentId", "project", "provider", "school", "status", "updatedAt", "verifiedAt",
        ]);
        assert.equal(stored.mode, "test");
        const everything = JSON.stringify([stored, start.body, done.body]).toLowerCase();
        for (const secret of [KEY_SECRET, payment.razorpay_signature, "signature", "secret", "card", "cvv", "vpa", "password", "pin"]) {
            assert.ok(!everything.includes(secret.toLowerCase()), `found: ${secret}`);
        }
    });
});

describe("donations and NGO payments share one project total", () => {
    test("raised = NGO payments the school accepted + verified donations, each counted once; NGO views are unchanged", async () => {
        const { school, project } = await approvedNeed();
        const ngo = await signedIn(ngoData, "ngo", { ngoName: "Shiksha Mitra Trust" });
        assert.equal((await ngo.c.post(`/api/projects/${project.id}/commitments`, { json: { parts: [1] } })).status, 201);
        const paid = await ngo.c.post(`/api/projects/${project.id}/payments`, {
            form: paymentForm({ parts: [1], method: "UPI", reference: "UTR000111222", paidOn: new Date().toISOString().slice(0, 10), note: "" }),
        });
        assert.equal(paid.status, 201, JSON.stringify(paid.body));
        assert.equal((await school.c.patch(`/api/school/payments/${paid.body.payment.id}/accept`)).status, 200);
        assert.equal(await raisedOf(project.id), 20000, "the NGO's ₹20,000");

        const { donation, checkout } = await started(donor, project.id, 5000);
        assert.equal((await verify(donor, donation.id, checkoutSuccess(checkout.orderId))).status, 200);
        assert.equal(await raisedOf(project.id), 25000, "₹20,000 from the NGO + ₹5,000 from the donor");

        // Left for donors: ₹1,00,000 − ₹20,000 committed by the NGO − ₹5,000 donated.
        assert.match((await donate(donor, project.id, 75001)).body.errors.amount, /up to ₹75,000/);

        const ngoView = (await ngo.c.get("/api/projects")).body.projects.find((p) => p.id === project.id);
        assert.equal(ngoView.committed, 20000, "donations aren't NGO commitments");
        assert.deepEqual(ngoView.parts.filter((p) => p.takenBy === "you").map((p) => p.status), ["RECEIVED"]);
        assert.equal(ngoView.raised, 25000);
        const schoolView = (await school.c.get(`/api/school/projects/${project.id}`)).body.project;
        assert.equal(schoolView.raised, 25000);
        assert.equal(schoolView.committed, 20000);
    });

    test("the budget can't change after a donation is confirmed (an unpaid one doesn't lock it)", async () => {
        const { school, project } = await approvedNeed();
        const edit = (budget) => school.c.patch(`/api/school/projects/${project.id}`, { json: { budget } });
        const { donation, checkout } = await started(donor, project.id, 1000);
        assert.equal((await edit("90000")).status, 200, "only an order so far");

        assert.equal((await verify(donor, donation.id, checkoutSuccess(checkout.orderId))).status, 200);
        const res = await edit("120000");
        assert.equal(res.status, 400);
        assert.match(res.body.errors.budget, /can't change after donors/);
        assert.equal((await edit("90000")).status, 200, "sending the same budget is fine");
        assert.equal((await Project.findById(project.id).lean()).budget, 90000);
    });
});

describe("rate limit", () => {
    test("each donor can start only so many donations in a window; other donors and verifying aren't affected", async () => {
        const { createApp } = await import("../app.js");
        const app = createApp({ corsOrigin: FRONTEND_ORIGIN, rateLimits: { donationOrders: { windowMs: 60_000, limit: 2 } } });
        const limited = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        try {
            const url = `http://127.0.0.1:${limited.address().port}`;
            const a = createClient(url);
            a.cookie = donor.cookie;
            const b = createClient(url);
            b.cookie = (await signedIn(donorData, "donor")).c.cookie;
            for (let i = 0; i < 2; i += 1) assert.equal((await a.post("/api/donations", { json: {} })).status, 400);
            const blocked = await a.post("/api/donations", { json: {} });
            assert.equal(blocked.status, 429);
            assert.match(blocked.body.message, /Too many donation attempts/);
            assert.equal((await b.post("/api/donations", { json: {} })).status, 400, "another donor isn't blocked");
            assert.equal((await a.post("/api/donations/64b000000000000000000000/verify", { json: {} })).status, 400, "verifying isn't limited");
        } finally {
            await new Promise((resolve) => limited.close(resolve));
        }
    });
});
