// VIDYADAAN — single source of truth for registration, login and upload rules.
// Imported by BOTH the React registration forms (for instant feedback) and the
// Express server (the authoritative check). Change a rule here and both sides follow.
// Keep this file free of browser-only and Node-only APIs.

export const ROLES = ["donor", "school", "ngo", "admin"];
export const PUBLIC_ROLES = ["donor", "school", "ngo"];
export const ACCOUNT_STATUSES = ["active", "pending", "rejected"];
// Every public account is checked by an admin before it can sign in.
export const APPROVAL_ROLES = ["school", "ngo", "donor"];

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt silently ignores everything after 72 bytes, so longer passwords are rejected.
export const PASSWORD_MAX_BYTES = 72;

// Password reset links carry 32 random bytes (64 hex characters), are single-use and expire quickly.
export const PASSWORD_RESET_TTL_MINUTES = 15;
export const PASSWORD_RESET_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

// Option lists already shown by the existing registration forms.
export const SCHOOL_STATES = ["Karnataka", "Tamil Nadu", "Andhra Pradesh", "Telangana", "Kerala", "Maharashtra", "Gujarat", "Rajasthan", "Uttar Pradesh", "Bihar"];
export const NGO_STATES = ["Karnataka", "Tamil Nadu", "Andhra Pradesh", "Telangana", "Kerala", "Maharashtra", "Gujarat", "Rajasthan"];
export const DONOR_STATES = NGO_STATES;
export const DONOR_CAUSES = ["Libraries", "Toilets", "Classrooms", "Digital Labs", "Mid-day Meal", "School Uniforms", "Sports Equipment", "Water & Sanitation"];
export const DONOR_FREQUENCIES = ["One-time", "Monthly", "Quarterly", "Annually"];
export const NGO_TYPES = ["Trust", "Society", "Section 8 Company", "Others"];
export const NGO_FOCUS_AREAS = ["Education", "Literacy", "Health", "Nutrition", "WASH", "Digital Literacy", "Sports", "Vocational"];

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const UDISE_PATTERN = /^\d{11}$/;

const utf8Length = (value) => new TextEncoder().encode(value).length;

export const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

export const getPasswordError = (password = "", confirm) => {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (utf8Length(password) > PASSWORD_MAX_BYTES) return "Password is too long (maximum 72 bytes).";
  if (confirm !== undefined && password !== confirm) return "Passwords do not match.";
  return "";
};

// ─── Field type helpers ──────────────────────────────────────────────────────
// Each returns { value } on success or { error } on failure. `value` is the
// normalised value that gets stored. Empty optional values return { value: undefined }.

const isBlank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

const text = ({ min = 1, max = 200 } = {}) => (v, label) => {
  if (typeof v !== "string") return { error: `${label} must be text.` };
  const value = v.trim().replace(/\s+/g, " ");
  if (value.length < min) return { error: `${label} must be at least ${min} characters.` };
  if (value.length > max) return { error: `${label} must be at most ${max} characters.` };
  return { value };
};

const multiline = ({ min = 1, max = 500 } = {}) => (v, label) => {
  if (typeof v !== "string") return { error: `${label} must be text.` };
  const value = v.trim();
  if (value.length < min) return { error: `${label} must be at least ${min} characters.` };
  if (value.length > max) return { error: `${label} must be at most ${max} characters.` };
  return { value };
};

const email = () => (v, label) => {
  const value = normalizeEmail(v);
  if (!EMAIL_PATTERN.test(value) || value.length > 254) return { error: `Enter a valid ${label.toLowerCase()}.` };
  return { value };
};

// Indian mobile/landline numbers. Stored as +91 followed by 10 digits.
const phone = () => (v, label) => {
  if (typeof v !== "string") return { error: `${label} must be text.` };
  let digits = v.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.startsWith("0091")) digits = digits.slice(4);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[1-9]\d{9}$/.test(digits)) return { error: `${label} must be a valid 10-digit Indian phone number.` };
  return { value: `+91${digits}` };
};

