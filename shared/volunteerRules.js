// VIDYADAAN — rules for an NGO's volunteers. Imported by BOTH the React form (instant feedback)
// and the Express API (the authoritative check). Keep it free of browser- and Node-only APIs.

import { checkIndianPhone } from "./registrationRules.js";

export const VOLUNTEERS_MAX = 200;
export const VOLUNTEER_FIELDS = ["name", "role", "phone", "projectId"];

const LABELS = { name: "Name", role: "Role", phone: "Phone number", projectId: "Project" };

const isBlank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

const text = (min, max) => (v, label) => {
  if (typeof v !== "string") return { error: `${label} must be text.` };
  const value = v.trim().replace(/\s+/g, " ");
  if (value.length < min) return { error: `${label} must be at least ${min} characters.` };
  if (value.length > max) return { error: `${label} must be at most ${max} characters.` };
  return { value };
};

const CHECKS = {
  name: text(2, 80),
  role: text(2, 60),
  phone: checkIndianPhone,
  // Which of the NGO's funded projects they work on; the server checks it is really one of them.
  projectId: (v, label) => (typeof v === "string" && /^[a-f\d]{24}$/i.test(v.trim()) ? { value: v.trim() } : { error: `Choose a valid ${label.toLowerCase()}.` }),
};
const REQUIRED = ["name", "role"];

/** Keys a browser may not send (mass-assignment protection). */
export const getUnexpectedVolunteerFields = (data) =>
  data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).filter((key) => !VOLUNTEER_FIELDS.includes(key)) : [];

/**
 * Validate a new volunteer (every field) or an edit (only the fields sent).
 * Optional fields left blank come back as "" (phone) or null (projectId), meaning "none".
 * @returns {{ errors: Record<string,string>, values: Record<string, unknown> }}
 */
export const validateVolunteer = (data, { isUpdate = false } = {}) => {
  const input = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const fields = isUpdate ? VOLUNTEER_FIELDS.filter((f) => f in input) : VOLUNTEER_FIELDS;
  const errors = {};
  const values = {};
  for (const field of fields) {
    const raw = input[field];
    if (isBlank(raw)) {
      if (REQUIRED.includes(field)) errors[field] = `${LABELS[field]} is required.`;
      else values[field] = field === "projectId" ? null : "";
      continue;
    }
    const result = CHECKS[field](raw, LABELS[field]);
    if (result.error) errors[field] = result.error;
    else values[field] = result.value;
  }
  return { errors, values };
};
