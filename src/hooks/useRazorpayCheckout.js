import { useRef, useState } from "react";
import { loadRazorpayCheckout } from "../utils/razorpayCheckout";

export const PAYMENT_UNAVAILABLE = "Payment service is currently unavailable. Please try again.";
// Phases in which a request or Razorpay's window is open: the window can't be closed and the form is locked.
const BUSY = ["creating", "checkout", "verifying"];

/**
 * Razorpay Checkout for one payment window (donor donations and NGO online payments). The server creates
 * the order and verifies what Razorpay returns; the browser never decides that a payment succeeded.
 *
 *   phase       idle → creating → checkout → verifying → confirmed | pending | refundDue
 *               (back to idle, with a notice, when Razorpay's window is closed without paying)
 *   pay(key, create)
 *               `create()` asks the server for an order and resolves with { id, checkout }. `key` says what the
 *               order is for (an amount, a set of parts): paying again for the same key after closing Razorpay
 *               reuses that order. Resolves with create()'s error, for the caller to show, or null.
 *   checkAgain()
 *               verifies again with the same values (the server counts a payment once, however often it's asked).
 *
 * Options: verify(id, values) — the server call; isConfirmed(data) — whether its answer means paid;
 * notConfirmed — what to tell the payer after a cancel or decline; prefill — Razorpay's prefill.
 */
const useRazorpayCheckout = ({ verify, isConfirmed = () => true, notConfirmed = "No payment was confirmed.", prefill, onConfirmed }) => {
  const [phase, setPhase] = useState("idle");
  const [notice, setNotice] = useState(null); // { tone, title, text } after Razorpay's window is closed
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // the server's answer, or { message } when it couldn't confirm
  const [payment, setPayment] = useState(null); // what Razorpay returned, kept to check again: { id, values }
  const orderRef = useRef(null); // the last order created: { key, id, checkout }
  // Blocks a second click before React has re-rendered the disabled button (one order per click).
  const startingRef = useRef(false);

  const release = () => {
    startingRef.current = false;
    setPhase("idle");
  };

  // Razorpay calls this after a payment. Only the server can say whether it counts.
  const confirm = async (id, response) => {
    const values = {
      razorpay_order_id: response?.razorpay_order_id,
      razorpay_payment_id: response?.razorpay_payment_id,
      razorpay_signature: response?.razorpay_signature,
    };
    setPayment({ id, values });
    setPhase("verifying");
    try {
      const data = await verify(id, values);
      if (!isConfirmed(data)) throw new Error("The payment hasn't been confirmed yet.");
      setResult(data);
      orderRef.current = null;
      setPhase("confirmed");
      onConfirmed?.(data);
    } catch (verifyError) {
      // Razorpay has already taken the payment, so this is never shown as a failure: the payer may have paid.
      setResult({ message: verifyError.message });
      if (verifyError.code === "REFUND_DUE") {
        orderRef.current = null;
        setPhase("refundDue");
      } else {
        setPhase("pending");
      }
    }
  };

  const open = (Razorpay, current) => {
    let lastFailure = "";
    try {
      const checkoutWindow = new Razorpay({
        key: current.checkout.keyId,
        order_id: current.checkout.orderId,
        amount: current.checkout.amount,
        currency: current.checkout.currency,
        name: current.checkout.name,
        description: current.checkout.description,
        prefill,
        theme: { color: "#4f46e5" },
        handler: (response) => confirm(current.id, response),
        modal: {
          // Razorpay's window was closed without completing a payment.
          ondismiss: () => {
            release();
            setNotice(
              lastFailure
                ? { tone: "danger", title: "Payment could not be completed.", text: `${lastFailure}. ${notConfirmed} You can try again.` }
                : { tone: "neutral", title: "Payment was cancelled.", text: `${notConfirmed} You can try again whenever you're ready.` }
            );
          },
        },
      });
      // A declined attempt: Razorpay keeps its window open so the payer can try another way to pay.
      checkoutWindow.on("payment.failed", (response) => {
        lastFailure = (response?.error?.description || "The payment was declined").replace(/\.$/, "");
      });
      setPhase("checkout");
      checkoutWindow.open();
    } catch {
      release();
      setError(PAYMENT_UNAVAILABLE);
    }
  };

  const pay = async (key, create) => {
    if (startingRef.current) return null;
    startingRef.current = true;
    setNotice(null);
    setError("");
    setPhase("creating");

    // Razorpay's script first: if it can't load, no order is created.
    let Razorpay;
    try {
      Razorpay = await loadRazorpayCheckout();
    } catch {
      release();
      setError(PAYMENT_UNAVAILABLE);
      return null;
    }

    let current = orderRef.current?.key === key ? orderRef.current : null;
    if (!current) {
      try {
        const order = await create();
        current = { key, id: order.id, checkout: order.checkout };
        orderRef.current = current;
      } catch (createError) {
        release();
        return createError;
      }
    }
    open(Razorpay, current);
    return null;
  };

  const clearMessages = () => {
    setNotice(null);
    setError("");
  };

  return {
    phase,
    busy: BUSY.includes(phase),
    notice,
    error,
    setError,
    clearMessages,
    result,
    paymentId: payment?.values.razorpay_payment_id || null,
    pay,
    checkAgain: () => confirm(payment.id, payment.values),
  };
};

export default useRazorpayCheckout;
