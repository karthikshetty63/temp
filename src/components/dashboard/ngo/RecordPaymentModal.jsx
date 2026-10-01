import { useEffect, useState } from "react";
import { LuCheck, LuCopy } from "react-icons/lu";
import {
  PAYMENT_METHODS, PAYMENT_NOTE_MAX, PAYMENT_PROOF_RULE, getPaymentDetails, getUploadError, submitPayment, validatePaymentDetails,
} from "../../../api/payments";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import FormField, { Input, Select, Textarea } from "../../ui/FormField";
import Modal from "../../ui/Modal";
import { formatINR, myParts, schoolPlace, sumAmounts } from "./format";

const todayISO = () => new Date().toISOString().slice(0, 10);

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
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
      >
        {copied ? <LuCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <LuCopy className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
};

/**
 * Record a payment the NGO has made to the school, with proof. Shows where to pay (the school's
 * bank account and UPI, only to an NGO that has committed), which unpaid parts it covers and the
 * exact amount. `lastRejection` is the school's reason if it rejected the previous payment.
 */
const RecordPaymentModal = ({ need, lastRejection, onClose, onSubmitted }) => {
  const unpaid = myParts(need).filter((p) => p.status === "AWAITING_PAYMENT");
  const [payee, setPayee] = useState({ loading: true, data: null, error: "" });
  const [form, setForm] = useState({ parts: unpaid.map((p) => p.part), method: "", reference: "", paidOn: todayISO(), note: "" });
  const [proof, setProof] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const place = schoolPlace(need.school);
  return (
    <Modal
      open
      size="lg"
      onClose={saving ? () => {} : onClose}
      title="Record a payment"
      description={`${need.title} · ${need.school.name}${place ? `, ${place}` : ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="payment-form" loading={saving} disabled={!unpaid.length}>{saving ? "Sending…" : "Send payment proof"}</Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        {lastRejection && (
          <Alert tone="danger" title="The school rejected your last payment">{lastRejection}</Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}

        <section aria-labelledby="payee-heading">
          <h3 id="payee-heading" className="text-sm font-semibold text-slate-900">1. Pay the school</h3>
          <p className="mt-1 text-sm text-slate-600">
            Send the money directly to the school&rsquo;s account. VIDYADAAN never handles the money.
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
          </div>
        </section>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">2. What this payment covers</legend>
          {errors.parts && <p className="mt-1 text-xs font-medium text-red-600">{errors.parts}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {unpaid.map((p) => (
              <label key={p.part} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                <input type="checkbox" checked={form.parts.includes(p.part)} onChange={() => togglePart(p.part)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                Part {p.part} · <span className="tabular-nums">{formatINR(p.amount)}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-700" role="status">
            {chosen.length ? <>Transfer exactly <span className="font-semibold text-slate-900">{formatINR(amount)}</span> for {chosen.length === 1 ? "this part" : "these parts"}.</> : "Choose at least one part."}
          </p>
        </fieldset>

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
    </Modal>
  );
};

export default RecordPaymentModal;
