// VIDYADAAN — rules for NGO payments to schools. Imported by BOTH the React payment form (instant
// feedback) and the Express API (the authoritative check). Keep it free of browser- and Node-only APIs.
//
// Money never passes through VIDYADAAN: the NGO pays the school directly, then records the payment
// here with proof (challan, receipt or transaction screenshot). The school accepts it once the
// money has reached its account.

import { FUNDING_PARTS } from "./projectRules.js";
import { DOCUMENT_TYPES } from "./registrationRules.js";

export const PAYMENT_METHODS = ["Bank transfer (NEFT/RTGS/IMPS)", "UPI", "Cheque", "Demand draft", "Cash deposit (challan)"];
export const PAYMENT_STATUSES = ["SUBMITTED", "ACCEPTED", "REJECTED"];
// Checked with getUploadError() from registrationRules.js (5 MB limit, real file type).
export const PAYMENT_PROOF_RULE = {
  label: "Payment proof",
  hint: "Challan, receipt or transaction screenshot: JPG, PNG, WebP or PDF, max 5 MB",
  types: DOCUMENT_TYPES,
};
export const PAYMENT_NOTE_MAX = 300;
export const PAYMENT_REJECTION_REASON_MIN = 5;
export const PAYMENT_REJECTION_REASON_MAX = 300;

const REFERENCE_MIN = 4;
const REFERENCE_MAX = 40;

const isBlank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const todayUTC = () => new Date().toISOString().slice(0, 10);

/** A UTR / transaction ID / cheque number as stored and compared: upper case, single spaces. */
export const normalizeReference = (value) => String(value).trim().replace(/\s+/g, " ").toUpperCase();

/** Parts as a list ([1, 2]) or as the text a form sends ("1,2"). */
const readParts = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",").filter((s) => s.trim() !== "").map((s) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN));
  return null;
};

/**
 * Validate what an NGO says about a payment it made (not the proof file).
 * @returns {{ errors: Record<string,string>, values: { parts?: number[], method?: string, reference?: string, paidOn?: string, note?: string } }}
 */
export const validatePaymentDetails = (data) => {
  const input = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const errors = {};
  const values = {};

  const parts = readParts(input.parts);
  if (!parts || parts.length === 0) errors.parts = "Choose the parts this payment covers.";
  else if (parts.some((p) => !Number.isInteger(p) || p < 1 || p > FUNDING_PARTS)) errors.parts = `Parts are numbered 1 to ${FUNDING_PARTS}.`;
  else if (new Set(parts).size !== parts.length) errors.parts = "Choose each part only once.";
  else values.parts = [...parts].sort((a, b) => a - b);

  if (!PAYMENT_METHODS.includes(input.method)) errors.method = "Choose how you paid.";
  else values.method = input.method;

  if (isBlank(input.reference)) errors.reference = "Enter the transaction reference (UTR, transaction ID or cheque number).";
  else if (typeof input.reference !== "string") errors.reference = "Transaction reference must be text.";
  else {
    const reference = normalizeReference(input.reference);
    if (reference.length < REFERENCE_MIN || reference.length > REFERENCE_MAX) {
      errors.reference = `Transaction reference must be ${REFERENCE_MIN} to ${REFERENCE_MAX} characters.`;
    } else if (!/^[A-Z0-9][A-Z0-9 /-]*$/.test(reference)) {
      errors.reference = "Transaction reference can only have letters, numbers, spaces, / and -.";
    } else values.reference = reference;
  }

  const paidOn = input.paidOn;
  if (typeof paidOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || new Date(`${paidOn}T00:00:00Z`).toISOString().slice(0, 10) !== paidOn) {
    errors.paidOn = "Enter the date you paid.";
  } else if (paidOn > todayUTC()) errors.paidOn = "The payment date can't be in the future.";
  else values.paidOn = paidOn;

  if (isBlank(input.note)) values.note = "";
  else if (typeof input.note !== "string") errors.note = "Note must be text.";
  else if (input.note.trim().length > PAYMENT_NOTE_MAX) errors.note = `Note must be at most ${PAYMENT_NOTE_MAX} characters.`;
  else values.note = input.note.trim();

  return { errors, values };
};

/** Why a school rejects a payment (the NGO sees this). @returns {{ error?: string, value?: string }} */
export const validateRejectionReason = (reason) => {
  if (typeof reason !== "string" || reason.trim().length < PAYMENT_REJECTION_REASON_MIN) {
    return { error: `Tell the NGO why, in at least ${PAYMENT_REJECTION_REASON_MIN} characters.` };
  }
  if (reason.trim().length > PAYMENT_REJECTION_REASON_MAX) return { error: `Keep the reason under ${PAYMENT_REJECTION_REASON_MAX} characters.` };
  return { value: reason.trim().replace(/\s+/g, " ") };
};
