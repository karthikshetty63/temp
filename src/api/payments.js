import { apiRequest } from "./auth";

// Rules shared with the server (the server re-checks everything).
export { getUploadError } from "../../shared/registrationRules.js";
export {
  PAYMENT_METHODS,
  PAYMENT_NOTE_MAX,
  PAYMENT_PROOF_RULE,
  PAYMENT_REJECTION_REASON_MAX,
  validatePaymentDetails,
  validateRejectionReason,
} from "../../shared/paymentRules.js";

// ─── NGO ─────────────────────────────────────────────────────────────────────
/** Where to send the money for a need the NGO has committed to (the school's bank account and UPI). */
export const getPaymentDetails = (projectId) => apiRequest(`/api/projects/${encodeURIComponent(projectId)}/payment-details`);

/** Record a payment already made to the school, with its proof file (challan, receipt or screenshot). */
export const submitPayment = (projectId, { parts, method, reference, paidOn, note, proof }) => {
  const form = new FormData();
  form.append("parts", parts.join(","));
  form.append("method", method);
  form.append("reference", reference);
  form.append("paidOn", paidOn);
  form.append("note", note);
  form.append("proof", proof);
  return apiRequest(`/api/projects/${encodeURIComponent(projectId)}/payments`, { method: "POST", body: form });
};

/** Every payment the signed-in NGO has recorded, newest first. */
export const listMyPayments = () => apiRequest("/api/projects/payments");

// ─── School ──────────────────────────────────────────────────────────────────
/** Payments NGOs have recorded for the signed-in school's projects, newest first. */
export const listSchoolPayments = () => apiRequest("/api/school/payments");

/** The money has reached the school: its parts count as received. */
export const acceptPayment = (id) => apiRequest(`/api/school/payments/${encodeURIComponent(id)}/accept`, { method: "PATCH" });

/** The money hasn't arrived (or the proof is wrong); the NGO sees `reason`. */
export const rejectPayment = (id, reason) =>
  apiRequest(`/api/school/payments/${encodeURIComponent(id)}/reject`, { method: "PATCH", body: { reason } });
