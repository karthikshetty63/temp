// VIDYADAAN — rules for donors' online donations (paid through Razorpay). Imported by the Express API
// (the authoritative check) and, later, by the React donation form (instant feedback), the same way
// paymentRules.js is. Keep it free of browser- and Node-only APIs.
//
// Money is whole rupees everywhere in VIDYADAAN (Project.budget, Project.raised, NGO payments and
// donations). Only the request to Razorpay uses paise (rupees × 100), and the server works that out.

export const DONATION_CURRENCY = "INR";
// CREATED: the Razorpay order exists and the donor hasn't paid yet (it counts for nothing).
// PAID: the server verified Razorpay's payment signature (it counts towards the project).
export const DONATION_STATUSES = ["CREATED", "PAID"];
export const DONATION_MIN = 10; // ₹10
export const DONATION_MAX = 500000; // ₹5,00,000 in one donation

// A donor sends only these. Everything else (who they are, the school, titles, amounts raised)
// comes from the database.
const FIELDS = ["projectId", "amount", "currency"];

const rupees = (n) => `₹${n.toLocaleString("en-IN")}`;
const isBlank = (v) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Keys in `data` a donor may not send (mass-assignment protection). */
export const getUnexpectedDonationFields = (data) =>
  data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).filter((key) => !FIELDS.includes(key)) : [];

/**
 * An amount in whole rupees: a number, or the digits a form sends ("500").
 * @returns {{ value?: number, error?: string }}
 */
export const validateDonationAmount = (value) => {
  if (isBlank(value)) return { error: "Enter an amount to donate." };
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isInteger(n)) return { error: "Enter the amount in whole rupees, for example 500." };
  if (n < DONATION_MIN) return { error: `The smallest donation is ${rupees(DONATION_MIN)}.` };
  if (n > DONATION_MAX) return { error: `The largest single donation is ${rupees(DONATION_MAX)}.` };
  return { value: n };
};

/**
 * Validate a new donation: which project, how much and, if sent, the currency (only INR).
 * @returns {{ errors: Record<string,string>, values: { projectId?: string, amount?: number, currency: string } }}
 */
export const validateDonation = (data) => {
  const input = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const errors = {};
  const values = { currency: DONATION_CURRENCY };

  if (typeof input.projectId !== "string" || !input.projectId.trim()) errors.projectId = "Choose a school need to donate to.";
  else values.projectId = input.projectId.trim();

  const amount = validateDonationAmount(input.amount);
  if (amount.error) errors.amount = amount.error;
  else values.amount = amount.value;

  if (input.currency !== undefined && input.currency !== DONATION_CURRENCY) errors.currency = "Donations are in Indian rupees (INR).";

  return { errors, values };
};
