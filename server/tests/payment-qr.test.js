import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PASSWORD, createAdmin, createClient, donorData, login, ngoData, registerActive, schoolData, startTestServer } from "./helpers.js";
import { getUpiQrImageError, parseUpiQr, sameUpiId, validateUpiQrRejectionReason } from "../../shared/upiQrRules.js";

let server;
let admin;
let User;
const newClient = () => createClient(server.baseUrl);
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
let n = 0;

// The kind of link Google Pay / PhonePe put in a school's QR. helpers.schoolData registers "school@sbi".
const OWN_QR = "upi://pay?pa=school@sbi&pn=Govt%20Primary%20School&cu=INR";
const MERCHANT_QR = "upi://pay?pa=Q123456789@ybl&pn=GOVT%20PRIMARY%20SCHOOL&mc=8211&mode=02&purpose=00";

const signedIn = async (factory, role, overrides) => {
    const data = factory(overrides);
    await registerActive(newClient(), data);
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, role)).status, 200);
    return { c, data };
};
const saveQr = (c, link) => c.put("/api/profile/payment-qr", { json: { link } });
const myQr = async (c) => (await c.get("/api/profile/me")).body.profile.paymentQr;
const schoolIdOf = async (data) => (await User.findOne({ email: data.email.toLowerCase() }).lean())._id.toString();

/** An approved need of `school` and an NGO that has committed to part 1 (so it may see where to pay). */
const ngoPayingSchool = async (school) => {
    const created = await school.c.post("/api/school/projects", {
        json: {
            title: `Library shelves ${(n += 1)}`, category: "Library", priority: "High", budget: "100000", studentsBenefited: "200",
            problem: "The school has no library shelves; books stay in boxes and 200 students can't borrow them.", expectedCompletion: inDays(90),
        },
    });
    const project = created.body.project;
    assert.equal((await admin.patch(`/api/admin/projects/${project.id}/approve`)).status, 200);
    const ngo = await signedIn(ngoData, "ngo");
    assert.equal((await ngo.c.post(`/api/projects/${project.id}/commitments`, { json: { parts: [1] } })).status, 201);
    return { ngo, project };
};
const payeeQr = async (ngo, project) => (await ngo.c.get(`/api/projects/${project.id}/payment-details`)).body.payee.qr;

before(async () => {
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
    const credentials = await createAdmin();
    admin = newClient();
    assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
});
after(() => server.stop());

describe("UPI QR rules", () => {
    test("accepts the payment links UPI apps put in a QR", () => {
        assert.deepEqual(parseUpiQr(` ${OWN_QR} `).value, { link: OWN_QR, upiId: "school@sbi", payeeName: "Govt Primary School" });
        assert.equal(parseUpiQr(MERCHANT_QR).value.upiId, "Q123456789@ybl");
        assert.equal(parseUpiQr("UPI://PAY?PA=head.master-1@okaxis").value.upiId, "head.master-1@okaxis");
        assert.ok(parseUpiQr("upi://pay?pa=school@sbi&am=0").value, "an amount of 0 means the payer chooses");
        assert.ok(parseUpiQr("upi://pay?pa=school@sbi&am=").value);
    });
    test("refuses anything that isn't a plain UPI payment link", () => {
        for (const text of [
            undefined, "", "   ", "https://pay.google.com/school@sbi", "school@sbi", "upi://mandate?pa=school@sbi",
            "upi://pay?pn=No%20UPI%20ID", "upi://pay?pa=not-an-upi-id", "upi://pay?pa=a@1bank", "upi://pay?pa=<script>@sbi",
            `upi://pay?pa=school@sbi&pn=${"x".repeat(520)}`, "upi://pay?pa=school@sbi\u0000",
        ]) {
            assert.ok(parseUpiQr(text).error, `should refuse ${JSON.stringify(text)?.slice(0, 60)}`);
        }
        assert.match(parseUpiQr("upi://pay?pa=school@sbi&am=500").error, /fixed amount/);
        assert.match(parseUpiQr("upi://pay?pa=school@sbi&cu=USD").error, /rupees/);
        // Two UPI IDs in one QR: different apps could pay different accounts.
        assert.match(parseUpiQr("upi://pay?pa=school@sbi&pa=thief@ybl").error, /repeated/);
        assert.match(parseUpiQr("upi://pay?pa=school@sbi&PA=thief@ybl").error, /repeated/);
    });
    test("UPI IDs compare without case; reasons and image files are checked", () => {
        assert.ok(sameUpiId(" School@SBI ", "school@sbi"));
        assert.ok(!sameUpiId("school@sbi", undefined));
        assert.ok(!sameUpiId("", ""));
        assert.ok(validateUpiQrRejectionReason("no").error);
        assert.equal(validateUpiQrRejectionReason("  Not   the school's account ").value, "Not the school's account");
        assert.ok(getUpiQrImageError({ type: "application/pdf", size: 10 }));
        assert.ok(getUpiQrImageError({ type: "image/png", size: 6 * 1024 * 1024 }));
        assert.equal(getUpiQrImageError({ type: "image/jpeg", size: 1000 }), null);
    });
});

