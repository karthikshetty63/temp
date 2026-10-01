import { apiRequest } from "./auth";

// Rules shared with the server (the server re-checks everything).
export { DONATION_CURRENCY, DONATION_MAX, DONATION_MIN, validateDonationAmount } from "../../shared/donationRules.js";

/**
 * Start a donation: the server checks the need and the amount, then creates its Razorpay order.
 * Only these two values are sent; the donor, school and amounts come from the server's records.
 * Resolves with { donation, checkout } (checkout: what Razorpay Checkout needs, including the public key ID).
 */
export const createDonation = (projectId, amount) => apiRequest("/api/donations", { method: "POST", body: { projectId, amount } });

/**
 * Ask the server to verify a payment. Only the three values Razorpay Checkout returned are sent; the server
 * checks the signature with its secret key. Safe to call again with the same values.
 */
export const verifyDonation = (donationId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) =>
  apiRequest(`/api/donations/${encodeURIComponent(donationId)}/verify`, {
    method: "POST",
    body: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
  });
