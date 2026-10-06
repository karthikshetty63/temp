import { useEffect, useRef, useState } from "react";
import { LuCircleCheck, LuLoaderCircle, LuLock, LuMapPin } from "react-icons/lu";
import { DONATION_MAX, DONATION_MIN, createDonation, validateDonationAmount, verifyDonation } from "../../api/donations";
import { useAuth } from "../../context/AuthContext";
import useRazorpayCheckout from "../../hooks/useRazorpayCheckout";
import { formatINR } from "../../utils/format";
import { schoolPlace } from "../dashboard/ngo/format";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import Modal from "../ui/Modal";
import { inputClasses } from "../ui/classes";

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];
const DEFAULT_AMOUNT = "1000";
// The need changed on the server (fully funded, promised by NGOs, or no longer listed): reload the list.
const NEED_CHANGED = [404, 409];
// Phases that show the amount form, and phases that show an outcome instead.
const FORM_PHASES = ["idle", "creating", "checkout"];
const OUTCOME_PHASES = ["verifying", "confirmed", "pending"];

const formatWhen = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const Row = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
    <dt className="text-slate-500">{label}</dt>
    <dd className="min-w-0 text-right font-medium text-slate-900 break-words">{children}</dd>
  </div>
);

/** The need being supported: title, school and place, all from the donor-safe view of GET /api/projects. */
const NeedSummary = ({ need, place }) => (
  <>
    <p className="text-base font-bold leading-snug tracking-tight text-slate-900">{need.title}</p>
    <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
      <LuMapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span>{need.school.name}{place && `, ${place}`}</span>
    </p>
  </>
);

/**
 * Donate to an approved school need through Razorpay (test mode). `need` is the donor view from
 * GET /api/projects. Only { projectId, amount } goes to the server, which creates the Razorpay order;
 * Razorpay's own Checkout takes the payment (VIDYADAAN never sees card, UPI or bank details); and the
 * donation is shown as confirmed only after the server has verified Razorpay's payment signature
 * (useRazorpayCheckout). `onConfirmed` then reloads the needs from the server; `onNeedChanged` does so
 * when the server says the need can no longer take donations.
 */
