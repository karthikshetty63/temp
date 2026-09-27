// VIDYADAAN — rules for school projects (infrastructure needs).
// Imported by BOTH the React project form (instant feedback) and the Express API (the
// authoritative check), the same way registrationRules.js is. Keep it free of browser-
// and Node-only APIs.

import { IMAGE_TYPES } from "./registrationRules.js";

// The same ids as src/constants/infrastructureCategories.js (a test keeps them in sync).
export const PROJECT_CATEGORIES = [
  "Classroom Development", "Library", "Computer Lab", "Science Laboratory", "Drinking Water", "Electricity",
  "Toilets & Sanitation", "Playground", "Campus Development", "Mid-Day Meal", "Transportation",
  "Inclusive Education", "Arts & Culture", "Digital Learning", "Health & Wellness", "Other Infrastructure",
];
export const PROJECT_PRIORITIES = ["Critical", "High", "Medium", "Low"];
// The work's own status, set by the school once the project is approved.
export const PROJECT_STATUSES = ["Open", "In Progress", "On Hold", "Completed"];

// Admin review. A new (or resubmitted) project waits for review; only OPEN projects may ever be
// shown to NGOs, donors or the public.
export const PROJECT_REVIEW_STATUSES = ["PENDING_REVIEW", "OPEN", "REJECTED"];
export const PROJECT_REJECTION_REASON_MIN = 5;
export const PROJECT_REJECTION_REASON_MAX = 500;

export const PROJECT_BUDGET_MIN = 1000;
export const PROJECT_BUDGET_MAX = 10000000; // ₹1 crore
const STUDENTS_MAX = 100000;
const MATERIALS_MAX = 20;
const YEARS_AHEAD_MAX = 5;

// Fields a school may send. `status` only exists once a project does.
const CREATE_FIELDS = ["title", "category", "problem", "priority", "budget", "studentsBenefited", "expectedCompletion", "location", "materials"];
const UPDATE_FIELDS = [...CREATE_FIELDS, "status"];
const REQUIRED = ["title", "category", "problem", "priority", "budget", "studentsBenefited", "expectedCompletion"];

const LABELS = {
  title: "Project title",
  category: "Category",
  problem: "Problem description",
  priority: "Priority",
  budget: "Estimated budget",
  studentsBenefited: "Students benefited",
  expectedCompletion: "Expected completion date",
  location: "Location",
  materials: "Required materials",
  status: "Status",
};

const isBlank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const todayUTC = () => new Date().toISOString().slice(0, 10);

const text = (min, max, { collapse = true } = {}) => (v, label) => {
  if (typeof v !== "string") return { error: `${label} must be text.` };
  const value = collapse ? v.trim().replace(/\s+/g, " ") : v.trim();
  if (value.length < min) return { error: `${label} must be at least ${min} characters.` };
  if (value.length > max) return { error: `${label} must be at most ${max} characters.` };
  return { value };
};

const oneOf = (options) => (v, label) =>
  typeof v === "string" && options.includes(v) ? { value: v } : { error: `Select a valid ${label.toLowerCase()}.` };

const wholeNumber = (min, max, message) => (v) => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? { value: n } : { error: message };
};

const completionDate = ({ allowPast }) => (v, label) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: `${label} must be a valid date.` };
  const date = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== v) return { error: `${label} must be a valid date.` };
  const latest = new Date();
  latest.setUTCFullYear(latest.getUTCFullYear() + YEARS_AHEAD_MAX);
  if (v > latest.toISOString().slice(0, 10)) return { error: `${label} must be within the next ${YEARS_AHEAD_MAX} years.` };
  if (!allowPast && v < todayUTC()) return { error: `${label} can't be in the past.` };
  return { value: v };
};

// Accepts a list or the comma-separated text the form sends.
const materialList = (v, label) => {
  const items = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : null;
  if (!items || items.some((item) => typeof item !== "string")) return { error: `${label} must be a list of items.` };
  const value = [...new Set(items.map((item) => item.trim().replace(/\s+/g, " ")).filter(Boolean))];
  if (value.length > MATERIALS_MAX) return { error: `List at most ${MATERIALS_MAX} materials.` };
  if (value.some((item) => item.length > 60)) return { error: "Each material must be at most 60 characters." };
  return { value };
};

