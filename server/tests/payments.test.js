import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
    FILES, PASSWORD, createAdmin, createClient, donorData, login, ngoData, paymentForm, registerActive, schoolData, startTestServer,
} from "./helpers.js";
import { normalizeReference, validatePaymentDetails, validateRejectionReason } from "../../shared/paymentRules.js";

let server;
let Project;
let admin;
const newClient = () => createClient(server.baseUrl);

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const today = () => inDays(0);
let n = 0;
let ref = 0;
const nextRef = () => `UTR${String((ref += 1)).padStart(9, "0")}`;

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
            title: `Computer lab with 10 PCs ${(n += 1)}`, category: "Computer Lab", priority: "High", budget: "100000", studentsBenefited: "200",
            problem: "The school has no computers; 200 students have never used one before class 10.", expectedCompletion: inDays(90),
        },
    });
    const project = created.body.project;
    assert.equal((await admin.patch(`/api/admin/projects/${project.id}/approve`)).status, 200);
    const ngo = await signedIn(ngoData, "ngo", { ngoName: "Shiksha Mitra Trust" });
    assert.equal((await ngo.c.post(`/api/projects/${project.id}/commitments`, { json: { parts } })).status, 201);
    return { school, ngo, project };
};
const pay = (c, projectId, fields = {}, proof) =>
    c.post(`/api/projects/${projectId}/payments`, {
        form: paymentForm({ parts: [1, 2], method: "Bank transfer (NEFT/RTGS/IMPS)", reference: nextRef(), paidOn: today(), note: "", ...fields }, proof),
    });
const myParts = async (c, projectId) =>
    (await c.get("/api/projects/committed")).body.projects.find((p) => p.id === projectId).parts.filter((p) => p.takenBy === "you");

before(async () => {
    server = await startTestServer();
    Project = (await import("../models/Project.js")).default;
    const credentials = await createAdmin();
    admin = newClient();
    assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
});
after(() => server.stop());

describe("payment rules", () => {
    test("parts, method, reference and date are required; the date can't be in the future", () => {
        assert.deepEqual(Object.keys(validatePaymentDetails({}).errors).sort(), ["method", "paidOn", "parts", "reference"]);
        const { errors, values } = validatePaymentDetails({ parts: "2,1", method: "UPI", reference: "  utr 1234 5678 ", paidOn: today(), note: " Paid from our SBI account " });
        assert.deepEqual(errors, {});
        assert.deepEqual(values, { parts: [1, 2], method: "UPI", reference: "UTR 1234 5678", paidOn: today(), note: "Paid from our SBI account" });
        assert.ok(validatePaymentDetails({ parts: "1", method: "UPI", reference: "UTR12345", paidOn: inDays(1) }).errors.paidOn);
        assert.ok(validatePaymentDetails({ parts: "1,1", method: "UPI", reference: "UTR12345", paidOn: today() }).errors.parts);
        assert.ok(validatePaymentDetails({ parts: "6", method: "UPI", reference: "UTR12345", paidOn: today() }).errors.parts);
        assert.ok(validatePaymentDetails({ parts: "1", method: "Cash", reference: "UTR12345", paidOn: today() }).errors.method);
        assert.ok(validatePaymentDetails({ parts: "1", method: "UPI", reference: "ab", paidOn: today() }).errors.reference);
        assert.ok(validatePaymentDetails({ parts: "1", method: "UPI", reference: "<script>", paidOn: today() }).errors.reference);
        assert.ok(validatePaymentDetails({ parts: "1", method: "UPI", reference: "UTR12345", paidOn: "2026-02-30" }).errors.paidOn);
        assert.equal(normalizeReference(" sbin  0001 "), "SBIN 0001");
        assert.ok(validateRejectionReason("no").error);
        assert.equal(validateRejectionReason("  Not   in our account ").value, "Not in our account");
    });
});

