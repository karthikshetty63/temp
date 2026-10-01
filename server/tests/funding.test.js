import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PASSWORD, createAdmin, createClient, donorData, login, ngoData, paymentForm, registerActive, schoolData, startTestServer } from "./helpers.js";
import { FUNDING_PARTS, splitIntoParts, validateFundingParts } from "../../shared/projectRules.js";

let server;
let User;
let Project;
let admin;
const newClient = () => createClient(server.baseUrl);

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const today = () => inDays(0);
let n = 0;
const projectData = (overrides = {}) => ({
    title: `Computer lab with 10 PCs ${(n += 1)}`,
    category: "Computer Lab",
    problem: "The school has no computers; 200 students have never used one before class 10.",
    priority: "High",
    budget: "100000",
    studentsBenefited: "200",
    expectedCompletion: inDays(90),
    ...overrides,
});
const signedIn = async (factory, role, overrides) => {
    const data = factory(overrides);
    await registerActive(newClient(), data);
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, role)).status, 200);
    return { c, data };
};
/** A school with one approved project; returns the school's client and the project. */
const approvedProject = async (overrides, school) => {
    const s = school || (await signedIn(schoolData, "school"));
    const res = await s.c.post("/api/school/projects", { json: projectData(overrides) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal((await admin.patch(`/api/admin/projects/${res.body.project.id}/approve`)).status, 200);
    return { school: s, project: res.body.project };
};
const commit = (c, id, parts) => c.post(`/api/projects/${id}/commitments`, { json: { parts } });
const seen = async (c, id) => (await c.get("/api/projects")).body.projects.find((p) => p.id === id);
const takenBy = (view) => view.parts.map((p) => p.takenBy);

before(async () => {
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
    Project = (await import("../models/Project.js")).default;
    const credentials = await createAdmin();
    admin = newClient();
    assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
});
after(() => server.stop());

describe("the budget splits into five equal parts", () => {
    test("parts always add up to exactly the budget, at most ₹1 apart", () => {
        assert.equal(FUNDING_PARTS, 5);
        assert.deepEqual(splitIntoParts(100000).map((p) => p.amount), [20000, 20000, 20000, 20000, 20000]);
        assert.deepEqual(splitIntoParts(123457).map((p) => p.amount), [24692, 24692, 24691, 24691, 24691]);
        for (const budget of [1000, 1001, 1004, 99999, 10000000]) {
            const parts = splitIntoParts(budget);
            assert.deepEqual(parts.map((p) => p.part), [1, 2, 3, 4, 5]);
            assert.equal(parts.reduce((sum, p) => sum + p.amount, 0), budget);
            assert.ok(Math.max(...parts.map((p) => p.amount)) - Math.min(...parts.map((p) => p.amount)) <= 1);
        }
    });

    test("an NGO must choose one or more different parts from 1 to 5", () => {
        for (const bad of [undefined, [], "1", [0], [6], [1, 1], [1.5], ["2"], [1, 2, 3, 4, 5, 1]]) {
            assert.ok(validateFundingParts(bad).error, JSON.stringify(bad));
        }
        assert.deepEqual(validateFundingParts([3, 1]).value, [1, 3]);
    });
});

describe("NGOs commit to parts of an approved need", () => {
    test("a new need shows five free parts; one NGO takes two, another sees them as taken (never by whom)", async () => {
        const { project } = await approvedProject();
        const a = await signedIn(ngoData, "ngo", { ngoName: "Shiksha Mitra Trust" });
        const b = await signedIn(ngoData, "ngo");

        const before = await seen(a.c, project.id);
        assert.equal(before.committed, 0);
        assert.deepEqual(before.parts, [1, 2, 3, 4, 5].map((part) => ({ part, amount: 20000, takenBy: null })));

        const res = await commit(a.c, project.id, [2, 1]);
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.match(res.body.message, /₹40,000/);
        assert.deepEqual(takenBy(res.body.project), ["you", "you", null, null, null]);
        assert.equal(res.body.project.committed, 40000);
        assert.equal(res.body.project.raised, 0, "a commitment is not money received");
        assert.ok(res.body.project.parts[0].committedAt);

        const other = await seen(b.c, project.id);
        assert.deepEqual(takenBy(other), ["other", "other", null, null, null]);
        assert.equal(other.committed, 40000);
        const json = JSON.stringify(other);
        for (const secret of ["Shiksha Mitra Trust", a.data.email, "committedAt", "ngo"]) assert.ok(!json.includes(secret), `leaked: ${secret}`);
    });

    test("a part can't be taken twice; a clash saves nothing and says which part", async () => {
        const { project } = await approvedProject();
        const a = await signedIn(ngoData, "ngo");
        const b = await signedIn(ngoData, "ngo");
        assert.equal((await commit(a.c, project.id, [1, 2])).status, 201);

        const clash = await commit(b.c, project.id, [2, 3]);
        assert.equal(clash.status, 409);
        assert.match(clash.body.message, /Part 2 has just been taken/);
        assert.deepEqual(takenBy(clash.body.project), ["other", "other", null, null, null], "part 3 was not taken either");
        assert.equal((await commit(a.c, project.id, [1])).status, 409, "not even by the same NGO");

        assert.equal((await commit(b.c, project.id, [3, 4, 5])).status, 201);
        const full = await seen(b.c, project.id);
        assert.deepEqual(takenBy(full), ["other", "other", "you", "you", "you"]);
        assert.equal(full.committed, 100000);
    });

    test("the full amount is all five parts", async () => {
        const { project } = await approvedProject({ budget: "123457" });
        const { c } = await signedIn(ngoData, "ngo");
        const res = await commit(c, project.id, [1, 2, 3, 4, 5]);
        assert.equal(res.status, 201);
        assert.equal(res.body.project.committed, 123457);
        assert.match(res.body.message, /₹1,23,457/);
    });

    test("two NGOs asking for the same part at the same moment: exactly one gets it", async () => {
        const { project } = await approvedProject();
        const ngos = await Promise.all([1, 2, 3, 4].map(() => signedIn(ngoData, "ngo")));
        const results = await Promise.all(ngos.map(({ c }) => commit(c, project.id, [1])));
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409]);
        const stored = await Project.findById(project.id).lean();
        assert.equal(stored.fundingParts.length, 1);
    });

    test("only approved, unfinished needs of active schools can be funded", async () => {
        const { c: ngo } = await signedIn(ngoData, "ngo");
        const school = await signedIn(schoolData, "school");
        const pending = (await school.c.post("/api/school/projects", { json: projectData() })).body.project;
        assert.equal((await commit(ngo, pending.id, [1])).status, 404, "pending");

        const { project: done } = await approvedProject({}, school);
        assert.equal((await school.c.patch(`/api/school/projects/${done.id}`, { json: { status: "Completed" } })).status, 200);
        assert.equal((await commit(ngo, done.id, [1])).status, 404, "completed");

        const { project: closed, school: other } = await approvedProject();
        await User.updateOne({ email: other.data.email.toLowerCase() }, { $set: { accountStatus: "rejected" } });
        assert.equal((await commit(ngo, closed.id, [1])).status, 404, "school account closed");

        assert.equal((await commit(ngo, "not-an-id", [1])).status, 404);
        assert.equal((await commit(ngo, "64b000000000000000000000", [1])).status, 404);
        const { project } = await approvedProject();
        for (const parts of [[], [0], [6], [1, 1], "all"]) assert.equal((await commit(ngo, project.id, parts)).status, 400, JSON.stringify(parts));
    });

    test("an NGO can withdraw only the parts it hasn't paid for", async () => {
        const { project, school } = await approvedProject();
        const { c } = await signedIn(ngoData, "ngo");
        assert.equal((await c.delete(`/api/projects/${project.id}/commitments`)).status, 404, "nothing to withdraw");
        assert.equal((await commit(c, project.id, [1, 2, 3])).status, 201);
        const pay = (parts, reference) =>
            c.post(`/api/projects/${project.id}/payments`, { form: paymentForm({ parts, method: "UPI", reference, paidOn: today() }) });
        const received = await pay([1], "UTR0000000001");
        assert.equal(received.status, 201, JSON.stringify(received.body));
        assert.equal((await school.c.patch(`/api/school/payments/${received.body.payment.id}/accept`)).status, 200);
        assert.equal((await pay([2], "UTR0000000002")).status, 201, "part 2: waiting for the school");

        const res = await c.delete(`/api/projects/${project.id}/commitments`);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual(takenBy(res.body.project), ["you", "you", null, null, null], "paid parts stay");
        assert.deepEqual(res.body.project.parts.slice(0, 2).map((p) => p.status), ["RECEIVED", "PAYMENT_SUBMITTED"]);
        assert.equal((await c.delete(`/api/projects/${project.id}/commitments`)).status, 404, "only paid parts left");
    });

    test("GET /api/projects/committed lists this NGO's needs only (completed ones too), latest commitment first", async () => {
        const { c } = await signedIn(ngoData, "ngo");
        const { c: other } = await signedIn(ngoData, "ngo");
        const { project: first, school } = await approvedProject();
        const { project: second } = await approvedProject();
        const { project: notMine } = await approvedProject();
        assert.equal((await commit(c, first.id, [5])).status, 201);
        assert.equal((await commit(c, second.id, [1, 2])).status, 201);
        assert.equal((await commit(other, notMine.id, [1])).status, 201);
        assert.equal((await school.c.patch(`/api/school/projects/${first.id}`, { json: { status: "Completed" } })).status, 200);

        const res = await c.get("/api/projects/committed");
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.projects.map((p) => p.id), [second.id, first.id]);
        assert.equal(res.body.projects[1].status, "Completed");
        assert.deepEqual(takenBy(res.body.projects[1]), [null, null, null, null, "you"]);
    });
});

