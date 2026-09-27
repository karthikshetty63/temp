import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PASSWORD, createAdmin, createClient, donorData, login, ngoData, register, registerActive, schoolData, startTestServer } from "./helpers.js";

let server;
let User;
let Project;
const newClient = () => createClient(server.baseUrl);

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const projectData = (overrides = {}) => ({
    title: "Smart Classroom & Interactive Board",
    category: "Classroom Development",
    problem: "Leaking roof and no digital learning tools for 240 primary students.",
    priority: "High",
    budget: "120000",
    studentsBenefited: "240",
    expectedCompletion: inDays(120),
    location: "",
    materials: "Smart TV, Dual Desks, Wiring Kit",
    ...overrides,
});

/** An approved school, signed in. */
const signedInSchool = async () => {
    const data = schoolData();
    await register(newClient(), data);
    await User.updateOne({ email: data.email }, { $set: { accountStatus: "active" } });
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, "school")).status, 200);
    return { c, data };
};

const create = (c, overrides) => c.post("/api/school/projects", { json: projectData(overrides) });

before(async () => {
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
    Project = (await import("../models/Project.js")).default;
});
after(() => server.stop());

describe("shared project rules", () => {
    test("the server's categories are exactly the ones the website's form offers", async () => {
        const { PROJECT_CATEGORIES } = await import("../../shared/projectRules.js");
        const { INFRASTRUCTURE_CATEGORIES } = await import("../../src/constants/infrastructureCategories.js");
        assert.deepEqual(PROJECT_CATEGORIES, INFRASTRUCTURE_CATEGORIES.map((c) => c.id));
    });
});

describe("school projects: create and list", () => {
    test("an approved school creates a project; values are cleaned and the location defaults to its district", async () => {
        const { c, data } = await signedInSchool();
        const res = await create(c, { title: "  Smart   Classroom  Setup ", materials: "Smart TV, , Dual Desks, Smart TV" });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        const p = res.body.project;
        assert.equal(p.title, "Smart Classroom Setup");
        assert.equal(p.budget, 120000);
        assert.equal(p.studentsBenefited, 240);
        assert.deepEqual(p.materials, ["Smart TV", "Dual Desks"]);
        assert.equal(p.status, "Open");
        assert.equal(p.raised, 0);
        assert.equal(p.location, `${data.district}, ${data.state}`);
        assert.equal(p.expectedCompletion, inDays(120));
        assert.deepEqual(
            Object.keys(p).sort(),
            ["budget", "category", "createdAt", "expectedCompletion", "id", "location", "materials", "priority", "problem", "raised", "rejectionReason", "reviewStatus", "reviewedAt", "status", "studentsBenefited", "submittedAt", "title", "updatedAt"]
        );

        const list = await c.get("/api/school/projects");
        assert.equal(list.status, 200);
        assert.equal(list.body.projects.length, 1);
        assert.equal(list.body.projects[0].id, p.id);
    });

    test("each school sees only its own projects, newest first", async () => {
        const a = await signedInSchool();
        const b = await signedInSchool();
        await create(a.c, { title: "First project for A" });
        await create(a.c, { title: "Second project for A" });
        await create(b.c, { title: "Only project for B" });
        const listA = (await a.c.get("/api/school/projects")).body.projects;
        assert.deepEqual(listA.map((p) => p.title), ["Second project for A", "First project for A"]);
        assert.deepEqual((await b.c.get("/api/school/projects")).body.projects.map((p) => p.title), ["Only project for B"]);
    });

    test("validation: every field is checked, with a message per field", async () => {
        const { c } = await signedInSchool();
        const cases = [
            [{ title: "" }, "title", /required/],
            [{ title: "abc" }, "title", /at least 5/],
            [{ category: "Swimming Pool" }, "category", /valid category/],
            [{ problem: "too short" }, "problem", /at least 20/],
            [{ priority: "Urgent!!" }, "priority", /valid priority/],
            [{ budget: "500" }, "budget", /between ₹1,000/],
            [{ budget: "12.5" }, "budget", /whole number/],
            [{ budget: "-5000" }, "budget", /whole number/],
            [{ studentsBenefited: "0" }, "studentsBenefited", /between 1/],
            [{ expectedCompletion: inDays(-2) }, "expectedCompletion", /past/],
            [{ expectedCompletion: "2026-02-30" }, "expectedCompletion", /valid date/],
            [{ expectedCompletion: inDays(365 * 6) }, "expectedCompletion", /5 years/],
            [{ materials: Array.from({ length: 21 }, (_, i) => `Item ${i}`) }, "materials", /at most 20/],
            [{ location: "x".repeat(151) }, "location", /at most 150/],
        ];
        for (const [override, field, pattern] of cases) {
            const res = await create(c, override);
            assert.equal(res.status, 400, `${field}: ${JSON.stringify(override).slice(0, 60)}`);
            assert.match(res.body.errors[field], pattern, field);
        }
        assert.equal((await c.get("/api/school/projects")).body.projects.length, 0, "nothing was saved");
    });

    test("mass assignment and injection are refused", async () => {
        const { c } = await signedInSchool();
        for (const extra of [{ raised: 99999 }, { school: "64b000000000000000000000" }, { status: "Completed" }, { _id: "x" }]) {
            const res = await create(c, extra);
            assert.equal(res.status, 400, JSON.stringify(extra));
            assert.match(res.body.message, /Unexpected field/);
        }
        assert.equal((await create(c, { category: { $ne: "" } })).status, 400);
        assert.equal((await c.post("/api/school/projects", { json: [] })).status, 400);
        assert.equal((await c.post("/api/school/projects", { json: "{bad" })).status, 400);
    });
});