describe("an NGO pays the school and records it with proof", () => {
    test("where to pay: only an NGO with unpaid parts sees the school's bank details", async () => {
        const { ngo, project, school } = await committedNeed([1]);
        const res = await ngo.c.get(`/api/projects/${project.id}/payment-details`);
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.payee, { name: school.data.schoolName, bankAccount: "123456789012", ifsc: "SBIN0001234", upi: "school@sbi" });

        const stranger = await signedIn(ngoData, "ngo");
        assert.equal((await stranger.c.get(`/api/projects/${project.id}/payment-details`)).status, 404, "an NGO that hasn't committed");
        assert.equal((await pay(ngo.c, project.id, { parts: [1] })).status, 201);
        assert.equal((await ngo.c.get(`/api/projects/${project.id}/payment-details`)).status, 404, "nothing left to pay");
    });

    test("recording a payment locks the parts until the school decides", async () => {
        const { ngo, project } = await committedNeed([1, 2, 3]);
        const res = await pay(ngo.c, project.id, { parts: [2, 1], method: "UPI", reference: "upi 4521 8890 1234", note: "From our HDFC current account" }, FILES.pdf());
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.match(res.body.message, /₹40,000/);
        const p = res.body.payment;
        assert.deepEqual(
            { parts: p.parts, amount: p.amount, method: p.method, reference: p.reference, paidOn: p.paidOn, note: p.note, status: p.status, school: p.school, project: p.project },
            { parts: [1, 2], amount: 40000, method: "UPI", reference: "UPI 4521 8890 1234", paidOn: today(), note: "From our HDFC current account", status: "SUBMITTED", school: { name: "Govt. Primary School, Honnali" }, project: { id: project.id, title: project.title } }
        );
        assert.equal(p.proof.mimeType, "application/pdf");
        assert.deepEqual(res.body.project.parts.slice(0, 3).map((x) => x.status), ["PAYMENT_SUBMITTED", "PAYMENT_SUBMITTED", "AWAITING_PAYMENT"]);
        assert.equal(res.body.project.raised, 0, "not received until the school accepts");

        assert.equal((await pay(ngo.c, project.id, { parts: [2] })).status, 400, "part 2 is already in a payment");
        assert.equal((await ngo.c.delete(`/api/projects/${project.id}/commitments`)).body.project.parts[1].takenBy, "you", "withdrawing leaves paid parts");
        assert.deepEqual((await ngo.c.get("/api/projects/payments")).body.payments.map((x) => x.id), [p.id]);
    });

    test("bad payments are refused and leave no file behind", async () => {
        const { ngo, project } = await committedNeed([1, 2]);
        const files = async () => (await import("../models/UploadedFile.js")).default.countDocuments({ purpose: "proof" });
        const before = await files();
        const cases = [
            [{ parts: [3] }, undefined, "parts"],
            [{ method: "Barter" }, undefined, "method"],
            [{ reference: "" }, undefined, "reference"],
            [{ paidOn: inDays(1) }, undefined, "paidOn"],
            [{ paidOn: inDays(-3) }, undefined, "paidOn"],
            [{}, null, "proof"],
            [{}, FILES.fakePng(), "proof"],
            [{}, FILES.exe(), "proof"],
        ];
        for (const [fields, proof, field] of cases) {
            const res = await pay(ngo.c, project.id, fields, proof);
            assert.equal(res.status, 400, `${field}: ${JSON.stringify(res.body)}`);
            assert.ok(res.body.errors[field], `${field}: ${JSON.stringify(res.body.errors)}`);
        }
        const big = await pay(ngo.c, project.id, {}, FILES.oversized());
        assert.ok([400, 413].includes(big.status), `oversized: ${big.status}`);
        assert.equal(await files(), before, "a refused payment kept its file");

        const reference = nextRef();
        assert.equal((await pay(ngo.c, project.id, { parts: [1], reference })).status, 201);
        const dup = await pay(ngo.c, project.id, { parts: [2], reference: reference.toLowerCase() });
        assert.equal(dup.status, 409, "the same transaction reference twice");
        assert.ok(dup.body.errors.reference);
        assert.equal((await pay(ngo.c, "64b000000000000000000000")).status, 404);
    });

    test("another NGO can't pay for someone else's parts", async () => {
        const { project } = await committedNeed([1, 2]);
        const other = await signedIn(ngoData, "ngo");
        assert.equal((await other.c.post(`/api/projects/${project.id}/commitments`, { json: { parts: [3] } })).status, 201);
        const res = await pay(other.c, project.id, { parts: [1] });
        assert.equal(res.status, 400);
        assert.match(res.body.errors.parts, /isn't one of your parts/);
    });
});

