import { useEffect, useRef, useState } from "react";
import { LuCheck, LuCircleCheck, LuCopy, LuLoaderCircle, LuLock } from "react-icons/lu";
import {
  PAYMENT_METHODS, PAYMENT_NOTE_MAX, PAYMENT_PROOF_RULE, getPaymentDetails, getUploadError, startOnlinePayment, submitPayment, validatePaymentDetails,
  verifyOnlinePayment,
} from "../../../api/payments";
import { useAuth } from "../../../context/AuthContext";
import useRazorpayCheckout from "../../../hooks/useRazorpayCheckout";
import Alert from "../../ui/Alert";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import FormField, { Input, Select, Textarea } from "../../ui/FormField";
import Modal from "../../ui/Modal";
import SegmentedControl from "../../ui/SegmentedControl";
import UpiQrCode from "../../ui/UpiQrCode";
import { formatINR, myParts, schoolPlace, sumAmounts } from "./format";

const todayISO = () => new Date().toISOString().slice(0, 10);
const formatWhen = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const partsText = (parts) => (parts.length === 1 ? `part ${parts[0]}` : `parts ${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`);

const MODES = [
  { value: "online", label: "Pay online" },
  { value: "direct", label: "Paid the school directly" },
];
// Online phases that show the parts form; the others show an outcome instead.
const ONLINE_FORM_PHASES = ["idle", "creating", "checkout"];

/** One line of the school's payment details, with a copy button. */
const PayeeRow = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the value is still on screen to copy by hand.
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="text-sm font-medium tabular-nums text-slate-900 break-all">{value}</dd>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50"
      >
        {copied ? <LuCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <LuCopy className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
};

/** The NGO's unpaid parts, as checkboxes. Both ways of paying use it. */
const PartsPicker = ({ legend, unpaid, selected, onToggle, error, summary }) => (
  <fieldset>
    <legend className="text-sm font-semibold text-slate-900">{legend}</legend>
    {error && <p className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    <div className="mt-2 flex flex-wrap gap-2">
      {unpaid.map((p) => (
        <label key={p.part} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
          <input type="checkbox" checked={selected.includes(p.part)} onChange={() => onToggle(p.part)} className="h-4 w-4 rounded border-slate-300 text-primary-600" />
          Part {p.part} · <span className="tabular-nums">{formatINR(p.amount)}</span>
        </label>
      ))}
    </div>
    <p className="mt-3 text-sm text-slate-700" role="status">{summary}</p>
  </fieldset>
);

const Row = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
    <dt className="text-slate-500">{label}</dt>
    <dd className="min-w-0 text-right font-medium text-slate-900 break-words">{children}</dd>
  </div>
);

/**
 * Pay for the NGO's unpaid parts of a need, in one of two ways the NGO switches between:
 *   online  through Razorpay. Only the parts go to the server, which prices them and creates the order; the
 *           parts count as paid only once the server has verified Razorpay's signature (useRazorpayCheckout).
 *   direct  the NGO has paid the school itself (we show the school's bank account and UPI, only to an NGO that
 *           has committed) and records it with proof for the school to accept.
 * `lastRejection` is the school's reason if it rejected the previous direct payment. `onSubmitted` gets the
 * server's answer after a recorded or confirmed payment; `onChanged` reloads the lists after any other outcome.
 */