const PaymentFlowModal = ({ need, onClose, onConfirmed, onNeedChanged }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [amountError, setAmountError] = useState("");
  const rzp = useRazorpayCheckout({
    verify: verifyDonation,
    isConfirmed: (data) => data.donation?.status === "PAID",
    notConfirmed: "No donation was confirmed.",
    prefill: { name: user?.name || "", email: user?.email || "" },
    onConfirmed,
  });
  const { phase, busy, notice, error, result, paymentId } = rzp;
  const statusRef = useRef(null);
  const amountRef = useRef(null);

  // Each outcome moves focus to its heading, so it is read out; closing Razorpay returns to the amount.
  useEffect(() => {
    if (OUTCOME_PHASES.includes(phase)) statusRef.current?.focus();
    else if (phase === "idle" && notice) amountRef.current?.focus();
  }, [phase, notice]);

  if (!need) return null;

  const place = schoolPlace(need.school);
  const typed = validateDonationAmount(amount).value;

  const changeAmount = (value) => {
    // People often type 1,000; only digits are kept, and the shared rules decide what is valid.
    setAmount(value.replace(/[s,]/g, ""));
    setAmountError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const { value, error: invalid } = validateDonationAmount(amount);
    if (invalid) {
      rzp.clearMessages();
      setAmountError(invalid);
      return;
    }
    setAmountError("");
    // Paying again after closing Razorpay, with the same amount, reuses the order already created.
    const createError = await rzp.pay(value, async () => {
      const data = await createDonation(need.id, value);
      return { id: data.donation.id, checkout: data.checkout };
    });
    if (!createError) return;
    if (createError.errors?.amount) setAmountError(createError.errors.amount);
    else rzp.setError(createError.message || "Couldn't start the payment. Please try again.");
    // e.g. "This need is already fully funded or promised by NGOs.": show the server's latest figures.
    if (NEED_CHANGED.includes(createError.status)) onNeedChanged?.();
  };

  const confirmed = phase === "confirmed" ? result.donation : null;

  const footers = {
    confirmed: <Button onClick={onClose}>Done</Button>,
    pending: (
      <>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {/* The same values again: the server records a payment once, however often it is checked. */}
        <Button onClick={rzp.checkAgain}>Check again</Button>
      </>
    ),
    verifying: null,
  };
  const donateLabel = typed ? `Donate ${formatINR(typed)}` : "Donate";
  const formFooter = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      <Button type="submit" form="donation-form" variant="brand" loading={busy} disabled={busy}>
        {phase === "creating" ? "Preparing secure payment…" : phase === "checkout" ? "Waiting for payment…" : notice && typed ? `Try again · ${formatINR(typed)}` : donateLabel}
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
          <LuLoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary-600 motion-reduce:animate-none" aria-hidden="true" />
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
            <h3 ref={statusRef} tabIndex={-1} className="mt-3 text-lg font-bold text-slate-900 focus:outline-none">Donation confirmed</h3>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-semibold tabular-nums text-slate-900">{formatINR(confirmed.amount)}</span> donated to
            </p>
          </div>
          <div className="mt-3 rounded-xl border border-surface-line bg-surface px-4 py-3 text-center">
            <p className="font-semibold text-slate-900">{confirmed.project.title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{need.school.name}{place && `, ${place}`}</p>
          </div>
          <dl className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 text-sm">
            <Row label="Payment ID"><span className="font-mono text-xs">{confirmed.paymentId}</span></Row>
            <Row label="Status"><Badge tone="success">{confirmed.status}</Badge></Row>
            {confirmed.verifiedAt && <Row label="Confirmed">{formatWhen(confirmed.verifiedAt)}</Row>}
          </dl>
          {confirmed.mode === "test" && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
              Razorpay test mode: no real money was charged.
            </p>
          )}
        </div>
      )}

      {phase === "pending" && (
        <div ref={statusRef} tabIndex={-1} className="space-y-3 focus:outline-none">
          <Alert tone="warning" title="Payment received but confirmation is still pending.">
            <p>
              We could not confirm the payment with our server yet. Please don&rsquo;t make another payment until the status is checked:
              use <span className="font-medium">Check again</span> in a moment. If it still can&rsquo;t be confirmed, contact VIDYADAAN support
              with your payment ID.
            </p>
            {paymentId && <p className="mt-2">Payment ID: <span className="font-mono">{paymentId}</span></p>}
          </Alert>
          {result?.message && <p className="text-xs text-slate-500">Server response: {result.message}</p>}
        </div>
      )}

      {FORM_PHASES.includes(phase) && (
        <form id="donation-form" onSubmit={handleSubmit} noValidate>
          <fieldset disabled={busy} className="space-y-5">
            <section aria-label="What you're supporting" className="rounded-xl border border-surface-line bg-surface px-4 py-3.5">
              <NeedSummary need={need} place={place} />
            </section>

            <FormField label="Donation amount" error={amountError} hint={`Whole rupees, from ${formatINR(DONATION_MIN)} up to ${formatINR(DONATION_MAX)}.`}>
              {({ invalid, ...field }) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-lg font-semibold text-slate-500" aria-hidden="true">₹</span>
                  <input
                    {...field}
                    ref={amountRef}
                    data-autofocus
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={9}
                    placeholder="0"
                    value={amount}
                    onChange={(e) => changeAmount(e.target.value)}
                    onBlur={() => amount !== "" && setAmountError(validateDonationAmount(amount).error || "")}
                    aria-invalid={invalid || undefined}
                    className={inputClasses({ invalid, className: "h-12 pl-9 pr-3 text-lg font-semibold tabular-nums" })}
                  />
                </div>
              )}
            </FormField>

            <div role="group" aria-label="Quick amounts" className="grid grid-cols-2 gap-2">
              {QUICK_AMOUNTS.map((value) => {
                const selected = typed === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => changeAmount(String(value))}
                    className={`h-11 rounded-control border text-sm font-semibold tabular-nums transition-colors duration-150 ${
                      selected
                        ? "border-primary-600 bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-600"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    {formatINR(value)}
                  </button>
                );
              })}
            </div>

            {notice && <Alert tone={notice.tone} title={notice.title}>{notice.text}</Alert>}
            {error && <Alert tone="danger">{error}</Alert>}
            {phase === "checkout" && (
              <p className="text-sm text-slate-600" role="status">Complete the payment in the Razorpay window.</p>
            )}

            <p className="flex items-start gap-2 text-xs text-slate-500">
              <LuLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span>
                You pay securely on Razorpay by UPI, card, net banking or other methods. VIDYADAAN never sees your card, UPI or bank details.{" "}
                <a href="/refund-policy" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">Refund policy</a>
              </span>
            </p>
          </fieldset>
        </form>
      )}
    </Modal>
  );
};

export default PaymentFlowModal;
