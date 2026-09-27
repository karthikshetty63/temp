import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { FILES, createClient, donorData, ngoData, register, registrationForm, schoolData, startTestServer } from "./helpers.js";

let server;
let client;
let models;

before(async () => {
    server = await startTestServer();
    client = createClient(server.baseUrl);
    models = {
        User: (await import("../models/User.js")).default,
        DonorProfile: (await import("../models/DonorProfile.js")).default,
        SchoolProfile: (await import("../models/SchoolProfile.js")).default,
        NGOProfile: (await import("../models/NGOProfile.js")).default,
        UploadedFile: (await import("../models/UploadedFile.js")).default,
    };
});
after(() => server.stop());

describe("valid registrations", () => {
    test("donor: 201, pending admin review, profile + PAN card saved, no cookie, no password", async () => {
        const data = donorData({ email: "  Mixed.Case@Example.COM ", phone: "098765 43210" });
        const res = await register(client, data);
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.equal(res.body.user.role, "donor");
        assert.equal(res.body.user.accountStatus, "pending", "donors are reviewed by an admin like schools and NGOs");
        assert.match(res.body.message, /pending admin approval/);
        assert.equal(res.body.user.email, "mixed.case@example.com");
        assert.equal(res.setCookie, "", "registration must not log the user in");
        assert.ok(!JSON.stringify(res.body).includes(data.password));

        const user = await models.User.findOne({ email: "mixed.case@example.com" }).select("+password");
        assert.notEqual(user.password, data.password, "password must be hashed");
        assert.match(user.password, /^\$2[aby]\$/);
        const profile = await models.DonorProfile.findOne({ userId: user._id }).lean();
        assert.equal(profile.phone, "+919876543210");
        assert.equal(profile.pin, "560001");
        assert.deepEqual(profile.causes, ["Libraries", "Toilets"]);
        assert.equal(profile.city, "Bengaluru");
        assert.ok(profile.documents.panCard, "PAN card linked to the profile");
    });

    test("school: 201, pending, every step's fields persisted", async () => {
        const data = schoolData();
        const res = await register(client, data);
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.equal(res.body.user.accountStatus, "pending");
        assert.equal(res.body.user.name, data.principalName);

        const profile = await models.SchoolProfile.findOne({ udise: data.udise }).lean();
        assert.ok(profile, "school profile must exist");
        assert.equal(profile.schoolName, data.schoolName);
        assert.equal(profile.district, "Davangere");
        assert.equal(profile.state, "Karnataka");
        assert.equal(profile.students, 438);
        assert.equal(profile.teachers, 18);
        assert.deepEqual(profile.infrastructure, { hasToilets: true, hasLibrary: false, hasComputers: true, hasDrinkingWater: false });
        assert.equal(profile.bankAccount, "123456789012");
        assert.equal(profile.ifsc, "SBIN0001234");
        assert.equal(profile.upi, "school@sbi");
        assert.equal(profile.phone, "+919876543210");
    });

    test("ngo: 201, pending, profile persisted", async () => {
        const data = ngoData();
        const res = await register(client, data);
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.equal(res.body.user.accountStatus, "pending");
        const profile = await models.NGOProfile.findOne({ pan: data.pan }).lean();
        assert.equal(profile.ngoName, data.ngoName);
        assert.equal(profile.regNumber, data.regNumber);
        assert.deepEqual(profile.focus, ["Education", "WASH"]);
        assert.equal(profile.established, 2010);
        assert.equal(profile.phone, "+918023456789");
        assert.equal(profile.altPhone, undefined, "blank optional field is not stored");
    });
});

describe("validation", () => {
    test("invalid email → 400 with field error", async () => {
        const res = await register(client, donorData({ email: "not-an-email" }));
        assert.equal(res.status, 400);
        assert.ok(res.body.errors.email);
    });

    test("missing required field on a LATER step (school bank account) → 400 pointing at that step", async () => {
        const data = schoolData();
        delete data.bankAccount;
        const res = await register(client, data);
        assert.equal(res.status, 400);
        assert.equal(res.body.errors.bankAccount, "Bank account number is required.");
        assert.equal(res.body.step, 4);
    });

    test("missing required fields on every role", async () => {
        for (const [factory, field] of [[donorData, "pin"], [schoolData, "udise"], [ngoData, "mission"]]) {
            const data = factory();
            delete data[field];
            const res = await register(client, data);
            assert.equal(res.status, 400, `${field}: ${JSON.stringify(res.body)}`);
            assert.ok(res.body.errors[field], `expected error for ${field}`);
        }
    });

    test("format checks: phone, PIN, UDISE, IFSC, PAN, state", async () => {
        const cases = [
            [donorData({ phone: "12345" }), "phone"],
            [donorData({ pin: "012345" }), "pin"],
            [donorData({ state: "Atlantis" }), "state"],
            [schoolData({ udise: "12345678901234" }), "udise"],
            [schoolData({ ifsc: "SBIN1234" }), "ifsc"],
            [ngoData({ pan: "ABCD1234F" }), "pan"],
            [ngoData({ regDate: "2999-01-01" }), "regDate"],
        ];
        for (const [data, field] of cases) {
            const res = await register(client, data);
            assert.equal(res.status, 400, field);
            assert.ok(res.body.errors[field], `expected error for ${field}: ${JSON.stringify(res.body)}`);
        }
    });

    test("7-character password → 400", async () => {
        const res = await register(client, donorData({ password: "Abc1234", confirm: "Abc1234" }));
        assert.equal(res.status, 400);
        assert.match(res.body.errors.password, /at least 8/);
    });

    test("password over 72 bytes (multi-byte chars) → 400", async () => {
        const long = "é".repeat(37); // 37 chars, 74 bytes
        const res = await register(client, donorData({ password: long, confirm: long }));
        assert.equal(res.status, 400);
        assert.match(res.body.errors.password, /too long/);
    });

    test("mismatched confirm password → 400 (all roles)", async () => {
        for (const factory of [donorData, schoolData, ngoData]) {
            const res = await register(client, factory({ confirm: "Something-else-9" }));
            assert.equal(res.status, 400);
            assert.equal(res.body.errors.confirm, "Passwords do not match.");
        }
    });

    test("terms not accepted → 400", async () => {
        const res = await register(client, donorData({ agree: false }));
        assert.equal(res.status, 400);
        assert.ok(res.body.errors.agree);
    });
});

