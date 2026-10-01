import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PASSWORD, createAdmin, createClient, donorData, login, ngoData, registerActive, schoolData, startTestServer } from "./helpers.js";
import { validateVolunteer } from "../../shared/volunteerRules.js";

let server;
let admin;
const newClient = () => createClient(server.baseUrl);
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const signedIn = async (factory, role) => {
    const data = factory();
    await registerActive(newClient(), data);
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, role)).status, 200);
    return c;
};
let n = 0;
const approvedProject = async () => {
    const school = await signedIn(schoolData, "school");
    const res = await school.post("/api/school/projects", {
        json: {
            title: `Drinking water filter ${(n += 1)}`, category: "Drinking Water", priority: "High", budget: "25000", studentsBenefited: "300",
            problem: "Children drink untreated borewell water and many fall ill every monsoon.", expectedCompletion: inDays(60),
        },
    });
    assert.equal((await admin.patch(`/api/admin/projects/${res.body.project.id}/approve`)).status, 200);
    return res.body.project;
};
const add = (c, json) => c.post("/api/ngo/volunteers", { json });

before(async () => {
    server = await startTestServer();
    const credentials = await createAdmin();
    admin = newClient();
    assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
});
after(() => server.stop());

describe("volunteer rules", () => {
    test("name and role are required; phone and project are optional", () => {
        assert.deepEqual(Object.keys(validateVolunteer({}).errors).sort(), ["name", "role"]);
        const { errors, values } = validateVolunteer({ name: "  Kavya   Rao ", role: "Field coordinator", phone: "098450 12345", projectId: "" });
        assert.deepEqual(errors, {});
        assert.deepEqual(values, { name: "Kavya Rao", role: "Field coordinator", phone: "+919845012345", projectId: null });
        assert.ok(validateVolunteer({ name: "Kavya", role: "Coordinator", phone: "12345" }).errors.phone);
        assert.ok(validateVolunteer({ name: "K", role: "Coordinator" }).errors.name);
        assert.ok(validateVolunteer({ name: "Kavya", role: "Coordinator", projectId: "not-an-id" }).errors.projectId);
    });
});

describe("an NGO manages its own volunteers", () => {
    test("add, list (newest first), edit and remove", async () => {
        const c = await signedIn(ngoData, "ngo");
        assert.deepEqual((await c.get("/api/ngo/volunteers")).body.volunteers, []);

        const first = await add(c, { name: "Kavya Rao", role: "Field coordinator", phone: "98450 12345" });
        assert.equal(first.status, 201, JSON.stringify(first.body));
        assert.deepEqual(
            { ...first.body.volunteer, id: undefined, createdAt: undefined },
            { id: undefined, name: "Kavya Rao", role: "Field coordinator", phone: "+919845012345", project: null, createdAt: undefined }
        );
        const second = (await add(c, { name: "Imran Khan", role: "Electrician" })).body.volunteer;
        assert.equal(second.phone, "");
        assert.deepEqual((await c.get("/api/ngo/volunteers")).body.volunteers.map((v) => v.name), ["Imran Khan", "Kavya Rao"]);

        const edited = await c.patch(`/api/ngo/volunteers/${first.body.volunteer.id}`, { json: { role: "Project lead", phone: "" } });
        assert.equal(edited.status, 200);
        assert.equal(edited.body.volunteer.role, "Project lead");
        assert.equal(edited.body.volunteer.phone, "");
        assert.equal(edited.body.volunteer.name, "Kavya Rao", "fields not sent stay the same");

        assert.equal((await c.delete(`/api/ngo/volunteers/${second.id}`)).status, 200);
        assert.equal((await c.delete(`/api/ngo/volunteers/${second.id}`)).status, 404);
        assert.deepEqual((await c.get("/api/ngo/volunteers")).body.volunteers.map((v) => v.name), ["Kavya Rao"]);
    });

    test("bad input and extra fields are refused", async () => {
        const c = await signedIn(ngoData, "ngo");
        assert.equal((await add(c, { role: "Coordinator" })).status, 400);
        assert.equal((await add(c, { name: "Kavya Rao", role: "Coordinator", phone: "12345" })).status, 400);
        const res = await add(c, { name: "Kavya Rao", role: "Coordinator", ngo: "64b000000000000000000000" });
        assert.equal(res.status, 400);
        assert.match(res.body.message, /Unexpected field/);
        const { volunteer } = (await add(c, { name: "Kavya Rao", role: "Coordinator" })).body;
        assert.equal((await c.patch(`/api/ngo/volunteers/${volunteer.id}`, { json: {} })).status, 400);
        assert.equal((await c.patch(`/api/ngo/volunteers/${volunteer.id}`, { json: { name: "" } })).status, 400);
    });

    test("a volunteer can only be assigned to a need this NGO has committed to fund", async () => {
        const c = await signedIn(ngoData, "ngo");
        const other = await signedIn(ngoData, "ngo");
        const funded = await approvedProject();
        const notFunded = await approvedProject();
        const fundedByOther = await approvedProject();
        assert.equal((await c.post(`/api/projects/${funded.id}/commitments`, { json: { parts: [1] } })).status, 201);
        assert.equal((await other.post(`/api/projects/${fundedByOther.id}/commitments`, { json: { parts: [1] } })).status, 201);

        for (const project of [notFunded, fundedByOther]) {
            const res = await add(c, { name: "Kavya Rao", role: "Coordinator", projectId: project.id });
            assert.equal(res.status, 400, project.title);
            assert.ok(res.body.errors.projectId);
        }
        const res = await add(c, { name: "Kavya Rao", role: "Coordinator", projectId: funded.id });
        assert.equal(res.status, 201);
        assert.deepEqual(res.body.volunteer.project, { id: funded.id, title: funded.title });

        const cleared = await c.patch(`/api/ngo/volunteers/${res.body.volunteer.id}`, { json: { projectId: null } });
        assert.equal(cleared.body.volunteer.project, null);
    });

    test("another NGO can't see, change or remove them", async () => {
        const c = await signedIn(ngoData, "ngo");
        const other = await signedIn(ngoData, "ngo");
        const { volunteer } = (await add(c, { name: "Kavya Rao", role: "Coordinator" })).body;
        assert.deepEqual((await other.get("/api/ngo/volunteers")).body.volunteers, []);
        assert.equal((await other.patch(`/api/ngo/volunteers/${volunteer.id}`, { json: { name: "Taken over" } })).status, 404);
        assert.equal((await other.delete(`/api/ngo/volunteers/${volunteer.id}`)).status, 404);
        assert.equal((await c.get("/api/ngo/volunteers")).body.volunteers[0].name, "Kavya Rao");
    });

    test("schools, donors and admins get 403; signed-out users get 401", async () => {
        const school = await signedIn(schoolData, "school");
        const donor = await signedIn(donorData, "donor");
        for (const c of [school, donor, admin]) {
            assert.equal((await c.get("/api/ngo/volunteers")).status, 403);
            assert.equal((await add(c, { name: "Kavya Rao", role: "Coordinator" })).status, 403);
        }
        assert.equal((await newClient().get("/api/ngo/volunteers")).status, 401);
    });
});