const pattern = (regex, message, transform = (s) => s.trim()) => (v, label) => {
  if (typeof v !== "string") return { error: `${label} must be text.` };
  const value = transform(v);
  if (!regex.test(value)) return { error: `${label} ${message}` };
  return { value };
};

const oneOf = (options) => (v, label) => {
  if (typeof v !== "string" || !options.includes(v)) return { error: `Select a valid ${label.toLowerCase()}.` };
  return { value: v };
};

const manyOf = (options, { max = options.length } = {}) => (v, label) => {
  if (!Array.isArray(v) || v.some((item) => typeof item !== "string" || !options.includes(item))) return { error: `${label} contains an invalid option.` };
  const value = [...new Set(v)];
  if (value.length > max) return { error: `${label} has too many options.` };
  return { value };
};

const integer = ({ min = 0, max = 1_000_000 } = {}) => (v, label) => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) return { error: `${label} must be a whole number between ${min} and ${max}.` };
  return { value: n };
};

const boolean = () => (v, label) => {
  if (typeof v !== "boolean") return { error: `${label} must be true or false.` };
  return { value: v };
};

// Dates arrive as "YYYY-MM-DD" from <input type="date">.
const pastDate = ({ minYear = 1800 } = {}) => (v, label) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: `${label} must be a valid date.` };
  const date = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== v) return { error: `${label} must be a valid date.` };
  if (date.getUTCFullYear() < minYear || date.getTime() > Date.now()) return { error: `${label} cannot be in the future.` };
  return { value: v };
};

const year = () => (v, label) => {
  const result = integer({ min: 1800, max: new Date().getFullYear() })(v, label);
  return result.error ? { error: `${label} must be a year between 1800 and ${new Date().getFullYear()}.` } : result;
};

const url = () => (v, label) => {
  if (typeof v !== "string") return { error: `${label} must be text.` };
  const value = v.trim();
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || value.length > 300) throw new Error("bad");
  } catch {
    return { error: `${label} must be a valid http(s) link.` };
  }
  return { value };
};

const mustBeTrue = (message) => (v) => (v === true ? { value: true } : { error: message });

// ─── Registration schemas ────────────────────────────────────────────────────
// `step` = index of the form step that shows the field (used to jump back to it).
// `profile: false` = validated but not stored on the role profile.

// `passwordStep` differs from `step` on the donor form (password has its own step).
const accountFields = (step, { nameField = "name", nameLabel = "Full name", passwordStep = step } = {}) => ({
  [nameField]: { label: nameLabel, required: true, step, check: text({ min: 2, max: 120 }) },
  email: { label: "Email address", required: true, step, check: email(), profile: false },
  password: { label: "Password", required: true, step: passwordStep, profile: false, check: (v) => { const error = getPasswordError(v); return error ? { error } : { value: v }; } },
});

