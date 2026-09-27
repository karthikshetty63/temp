import assert from "node:assert/strict";
import fs from "node:fs";
import { after, before, describe, test } from "node:test";
import { FILES, PASSWORD, createAdmin, createClient, donorData, login, ngoData, registerActive, schoolData, startTestServer } from "./helpers.js";

let server;
let UploadedFile;
let admin;
const newClient = () => createClient(server.baseUrl);
const diskFiles = () => fs.readdirSync(server.uploadDir);

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const signedIn = async (factory, role) => {
    const data = factory();
    await registerActive(newClient(), data);
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, role)).status, 200);
    return c;
};
const createProject = async (c, title = "Library shelves and books") => {
    const res = await c.post("/api/school/projects", {
        json: {
            title,
            category: "Library",
            problem: "The school has no library; 300 students have no books beyond their textbooks.",
            priority: "High",
            budget: "80000",
            studentsBenefited: "300",
            expectedCompletion: inDays(90),
        },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.project;
};

/** The multipart body the gallery form sends. */
const photoForm = ({ projectId, stage = "Before", caption = "", file = FILES.png(), field = "photo", extra = {} } = {}) => {
    const form = new FormData();
    if (projectId !== undefined) form.append("projectId", projectId);
    if (stage !== undefined) form.append("stage", stage);
    form.append("caption", caption);
    for (const [key, value] of Object.entries(extra)) form.append(key, value);
    if (file) form.append(field, file);
    return form;
};
const upload = (c, options) => c.post("/api/school/photos", { form: photoForm(options) });

/** Runs `fn` and checks it left no file behind on disk or in the database. */
const expectNothingStored = async (fn) => {
    const before = { disk: diskFiles().length, db: await UploadedFile.countDocuments() };
    await fn();
    assert.equal(diskFiles().length, before.disk, "a file was written to disk");
    assert.equal(await UploadedFile.countDocuments(), before.db, "an UploadedFile record was created");
};

let school;
let project;

before(async () => {
    server = await startTestServer();
    UploadedFile = (await import("../models/UploadedFile.js")).default;
    const credentials = await createAdmin();
    admin = newClient();
    assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
    school = await signedIn(schoolData, "school");
    project = await createProject(school);
});
after(() => server.stop());

describe("school adds photos to its own projects", () => {
    test("upload: stored privately, linked to the project, listed, viewable by the school and admins only", async () => {
        const res = await upload(school, { projectId: project.id, stage: "Before", caption: "  Empty   classroom   corner " });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        const { photo } = res.body;
        assert.deepEqual(Object.keys(photo).sort(), ["caption", "createdAt", "file", "id", "project", "stage"]);
        assert.deepEqual(photo.project, { id: project.id, title: project.title });
        assert.equal(photo.stage, "Before");
        assert.equal(photo.caption, "Empty classroom corner");
        assert.equal(photo.file.mimeType, "image/png");
        assert.equal(photo.file.storageKey, undefined, "storage key must never be sent");

        const list = await school.get("/api/school/photos");
        assert.equal(list.status, 200);
        assert.deepEqual(list.body.photos.map((p) => p.id), [photo.id]);

        const own = await school.get(`/api/files/${photo.file.id}`);
        assert.equal(own.status, 200);
        assert.equal(own.headers.get("content-type"), "image/png");
        assert.equal((await admin.get(`/api/files/${photo.file.id}`)).status, 200);

        const otherSchool = await signedIn(schoolData, "school");
        assert.equal((await otherSchool.get(`/api/files/${photo.file.id}`)).status, 404, "another school must not see it");
        assert.deepEqual((await otherSchool.get("/api/school/photos")).body.photos, [], "another school's gallery stays empty");
    });

    test("a school only ever lists its own photos, newest first", async () => {
        const c = await signedIn(schoolData, "school");
        const p = await createProject(c, "Drinking water filter");
        const first = (await upload(c, { projectId: p.id, stage: "Before" })).body.photo;
        const second = (await upload(c, { projectId: p.id, stage: "In progress", file: FILES.jpeg() })).body.photo;
        const list = (await c.get("/api/school/photos")).body.photos;
        assert.deepEqual(list.map((x) => x.id), [second.id, first.id]);
        assert.equal(list[0].file.mimeType, "image/jpeg");
    });

    test("fields the form doesn't have are ignored: a photo can't be filed under another school", async () => {
        const other = await signedIn(schoolData, "school");
        const res = await upload(school, { projectId: project.id, extra: { school: "000000000000000000000000", file: "x" } });
        assert.equal(res.status, 201);
        assert.deepEqual((await other.get("/api/school/photos")).body.photos, []);
    });
});

describe("invalid uploads are refused and store nothing", () => {
    test("no photo, a JSON body, or the wrong field name", async () => {
        await expectNothingStored(async () => {
            const none = await upload(school, { projectId: project.id, file: null });
            assert.equal(none.status, 400);
            assert.equal(none.body.errors.photo, "Choose a photo to upload.");
            assert.equal((await school.post("/api/school/photos", { json: { projectId: project.id, stage: "Before" } })).status, 400);
            const wrongField = await upload(school, { projectId: project.id, field: "schoolPhoto" });
            assert.equal(wrongField.status, 400);
            assert.ok(wrongField.body.errors.schoolPhoto);
        });
    });

    test("not really an image: a script named .png, a PDF, an .exe", async () => {
        await expectNothingStored(async () => {
            for (const file of [FILES.fakePng(), FILES.pdf(), FILES.exe()]) {
                const res = await upload(school, { projectId: project.id, file });
                assert.equal(res.status, 400, file.name);
                assert.ok(res.body.errors.photo, file.name);
            }
        });
    });

    test("two photos at once, or one over 5 MB", async () => {
        await expectNothingStored(async () => {
            const form = photoForm({ projectId: project.id });
            form.append("photo", FILES.png());
            assert.equal((await school.post("/api/school/photos", { form })).status, 400);
            assert.equal((await upload(school, { projectId: project.id, file: FILES.oversized() })).status, 413);
        });
    });

    test("missing, malformed or someone else's project", async () => {
        const other = await signedIn(schoolData, "school");
        const othersProject = await createProject(other, "Someone else's project");
        await expectNothingStored(async () => {
            const missing = await upload(school, {});
            assert.equal(missing.status, 400);
            assert.equal(missing.body.errors.projectId, "Choose the project this photo belongs to.");
            for (const projectId of ["abc", "000000000000000000000000", othersProject.id]) {
                const res = await upload(school, { projectId });
                assert.equal(res.status, 400, projectId);
                assert.equal(res.body.errors.projectId, "Choose one of your projects.", projectId);
            }
        });
    });

    test("an unknown stage or a caption over 200 characters", async () => {
        await expectNothingStored(async () => {
            const stage = await upload(school, { projectId: project.id, stage: "Finished" });
            assert.equal(stage.status, 400);
            assert.equal(stage.body.errors.stage, "Choose when the photo was taken.");
            const caption = await upload(school, { projectId: project.id, caption: "x".repeat(201) });
            assert.equal(caption.status, 400);
            assert.ok(caption.body.errors.caption);
        });
    });
});

describe("deleting photos", () => {
    test("the school deletes its photo: gone from the gallery, the database and the disk", async () => {
        const photo = (await upload(school, { projectId: project.id, stage: "Completed" })).body.photo;
        const doc = await UploadedFile.findById(photo.file.id);
        const filePath = `${server.uploadDir}/${doc.storageKey}`;
        assert.ok(fs.existsSync(filePath));

        const res = await school.delete(`/api/school/photos/${photo.id}`);
        assert.equal(res.status, 200);
        assert.ok(!(await school.get("/api/school/photos")).body.photos.some((p) => p.id === photo.id));
        assert.equal(await UploadedFile.findById(photo.file.id), null);
        assert.equal(fs.existsSync(filePath), false);
        assert.equal((await school.delete(`/api/school/photos/${photo.id}`)).status, 404, "second delete");
    });

    test("another school can't delete it; a bad id is simply not found", async () => {
        const photo = (await upload(school, { projectId: project.id })).body.photo;
        const other = await signedIn(schoolData, "school");
        assert.equal((await other.delete(`/api/school/photos/${photo.id}`)).status, 404);
        assert.ok((await school.get("/api/school/photos")).body.photos.some((p) => p.id === photo.id), "photo must survive");
        assert.equal((await school.delete("/api/school/photos/not-an-id")).status, 404);
    });
});

describe("only schools can use the gallery", () => {
    test("NGO, donor and admin get 403; signed-out users get 401", async () => {
        const ngo = await signedIn(ngoData, "ngo");
        const donor = await signedIn(donorData, "donor");
        for (const c of [ngo, donor, admin]) {
            assert.equal((await c.get("/api/school/photos")).status, 403);
            assert.equal((await upload(c, { projectId: project.id })).status, 403);
        }
        const anon = newClient();
        assert.equal((await anon.get("/api/school/photos")).status, 401);
        assert.equal((await upload(anon, { projectId: project.id })).status, 401);
    });
});
