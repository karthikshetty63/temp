// Razorpay, in TEST MODE: creates payment orders and checks the signature Razorpay Checkout returns.
// No extra package (the same approach as googleAuth.js): creating an order is one HTTPS request, and
// the signature is an HMAC-SHA256 that node:crypto computes. The key secret never leaves the server;
// the website only ever receives the key ID.
import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";

const ORDERS_URL = "https://api.razorpay.com/v1/orders";
// Test keys only for now: live payments need VIDYADAAN's own merchant, legal and payout set-up first.
const TEST_KEY_ID = /^rzp_test_[A-Za-z0-9]+$/;
const ORDER_ID = /^order_[A-Za-z0-9]+$/;
const SIGNATURE = /^[a-f0-9]{64}$/;

/** Razorpay couldn't create the order: wrong keys, no connection, or an answer we didn't expect. */
export class RazorpayError extends Error {}

const keyId = () => (process.env.RAZORPAY_KEY_ID || "").trim();
const keySecret = () => (process.env.RAZORPAY_KEY_SECRET || "").trim();

/** True when a test key ID and its secret are set. A live key (rzp_live_…) is refused. */
export const isRazorpayConfigured = () => TEST_KEY_ID.test(keyId()) && keySecret().length > 0;
export const isLiveKeyConfigured = () => keyId().startsWith("rzp_live_");

/** Public: Razorpay Checkout in the browser needs it. Never the secret. */
export const getRazorpayKeyId = () => keyId();

/** "test" or "live", from the key in use (always "test" while only test keys are accepted). */
export const razorpayMode = () => (isLiveKeyConfigured() ? "live" : "test");

const realFetch = (url, init) => fetch(url, init);
let send = realFetch;

/** Tests replace the HTTPS call to Razorpay: fn(url, init) must resolve to a Response. */
export const setRazorpayFetch = (fn) => {
    send = fn || realFetch;
};

/**
 * Create a Razorpay order for `amount` paise. The amount is fixed on the order, so Checkout can only
 * collect exactly that. Returns Razorpay's order ({ id: "order_…", amount, currency, status, … }).
 * Throws RazorpayError (never with the key or secret in its message).
 */
export const createRazorpayOrder = async ({ amount, currency, receipt, notes }) => {
    let response;
    try {
        response = await send(ORDERS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString("base64")}`,
            },
            body: JSON.stringify({ amount, currency, receipt, notes }),
            signal: AbortSignal.timeout(10_000),
        });
    } catch (error) {
        throw new RazorpayError(`Razorpay could not be reached (${error.name})`);
    }
    const order = await response.json().catch(() => null);
    if (!response.ok) throw new RazorpayError(`Razorpay refused the order (HTTP ${response.status})`);
    if (!order || typeof order.id !== "string" || !ORDER_ID.test(order.id) || order.amount !== amount || order.currency !== currency || order.status !== "created") {
        throw new RazorpayError("Razorpay sent an order that doesn't match the request");
    }
    return order;
};

/**
 * True only for the signature Razorpay Checkout returns after a successful payment: an HMAC-SHA256
 * of "<order id>|<payment id>" made with our key secret. Without the secret it can't be forged.
 */
export const isValidPaymentSignature = ({ orderId, paymentId, signature }) => {
    if (typeof signature !== "string" || !SIGNATURE.test(signature)) return false;
    const expected = createHmac("sha256", keySecret()).update(`${orderId}|${paymentId}`).digest();
    // Constant-time comparison, so the check takes as long however much of a guess is right.
    return timingSafeEqual(expected, Buffer.from(signature, "hex"));
};

const PAYMENT_ID = /^pay_[A-Za-z0-9]+$/;

/**
 * The three values Razorpay Checkout hands the browser after a payment, from a request body — or null
 * when any is missing or has the wrong shape. (Shape only: isValidPaymentSignature does the real check.)
 * @returns {{ orderId: string, paymentId: string, signature: string } | null}
 */
export const readCheckoutResult = (body) => {
    const input = body && typeof body === "object" ? body : {};
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = input;
    const complete =
        typeof orderId === "string" && ORDER_ID.test(orderId) &&
        typeof paymentId === "string" && PAYMENT_ID.test(paymentId) &&
        typeof signature === "string" && SIGNATURE.test(signature);
    return complete ? { orderId, paymentId, signature } : null;
};