export const REGISTRATION_SCHEMAS = {
  donor: {
    steps: ["Personal", "Address", "Password", "Preferences", "Documents", "Review"],
    fields: {
      ...accountFields(0, { passwordStep: 2 }),
      phone: { label: "Phone number", required: true, step: 0, check: phone() },
      dob: { label: "Date of birth", required: false, step: 0, check: pastDate({ minYear: 1900 }) },
      address: { label: "Address", required: true, step: 1, check: multiline({ min: 5, max: 300 }) },
      city: { label: "City", required: true, step: 1, check: text({ min: 2, max: 80 }) },
      state: { label: "State", required: true, step: 1, check: oneOf(DONOR_STATES) },
      pin: { label: "PIN code", required: true, step: 1, check: pattern(/^[1-9]\d{5}$/, "must be a valid 6-digit PIN code.") },
      causes: { label: "Preferred causes", required: false, step: 3, check: manyOf(DONOR_CAUSES) },
      frequency: { label: "Donation frequency", required: false, step: 3, check: oneOf(DONOR_FREQUENCIES) },
      anonymous: { label: "Anonymous preference", required: false, step: 3, check: boolean() },
      agree: { label: "Terms", required: true, step: 5, profile: false, check: mustBeTrue("You must accept the Terms of Service and Privacy Policy.") },
    },
  },
  school: {
    steps: ["School Info", "Principal", "Infrastructure", "Documents", "Bank Details", "Review"],
    fields: {
      schoolName: { label: "School name", required: true, step: 0, check: text({ min: 3, max: 150 }) },
      udise: { label: "UDISE code", required: true, step: 0, check: pattern(UDISE_PATTERN, "must be exactly 11 digits.", (s) => s.replace(/\s/g, "")) },
      address: { label: "Full address", required: true, step: 0, check: multiline({ min: 5, max: 300 }) },
      district: { label: "District", required: true, step: 0, check: text({ min: 2, max: 80 }) },
      state: { label: "State", required: true, step: 0, check: oneOf(SCHOOL_STATES) },
      ...accountFields(1, { nameField: "principalName", nameLabel: "Principal name" }),
      phone: { label: "Phone number", required: true, step: 1, check: phone() },
      students: { label: "Total students", required: false, step: 1, check: integer({ min: 0, max: 100000 }) },
      teachers: { label: "Total teachers", required: false, step: 1, check: integer({ min: 0, max: 10000 }) },
      hasToilets: { label: "Functional toilets", required: false, step: 2, check: boolean() },
      hasLibrary: { label: "Library", required: false, step: 2, check: boolean() },
      hasComputers: { label: "Computer lab", required: false, step: 2, check: boolean() },
      hasDrinkingWater: { label: "Drinking water", required: false, step: 2, check: boolean() },
      bankAccount: { label: "Bank account number", required: true, step: 4, check: pattern(/^\d{9,18}$/, "must be 9 to 18 digits.", (s) => s.replace(/\s/g, "")) },
      ifsc: { label: "IFSC code", required: true, step: 4, check: pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/, "must look like SBIN0001234.", (s) => s.trim().toUpperCase()) },
      upi: { label: "UPI ID", required: false, step: 4, check: pattern(/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, "must look like name@bank.") },
      agree: { label: "Declaration", required: true, step: 5, profile: false, check: mustBeTrue("You must accept the declaration, Terms of Service and Privacy Policy.") },
    },
  },
  ngo: {
    steps: ["Organisation", "Mission", "Registration", "Address", "Contact", "Documents", "Review"],
    fields: {
      ngoName: { label: "NGO name", required: true, step: 0, check: text({ min: 3, max: 150 }) },
      type: { label: "Organisation type", required: false, step: 0, check: oneOf(NGO_TYPES) },
      established: { label: "Year established", required: false, step: 0, check: year() },
      website: { label: "Website", required: false, step: 0, check: url() },
      mission: { label: "Mission statement", required: true, step: 1, check: multiline({ min: 20, max: 2000 }) },
      focus: { label: "Focus areas", required: false, step: 1, check: manyOf(NGO_FOCUS_AREAS) },
      regNumber: { label: "Registration number", required: true, step: 2, check: pattern(/^[A-Za-z0-9/\- ]{3,50}$/, "may only contain letters, numbers, / and -.") },
      regDate: { label: "Registration date", required: true, step: 2, check: pastDate() },
      pan: { label: "PAN number", required: true, step: 2, check: pattern(/^[A-Z]{5}\d{4}[A-Z]$/, "must look like ABCDE1234F.", (s) => s.trim().toUpperCase()) },
      address: { label: "Registered address", required: true, step: 3, check: multiline({ min: 5, max: 300 }) },
      district: { label: "District", required: true, step: 3, check: text({ min: 2, max: 80 }) },
      state: { label: "State", required: true, step: 3, check: oneOf(NGO_STATES) },
      ...accountFields(4, { nameField: "contactName", nameLabel: "Primary contact name" }),
      phone: { label: "Phone number", required: true, step: 4, check: phone() },
      altPhone: { label: "Alternate phone", required: false, step: 4, check: phone() },
      agree: { label: "Declaration", required: true, step: 6, profile: false, check: mustBeTrue("You must accept the declaration, Terms of Service and Privacy Policy.") },
    },
  },
};

