// Shared setup for the automated auth test suite.
// Runs the real Express app against a throwaway in-memory MongoDB and a temporary
// uploads folder. It never loads .env and never touches the real (Atlas) database.
import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(32).toString("hex");

const { MongoMemoryServer } = await import("mongodb-memory-server");
const { default: mongoose } = await import("mongoose");
const { createApp } = await import("../app.js");
const { setUploadDir } = await import("../utils/fileStorage.js");
const { createOrResetAdmin } = await import("../services/adminAccount.js");
const { UPLOAD_RULES } = await import("../../shared/registrationRules.js");
const models = await Promise.all(
    ["User", "SchoolProfile", "NGOProfile", "DonorProfile", "UploadedFile", "RevokedSession", "Project"].map((m) => import(`../models/${m}.js`))
);

export const FRONTEND_ORIGIN = "http://localhost:5173";

/** Start an isolated API server. Call `stop()` in `after()`. */
export const startTestServer = async ({ rateLimits = false } = {}) => {
    const mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri("vidyaadaan_test"));
    // Build unique indexes before tests that rely on them (duplicate email/UDISE/PAN).
    await Promise.all(models.map((m) => m.default.init()));

    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "vidyaadaan-uploads-"));
    setUploadDir(uploadDir);

    const app = createApp({ corsOrigin: FRONTEND_ORIGIN, rateLimits });
    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    return {
        baseUrl,
        uploadDir,
        mongoose,
        stop: async () => {
            await new Promise((resolve) => server.close(resolve));
            await mongoose.disconnect();
            await mongo.stop();
            fs.rmSync(uploadDir, { recursive: true, force: true });
        },
    };
};

/** A tiny HTTP client that remembers the auth cookie, like a browser does. */
export const createClient = (baseUrl) => {
    let cookie = "";
    const client = {
        get cookie() {
            return cookie;
        },
        set cookie(value) {
            cookie = value;
        },
        async request(method, urlPath, { json, form, headers = {} } = {}) {
            const init = { method, headers: { Origin: FRONTEND_ORIGIN, ...headers } };
            if (cookie) init.headers.Cookie = cookie;
            if (json !== undefined) {
                init.headers["Content-Type"] = "application/json";
                init.body = typeof json === "string" ? json : JSON.stringify(json);
            } else if (form) {
                init.body = form;
            }
            const res = await fetch(baseUrl + urlPath, init);
            const setCookie = res.headers.get("set-cookie") || "";
            if (setCookie.startsWith("vidyaadaan_auth=")) {
                const pair = setCookie.split(";")[0];
                // A browser deletes the cookie when it receives an empty value / Max-Age=0.
                cookie = pair === "vidyaadaan_auth=" || /Max-Age=0/i.test(setCookie) ? "" : pair;
            }
            const contentType = res.headers.get("content-type") || "";
            const body = contentType.includes("application/json") ? await res.json() : Buffer.from(await res.arrayBuffer());
            return { status: res.status, body, headers: res.headers, setCookie };
        },
        get: (p, o) => client.request("GET", p, o),
        post: (p, o) => client.request("POST", p, o),
        put: (p, o) => client.request("PUT", p, o),
        patch: (p, o) => client.request("PATCH", p, o),
        delete: (p, o) => client.request("DELETE", p, o),
    };
    return client;
};

