import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { FILES, PASSWORD, createAdmin, createClient, donorData, login, ngoData, register, registrationForm, schoolData, startTestServer } from "./helpers.js";

let server;
let admin;
let User;

const newClient = () => createClient(server.baseUrl);
const idOf = async (email) => (await User.findOne({ email }))._id.toString();

before(async () => {
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
    const credentials = await createAdmin();
    admin = newClient();
    assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
});
after(() => server.stop());

describe("admin account creation (controlled mechanism)", () => {
    test("createOrResetAdmin creates an active admin and refuses to promote other accounts", async () => {
        const { createOrResetAdmin } = await import("../services/adminAccount.js");
        const donor = donorData();
        await register(newClient(), donor);
        await assert.rejects(createOrResetAdmin({ name: "X", email: donor.email, password: PASSWORD }), /non-admin/);
        await assert.rejects(createOrResetAdmin({ name: "X", email: "weak@admin.test", password: "short" }), /at least 8/);

        const { created, user } = await createOrResetAdmin({ name: "Second Admin", email: "Second@Admin.test", password: PASSWORD });
        assert.equal(created, true);
        assert.equal(user.role, "admin");
        assert.equal(user.accountStatus, "active");
        assert.equal(user.email, "second@admin.test");
        await assert.rejects(createOrResetAdmin({ name: "Again", email: "second@admin.test", password: PASSWORD }), /already exists/);
    });
});

describe("approval queue", () => {
    test("pending list contains new schools, NGOs and donors", async () => {
        const school = schoolData();
        const ngo = ngoData();
        const donor = donorData();
        await register(newClient(), school);
        await register(newClient(), ngo);
        await register(newClient(), donor);

        const res = await admin.get("/api/admin/accounts?status=pending");
        assert.equal(res.status, 200);
        const emails = res.body.accounts.map((a) => a.email);
        assert.ok(emails.includes(school.email));
        assert.ok(emails.includes(ngo.email));
        assert.ok(emails.includes(donor.email), "donors are reviewed too");
        const schoolRow = res.body.accounts.find((a) => a.email === school.email);
        assert.equal(schoolRow.organisationName, school.schoolName);
        assert.equal(schoolRow.identifier, school.udise);
        const donorRow = res.body.accounts.find((a) => a.email === donor.email);
        assert.equal(donorRow.organisationName, null, "a donor is a person, not an organisation");
        assert.equal(donorRow.district, donor.city);
        assert.equal(donorRow.documentCount, 1, "their PAN card");
        assert.ok(res.body.pendingCounts.school >= 1 && res.body.pendingCounts.ngo >= 1 && res.body.pendingCounts.donor >= 1);

        const onlySchools = await admin.get("/api/admin/accounts?role=school&status=pending");
        assert.ok(onlySchools.body.accounts.every((a) => a.role === "school"));
        const onlyDonors = await admin.get("/api/admin/accounts?role=donor&status=pending");
        assert.equal(onlyDonors.status, 200);
        assert.ok(onlyDonors.body.accounts.length >= 1 && onlyDonors.body.accounts.every((a) => a.role === "donor"));
    });

    test("invalid filters → 400", async () => {
        assert.equal((await admin.get("/api/admin/accounts?role=admin")).status, 400, "admins are not reviewed");
        assert.equal((await admin.get("/api/admin/accounts?role=superuser")).status, 400);
        assert.equal((await admin.get("/api/admin/accounts?status=deleted")).status, 400);
    });

    test("view details includes profile and document metadata, never storage keys or password", async () => {
        const school = schoolData();
        await newClient().post("/api/auth/register", { form: registrationForm(school, { schoolCertificate: FILES.pdf(), principalIdProof: FILES.jpeg(), schoolPhoto: FILES.png() }) });
        const res = await admin.get(`/api/admin/accounts/${await idOf(school.email)}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.profile.udise, school.udise);
        assert.equal(res.body.profile.bankAccount, "123456789012", "admin sees full bank details to verify them");
        assert.equal(res.body.profile.documents.registrationCertificate.mimeType, "application/pdf");
        assert.equal(res.body.profile.photo.mimeType, "image/png");
        const text = JSON.stringify(res.body);
        assert.ok(!text.includes("storageKey") && !text.includes("password"));

        // Admin can open the private document.
        const file = await admin.get(`/api/files/${res.body.profile.documents.registrationCertificate.id}`);
        assert.equal(file.status, 200);
        assert.equal(file.headers.get("content-type"), "application/pdf");
    });

    test("donor details show their profile and PAN card, which the admin can open", async () => {
        const donor = donorData();
        await register(newClient(), donor);
        const res = await admin.get(`/api/admin/accounts/${await idOf(donor.email)}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.account.role, "donor");
        assert.equal(res.body.profile.city, donor.city);
        assert.equal(res.body.profile.documents.panCard.mimeType, "application/pdf");
        assert.equal((await admin.get(`/api/files/${res.body.profile.documents.panCard.id}`)).status, 200);
        assert.ok(!JSON.stringify(res.body).includes("storageKey"));
    });

    test("details for unknown / admin / malformed ids → 404", async () => {
        const other = await createAdmin();
        assert.equal((await admin.get(`/api/admin/accounts/${await idOf(other.email)}`)).status, 404, "admins are not in the review queue");
        assert.equal((await admin.get("/api/admin/accounts/64b000000000000000000000")).status, 404);
        assert.equal((await admin.get("/api/admin/accounts/not-an-id")).status, 404);
    });
});

