import { useEffect, useRef, useState } from "react";
import { LuCircleCheck, LuLoaderCircle, LuLock, LuMapPin } from "react-icons/lu";
import { DONATION_MAX, DONATION_MIN, createDonation, validateDonationAmount, verifyDonation } from "../../api/donations";
import { useAuth } from "../../context/AuthContext";
import { formatINR } from "../../utils/format";
import { loadRazorpayCheckout } from "../../utils/razorpayCheckout";
import { schoolPlace } from "../dashboard/ngo/format";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import Modal from "../ui/Modal";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClasses } from "../ui/classes";

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];
const UNAVAILABLE = "Payment service is currently unavailable. Please try again.";
// The server answered and refused the payment details, so the donation is definitely not confirmed.
// Any other failure (no answer, a server problem, an expired session) means the payment may still have gone through.
const REFUSED = [400, 404, 409];
// Phases in which a request or Razorpay's window is open: the modal can't be closed and the form is locked.
const BUSY = ["creating", "checkout", "verifying"];
// Phases that show the amount form, and phases that show an outcome instead.
const FORM_PHASES = ["form", "creating", "checkout"];
const OUTCOME_PHASES = ["verifying", "confirmed", "refused", "unconfirmed"];

const formatWhen = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const Row = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
    <dt className="text-slate-500">{label}</dt>
    <dd className="min-w-0 text-right font-medium text-slate-900 break-all">{children}</dd>
  </div>
);

/**
 * Donate to an approved school need through Razorpay (test mode). `need` is the donor view from
 * GET /api/projects. The donation is shown as confirmed only after the server has verified Razorpay's
 * payment signature; `onConfirmed` then lets the page reload the need's funding from the server.
 */