// Keys the frontend sends that are validated elsewhere and never stored.
export const CLIENT_ONLY_FIELDS = ["confirm", "role"];

/**
 * Validate registration data.
 * @param {"donor"|"school"|"ngo"} role
 * @param {object} data raw form values
 * @param {{ steps?: number[] }} [options] only validate fields on these steps (frontend per-step checks)
 * @returns {{ errors: Record<string,string>, values: Record<string,unknown>, firstErrorStep: number|null }}
 */
export const validateRegistration = (role, data, { steps } = {}) => {
  const schema = REGISTRATION_SCHEMAS[role];
  const errors = {};
  const values = {};
  if (!schema) return { errors: { role: "Role must be donor, school, or ngo." }, values, firstErrorStep: 0 };
  const input = data && typeof data === "object" && !Array.isArray(data) ? data : {};

  for (const [name, rule] of Object.entries(schema.fields)) {
    if (steps && !steps.includes(rule.step)) continue;
    const raw = input[name];
    if (isBlank(raw) || (Array.isArray(raw) && raw.length === 0 && !rule.required)) {
      if (rule.required) errors[name] = name === "agree" ? rule.check(raw).error : `${rule.label} is required.`;
      continue;
    }
    const result = rule.check(raw, rule.label);
    if (result.error) errors[name] = result.error;
    else values[name] = result.value;
  }

  // Confirm password lives on the same step as the password.
  const passwordStep = schema.fields.password.step;
  if ((!steps || steps.includes(passwordStep)) && !errors.password && input.confirm !== input.password) {
    errors.confirm = "Passwords do not match.";
  }

  const errorSteps = Object.keys(errors).map((k) => (k === "confirm" ? passwordStep : schema.fields[k]?.step ?? 0));
  return { errors, values, firstErrorStep: errorSteps.length ? Math.min(...errorSteps) : null };
};

/** Keys in `data` that are not allowed for this role (mass-assignment protection). */
export const getUnexpectedFields = (role, data) => {
  const schema = REGISTRATION_SCHEMAS[role];
  if (!schema || !data || typeof data !== "object") return [];
  const allowed = new Set([...Object.keys(schema.fields), ...CLIENT_ONLY_FIELDS]);
  return Object.keys(data).filter((key) => !allowed.has(key));
};

/** Profile-only values (drops email/password/agree) ready to be stored. */
export const pickProfileValues = (role, values) => {
  const schema = REGISTRATION_SCHEMAS[role];
  return Object.fromEntries(Object.entries(values).filter(([name]) => schema.fields[name]?.profile !== false));
};

/** The display name stored on the User record for each role. */
export const getAccountName = (role, values) => ({ donor: values.name, school: values.principalName, ngo: values.contactName }[role]);

// ─── Editing a school profile after registration ─────────────────────────────
// What a school may change itself. Its identity (name, UDISE, district, state, email) and bank
// details were verified when the admin approved it, so they stay locked.
export const SCHOOL_PROFILE_EDITABLE = ["principalName", "phone", "address", "students", "teachers", "hasToilets", "hasLibrary", "hasComputers", "hasDrinkingWater"];
export const SCHOOL_FACILITY_FIELDS = ["hasToilets", "hasLibrary", "hasComputers", "hasDrinkingWater"];

/**
 * Validate a school's profile edit (only the fields sent), with the registration rules.
 * @returns {{ errors: Record<string,string>, values: Record<string,unknown>, cleared: string[] }}
 *   `cleared` = optional fields sent empty, to be removed.
 */
