import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { after, before, describe, test } from "node:test";
import { FILES, PASSWORD, createClient, donorData, login, ngoData, registrationForm, requiredFiles, schoolData, startTestServer } from "./helpers.js";

let server;
let User;
let UploadedFile;

const newClient = () => createClient(server.baseUrl);
const registerWithFiles = (data, files) => newClient().post("/api/auth/register", { form: registrationForm(data, files) });
const diskFiles = () => fs.readdirSync(server.uploadDir);

/** Register + approve a school (with its required documents plus `files`) and return a logged-in client. */
const approvedSchool = async (files = {}) => {
    const data = schoolData();
    const res = await registerWithFiles(data, { ...requiredFiles("school"), ...files });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    await User.updateOne({ email: data.email }, { $set: { accountStatus: "active" } });
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, "school")).status, 200);
    return { c, data };
};

before(async () => {
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
    UploadedFile = (await import("../models/UploadedFile.js")).default;
});
after(() => server.stop());

describe("registration uploads", () => {
    test("school with photo + documents: files stored, linked to profile, visible after login", async () => {
        const before = diskFiles().length;
        const { c } = await approvedSchool({ schoolPhoto: FILES.png(), schoolCertificate: FILES.pdf(), principalIdProof: FILES.jpeg() });
        assert.equal(diskFiles().length, before + 3);

        const me = await c.get("/api/profile/me");
        assert.equal(me.status, 200);
        assert.equal(me.body.profile.photo.mimeType, "image/png");
        assert.equal(me.body.profile.documents.registrationCertificate.mimeType, "application/pdf");
        assert.equal(me.body.profile.documents.principalIdProof.mimeType, "image/jpeg");
        assert.equal(me.body.profile.bankAccount, "•••• 9012", "bank account is masked for the owner view");
        assert.ok(!JSON.stringify(me.body).includes("storageKey"));

        const photo = await c.get(`/api/files/${me.body.profile.photo.id}`);
        assert.equal(photo.status, 200);
        assert.equal(photo.headers.get("content-type"), "image/png");
        assert.equal(photo.headers.get("x-content-type-options"), "nosniff");
        assert.match(photo.headers.get("cache-control"), /no-store/);
        assert.ok(Buffer.isBuffer(photo.body) && photo.body.length > 0);
    });

    test("NGO documents are stored and linked", async () => {
        const data = ngoData();
        const res = await registerWithFiles(data, { registrationCertificate: FILES.pdf(), panCard: FILES.png() });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        const NGOProfile = (await import("../models/NGOProfile.js")).default;
        const profile = await NGOProfile.findOne({ pan: data.pan }).lean();
        assert.ok(profile.documents.registrationCertificate);
        assert.ok(profile.documents.panCard);
        assert.equal(profile.documents.annualReport, undefined);
    });

    test("invalid type (exe) → 400, nothing stored, no account", async () => {
        const before = diskFiles().length;
        const data = schoolData();
        const res = await registerWithFiles(data, { schoolCertificate: FILES.exe() });
        assert.equal(res.status, 400);
        assert.ok(res.body.errors.schoolCertificate);
        assert.equal(res.body.step, 3, "points the form back to the Documents step");
        assert.equal(diskFiles().length, before);
        assert.equal(await User.countDocuments({ email: data.email }), 0);
    });

    test("file whose content is not really an image (spoofed .png) → 400", async () => {
        const res = await registerWithFiles(schoolData(), { schoolPhoto: FILES.fakePng() });
        assert.equal(res.status, 400);
        assert.match(res.body.errors.schoolPhoto, /content does not match/);
    });

    test("PDF is not accepted as the school photograph", async () => {
        const res = await registerWithFiles(schoolData(), { schoolPhoto: FILES.pdf() });
        assert.equal(res.status, 400);
        assert.ok(res.body.errors.schoolPhoto);
    });

    test("oversized file (> 5 MB) → 413 and nothing stored", async () => {
        const before = diskFiles().length;
        const data = schoolData();
        const res = await registerWithFiles(data, { schoolPhoto: FILES.oversized() });
        assert.equal(res.status, 413);
        assert.match(res.body.message, /5 MB/);
        assert.equal(diskFiles().length, before);
        assert.equal(await User.countDocuments({ email: data.email }), 0);
    });

    test("unexpected file field, duplicate field, donor files → 400", async () => {
        assert.equal((await registerWithFiles(schoolData(), { panCard: FILES.pdf() })).status, 400, "NGO field on school form");
        const form = registrationForm(schoolData(), { schoolPhoto: FILES.png() });
        form.append("schoolPhoto", FILES.png());
        assert.equal((await newClient().post("/api/auth/register", { form })).status, 400, "two photos");
        const { donorData } = await import("./helpers.js");
        assert.equal((await registerWithFiles(donorData(), { schoolPhoto: FILES.png() })).status, 400, "donor has no uploads");
    });

    test("extra multipart text fields are rejected", async () => {
        const form = registrationForm(schoolData());
        form.append("accountStatus", "active");
        assert.equal((await newClient().post("/api/auth/register", { form })).status, 400);
    });

    test("validation failure on a text field leaves no files behind", async () => {
        const before = diskFiles().length;
        const res = await registerWithFiles(schoolData({ ifsc: "bad" }), { schoolPhoto: FILES.png() });
        assert.equal(res.status, 400);
        assert.equal(diskFiles().length, before);
    });

    test("required documents: school certificate + principal ID, NGO certificate + PAN, donor PAN", async () => {
        const { getMissingUploads } = await import("../../shared/registrationRules.js");
        assert.deepEqual(getMissingUploads("school", ["schoolPhoto"]).map((m) => m.field), ["schoolCertificate", "principalIdProof"]);
        assert.deepEqual(getMissingUploads("ngo", ["annualReport"]).map((m) => m.field), ["registrationCertificate", "panCard"]);
        assert.deepEqual(getMissingUploads("donor", []).map((m) => m.field), ["panCard"]);
        assert.deepEqual(getMissingUploads("school", ["schoolCertificate", "principalIdProof"]), []);
    });

    test("registering without the required documents is refused and points to the Documents step", async () => {
        for (const [data, missing, step] of [[schoolData(), ["schoolCertificate", "principalIdProof"], 3], [ngoData(), ["registrationCertificate", "panCard"], 5], [donorData(), ["panCard"], 4]]) {
            const res = await registerWithFiles(data, {});
            assert.equal(res.status, 400, data.role);
            assert.deepEqual(Object.keys(res.body.errors).sort(), [...missing].sort(), data.role);
            assert.equal(res.body.step, step, `${data.role}: jumps to the Documents step`);
            assert.equal(await User.countDocuments({ email: data.email }), 0);
        }
    });

    test("donor PAN card is stored privately and linked to the donor profile", async () => {
        const data = donorData();
        const res = await registerWithFiles(data, { panCard: FILES.jpeg() });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        const DonorProfile = (await import("../models/DonorProfile.js")).default;
        const user = await User.findOne({ email: data.email });
        const profile = await DonorProfile.findOne({ userId: user._id }).lean();
        const file = await UploadedFile.findById(profile.documents.panCard);
        assert.equal(file.mimeType, "image/jpeg");
        assert.equal(file.owner.toString(), user._id.toString());
    });
});

