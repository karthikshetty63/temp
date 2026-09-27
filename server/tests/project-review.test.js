import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PASSWORD, createAdmin, createClient, donorData, login, ngoData, registerActive, schoolData, startTestServer } from "./helpers.js";

let server;
let User;
let Project;
let admin;
let adminId;
const newClient = () => createClient(server.baseUrl);

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
let n = 0;
const projectData = (overrides = {}) => ({
    title: `Library shelves and books ${(n += 1)}`,
    category: "Library",
    problem: "The school has no library; 300 students have no books beyond their textbooks.",
    priority: "High",
    budget: "80000",
    studentsBenefited: "300",
    expectedCompletion: inDays(90),
    ...overrides,
});

/** An approved (active) school, signed in. */
const signedInSchool = async () => {
    const data = schoolData();
    await registerActive(newClient(), data);
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, "school")).status, 200);
    return { c, data };
};
const createProject = async (c, overrides) => {
    const res = await c.post("/api/school/projects", { json: projectData(overrides) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.project;
};
const signedIn = async (factory, role) => {
    const data = factory();
    await registerActive(newClient(), data);
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, role)).status, 200);
    return c;
};
const pendingList = () => admin.get("/api/admin/projects?status=PENDING_REVIEW");
const approve = (id) => admin.patch(`/api/admin/projects/${id}/approve`);
const reject = (id, reason) => admin.patch(`/api/admin/projects/${id}/reject`, { json: reason === undefined ? {} : { reason } });

before(async () => {
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
    Project = (await import("../models/Project.js")).default;
    const credentials = await createAdmin();
    admin = newClient();
    assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
    adminId = (await User.findOne({ email: credentials.email }))._id.toString();
});
after(() => server.stop());

// Runs first, while the database has no projects at all.
describe("empty review queue", () => {
    test("(10) the admin review list works when nothing is waiting", async () => {
        const res = await pendingList();
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.projects, []);
        assert.deepEqual(res.body.counts, { PENDING_REVIEW: 0, OPEN: 0, REJECTED: 0 });
    });
});

describe("school submits, admin sees it", () => {
    test("(1) a new project is PENDING_REVIEW; the browser can't set review fields", async () => {
        const { c } = await signedInSchool();
        const project = await createProject(c);
        assert.equal(project.reviewStatus, "PENDING_REVIEW");
        assert.equal(project.rejectionReason, null);
        assert.equal(project.reviewedAt, null);
        assert.ok(project.submittedAt);

        for (const extra of [{ reviewStatus: "OPEN" }, { reviewStatus: "APPROVED" }, { reviewedBy: adminId }, { rejectionReason: "x" }, { submittedAt: "2020-01-01" }]) {
            const res = await c.post("/api/school/projects", { json: projectData(extra) });
            assert.equal(res.status, 400, JSON.stringify(extra));
            const edit = await c.patch(`/api/school/projects/${project.id}`, { json: extra });
            assert.equal(edit.status, 400, `edit ${JSON.stringify(extra)}`);
        }
        assert.equal((await Project.findById(project.id)).reviewStatus, "PENDING_REVIEW", "a school can't approve its own project");
    });

    test("(2) the admin gets the waiting projects with their school, oldest first", async () => {
        const { c, data } = await signedInSchool();
        const first = await createProject(c, { title: "First waiting project" });
        const second = await createProject(c, { title: "Second waiting project" });
        const res = await pendingList();
        assert.equal(res.status, 200);
        const ids = res.body.projects.map((p) => p.id);
        assert.ok(ids.indexOf(first.id) < ids.indexOf(second.id), "first come, first served");
        const row = res.body.projects.find((p) => p.id === first.id);
        assert.equal(row.school.name, data.schoolName);
        assert.equal(row.school.udise, data.udise);
        assert.equal(row.school.accountStatus, "active");
        assert.equal(row.category, "Library");
        assert.ok(res.body.counts.PENDING_REVIEW >= 2);

        const detail = await admin.get(`/api/admin/projects/${first.id}`);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.project.problem, projectData().problem);
        assert.equal(detail.body.project.school.email, data.email.toLowerCase());
        assert.ok(!JSON.stringify(detail.body).includes("password"));
    });

    test("bad filters and ids are refused", async () => {
        assert.equal((await admin.get("/api/admin/projects?status=APPROVED")).status, 400);
        assert.equal((await admin.get("/api/admin/projects/not-an-id")).status, 404);
        assert.equal((await admin.get("/api/admin/projects/64b000000000000000000000")).status, 404);
        assert.equal((await approve("64b000000000000000000000")).status, 404);
    });
});