describe("the school sees commitments and confirms the money arrived", () => {
    test("the school sees who committed, with contact details; other schools see nothing", async () => {
        const { project, school } = await approvedProject();
        const { c, data } = await signedIn(ngoData, "ngo", { ngoName: "Shiksha Mitra Trust", district: "Mysuru", state: "Karnataka" });
        assert.equal((await commit(c, project.id, [4, 3])).status, 201);

        const res = await school.c.get("/api/school/commitments");
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.commitments.map((x) => [x.projectId, x.projectTitle, x.part, x.amount, x.status, x.receivedAt]), [
            [project.id, project.title, 3, 20000, "AWAITING_PAYMENT", null],
            [project.id, project.title, 4, 20000, "AWAITING_PAYMENT", null],
        ]);
        assert.deepEqual(res.body.commitments[0].ngo, { name: "Shiksha Mitra Trust", email: data.email.toLowerCase(), phone: "+918023456789", district: "Mysuru", state: "Karnataka" });

        const otherSchool = await signedIn(schoolData, "school");
        assert.deepEqual((await otherSchool.c.get("/api/school/commitments")).body.commitments, []);
        assert.equal((await school.c.patch(`/api/school/projects/${project.id}/commitments/3`, { json: { received: true } })).status, 404, "no way to mark money received without a payment");
    });

    test("the budget can't change once any part is taken", async () => {
        const { project, school } = await approvedProject();
        const edit = (budget) => school.c.patch(`/api/school/projects/${project.id}`, { json: { budget } });
        assert.equal((await edit("90000")).status, 200, "free to change before any commitment");

        const { c } = await signedIn(ngoData, "ngo");
        assert.equal((await commit(c, project.id, [1])).status, 201);
        assert.equal((await seen(c, project.id)).parts[0].amount, 18000);
        const res = await edit("120000");
        assert.equal(res.status, 400);
        assert.match(res.body.errors.budget, /can't change/);
        assert.equal((await edit("90000")).status, 200, "sending the same budget is fine");
        assert.equal((await school.c.patch(`/api/school/projects/${project.id}`, { json: { title: "Computer lab, 10 PCs and a printer" } })).status, 200);
    });

    test("a commitment made while the school is saving a new budget wins; the budget stays", async () => {
        const { project } = await approvedProject();
        const { c } = await signedIn(ngoData, "ngo");
        // The school's edit has already read the project and passed its check...
        const doc = await Project.findById(project.id);
        doc.$where = { "fundingParts.0": { $exists: false } };
        doc.set({ budget: 50000 });
        // ...when an NGO commits.
        assert.equal((await commit(c, project.id, [1])).status, 201);
        await assert.rejects(doc.save(), (error) => error.name === "DocumentNotFoundError");
        assert.equal((await Project.findById(project.id).lean()).budget, 100000);
    });
});

describe("who can use these endpoints", () => {
    test("only NGOs commit and withdraw; only schools see and confirm their commitments", async () => {
        const { project, school } = await approvedProject();
        const donor = (await signedIn(donorData, "donor")).c;
        const ngo = (await signedIn(ngoData, "ngo")).c;
        for (const c of [school.c, donor, admin]) {
            assert.equal((await commit(c, project.id, [1])).status, 403);
            assert.equal((await c.delete(`/api/projects/${project.id}/commitments`)).status, 403);
            assert.equal((await c.get("/api/projects/committed")).status, 403);
        }
        assert.equal((await commit(newClient(), project.id, [1])).status, 401);
        for (const c of [ngo, donor, admin]) assert.equal((await c.get("/api/school/commitments")).status, 403);
        assert.equal((await newClient().get("/api/school/commitments")).status, 401);
    });
});