describe("school photo replace / remove", () => {
    test("replace: new photo linked, old file removed from disk and DB", async () => {
        const { c } = await approvedSchool({ schoolPhoto: FILES.png() });
        const oldId = (await c.get("/api/profile/me")).body.profile.photo.id;
        const oldDoc = await UploadedFile.findById(oldId);
        const oldPath = `${server.uploadDir}/${oldDoc.storageKey}`;
        assert.ok(fs.existsSync(oldPath));

        const form = new FormData();
        form.append("schoolPhoto", FILES.jpeg());
        const res = await c.put("/api/profile/photo", { form });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.photo.mimeType, "image/jpeg");

        const me = await c.get("/api/profile/me");
        assert.equal(me.body.profile.photo.id, res.body.photo.id);
        assert.equal(await UploadedFile.findById(oldId), null);
        assert.equal(fs.existsSync(oldPath), false);
        assert.equal((await c.get(`/api/files/${oldId}`)).status, 404);
    });

    test("replace with invalid file keeps the existing photo", async () => {
        const { c } = await approvedSchool({ schoolPhoto: FILES.png() });
        const before = (await c.get("/api/profile/me")).body.profile.photo.id;
        const form = new FormData();
        form.append("schoolPhoto", FILES.fakePng());
        assert.equal((await c.put("/api/profile/photo", { form })).status, 400);
        const empty = new FormData();
        assert.equal((await c.put("/api/profile/photo", { form: empty })).status, 400);
        assert.equal((await c.get("/api/profile/me")).body.profile.photo.id, before);
    });

    test("remove: photo unset and file deleted", async () => {
        const { c } = await approvedSchool({ schoolPhoto: FILES.png() });
        const oldId = (await c.get("/api/profile/me")).body.profile.photo.id;
        const res = await c.delete("/api/profile/photo");
        assert.equal(res.status, 200);
        assert.equal((await c.get("/api/profile/me")).body.profile.photo, null);
        assert.equal(await UploadedFile.findById(oldId), null);
    });

    test("upload a photo when the school registered without one", async () => {
        const { c } = await approvedSchool();
        assert.equal((await c.get("/api/profile/me")).body.profile.photo, null);
        const form = new FormData();
        form.append("schoolPhoto", FILES.png());
        assert.equal((await c.put("/api/profile/photo", { form })).status, 200);
        assert.equal((await c.get("/api/profile/me")).body.profile.photo.mimeType, "image/png");
    });
});

describe("private file access", () => {
    test("another school, a donor, and anonymous users cannot read someone else's documents", async () => {
        const { c: owner } = await approvedSchool({ principalIdProof: FILES.jpeg() });
        const docId = (await owner.get("/api/profile/me")).body.profile.documents.principalIdProof.id;
        assert.equal((await owner.get(`/api/files/${docId}`)).status, 200);

        const { c: otherSchool } = await approvedSchool();
        assert.equal((await otherSchool.get(`/api/files/${docId}`)).status, 404);
        assert.equal((await newClient().get(`/api/files/${docId}`)).status, 401);
        assert.equal((await otherSchool.get("/api/files/not-an-id")).status, 404);
    });

    test("upload folder is not publicly served", async () => {
        const [name] = diskFiles();
        assert.ok(name, "there should be at least one stored file by now");
        for (const path of [`/uploads/${name}`, `/server/uploads/${name}`, `/api/uploads/${name}`]) {
            const res = await newClient().get(path);
            assert.notEqual(res.status, 200, path);
        }
    });
});