describe("duplicates", () => {
    test("duplicate email → 409, including different case", async () => {
        const data = donorData();
        assert.equal((await register(client, data)).status, 201);
        const again = await register(client, donorData({ email: data.email.toUpperCase() }));
        assert.equal(again.status, 409);
        assert.ok(again.body.errors.email);
        assert.equal(await models.User.countDocuments({ email: data.email }), 1);
    });

    test("same email cannot be reused across roles", async () => {
        const data = donorData();
        await register(client, data);
        const res = await register(client, schoolData({ email: data.email }));
        assert.equal(res.status, 409);
    });

    test("duplicate UDISE → 409 and no orphan user", async () => {
        const first = schoolData();
        assert.equal((await register(client, first)).status, 201);
        const second = schoolData({ udise: first.udise });
        const res = await register(client, second);
        assert.equal(res.status, 409);
        assert.ok(res.body.errors.udise);
        assert.equal(await models.User.countDocuments({ email: second.email }), 0);
    });

    test("duplicate NGO PAN → 409", async () => {
        const first = ngoData();
        await register(client, first);
        const res = await register(client, ngoData({ pan: first.pan.toLowerCase() }));
        assert.equal(res.status, 409);
        assert.ok(res.body.errors.pan);
    });

    test("concurrent duplicate registrations: exactly one succeeds, no orphans", async () => {
        const data = schoolData();
        const results = await Promise.all([register(client, data), register(client, { ...data, email: `x${data.email}` })]);
        const statuses = results.map((r) => r.status).sort();
        assert.deepEqual(statuses, [201, 409], JSON.stringify(results.map((r) => r.body)));
        assert.equal(await models.SchoolProfile.countDocuments({ udise: data.udise }), 1);
        const users = await models.User.countDocuments({ email: { $in: [data.email, `x${data.email}`] } });
        assert.equal(users, 1, "the losing request must roll back its user");
    });
});

describe("role and mass-assignment protection", () => {
    test("invalid role → 400", async () => {
        const res = await register(client, donorData({ role: "superuser" }));
        assert.equal(res.status, 400);
    });

    test("admin registration is rejected", async () => {
        const res = await register(client, { ...donorData(), role: "admin" });
        assert.equal(res.status, 400);
        assert.match(res.body.message, /Admin accounts cannot be registered/);
    });

    test("unexpected / sensitive fields are rejected, nothing is created", async () => {
        for (const extra of [{ accountStatus: "active" }, { _id: "64b000000000000000000000" }, { passwordHash: "x" }, { createdAt: "2020-01-01" }, { $where: "1" }, { tokenVersion: 5 }]) {
            const data = { ...donorData(), ...extra };
            const res = await register(client, data);
            assert.equal(res.status, 400, JSON.stringify(extra));
            assert.match(res.body.message, /Unexpected field/);
            assert.equal(await models.User.countDocuments({ email: data.email }), 0);
        }
    });

    test("a school cannot self-activate via accountStatus", async () => {
        const data = { ...schoolData(), accountStatus: "active" };
        const res = await register(client, data);
        assert.equal(res.status, 400);
    });

    test("MongoDB operator objects in field values are rejected", async () => {
        const res = await register(client, donorData({ city: { $gt: "" }, email: { $ne: null } }));
        assert.equal(res.status, 400);
        assert.ok(res.body.errors.city || res.body.errors.email);
    });

    test("wrong field types are rejected (school may not send donor fields)", async () => {
        const res = await register(client, { ...schoolData(), causes: ["Libraries"] });
        assert.equal(res.status, 400);
        assert.ok(res.body.errors.causes);
    });
});

describe("rollback", () => {
    test("profile failure after user creation removes the user and stored files", async () => {
        const data = schoolData();
        const SchoolProfile = models.SchoolProfile;
        const original = SchoolProfile.create;
        SchoolProfile.create = async () => {
            throw new Error("simulated database failure");
        };
        const consoleError = console.error;
        console.error = () => {};
        const { readdirSync } = await import("node:fs");
        const filesBefore = await models.UploadedFile.countDocuments();
        const diskBefore = readdirSync(server.uploadDir).sort();
        try {
            const res = await client.post("/api/auth/register", { form: registrationForm(data, { schoolPhoto: FILES.png(), schoolCertificate: FILES.pdf(), principalIdProof: FILES.jpeg() }) });
            assert.equal(res.status, 500);
            assert.equal(res.body.message, "Something went wrong. Please try again.", "internal error text must not leak");
        } finally {
            SchoolProfile.create = original;
            console.error = consoleError;
        }
        assert.equal(await models.User.countDocuments({ email: data.email }), 0, "user rolled back");
        const user = await models.User.findOne({ email: data.email });
        assert.equal(user, null);
        assert.equal(await models.UploadedFile.countDocuments(), filesBefore, "file records rolled back");
        assert.deepEqual(readdirSync(server.uploadDir).sort(), diskBefore, "no orphan files on disk");
    });
});