const RecordPaymentModal = ({ need, lastRejection, onClose, onSubmitted, onChanged }) => {
  const { user } = useAuth();
  const unpaid = myParts(need).filter((p) => p.status === "AWAITING_PAYMENT");
  const [mode, setMode] = useState("online");
  const [payee, setPayee] = useState({ loading: true, data: null, error: "" });
  const [form, setForm] = useState({ parts: unpaid.map((p) => p.part), method: "", reference: "", paidOn: todayISO(), note: "" });
  const [proof, setProof] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const rzp = useRazorpayCheckout({
    verify: verifyOnlinePayment,
    isConfirmed: (data) => data.payment?.status === "ACCEPTED",
    notConfirmed: "No payment was recorded.",
    prefill: { name: user?.name || "", email: user?.email || "" },
  });
  const statusRef = useRef(null);

  useEffect(() => {
    let active = true;
    getPaymentDetails(need.id).then(
      (data) => active && setPayee({ loading: false, data: data.payee, error: "" }),
      (loadError) => active && setPayee({ loading: false, data: null, error: loadError.message || "Could not load the school's payment details." })
    );
    return () => {
      active = false;
    };
  }, [need.id]);

  // An online outcome moves focus to its heading, so it is read out.
  useEffect(() => {
    if (!ONLINE_FORM_PHASES.includes(rzp.phase)) statusRef.current?.focus();
  }, [rzp.phase]);

  const chosen = unpaid.filter((p) => form.parts.includes(p.part));
  const amount = sumAmounts(chosen);
  const earliest = chosen.length ? chosen.map((p) => p.committedAt.slice(0, 10)).sort()[0] : undefined;
  // Editing a field clears its error; the rest stay until the next attempt.
  const clearError = (field) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    clearError(field);
  };
  const togglePart = (part) => {
    setForm((f) => ({ ...f, parts: f.parts.includes(part) ? f.parts.filter((x) => x !== part) : [...f.parts, part].sort((a, b) => a - b) }));
    clearError("parts");
  };
  const chooseProof = (e) => {
    setProof(e.target.files?.[0] || null);
    clearError("proof");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { errors: clientErrors } = validatePaymentDetails(form);
    const fileError = proof ? getUploadError(PAYMENT_PROOF_RULE, { type: proof.type, size: proof.size }) : "Upload the challan, receipt or a screenshot of the transaction.";
    if (fileError) clientErrors.proof = fileError;
    if (!clientErrors.paidOn && earliest && form.paidOn < earliest) clientErrors.paidOn = "The payment date can't be before you committed.";
    setErrors(clientErrors);
    setError("");
    if (Object.values(clientErrors).some(Boolean)) return;

    setSaving(true);
    try {
      const data = await submitPayment(need.id, { ...form, proof });
      onSubmitted(data);
    } catch (saveError) {
      if (saveError.errors) setErrors(saveError.errors);
      else setError(saveError.message || "Could not record the payment. Please try again.");
      setSaving(false);
    }
  };

  const payOnline = async (event) => {
    event.preventDefault();
    if (rzp.busy) return;
    if (!chosen.length) {
      rzp.clearMessages();
      setErrors({ parts: "Choose at least one part." });
      return;
    }
    setErrors({});
    const parts = chosen.map((p) => p.part);
    // Paying again after closing Razorpay, for the same parts, reuses the order already created.
    const createError = await rzp.pay(parts.join(","), async () => {
      const data = await startOnlinePayment(need.id, parts);
      return { id: data.payment.id, checkout: data.checkout };
    });
    if (!createError) return;
    if (createError.errors?.parts) setErrors({ parts: createError.errors.parts });
    else rzp.setError(createError.message || "Couldn't start the payment. Please try again.");
  };

  const place = schoolPlace(need.school);
  const online = mode === "online";
  const onlineForm = ONLINE_FORM_PHASES.includes(rzp.phase);
  const confirmed = rzp.phase === "confirmed" ? rzp.result.payment : null;
  const busy = saving || rzp.busy;
  // After a confirmed payment, closing the window in any way updates the dashboard.
  const close = () => {
    if (busy) return;
    if (confirmed) onSubmitted(rzp.result);
    else {
      if (["pending", "refundDue"].includes(rzp.phase)) onChanged?.();
      onClose();
    }
  };

  const directFooter = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
      <Button type="submit" form="payment-form" loading={saving} disabled={!unpaid.length}>{saving ? "Sending…" : "Send payment proof"}</Button>
    </>
  );
  const onlineLabel = rzp.phase === "creating" ? "Preparing secure payment…" : rzp.phase === "checkout" ? "Waiting for payment…" : rzp.notice && amount ? `Try again · ${formatINR(amount)}` : amount ? `Pay ${formatINR(amount)} online` : "Pay online";
  const onlineFooters = {
    form: (
      <>
        <Button variant="secondary" onClick={onClose} disabled={rzp.busy}>Cancel</Button>
        <Button type="submit" form="online-payment-form" variant="brand" loading={rzp.busy} disabled={rzp.busy || !unpaid.length}>{onlineLabel}</Button>
      </>
    ),
    confirmed: <Button onClick={close}>Done</Button>,
    pending: (
      <>
        <Button variant="secondary" onClick={close}>Close</Button>
        {/* The same values again: the server records a payment once, however often it is checked. */}
        <Button onClick={rzp.checkAgain}>Check again</Button>
      </>
    ),
    refundDue: <Button variant="secondary" onClick={close}>Close</Button>,
    verifying: null,
  };

  return (
    <Modal
      open
      size="lg"
      onClose={close}
      title="Make a payment"
      description={`${need.title} · ${need.school.name}${place ? `, ${place}` : ""}`}
      footer={online ? onlineFooters[onlineForm ? "form" : rzp.phase] : directFooter}
    >
      <div className="space-y-6">
        {(!online || onlineForm) && (
          <fieldset disabled={busy}>
            <SegmentedControl label="How are you paying?" value={mode} onChange={setMode} options={MODES} className="w-full [&>button]:flex-1" />
          </fieldset>
        )}

        {/* ─── Online, through Razorpay ─── */}
        {online && rzp.phase === "verifying" && (
          <div className="py-8 text-center" role="status">
            <LuLoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary-600 motion-reduce:animate-none" aria-hidden="true" />
            <h3 ref={statusRef} tabIndex={-1} className="mt-4 text-base font-semibold text-slate-900 focus:outline-none">Confirming your payment…</h3>
            <p className="mt-1 text-sm text-slate-500">Checking the payment with Razorpay. Please keep this window open.</p>
          </div>
        )}

        {online && confirmed && (
          <div className="animate-view-enter motion-reduce:animate-none">
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
                <LuCircleCheck className="h-6 w-6 text-emerald-600" aria-hidden="true" />
              </span>
              <h3 ref={statusRef} tabIndex={-1} className="mt-3 text-lg font-bold text-slate-900 focus:outline-none">Payment confirmed</h3>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold tabular-nums text-slate-900">{formatINR(confirmed.amount)}</span> paid for {partsText(confirmed.parts)} of
              </p>
            </div>
            <div className="mt-3 rounded-xl border border-surface-line bg-surface px-4 py-3 text-center">
              <p className="font-semibold text-slate-900">{confirmed.project.title}</p>
              <p className="mt-0.5 text-sm text-slate-600">{need.school.name}{place && `, ${place}`}</p>
            </div>
            <dl className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 text-sm">
              <Row label="Payment ID"><span className="font-mono text-xs">{confirmed.reference}</span></Row>
              <Row label="Status"><Badge tone="success">PAID</Badge></Row>
              {confirmed.reviewedAt && <Row label="Confirmed">{formatWhen(confirmed.reviewedAt)}</Row>}
            </dl>
            <p className="mt-3 text-sm text-slate-600">These parts now count as paid. VIDYADAAN transfers the full amount to the school&rsquo;s verified bank account.</p>
            {confirmed.mode === "test" && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                Razorpay test mode: no real money was charged.
              </p>
            )}
          </div>
        )}

        {online && rzp.phase === "pending" && (
          <div ref={statusRef} tabIndex={-1} className="space-y-3 focus:outline-none">
            <Alert tone="warning" title="Payment received but confirmation is still pending.">
              <p>
                We could not confirm the payment with our server yet. Please don&rsquo;t make another payment until the status is checked:
                use <span className="font-medium">Check again</span> in a moment. If it still can&rsquo;t be confirmed, contact VIDYADAAN support
                with your payment ID.
              </p>
              {rzp.paymentId && <p className="mt-2">Payment ID: <span className="font-mono">{rzp.paymentId}</span></p>}
            </Alert>
            {rzp.result?.message && <p className="text-xs text-slate-500">Server response: {rzp.result.message}</p>}
          </div>
        )}

        {online && rzp.phase === "refundDue" && (
          <div ref={statusRef} tabIndex={-1} className="focus:outline-none">
            <Alert tone="warning" title="Payment received, but these parts were already paid.">
              <p>{rzp.result?.message}</p>
              {rzp.paymentId && <p className="mt-2">Payment ID: <span className="font-mono">{rzp.paymentId}</span></p>}
            </Alert>
          </div>
        )}

        {online && onlineForm && (
          <form id="online-payment-form" onSubmit={payOnline} noValidate className="space-y-5">
            <fieldset disabled={rzp.busy} className="space-y-5">
              <PartsPicker
                legend="Choose the parts to pay for"
                unpaid={unpaid}
                selected={form.parts}
                onToggle={togglePart}
                error={errors.parts}
                summary={chosen.length ? <>You&rsquo;ll pay <span className="font-semibold text-slate-900">{formatINR(amount)}</span> for {chosen.length === 1 ? "this part" : "these parts"}.</> : "Choose at least one part."}
              />
              {rzp.notice && <Alert tone={rzp.notice.tone} title={rzp.notice.title}>{rzp.notice.text}</Alert>}
              {rzp.error && <Alert tone="danger">{rzp.error}</Alert>}
              {rzp.phase === "checkout" && <p className="text-sm text-slate-600" role="status">Complete the payment in the Razorpay window.</p>}
              <div className="flex items-start gap-2.5 rounded-xl border border-surface-line bg-surface px-4 py-3 text-sm text-slate-600">
                <LuLock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <p>
                  You pay VIDYADAAN securely on Razorpay by UPI, card, net banking or other methods; VIDYADAAN never sees your card, UPI or bank
                  details. The parts count as paid as soon as Razorpay confirms the payment, with no proof needed, and VIDYADAAN transfers the full
                  amount to the school&rsquo;s verified bank account.{" "}
                  <a href="/refund-policy" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">Refund policy</a>
                </p>
              </div>
            </fieldset>
          </form>
        )}

        {/* ─── Directly to the school, recorded with proof ─── */}
        {!online && (
          <form id="payment-form" onSubmit={handleSubmit} noValidate className="space-y-6">
            {lastRejection && (
              <Alert tone="danger" title="The school rejected your last payment">{lastRejection}</Alert>
            )}
            {error && <Alert tone="danger">{error}</Alert>}

            <section aria-labelledby="payee-heading">
              <h3 id="payee-heading" className="text-sm font-semibold text-slate-900">1. Pay the school</h3>
              <p className="mt-1 text-sm text-slate-600">
                Send the money directly to the school&rsquo;s account. VIDYADAAN never handles this money.
              </p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
                {payee.loading && <p className="py-2 text-sm text-slate-500" role="status">Loading the school&rsquo;s payment details…</p>}
                {payee.error && <p className="py-2 text-sm text-red-700">{payee.error}</p>}
                {payee.data && (
                  <dl className="divide-y divide-slate-200">
                    <div className="py-2">
                      <dt className="text-xs text-slate-500">Account name</dt>
                      <dd className="text-sm font-medium text-slate-900">{payee.data.name}</dd>
                    </div>
                    {payee.data.bankAccount && <PayeeRow label="Account number" value={payee.data.bankAccount} />}
                    {payee.data.ifsc && <PayeeRow label="IFSC" value={payee.data.ifsc} />}
                    {payee.data.upi && <PayeeRow label="UPI ID" value={payee.data.upi} />}
                  </dl>
                )}
                {/* Only a QR that is the school's verified UPI ID, or one an admin approved, reaches this point. */}
                {payee.data?.qr && (
                  <div className="flex flex-col gap-3 border-t border-slate-200 py-3 sm:flex-row sm:items-center">
                    <UpiQrCode link={payee.data.qr.link} label={`UPI QR of ${payee.data.name}`} size={128} />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-slate-900">Or scan to pay by UPI</p>
                      <p className="mt-0.5 text-slate-600">
                        Scan with PhonePe, Google Pay, Paytm or BHIM. Before paying, check that your app shows{" "}
                        <span className="font-medium text-slate-900 break-words">{payee.data.qr.upiId}</span>
                        {payee.data.qr.payeeName && <> ({payee.data.qr.payeeName})</>}.
                      </p>
                      {amount > 0 && <p className="mt-1 text-xs text-slate-500">Enter the amount yourself: <span className="tabular-nums">{formatINR(amount)}</span> for the parts chosen below.</p>}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <PartsPicker
              legend="2. What this payment covers"
              unpaid={unpaid}
              selected={form.parts}
              onToggle={togglePart}
              error={errors.parts}
              summary={chosen.length ? <>Transfer exactly <span className="font-semibold text-slate-900">{formatINR(amount)}</span> for {chosen.length === 1 ? "this part" : "these parts"}.</> : "Choose at least one part."}
            />

            <section aria-labelledby="details-heading" className="space-y-5">
              <h3 id="details-heading" className="text-sm font-semibold text-slate-900">3. Payment details and proof</h3>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField label="How you paid" required error={errors.method}>
                  {(f) => (
                    <Select {...f} value={form.method} onChange={set("method")}>
                      <option value="">Choose a method</option>
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </Select>
                  )}
                </FormField>
                <FormField label="Date paid" required error={errors.paidOn}>
                  {(f) => <Input {...f} type="date" min={earliest} max={todayISO()} value={form.paidOn} onChange={set("paidOn")} />}
                </FormField>
              </div>
              <FormField label="Transaction reference" required error={errors.reference} hint="UTR number, UPI transaction ID, or cheque / DD number.">
                {(f) => <Input {...f} value={form.reference} onChange={set("reference")} maxLength={40} autoComplete="off" placeholder="e.g. SBIN026123456789" />}
              </FormField>
              <FormField label="Proof of payment" required error={errors.proof} hint={PAYMENT_PROOF_RULE.hint}>
                {(f) => (
                  <Input
                    {...f}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={chooseProof}
                    className="py-2 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-700"
                  />
                )}
              </FormField>
              <FormField label="Note for the school" error={errors.note} hint="Optional.">
                {(f) => <Textarea {...f} rows={2} value={form.note} onChange={set("note")} maxLength={PAYMENT_NOTE_MAX} placeholder="e.g. Paid from our HDFC current account" />}
              </FormField>
            </section>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default RecordPaymentModal;