describe("a school adds its UPI QR", () => {
    test("a QR with the UPI ID verified at registration is active at once; NGOs paying the school see it", async () => {
        const school = await signedIn(schoolData, "school");
        const { ngo, project } = await ngoPayingSchool(school);
        assert.equal(await payeeQr(ngo, project), null, "no QR yet");

        const res = await saveQr(school.c, OWN_QR);
        assert.equal(res.status, 200);
        assert.equal(res.body.paymentQr.status, "ACTIVE");
        assert.equal(res.body.paymentQr.upiId, "school@sbi");
        assert.equal("reviewedBy" in res.body.paymentQr, false);

        const own = await myQr(school.c);
        assert.equal(own.status, "ACTIVE");
        assert.equal(own.link, OWN_QR);
        assert.deepEqual(await payeeQr(ngo, project), { link: OWN_QR, upiId: "school@sbi", payeeName: "Govt Primary School" });

        // Saving the same QR again changes nothing.
        const again = await saveQr(school.c, OWN_QR);
        assert.equal(again.status, 200);
        assert.equal(again.body.paymentQr.submittedAt, own.submittedAt);
    });

    test("an invalid QR is refused and the saved one is kept", async () => {
        const school = await signedIn(schoolData, "school");
        await saveQr(school.c, OWN_QR);
        for (const link of ["https://example.com/pay", "upi://pay?pa=school@sbi&am=1000", "upi://pay?pa=school@sbi&pa=other@ybl", 42, null]) {
            const res = await saveQr(school.c, link);
            assert.equal(res.status, 400, `should refuse ${link}`);
            assert.ok(res.body.errors.link);
        }
        assert.equal((await myQr(school.c)).link, OWN_QR);
    });

    test("a QR with another UPI ID waits for an admin; NGOs don't see it until it is approved", async () => {
        const school = await signedIn(schoolData, "school");
        const { ngo, project } = await ngoPayingSchool(school);
        const res = await saveQr(school.c, MERCHANT_QR);
        assert.equal(res.status, 200);
        assert.equal(res.body.paymentQr.status, "PENDING");
        assert.match(res.body.message, /check it before NGOs see it/);
        assert.equal(await payeeQr(ngo, project), null);

        // Replacing an active QR with an unchecked one hides the QR from NGOs until it is approved.
        await saveQr(school.c, OWN_QR);
        assert.ok(await payeeQr(ngo, project));
        await saveQr(school.c, MERCHANT_QR);
        assert.equal(await payeeQr(ngo, project), null);
    });

    test("removing the QR", async () => {
        const school = await signedIn(schoolData, "school");
        const { ngo, project } = await ngoPayingSchool(school);
        await saveQr(school.c, OWN_QR);
        const res = await school.c.delete("/api/profile/payment-qr");
        assert.equal(res.status, 200);
        assert.equal(res.body.paymentQr, null);
        assert.equal(await myQr(school.c), null);
        assert.equal(await payeeQr(ngo, project), null);
    });

    test("only a signed-in school can set a QR; donors never receive one", async () => {
        assert.equal((await saveQr(newClient(), OWN_QR)).status, 401);
        const ngo = await signedIn(ngoData, "ngo");
        assert.equal((await saveQr(ngo.c, OWN_QR)).status, 403);
        const donor = await signedIn(donorData, "donor");
        assert.equal((await saveQr(donor.c, OWN_QR)).status, 403);
        assert.equal((await donor.c.delete("/api/profile/payment-qr")).status, 403);

        const school = await signedIn(schoolData, "school");
        const { project } = await ngoPayingSchool(school);
        await saveQr(school.c, OWN_QR);
        const view = await donor.c.get("/api/projects");
        assert.equal(view.status, 200);
        assert.ok(view.body.projects.some((p) => p.id === project.id));
        const text = JSON.stringify(view.body);
        assert.ok(!text.includes("school@sbi") && !text.includes("upi://"), "the donor view never contains UPI details");
        assert.equal((await donor.c.get(`/api/projects/${project.id}/payment-details`)).status, 403);
    });
});