describe("the school checks the proof and accepts or rejects the payment", () => {
    test("the school sees the payment with the NGO's contact and can open the proof; nobody else can", async () => {
        const { ngo, project, school } = await committedNeed([1, 2]);
        const paid = (await pay(ngo.c, project.id, { reference: "UTR998877665" })).body.payment;

        const list = await school.c.get("/api/school/payments");
        assert.equal(list.status, 200);
        const seen = list.body.payments[0];
        assert.equal(seen.id, paid.id);
        assert.equal(seen.reference, "UTR998877665");
        assert.equal(seen.ngo.name, "Shiksha Mitra Trust");
        assert.equal(seen.ngo.email, ngo.data.email.toLowerCase());
        assert.equal(seen.status, "SUBMITTED");
        const commitments = (await school.c.get("/api/school/commitments")).body.commitments;
        assert.deepEqual(commitments.map((x) => x.status), ["PAYMENT_SUBMITTED", "PAYMENT_SUBMITTED"]);
        assert.ok(commitments.every((x) => x.paymentId === paid.id));

        assert.equal((await school.c.get(`/api/files/${paid.proof.id}`)).status, 200, "the school opens the proof");
        assert.equal((await ngo.c.get(`/api/files/${paid.proof.id}`)).status, 200, "the NGO opens its own proof");
        const otherSchool = await signedIn(schoolData, "school");
        const otherNgo = await signedIn(ngoData, "ngo");
        for (const c of [otherSchool.c, otherNgo.c]) assert.equal((await c.get(`/api/files/${paid.proof.id}`)).status, 404);
        assert.deepEqual((await otherSchool.c.get("/api/school/payments")).body.payments, []);
        assert.equal((await otherSchool.c.patch(`/api/school/payments/${paid.id}/accept`)).status, 404);
    });

    test("accepting adds the amount to 'raised' once and the NGO sees it received", async () => {
        const { ngo, project, school } = await committedNeed([1, 2, 3]);
        const paid = (await pay(ngo.c, project.id, { parts: [1, 2] })).body.payment;
        const accept = () => school.c.patch(`/api/school/payments/${paid.id}/accept`);

        const results = await Promise.all([accept(), accept()]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409], "accepted exactly once");
        const ok = results.find((r) => r.status === 200).body;
        assert.equal(ok.project.raised, 40000);
        assert.equal(ok.payment.status, "ACCEPTED");
        assert.ok(ok.payment.reviewedAt);
        assert.equal((await Project.findById(project.id).lean()).raised, 40000);

        assert.deepEqual((await myParts(ngo.c, project.id)).map((p) => p.status), ["RECEIVED", "RECEIVED", "AWAITING_PAYMENT"]);
        assert.equal((await ngo.c.get("/api/projects/payments")).body.payments[0].status, "ACCEPTED");
        assert.equal((await school.c.patch(`/api/school/payments/${paid.id}/reject`, { json: { reason: "Changed my mind" } })).status, 409);
    });

    test("rejecting needs a reason; the NGO sees it and can pay again", async () => {
        const { ngo, project, school } = await committedNeed([1]);
        const reference = nextRef();
        const paid = (await pay(ngo.c, project.id, { parts: [1], reference })).body.payment;
        assert.equal((await school.c.patch(`/api/school/payments/${paid.id}/reject`, { json: { reason: "" } })).status, 400);

        const res = await school.c.patch(`/api/school/payments/${paid.id}/reject`, { json: { reason: "No such credit in our account on that date." } });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.payment.status, "REJECTED");
        assert.equal(res.body.project.raised, 0);

        const history = (await ngo.c.get("/api/projects/payments")).body.payments;
        assert.deepEqual([history[0].status, history[0].rejectionReason], ["REJECTED", "No such credit in our account on that date."]);
        assert.deepEqual((await myParts(ngo.c, project.id)).map((p) => p.status), ["AWAITING_PAYMENT"]);
        assert.equal((await pay(ngo.c, project.id, { parts: [1], reference })).status, 201, "a rejected reference can be sent again");
        assert.equal((await school.c.patch(`/api/school/payments/${paid.id}/accept`)).status, 409, "a rejected payment can't be accepted later");
    });
});

describe("who can use the payment endpoints", () => {
    test("only NGOs record payments; only schools review them", async () => {
        const { ngo, project, school } = await committedNeed([1]);
        const paid = (await pay(ngo.c, project.id, { parts: [1] })).body.payment;
        const donor = (await signedIn(donorData, "donor")).c;
        for (const c of [school.c, donor, admin]) {
            assert.equal((await c.get("/api/projects/payments")).status, 403);
            assert.equal((await c.get(`/api/projects/${project.id}/payment-details`)).status, 403);
            assert.equal((await pay(c, project.id, { parts: [1] })).status, 403);
        }
        for (const c of [ngo.c, donor, admin]) {
            assert.equal((await c.get("/api/school/payments")).status, 403);
            assert.equal((await c.patch(`/api/school/payments/${paid.id}/accept`)).status, 403);
            assert.equal((await c.patch(`/api/school/payments/${paid.id}/reject`, { json: { reason: "Not received" } })).status, 403);
        }
        assert.equal((await newClient().get("/api/school/payments")).status, 401);
        assert.equal((await newClient().get("/api/projects/payments")).status, 401);
    });
});