describe("approve / reject", () => {
    test("approve school → it can log in; approval metadata recorded; profile preserved", async () => {
        const school = schoolData();
        await register(newClient(), school);
        const id = await idOf(school.email);

        const res = await admin.patch(`/api/admin/accounts/${id}/approve`);
        assert.equal(res.status, 200);
        assert.equal(res.body.account.accountStatus, "active");

        const stored = await User.findById(id);
        assert.ok(stored.statusChangedAt instanceof Date);
        assert.ok(stored.statusChangedBy);
        const SchoolProfile = (await import("../models/SchoolProfile.js")).default;
        assert.equal((await SchoolProfile.findOne({ userId: id })).udise, school.udise);

        const loginRes = await login(newClient(), school.email, PASSWORD, "school");
        assert.equal(loginRes.status, 200);
        assert.equal((await admin.patch(`/api/admin/accounts/${id}/approve`)).status, 409, "approving twice is a conflict");
    });

    test("approve NGO → it can log in", async () => {
        const ngo = ngoData();
        await register(newClient(), ngo);
        assert.equal((await admin.patch(`/api/admin/accounts/${await idOf(ngo.email)}/approve`)).status, 200);
        assert.equal((await login(newClient(), ngo.email, PASSWORD, "ngo")).status, 200);
    });

    test("a new donor can't sign in until approved; after approval they can", async () => {
        const donor = donorData();
        await register(newClient(), donor);
        const before = await login(newClient(), donor.email, PASSWORD, "donor");
        assert.equal(before.status, 403);
        assert.equal(before.body.code, "ACCOUNT_PENDING");
        assert.equal((await admin.patch(`/api/admin/accounts/${await idOf(donor.email)}/approve`)).status, 200);
        assert.equal((await login(newClient(), donor.email, PASSWORD, "donor")).status, 200);
    });

    test("reject donor: sign-in shows the reason", async () => {
        const donor = donorData();
        await register(newClient(), donor);
        await admin.patch(`/api/admin/accounts/${await idOf(donor.email)}/reject`, { json: { reason: "PAN card image is unreadable." } });
        const res = await login(newClient(), donor.email, PASSWORD, "donor");
        assert.equal(res.status, 403);
        assert.equal(res.body.code, "ACCOUNT_REJECTED");
        assert.equal(res.body.reason, "PAN card image is unreadable.");
    });

    test("reject school requires a reason, blocks login and shows the reason", async () => {
        const school = schoolData();
        await register(newClient(), school);
        const id = await idOf(school.email);

        assert.equal((await admin.patch(`/api/admin/accounts/${id}/reject`, { json: {} })).status, 400);
        assert.equal((await admin.patch(`/api/admin/accounts/${id}/reject`, { json: { reason: "no" } })).status, 400);

        const res = await admin.patch(`/api/admin/accounts/${id}/reject`, { json: { reason: "UDISE code could not be verified." } });
        assert.equal(res.status, 200);
        assert.equal(res.body.account.accountStatus, "rejected");
        assert.equal(res.body.account.rejectionReason, "UDISE code could not be verified.");

        const loginRes = await login(newClient(), school.email, PASSWORD, "school");
        assert.equal(loginRes.status, 403);
        assert.equal(loginRes.body.code, "ACCOUNT_REJECTED");
        assert.equal(loginRes.body.reason, "UDISE code could not be verified.");
    });

    test("reject NGO; rejecting an ACTIVE NGO ends its current session", async () => {
        const ngo = ngoData();
        await register(newClient(), ngo);
        const id = await idOf(ngo.email);
        await admin.patch(`/api/admin/accounts/${id}/approve`);
        const ngoClient = newClient();
        await login(ngoClient, ngo.email, PASSWORD, "ngo");
        assert.equal((await ngoClient.get("/api/auth/me")).status, 200);

        assert.equal((await admin.patch(`/api/admin/accounts/${id}/reject`, { json: { reason: "Registration certificate expired." } })).status, 200);
        assert.equal((await ngoClient.get("/api/auth/me")).status, 401);
        assert.equal((await admin.patch(`/api/admin/accounts/${id}/reject`, { json: { reason: "Again and again." } })).status, 409);

        // A rejected account can be re-approved after review.
        assert.equal((await admin.patch(`/api/admin/accounts/${id}/approve`)).status, 200);
        assert.equal((await login(newClient(), ngo.email, PASSWORD, "ngo")).status, 200);
    });

    test("unauthorized approval attempts: anonymous 401, approved school 403, target unchanged", async () => {
        const target = schoolData();
        await register(newClient(), target);
        const id = await idOf(target.email);

        assert.equal((await newClient().patch(`/api/admin/accounts/${id}/approve`)).status, 401);

        const other = schoolData();
        await register(newClient(), other);
        await User.updateOne({ email: other.email }, { $set: { accountStatus: "active" } });
        const schoolClient = newClient();
        await login(schoolClient, other.email, PASSWORD, "school");
        assert.equal((await schoolClient.patch(`/api/admin/accounts/${id}/approve`)).status, 403);

        assert.equal((await User.findById(id)).accountStatus, "pending");
    });
});