// ─── Fixtures ────────────────────────────────────────────────────────────────
let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter += 1)}`;
const digits = (n) => Array.from({ length: n }, (_, i) => (i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10))).join("");
const panLetters = () => Array.from({ length: 5 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");

export const PASSWORD = "Str0ng-pass-8";

export const donorData = (overrides = {}) => ({
    role: "donor",
    name: "Test Donor",
    email: `donor.${unique()}@example.com`,
    phone: "+91 98765 43210",
    dob: "1990-05-01",
    address: "12 MG Road, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    pin: "560001",
    password: PASSWORD,
    confirm: PASSWORD,
    causes: ["Libraries", "Toilets"],
    frequency: "Monthly",
    anonymous: false,
    agree: true,
    ...overrides,
});

export const schoolData = (overrides = {}) => ({
    role: "school",
    schoolName: "Govt. Primary School, Honnali",
    udise: digits(11),
    address: "School building, Honnali Village, Davangere",
    district: "Davangere",
    state: "Karnataka",
    principalName: "Suresh Kumar",
    email: `school.${unique()}@example.gov.in`,
    phone: "9876543210",
    password: PASSWORD,
    confirm: PASSWORD,
    students: "438",
    teachers: "18",
    hasToilets: true,
    hasLibrary: false,
    hasComputers: true,
    hasDrinkingWater: false,
    bankAccount: "123456789012",
    ifsc: "SBIN0001234",
    upi: "school@sbi",
    agree: true,
    ...overrides,
});

export const ngoData = (overrides = {}) => ({
    role: "ngo",
    ngoName: "Shiksha Seva Foundation",
    type: "Trust",
    established: "2010",
    website: "https://shikshaseva.example.org",
    mission: "Improving learning conditions in rural government schools across Karnataka.",
    focus: ["Education", "WASH"],
    regNumber: `NGO/2010/REG/${digits(5)}`,
    regDate: "2010-06-15",
    pan: `${panLetters()}${digits(4)}${panLetters().slice(0, 1)}`,
    address: "2nd Floor, Jayanagar, Bengaluru 560041",
    district: "Bengaluru Urban",
    state: "Karnataka",
    contactName: "Programme Director",
    email: `ngo.${unique()}@example.org`,
    phone: "080 2345 6789",
    altPhone: "",
    password: PASSWORD,
    confirm: PASSWORD,
    agree: true,
    ...overrides,
});

// Minimal files whose first bytes match real formats.
export const FILES = {
    png: () => new File([Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4f10000000049454e44ae426082", "hex")], "photo.png", { type: "image/png" }),
    jpeg: () => new File([Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 1)])], "photo.jpg", { type: "image/jpeg" }),
    pdf: () => new File([Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n")], "certificate.pdf", { type: "application/pdf" }),
    // Claims to be a PNG but is actually a script — must be rejected by the signature check.
    fakePng: () => new File([Buffer.from("<script>alert('x')</script> not an image at all")], "evil.png", { type: "image/png" }),
    exe: () => new File([Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100)])], "setup.exe", { type: "application/x-msdownload" }),
    oversized: (type = "image/png") => new File([Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(5 * 1024 * 1024 + 10)])], "big.png", { type }),
};

/** Build the multipart body the React forms send: `data` JSON + files. */
export const registrationForm = (data, files = {}) => {
    const form = new FormData();
    form.append("data", JSON.stringify(data));
    for (const [field, file] of Object.entries(files)) form.append(field, file);
    return form;
};

export const createAdmin = async (overrides = {}) => {
    const credentials = { name: "Platform Admin", email: `admin.${unique()}@vidyadaan.test`, password: PASSWORD, ...overrides };
    await createOrResetAdmin(credentials);
    return credentials;
};

/** Register (JSON) and return the response. */
/** The documents a role must upload at registration (small but genuine PDFs). */
export const requiredFiles = (role) =>
    Object.fromEntries(Object.entries(UPLOAD_RULES[role] || {}).filter(([, rule]) => rule.required).map(([field]) => [field, FILES.pdf()]));

/** Register the way the React form does: the values as JSON plus the required documents. */
export const register = (client, data, files = requiredFiles(data.role)) =>
    client.post("/api/auth/register", { form: registrationForm(data, files) });

/** Register, then approve the account as an admin would (every new account starts pending). */
export const registerActive = async (client, data, files) => {
    const res = await register(client, data, files);
    await models[0].default.updateOne({ email: String(data.email).trim().toLowerCase() }, { $set: { accountStatus: "active" } });
    return res;
};

export const login = (client, email, password = PASSWORD, role) =>
    client.post("/api/auth/login", { json: { email, password, ...(role ? { role } : {}) } });