const checks = ({ isUpdate }) => ({
  title: text(5, 120),
  category: oneOf(PROJECT_CATEGORIES),
  problem: text(20, 2000, { collapse: false }),
  priority: oneOf(PROJECT_PRIORITIES),
  budget: wholeNumber(
    PROJECT_BUDGET_MIN,
    PROJECT_BUDGET_MAX,
    `Budget must be a whole number of rupees between ₹${PROJECT_BUDGET_MIN.toLocaleString("en-IN")} and ₹${PROJECT_BUDGET_MAX.toLocaleString("en-IN")}.`
  ),
  studentsBenefited: wholeNumber(1, STUDENTS_MAX, `Students benefited must be a whole number between 1 and ${STUDENTS_MAX.toLocaleString("en-IN")}.`),
  // An existing project may run late, so only new projects need a future date.
  expectedCompletion: completionDate({ allowPast: isUpdate }),
  location: text(0, 150),
  materials: materialList,
  status: oneOf(PROJECT_STATUSES),
});

/** Keys in `data` a school may not send (mass-assignment protection). */
export const getUnexpectedProjectFields = (data, { isUpdate = false } = {}) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const allowed = isUpdate ? UPDATE_FIELDS : CREATE_FIELDS;
  return Object.keys(data).filter((key) => !allowed.includes(key));
};

/**
 * Validate a new project (all required fields) or an edit (only the fields sent).
 * @returns {{ errors: Record<string,string>, values: Record<string, unknown> }}
 */
export const validateProject = (data, { isUpdate = false } = {}) => {
  const input = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const rules = checks({ isUpdate });
  const fields = isUpdate ? UPDATE_FIELDS.filter((f) => f in input) : CREATE_FIELDS;
  const errors = {};
  const values = {};

  for (const field of fields) {
    const raw = input[field];
    if (isBlank(raw) || (Array.isArray(raw) && raw.length === 0)) {
      if (REQUIRED.includes(field)) errors[field] = `${LABELS[field]} is required.`;
      else values[field] = field === "materials" ? [] : "";
      continue;
    }
    const result = rules[field](raw, LABELS[field]);
    if (result.error) errors[field] = result.error;
    else values[field] = result.value;
  }
  return { errors, values };
};

// ─── Project photos (the school's gallery) ───────────────────────────────────────
// A photo belongs to one of the school's own projects; the stage says when in the work it was taken.
export const PHOTO_STAGES = ["Before", "In progress", "Completed"];
export const PHOTO_CAPTION_MAX = 200;
// Checked with getUploadError() from registrationRules.js (5 MB limit, real file type).
export const PROJECT_PHOTO_RULE = { label: "Photo", hint: "JPG, PNG or WebP, max 5 MB", types: IMAGE_TYPES };

/**
 * Validate a photo's details (not the file): which project, which stage, an optional caption.
 * @returns {{ errors: Record<string,string>, values: { projectId?: string, stage?: string, caption?: string } }}
 */
export const validatePhotoDetails = (data) => {
  const input = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const errors = {};
  const values = {};

  if (typeof input.projectId !== "string" || !input.projectId.trim()) errors.projectId = "Choose the project this photo belongs to.";
  else values.projectId = input.projectId.trim();

  if (!PHOTO_STAGES.includes(input.stage)) errors.stage = "Choose when the photo was taken.";
  else values.stage = input.stage;

  const caption = isBlank(input.caption) ? "" : input.caption;
  if (typeof caption !== "string") errors.caption = "Caption must be text.";
  else {
    const value = caption.trim().replace(/\s+/g, " ");
    if (value.length > PHOTO_CAPTION_MAX) errors.caption = `Caption must be at most ${PHOTO_CAPTION_MAX} characters.`;
    else values.caption = value;
  }

  return { errors, values };
};