describe("only an admin can decide", () => {
    test("(3) the school itself, another school, an NGO, a donor and anonymous users can't approve, reject or list", async () => {
        const owner = await signedInSchool();
        const project = await createProject(owner.c);
        const outsiders = [
            ["owner school", owner.c],
            ["other school", (await signedInSchool()).c],
            ["NGO", await signedIn(ngoData, "ngo")],
            ["donor", await signedIn(donorData, "donor")],
        ];
        for (const [who, c] of outsiders) {
            assert.equal((await c.patch(`/api/admin/projects/${project.id}/approve`)).status, 403, who);
            assert.equal((await c.patch(`/api/admin/projects/${project.id}/reject`, { json: { reason: "Not allowed here." } })).status, 403, who);
            assert.equal((await c.get("/api/admin/projects")).status, 403, who);
        }
        assert.equal((await newClient().patch(`/api/admin/projects/${project.id}/approve`)).status, 401, "anonymous");
        const stored = await Project.findById(project.id);
        assert.equal(stored.reviewStatus, "PENDING_REVIEW");
        assert.equal(stored.reviewedBy, undefined);
    });
});

describe("approve", () => {
    test("(4) approve → OPEN with who and when; approving again, or rejecting it, is refused", async () => {
        const { c } = await signedInSchool();
        const project = await createProject(c);
        const res = await approve(project.id);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.project.reviewStatus, "OPEN");

        const stored = await Project.findById(project.id);
        assert.equal(stored.reviewStatus, "OPEN");
        assert.equal(stored.reviewedBy.toString(), adminId);
        assert.ok(Date.now() - stored.reviewedAt.getTime() < 60_000);
        assert.equal((await c.get(`/api/school/projects/${project.id}`)).body.project.reviewStatus, "OPEN", "the school sees it");

        const again = await approve(project.id);
        assert.equal(again.status, 409);
        assert.match(again.body.message, /already approved/);
        assert.equal((await reject(project.id, "Changed my mind about this.")).status, 409);
    });

    test("the same project approved twice at the same moment succeeds once", async () => {
        const { c } = await signedInSchool();
        const project = await createProject(c);
        const results = await Promise.all([approve(project.id), approve(project.id)]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    });

    test("a project can't be approved while its school's account isn't active", async () => {
        const { c, data } = await signedInSchool();
        const project = await createProject(c);
        await User.updateOne({ email: data.email.toLowerCase() }, { $set: { accountStatus: "rejected" } });
        const res = await approve(project.id);
        assert.equal(res.status, 409);
        assert.match(res.body.message, /not active/);
        assert.equal((await Project.findById(project.id)).reviewStatus, "PENDING_REVIEW");
    });

    test("the work status (In Progress, Completed…) can only change after approval", async () => {
        const { c } = await signedInSchool();
        const project = await createProject(c);
        const early = await c.patch(`/api/school/projects/${project.id}`, { json: { status: "Completed" } });
        assert.equal(early.status, 400);
        assert.match(early.body.errors.status, /once the project is approved/);
        await approve(project.id);
        assert.equal((await c.patch(`/api/school/projects/${project.id}`, { json: { status: "In Progress" } })).status, 200);
    });
});

