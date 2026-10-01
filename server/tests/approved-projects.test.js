import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PASSWORD, createAdmin, createClient, donorData, login, ngoData, paymentForm, registerActive, schoolData, startTestServer } from "./helpers.js";

let server;
let User;
let Project;
let FundingPayment;
let admin;
let ngo;
let donor;
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
const signedIn = async (factory, role, overrides) => {
    const data = factory(overrides);
    await registerActive(newClient(), data);
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, role)).status, 200);
    return { c, data };
};
const createProject = async (c, overrides) => {
    const res = await c.post("/api/school/projects", { json: projectData(overrides) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.project;
};
const approve = (id) => admin.patch(`/api/admin/projects/${id}/approve`);
const reject = (id) => admin.patch(`/api/admin/projects/${id}/reject`, { json: { reason: "Please attach a quotation." } });
const idsSeenBy = async (client) => {
    const res = await client.get("/api/projects");
    assert.equal(res.status, 200);
    return res.body.projects.map((p) => p.id);
};
const visibleIds = () => idsSeenBy(ngo);

before(async () => {
    server = await startTestServer();
    User = (await import("../models/User.js")).default;
    Project = (await import("../models/Project.js")).default;
    FundingPayment = (await import("../models/FundingPayment.js")).default;
    const credentials = await createAdmin();
    admin = newClient();
    assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
    ngo = (await signedIn(ngoData, "ngo")).c;
    donor = (await signedIn(donorData, "donor")).c;
});
after(() => server.stop());

describe("NGOs see only approved school needs", () => {
    test("the list is empty before anything is approved", async () => {
        assert.deepEqual(await visibleIds(), []);
    });

    test("pending, rejected and completed projects stay hidden; approved ones appear, newest approval first", async () => {
        const { c } = await signedIn(schoolData, "school", { schoolName: "Govt. Primary School, Honnali", district: "Davangere", state: "Karnataka" });
        const pending = await createProject(c);
        const rejected = await createProject(c);
        const first = await createProject(c);
        const second = await createProject(c);
        const completed = await createProject(c);
        await reject(rejected.id);
        await approve(first.id);
        await approve(second.id);
        await approve(completed.id);
        assert.equal((await c.patch(`/api/school/projects/${completed.id}`, { json: { status: "Completed" } })).status, 200);

        const ids = await visibleIds();
        assert.deepEqual(ids, [second.id, first.id]);
        assert.ok(!ids.includes(pending.id) && !ids.includes(rejected.id) && !ids.includes(completed.id));
    });

    test("an NGO sees the need and where the school is, never private details", async () => {
        const { c, data } = await signedIn(schoolData, "school", { schoolName: "GHS Sullia", district: "Dakshina Kannada", state: "Karnataka" });
        const project = await createProject(c, { title: "Drinking water filter", category: "Drinking Water", budget: "25000" });
        await approve(project.id);

        const seen = (await ngo.get("/api/projects")).body.projects.find((p) => p.id === project.id);
        assert.deepEqual(Object.keys(seen).sort(), [
            "approvedAt", "budget", "category", "committed", "expectedCompletion", "id", "location", "materials", "parts", "priority", "problem",
            "raised", "school", "status", "studentsBenefited", "title",
        ]);
        assert.deepEqual(seen.school, { name: "GHS Sullia", district: "Dakshina Kannada", state: "Karnataka" });
        const json = JSON.stringify(seen);
        for (const secret of [data.email, data.udise, data.phone, data.bankAccount, "rejectionReason", "reviewedBy", "reviewStatus"]) {
            assert.ok(!json.includes(secret), `leaked: ${secret}`);
        }
    });

    test("a school whose account is no longer active drops out, with all its approved projects", async () => {
        const { c, data } = await signedIn(schoolData, "school");
        const project = await createProject(c);
        await approve(project.id);
        assert.ok((await visibleIds()).includes(project.id));
        await User.updateOne({ email: data.email.toLowerCase() }, { $set: { accountStatus: "rejected" } });
        assert.ok(!(await visibleIds()).includes(project.id));
    });

    test("a record saved before review existed (no review status) is never shown", async () => {
        const { c } = await signedIn(schoolData, "school");
        const project = await createProject(c);
        await Project.collection.updateOne({ _id: new (await import("mongoose")).default.Types.ObjectId(project.id) }, { $unset: { reviewStatus: "" } });
        assert.ok(!(await visibleIds()).includes(project.id));
    });
});

describe("donors see the same approved needs, read-only", () => {
    test("a donor sees approved needs only (never pending, rejected or completed ones), the same as NGOs, in the same order", async () => {
        const { c } = await signedIn(schoolData, "school");
        const pending = await createProject(c);
        const rejected = await createProject(c);
        const approved = await createProject(c);
        const completed = await createProject(c);
        await reject(rejected.id);
        await approve(approved.id);
        await approve(completed.id);
        assert.equal((await c.patch(`/api/school/projects/${completed.id}`, { json: { status: "Completed" } })).status, 200);

        const ids = await idsSeenBy(donor);
        assert.ok(ids.includes(approved.id));
        for (const [label, hidden] of [["pending", pending], ["rejected", rejected], ["completed", completed]]) {
            assert.ok(!ids.includes(hidden.id), `a ${label} project is hidden`);
        }
        assert.deepEqual(ids, await visibleIds(), "the same projects NGOs see, in the same order");
    });

    test("a school whose account is no longer active drops out for donors too", async () => {
        const { c, data } = await signedIn(schoolData, "school");
        const project = await createProject(c);
        await approve(project.id);
        assert.ok((await idsSeenBy(donor)).includes(project.id));
        await User.updateOne({ email: data.email.toLowerCase() }, { $set: { accountStatus: "rejected" } });
        assert.ok(!(await idsSeenBy(donor)).includes(project.id));
    });

    test("a donor gets only what the donor dashboard shows: no school contacts, bank details, UDISE, review or NGO funding", async () => {
        const { c, data } = await signedIn(schoolData, "school", { schoolName: "GHPS Bellare", district: "Dakshina Kannada", state: "Karnataka" });
        const project = await createProject(c, { title: "Smart classroom for 200 students", category: "Classroom Development", budget: "100000" });
        await approve(project.id);
        // An NGO commits to two of the five ₹20,000 parts, pays, and the school accepts the payment,
        // so the need has NGO commitments, a payment and money raised.
        const funder = await signedIn(ngoData, "ngo", { ngoName: "Shiksha Mitra Trust" });
        assert.equal((await funder.c.post(`/api/projects/${project.id}/commitments`, { json: { parts: [1, 2] } })).status, 201);
        const reference = "UTR998877665";
        const note = "Paid from our SBI current account";
        const paid = await funder.c.post(`/api/projects/${project.id}/payments`, {
            form: paymentForm({ parts: [1, 2], method: "UPI", reference, paidOn: new Date().toISOString().slice(0, 10), note }),
        });
        assert.equal(paid.status, 201, JSON.stringify(paid.body));
        assert.equal((await c.patch(`/api/school/payments/${paid.body.payment.id}/accept`)).status, 200);

        const seen = (await donor.get("/api/projects")).body.projects.find((p) => p.id === project.id);
        assert.deepEqual(Object.keys(seen).sort(), ["budget", "category", "id", "priority", "raised", "school", "status", "title"]);
        assert.deepEqual(seen.school, { name: "GHPS Bellare", district: "Dakshina Kannada", state: "Karnataka" });
        assert.equal(seen.raised, 40000, "the money the school accepted, on the same project");
        const json = JSON.stringify(seen);
        for (const secret of [
            // the school's contacts, identity and bank details
            data.email, data.phone, data.principalName, data.udise, data.bankAccount, data.ifsc, data.upi,
            // the NGO, its commitment and its payment
            funder.data.ngoName, funder.data.email, reference, note, "parts", "committed", "payment",
            // the admin review
            "reviewStatus", "reviewedBy", "rejectionReason", "approvedAt",
        ]) {
            assert.ok(!json.includes(secret), `leaked: ${secret}`);
        }

        // The NGO still gets its full partner view of the same project.
        const ngoView = (await funder.c.get("/api/projects")).body.projects.find((p) => p.id === project.id);
        assert.equal(ngoView.committed, 40000);
        assert.deepEqual(ngoView.parts.filter((p) => p.takenBy === "you").map((p) => p.part), [1, 2]);
    });

    test("a donor can't use any NGO funding action: commit, withdraw, record a payment, bank details or NGO lists", async () => {
        const { c } = await signedIn(schoolData, "school");
        const project = await createProject(c);
        await approve(project.id);
        const attempts = {
            commit: () => donor.post(`/api/projects/${project.id}/commitments`, { json: { parts: [1] } }),
            withdraw: () => donor.delete(`/api/projects/${project.id}/commitments`),
            "record a payment": () =>
                donor.post(`/api/projects/${project.id}/payments`, { form: paymentForm({ parts: [1], method: "UPI", reference: "UTR123456789", paidOn: new Date().toISOString().slice(0, 10) }) }),
            "school bank details": () => donor.get(`/api/projects/${project.id}/payment-details`),
            "NGO commitments list": () => donor.get("/api/projects/committed"),
            "NGO payments list": () => donor.get("/api/projects/payments"),
        };
        for (const [action, attempt] of Object.entries(attempts)) assert.equal((await attempt()).status, 403, action);

        assert.deepEqual((await Project.findById(project.id).lean()).fundingParts, [], "nothing was committed");
        assert.equal(await FundingPayment.countDocuments({ project: project.id }), 0, "no payment was recorded");
    });
});

describe("who can read the list", () => {
    test("NGOs and donors can; schools and admins get 403; signed-out users get 401", async () => {
        const school = (await signedIn(schoolData, "school")).c;
        for (const c of [ngo, donor]) assert.equal((await c.get("/api/projects")).status, 200);
        for (const c of [school, admin]) assert.equal((await c.get("/api/projects")).status, 403);
        assert.equal((await newClient().get("/api/projects")).status, 401);
    });
});
