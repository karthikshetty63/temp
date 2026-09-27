import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { PASSWORD, createAdmin, createClient, donorData, login, ngoData, registerActive, schoolData, startTestServer } from "./helpers.js";

let server;
const newClient = () => createClient(server.baseUrl);

const signedIn = async (factory, role) => {
    const data = factory();
    await registerActive(newClient(), data);
    const c = newClient();
    assert.equal((await login(c, data.email, PASSWORD, role)).status, 200);
    return { c, data };
};
const myProfile = async (c) => (await c.get("/api/profile/me")).body.profile;
const edit = (c, json) => c.patch("/api/profile/school", { json });

before(async () => {
    server = await startTestServer();
});
after(() => server.stop());

describe("a school edits its own profile", () => {
    test("editable details are validated, saved and returned; the principal's name becomes the account name", async () => {
        const { c } = await signedIn(schoolData, "school");
        const res = await edit(c, {
            principalName: "  Lakshmi   Devi ",
            phone: "080 2345 6789",
            address: "New block, Honnali Village, Davangere",
            students: "512",
            teachers: 21,
            hasLibrary: true,
            hasToilets: false,
        });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.profile.principalName, "Lakshmi Devi");
        assert.equal(res.body.profile.phone, "+918023456789");

        const profile = await myProfile(c);
        assert.equal(profile.principalName, "Lakshmi Devi");
        assert.equal(profile.address, "New block, Honnali Village, Davangere");
        assert.equal(profile.students, 512);
        assert.equal(profile.teachers, 21);
        // Only the facilities sent change; the others keep their registration values.
        assert.deepEqual(profile.infrastructure, { hasToilets: false, hasLibrary: true, hasComputers: true, hasDrinkingWater: false });
        assert.equal(profile.bankAccount, "•••• 9012", "bank account stays masked");
        assert.equal((await c.get("/api/auth/me")).body.user.name, "Lakshmi Devi");
    });

    test("optional counts can be cleared", async () => {
        const { c } = await signedIn(schoolData, "school");
        assert.equal((await edit(c, { students: "", teachers: null })).status, 200);
        const profile = await myProfile(c);
        assert.equal(profile.students, undefined);
        assert.equal(profile.teachers, undefined);
    });

    test("verified identity and bank details can't be changed here", async () => {
        const { c, data } = await signedIn(schoolData, "school");
        for (const [field, value] of [
            ["schoolName", "Another School"], ["udise", "12345678901"], ["email", "new@example.com"], ["district", "Mysuru"],
            ["state", "Kerala"], ["bankAccount", "999999999999"], ["ifsc", "HDFC0001234"], ["userId", "000000000000000000000000"],
            ["photo", "000000000000000000000000"],
        ]) {
            const res = await edit(c, { [field]: value, phone: "9876500000" });
            assert.equal(res.status, 400, field);
            assert.equal(res.body.errors[field], "This field can't be changed here.", field);
        }
        const profile = await myProfile(c);
        assert.equal(profile.schoolName, data.schoolName);
        assert.equal(profile.udise, data.udise);
        assert.equal(profile.phone, "+919876543210", "nothing is saved when any field is refused");
    });

    test("invalid values are refused with a message per field, and nothing is saved", async () => {
        const { c } = await signedIn(schoolData, "school");
        const res = await edit(c, { principalName: "", phone: "12345", students: "-3", hasLibrary: "yes", address: "abc" });
        assert.equal(res.status, 400);
        assert.deepEqual(Object.keys(res.body.errors).sort(), ["address", "hasLibrary", "phone", "principalName", "students"]);
        const profile = await myProfile(c);
        assert.equal(profile.principalName, "Suresh Kumar");
        assert.equal(profile.students, 438);
    });

    test("an empty or non-object body is refused", async () => {
        const { c } = await signedIn(schoolData, "school");
        assert.equal((await edit(c, {})).status, 400);
        assert.equal((await edit(c, [])).status, 400);
        assert.equal((await edit(c, "null")).status, 400);
    });
});

describe("only schools can edit a school profile", () => {
    test("NGO, donor and admin get 403; signed-out users get 401", async () => {
        const ngo = (await signedIn(ngoData, "ngo")).c;
        const donor = (await signedIn(donorData, "donor")).c;
        const credentials = await createAdmin();
        const admin = newClient();
        assert.equal((await login(admin, credentials.email, PASSWORD, "admin")).status, 200);
        for (const c of [ngo, donor, admin]) assert.equal((await edit(c, { phone: "9876500000" })).status, 403);
        assert.equal((await edit(newClient(), { phone: "9876500000" })).status, 401);
    });
});