describe("an admin reviews a QR with a different UPI ID", () => {
    test("the queue shows the school, its verified UPI ID and the QR's; approving makes it visible to NGOs", async () => {
        const school = await signedIn(schoolData, "school", { schoolName: "Govt. Higher Primary School, Melur" });
        const { ngo, project } = await ngoPayingSchool(school);
        await saveQr(school.c, MERCHANT_QR);
        const schoolId = await schoolIdOf(school.data);

        const queue = await admin.get("/api/admin/payment-qrs");
        assert.equal(queue.status, 200);
        const item = queue.body.qrs.find((q) => q.school.id === schoolId);
        assert.equal(item.school.name, "Govt. Higher Primary School, Melur");
        assert.equal(item.verifiedUpiId, "school@sbi");
        assert.equal(item.matchesVerifiedUpi, false);
        assert.equal(item.paymentQr.upiId, "Q123456789@ybl");
        assert.ok(queue.body.counts.PENDING >= 1);

        const approved = await admin.patch(`/api/admin/payment-qrs/${schoolId}/approve`, { json: { link: MERCHANT_QR } });
        assert.equal(approved.status, 200);
        assert.equal(approved.body.paymentQr.status, "ACTIVE");
        assert.equal((await myQr(school.c)).status, "ACTIVE");
        assert.equal((await payeeQr(ngo, project)).upiId, "Q123456789@ybl");

        const twice = await admin.patch(`/api/admin/payment-qrs/${schoolId}/approve`, { json: { link: MERCHANT_QR } });
        assert.equal(twice.status, 409);
        assert.match(twice.body.message, /already approved/);
        // Re-saving the approved QR keeps it approved.
        assert.equal((await saveQr(school.c, MERCHANT_QR)).body.paymentQr.status, "ACTIVE");
    });

    test("a QR the school replaced after the admin opened it is never approved unseen", async () => {
        const school = await signedIn(schoolData, "school");
        await saveQr(school.c, MERCHANT_QR);
        const schoolId = await schoolIdOf(school.data);
        const swapped = "upi://pay?pa=someone.else@okhdfcbank&pn=Someone";
        await saveQr(school.c, swapped);

        const res = await admin.patch(`/api/admin/payment-qrs/${schoolId}/approve`, { json: { link: MERCHANT_QR } });
        assert.equal(res.status, 409);
        assert.match(res.body.message, /replaced this QR/);
        assert.equal((await myQr(school.c)).status, "PENDING");
        assert.equal((await admin.patch(`/api/admin/payment-qrs/${schoolId}/approve`, { json: {} })).status, 400);
    });

    test("rejecting needs a reason; the school sees it and can upload another QR", async () => {
        const school = await signedIn(schoolData, "school");
        await saveQr(school.c, MERCHANT_QR);
        const schoolId = await schoolIdOf(school.data);

        assert.equal((await admin.patch(`/api/admin/payment-qrs/${schoolId}/reject`, { json: { link: MERCHANT_QR, reason: "no" } })).status, 400);
        const rejected = await admin.patch(`/api/admin/payment-qrs/${schoolId}/reject`, {
            json: { link: MERCHANT_QR, reason: "This UPI ID is not in the school's name. Upload the QR of the school's bank account." },
        });
        assert.equal(rejected.status, 200);
        const own = await myQr(school.c);
        assert.equal(own.status, "REJECTED");
        assert.match(own.rejectionReason, /not in the school's name/);
        assert.equal((await admin.get("/api/admin/payment-qrs?status=REJECTED")).body.qrs.some((q) => q.school.id === schoolId), true);

        // Uploading again (even the same QR) sends it back for review.
        assert.equal((await saveQr(school.c, MERCHANT_QR)).body.paymentQr.status, "PENDING");
        assert.equal((await myQr(school.c)).rejectionReason, null);
    });

    test("only an admin can list or decide; bad ids and statuses are refused", async () => {
        const school = await signedIn(schoolData, "school");
        await saveQr(school.c, MERCHANT_QR);
        const schoolId = await schoolIdOf(school.data);
        assert.equal((await school.c.get("/api/admin/payment-qrs")).status, 403);
        assert.equal((await school.c.patch(`/api/admin/payment-qrs/${schoolId}/approve`, { json: { link: MERCHANT_QR } })).status, 403);
        assert.equal((await newClient().get("/api/admin/payment-qrs")).status, 401);
        assert.equal((await admin.get("/api/admin/payment-qrs?status=ANY")).status, 400);
        assert.equal((await admin.patch("/api/admin/payment-qrs/not-an-id/approve", { json: { link: MERCHANT_QR } })).status, 404);
        assert.equal((await admin.patch("/api/admin/payment-qrs/0123456789abcdef01234567/approve", { json: { link: MERCHANT_QR } })).status, 404);
    });
});