const PaymentFlowModal = ({ need, onClose, onConfirmed }) => {
  const { user } = useAuth();
  // form → creating → checkout → verifying → confirmed | refused | unconfirmed (back to form if Razorpay is closed)
  const [phase, setPhase] = useState("form");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null); // { tone, text } after Razorpay's window is closed
  const [order, setOrder] = useState(null); // the last order created: { amount, donation, checkout }
  const [payment, setPayment] = useState(null); // what Razorpay returned, kept to check again: { donationId, values }
  const [result, setResult] = useState(null); // the server's answer: { message, donation? }
  const statusRef = useRef(null);
  const amountRef = useRef(null);

  // Each outcome moves focus to its heading, so it is read out; closing Razorpay returns to the amount.
  useEffect(() => {
    if (OUTCOME_PHASES.includes(phase)) statusRef.current?.focus();
    else if (phase === "form" && notice) amountRef.current?.focus();
  }, [phase, notice]);

  if (!need) return null;

  const busy = BUSY.includes(phase);
  const place = schoolPlace(need.school);
  const typed = validateDonationAmount(amount).value;

  const changeAmount = (value) => {
    setAmount(value);
    setAmountError("");
  };

  // Razorpay calls this after a successful payment. Only the server can say whether it counts.
  const confirmPayment = async (donationId, response) => {
    const values = {
      razorpay_order_id: response?.razorpay_order_id,
      razorpay_payment_id: response?.razorpay_payment_id,
      razorpay_signature: response?.razorpay_signature,
    };
    setPayment({ donationId, values });
    setPhase("verifying");
    try {
      const data = await verifyDonation(donationId, values);
      if (data.donation?.status !== "PAID") throw new Error("The payment hasn't been confirmed yet.");
      setResult(data);
      setOrder(null);
      setPhase("confirmed");
      onConfirmed?.(data);
    } catch (verifyError) {
      setResult({ message: verifyError.message });
      setPhase(REFUSED.includes(verifyError.status) ? "refused" : "unconfirmed");
    }
  };

  const openCheckout = (Razorpay, current) => {
    const { checkout, donation } = current;
    let lastFailure = "";
    try {
      const checkoutWindow = new Razorpay({
        key: checkout.keyId,
        order_id: checkout.orderId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: checkout.name,
        description: checkout.description,
        prefill: { name: user?.name || "", email: user?.email || "" },
        theme: { color: "#4f46e5" },
        handler: (response) => confirmPayment(donation.id, response),
        modal: {
          // The donor closed Razorpay's window without completing a payment.
          ondismiss: () => {
            setPhase("form");
            setNotice(
              lastFailure
                ? { tone: "warning", text: `The last payment attempt didn't go through (${lastFailure}). You can try again.` }
                : { tone: "neutral", text: "Payment cancelled. You can try again whenever you're ready." }
            );
          },
        },
      });
      // A declined attempt: Razorpay keeps its window open so the donor can try another way to pay.
      checkoutWindow.on("payment.failed", (response) => {
        lastFailure = response?.error?.description || "the payment was declined";
      });
      setPhase("checkout");
      checkoutWindow.open();
    } catch {
      setPhase("form");
      setError(UNAVAILABLE);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const { value, error: invalid } = validateDonationAmount(amount);
    setNotice(null);
    setError("");
    if (invalid) {
      setAmountError(invalid);
      return;
    }
    setAmountError("");
    setPhase("creating");

    // Razorpay's script first: if it can't load, no order is created.
    let Razorpay;
    try {
      Razorpay = await loadRazorpayCheckout();
    } catch {
      setPhase("form");
      setError(UNAVAILABLE);
      return;
    }

    // Paying again after closing Razorpay, with the same amount, reuses the order already created.
    let current = order?.amount === value ? order : null;
    if (!current) {
      try {
        const data = await createDonation(need.id, value);
        current = { amount: value, donation: data.donation, checkout: data.checkout };
        setOrder(current);
      } catch (createError) {
        setPhase("form");
        if (createError.errors?.amount) setAmountError(createError.errors.amount);
        else setError(createError.message || "Couldn't start the payment. Please try again.");
        return;
      }
    }
    openCheckout(Razorpay, current);
  };

  const confirmed = phase === "confirmed" ? result.donation : null;
  const paymentId = payment?.values.razorpay_payment_id;

  const footers = {
    confirmed: <Button onClick={onClose}>Done</Button>,
    refused: <Button variant="secondary" onClick={onClose}>Close</Button>,
    unconfirmed: (
      <>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {/* The same values again: the server records a payment once, however often it is checked. */}
        <Button onClick={() => confirmPayment(payment.donationId, payment.values)}>Check again</Button>
      </>
    ),
    verifying: null,
  };
  const formFooter = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button
        type="submit"
        form="donation-form"
        loading={phase === "creating"}
        disabled={busy}
        className="bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
      >
        {phase === "creating" ? "Preparing secure payment…" : phase === "checkout" ? "Waiting for payment…" : typed ? `Donate ${formatINR(typed)}` : "Donate"}
      </Button>
    </>
  );

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Make a donation"
      footer={FORM_PHASES.includes(phase) ? formFooter : footers[phase]}
    >
      {phase === "verifying" && (
        <div className="py-8 text-center" role="status">
          <LuLoaderCircle className="mx-auto h-8 w-8 animate-spin text-indigo-600 motion-reduce:animate-none" aria-hidden="true" />
          <h3 ref={statusRef} tabIndex={-1} className="mt-4 text-base font-semibold text-slate-900 focus:outline-none">Confirming your donation…</h3>
          <p className="mt-1 text-sm text-slate-500">Checking the payment with Razorpay. Please keep this window open.</p>
        </div>
      )}

      {confirmed && (
        <div className="animate-view-enter motion-reduce:animate-none">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
              <LuCircleCheck className="h-6 w-6 text-emerald-600" aria-hidden="true" />
            </span>
            <h3 ref={statusRef} tabIndex={-1} className="mt-3 text-lg font-semibold text-slate-900 focus:outline-none">Donation confirmed</h3>
            <p className="mt-1 text-sm text-slate-600">Thank you. It now counts towards this need&rsquo;s funding.</p>
          </div>
          <dl className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 text-sm">
            <Row label="Amount"><span className="tabular-nums">{formatINR(confirmed.amount)}</span></Row>
            <Row label="School need">{confirmed.project.title}</Row>
            <Row label="Payment ID"><span className="font-mono text-xs">{confirmed.paymentId}</span></Row>
            {confirmed.verifiedAt && <Row label="Confirmed">{formatWhen(confirmed.verifiedAt)}</Row>}
          </dl>
          {confirmed.mode === "test" && (
            <p className="mt-3 text-xs text-slate-500">Razorpay test mode: no real money was charged.</p>
          )}
        </div>
      )}

      {phase === "refused" && (
        <div ref={statusRef} tabIndex={-1} className="focus:outline-none">
          <Alert tone="danger" title="Payment could not be confirmed.">
            <p>{result.message}</p>
            {paymentId && <p className="mt-2">Payment ID: <span className="font-mono">{paymentId}</span></p>}
          </Alert>
        </div>
      )}

      {phase === "unconfirmed" && (
        <div ref={statusRef} tabIndex={-1} className="space-y-3 focus:outline-none">
          <Alert tone="warning" title="Payment received by the payment gateway. We could not confirm it yet.">
            <p>
              Please check your donation status before trying again: use <span className="font-medium">Check again</span> in a moment, and
              don&rsquo;t pay a second time. If it still can&rsquo;t be confirmed, contact VIDYADAAN support with your payment ID.
            </p>
            {paymentId && <p className="mt-2">Payment ID: <span className="font-mono">{paymentId}</span></p>}
          </Alert>
          {result?.message && <p className="text-xs text-slate-500">Reason: {result.message}</p>}
        </div>
      )}

      {FORM_PHASES.includes(phase) && (
        <form id="donation-form" onSubmit={handleSubmit} noValidate>
          <fieldset disabled={busy} className="space-y-5">
            <section aria-label="What you're supporting" className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3.5">
              <p className="text-xs font-medium text-indigo-700">You&rsquo;re supporting</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{need.title}</p>
              <p className="mt-0.5 flex items-start gap-1.5 text-xs text-slate-600">
                <LuMapPin className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span>{need.school.name}{place && ` · ${place}`}</span>
              </p>
              <p className="mt-2 text-xs text-slate-600 tabular-nums">
                <span className="font-medium text-slate-900">{formatINR(need.raised)}</span> raised of {formatINR(need.budget)}
              </p>
            </section>

            <FormField label="Amount" error={amountError} hint={`Minimum ${formatINR(DONATION_MIN)}, up to ${formatINR(DONATION_MAX)} in one donation.`}>
              {({ invalid, ...field }) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base font-medium text-slate-500" aria-hidden="true">₹</span>
                  <input
                    {...field}
                    ref={amountRef}
                    data-autofocus
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => changeAmount(e.target.value)}
                    aria-invalid={invalid || undefined}
                    className={inputClasses({ invalid, className: "h-12 pl-8 pr-3 text-lg font-semibold tabular-nums" })}
                  />
                </div>
              )}
            </FormField>

            <SegmentedControl
              label="Quick amounts"
              value={amount}
              onChange={changeAmount}
              options={QUICK_AMOUNTS.map((a) => ({ value: String(a), label: formatINR(a) }))}
            />

            {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
            {error && <Alert tone="danger">{error}</Alert>}
            {phase === "checkout" && (
              <p className="text-sm text-slate-600" role="status">Complete the payment in the Razorpay window.</p>
            )}

            <p className="flex items-start gap-2 text-xs text-slate-500">
              <LuLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span>Payment is handled securely by Razorpay. VIDYADAAN never sees your card, UPI or bank details.</span>
            </p>
          </fieldset>
        </form>
      )}
    </Modal>
  );
};

export default PaymentFlowModal;