describe("reject and resubmit", () => {
    test("(5) rejecting without a (long enough) reason is a validation error; nothing changes", async () => {
        const { c } = await signedInSchool();
        const project = await createProject(c);
        for (const reason of [undefined, "", "   ", "no", "x".repeat(501), 12345]) {
            const res = await reject(project.id, reason);
            assert.equal(res.status, 400, JSON.stringify(reason));
            assert.ok(res.body.errors.reason);
        }
        assert.equal((await Project.findById(project.id)).reviewStatus, "PENDING_REVIEW");
    });

    test("(6)(7) reject with a reason → REJECTED; the school sees the reason; it can't jump straight to OPEN", async () => {
        const { c } = await signedInSchool();
        const project = await createProject(c);
        const res = await reject(project.id, "  Please attach a quotation and break the budget down by item.  ");
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.project.reviewStatus, "REJECTED");

        const stored = await Project.findById(project.id);
        assert.equal(stored.rejectionReason, "Please attach a quotation and break the budget down by item.");
        assert.equal(stored.reviewedBy.toString(), adminId);
        assert.ok(stored.reviewedAt);

        const seen = (await c.get(`/api/school/projects/${project.id}`)).body.project;
        assert.equal(seen.reviewStatus, "REJECTED");
        assert.equal(seen.rejectionReason, "Please attach a quotation and break the budget down by item.");

        const direct = await approve(project.id);
        assert.equal(direct.status, 409, "REJECTED → OPEN directly is not allowed");
        assert.match(direct.body.message, /rejected/);
        assert.equal((await reject(project.id, "Rejecting a second time.")).status, 409);
    });

    test("(8) the school edits a rejected project → PENDING_REVIEW again, old review cleared, back in the queue", async () => {
        const { c } = await signedInSchool();
        const project = await createProject(c);
        await reject(project.id, "Budget needs an item-wise breakdown.");
        const before = await Project.findById(project.id);

        const res = await c.patch(`/api/school/projects/${project.id}`, { json: { budget: 85000, materials: "Shelves x6, Books x400" } });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.match(res.body.message, /resubmitted/);
        assert.equal(res.body.project.reviewStatus, "PENDING_REVIEW");
        assert.equal(res.body.project.rejectionReason, null);
        assert.equal(res.body.project.reviewedAt, null);

        const stored = await Project.findById(project.id);
        assert.equal(stored.rejectionReason, undefined);
        assert.equal(stored.reviewedBy, undefined);
        assert.ok(stored.submittedAt > before.submittedAt, "resubmission time recorded");
        assert.ok((await pendingList()).body.projects.some((p) => p.id === project.id), "back in the review queue");
        assert.equal((await approve(project.id)).status, 200, "and it can now be approved");
    });

    test("editing a project that is still pending keeps it pending", async () => {
        const { c } = await signedInSchool();
        const project = await createProject(c);
        const res = await c.patch(`/api/school/projects/${project.id}`, { json: { budget: 90000 } });
        assert.equal(res.body.project.reviewStatus, "PENDING_REVIEW");
        assert.match(res.body.message, /updated/);
    });
});

describe("visibility", () => {
    test("(9) only OPEN projects come back from the query for NGO / donor / public features, whatever filter is passed", async () => {
        const { c } = await signedInSchool();
        const pending = await createProject(c, { title: "Visibility pending" });
        const rejected = await createProject(c, { title: "Visibility rejected" });
        const open = await createProject(c, { title: "Visibility open" });
        await reject(rejected.id, "Not eligible for this platform.");
        await approve(open.id);

        const visible = (await Project.findVisibleToPublic({ title: /^Visibility/ })).map((p) => p._id.toString());
        assert.deepEqual(visible, [open.id]);
        const sneaky = await Project.findVisibleToPublic({ reviewStatus: "PENDING_REVIEW", title: /^Visibility/ });
        assert.deepEqual(sneaky.map((p) => p._id.toString()), [open.id], "a filter can't widen the review condition");
        assert.ok(!visible.includes(pending.id) && !visible.includes(rejected.id));
    });

    test("(9) NGOs and donors get no project data from the existing project APIs", async () => {
        const { c } = await signedInSchool();
        const project = await createProject(c);
        for (const [who, client] of [["NGO", await signedIn(ngoData, "ngo")], ["donor", await signedIn(donorData, "donor")]]) {
            assert.equal((await client.get("/api/school/projects")).status, 403, who);
            assert.equal((await client.get(`/api/school/projects/${project.id}`)).status, 403, who);
        }
        assert.equal((await newClient().get(`/api/school/projects/${project.id}`)).status, 401, "public");
        assert.equal((await newClient().get(`/api/projects/${project.id}`)).status, 404, "no public project API exists yet");
        const otherSchool = (await signedInSchool()).c;
        assert.equal((await otherSchool.get(`/api/school/projects/${project.id}`)).status, 404, "another school");
    });

    test("a project saved before review existed is treated as waiting for review", async () => {
        const { c, data } = await signedInSchool();
        const school = await User.findOne({ email: data.email.toLowerCase() });
        // Written straight to the collection, exactly like an older record (no review fields).
        const { insertedId } = await Project.collection.insertOne({
            school: school._id, title: "Older project", category: "Library", problem: "Saved before admin review existed.",
            priority: "Low", budget: 5000, raised: 0, studentsBenefited: 10, expectedCompletion: new Date(inDays(30)),
            location: "", materials: [], status: "Open", createdAt: new Date(), updatedAt: new Date(),
        });
        const id = insertedId.toString();
        assert.equal((await c.get(`/api/school/projects/${id}`)).body.project.reviewStatus, "PENDING_REVIEW");
        assert.ok((await pendingList()).body.projects.some((p) => p.id === id), "in the admin queue");
        assert.equal((await Project.findVisibleToPublic({ _id: insertedId })).length, 0, "hidden from the public");
        assert.equal((await approve(id)).status, 200);
        assert.equal((await Project.findById(id)).reviewStatus, "OPEN");
    });
});