describe("school projects: view and edit", () => {
    test("a school views and edits its project; only sent fields change; a past date is allowed on edit", async () => {
        const { c } = await signedInSchool();
        const { id } = (await create(c)).body.project;
        assert.equal((await c.get(`/api/school/projects/${id}`)).body.project.id, id);
        // The work status can only change once an admin has approved the project.
        await Project.updateOne({ _id: id }, { $set: { reviewStatus: "OPEN" } });

        const res = await c.patch(`/api/school/projects/${id}`, { json: { budget: 150000, status: "In Progress", expectedCompletion: inDays(-10) } });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.project.budget, 150000);
        assert.equal(res.body.project.status, "In Progress");
        assert.equal(res.body.project.expectedCompletion, inDays(-10));
        assert.equal(res.body.project.title, projectData().title, "unsent fields unchanged");

        assert.equal((await c.patch(`/api/school/projects/${id}`, { json: { status: "Done-ish" } })).status, 400);
        assert.equal((await c.patch(`/api/school/projects/${id}`, { json: { raised: 5 } })).status, 400);
        assert.equal((await c.patch(`/api/school/projects/${id}`, { json: { title: "" } })).status, 400, "required fields can't be blanked");
        assert.equal((await c.patch(`/api/school/projects/${id}`, { json: {} })).status, 400);
    });

    test("another school's project, or a bad id, is simply not found", async () => {
        const owner = await signedInSchool();
        const other = await signedInSchool();
        const { id } = (await create(owner.c)).body.project;
        assert.equal((await other.c.get(`/api/school/projects/${id}`)).status, 404);
        assert.equal((await other.c.patch(`/api/school/projects/${id}`, { json: { budget: 2000 } })).status, 404);
        assert.equal((await Project.findById(id)).budget, 120000, "untouched");
        assert.equal((await owner.c.get("/api/school/projects/not-an-id")).status, 404);
        assert.equal((await owner.c.get("/api/school/projects/64b000000000000000000000")).status, 404);
    });
});

describe("school projects: access", () => {
    test("signed out → 401; donors, NGOs and admins → 403; pending schools can't sign in to use it", async () => {
        assert.equal((await newClient().get("/api/school/projects")).status, 401);

        const donor = donorData();
        await registerActive(newClient(), donor);
        const d = newClient();
        await login(d, donor.email, PASSWORD, "donor");
        assert.equal((await d.get("/api/school/projects")).status, 403);

        const ngo = ngoData();
        await register(newClient(), ngo);
        await User.updateOne({ email: ngo.email }, { $set: { accountStatus: "active" } });
        const n = newClient();
        await login(n, ngo.email, PASSWORD, "ngo");
        assert.equal((await n.post("/api/school/projects", { json: projectData() })).status, 403);

        const admin = await createAdmin();
        const a = newClient();
        await login(a, admin.email, PASSWORD, "admin");
        assert.equal((await a.get("/api/school/projects")).status, 403);

        const pending = schoolData();
        await register(newClient(), pending);
        const p = newClient();
        assert.equal((await login(p, pending.email, PASSWORD, "school")).status, 403);
        assert.equal((await p.get("/api/school/projects")).status, 401);
    });

    test("a school rejected after creating projects loses access immediately", async () => {
        const { c, data } = await signedInSchool();
        await create(c);
        await User.updateOne({ email: data.email }, { $set: { accountStatus: "rejected" }, $inc: { tokenVersion: 1 } });
        assert.equal((await c.get("/api/school/projects")).status, 401);
    });
});