export const validateSchoolProfileUpdate = (data) => {
  const input = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const fields = REGISTRATION_SCHEMAS.school.fields;
  const errors = {};
  const values = {};
  const cleared = [];

  for (const key of Object.keys(input)) {
    if (!SCHOOL_PROFILE_EDITABLE.includes(key)) errors[key] = "This field can't be changed here.";
  }
  for (const name of SCHOOL_PROFILE_EDITABLE) {
    if (!(name in input)) continue;
    const rule = fields[name];
    if (isBlank(input[name])) {
      if (rule.required) errors[name] = `${rule.label} is required.`;
      else cleared.push(name);
      continue;
    }
    const result = rule.check(input[name], rule.label);
    if (result.error) errors[name] = result.error;
    else values[name] = result.value;
  }
  return { errors, values, cleared };
};

// ─── Uploads ─────────────────────────────────────────────────────────────────
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // matches "max 5MB" in the existing UI
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];

// `field` is the multipart field name; `profilePath` is where the file id is stored on the profile.
export const UPLOAD_RULES = {
  school: {
    schoolCertificate: { label: "School Registration Certificate", hint: "PDF or Image", types: DOCUMENT_TYPES, required: true, profilePath: "documents.registrationCertificate", step: 3 },
    principalIdProof: { label: "Principal ID Proof", hint: "Govt photo ID; if Aadhaar, mask the first 8 digits", types: DOCUMENT_TYPES, required: true, profilePath: "documents.principalIdProof", step: 3 },
    schoolPhoto: { label: "School Photograph", hint: "JPG/PNG/WebP, max 5MB", types: IMAGE_TYPES, required: false, profilePath: "photo", step: 3 },
  },
  ngo: {
    registrationCertificate: { label: "Registration Certificate", hint: "PDF or Image, max 5MB", types: DOCUMENT_TYPES, required: true, profilePath: "documents.registrationCertificate", step: 5 },
    certificate12A80G: { label: "12A / 80G Certificate", hint: "PDF or Image, max 5MB", types: DOCUMENT_TYPES, required: false, profilePath: "documents.certificate12A80G", step: 5 },
    annualReport: { label: "Annual Report (Last Year)", hint: "PDF or Image, max 5MB", types: DOCUMENT_TYPES, required: false, profilePath: "documents.annualReport", step: 5 },
    panCard: { label: "PAN Card", hint: "PDF or Image, max 5MB", types: DOCUMENT_TYPES, required: true, profilePath: "documents.panCard", step: 5 },
  },
  donor: {
    // Needed for 80G tax-exemption receipts, and checked by an admin before the account is activated.
    panCard: { label: "PAN Card", hint: "PDF or photo, max 5MB", types: DOCUMENT_TYPES, required: true, profilePath: "documents.panCard", step: 4 },
  },
};

const TYPE_LABELS = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WebP", "application/pdf": "PDF" };
export const describeTypes = (types) => types.map((t) => TYPE_LABELS[t] || t).join(", ");

/**
 * Check one file's declared type and size. The server additionally checks the
 * real file signature (magic bytes), which a browser cannot be trusted to do.
 */
export const getUploadError = (rule, { type, size }) => {
  if (!rule) return "This file is not expected here.";
  if (!rule.types.includes(type)) return `${rule.label} must be one of: ${describeTypes(rule.types)}.`;
  if (!Number.isFinite(size) || size <= 0) return `${rule.label} is empty.`;
  if (size > MAX_UPLOAD_BYTES) return `${rule.label} must be 5 MB or smaller.`;
  return "";
};

/** Missing required uploads for a role, given the set of provided field names. */
export const getMissingUploads = (role, providedFields, rules = UPLOAD_RULES[role] || {}) =>
  Object.entries(rules).filter(([field, rule]) => rule.required && !providedFields.includes(field)).map(([field, rule]) => ({ field, message: `${rule.label} is required.`, step: rule.step }));
