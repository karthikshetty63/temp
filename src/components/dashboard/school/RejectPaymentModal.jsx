import { useState } from "react";
import { PAYMENT_REJECTION_REASON_MAX, rejectPayment, validateRejectionReason } from "../../../api/payments";
import { formatINR } from "../../../utils/format";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import FormField, { Textarea } from "../../ui/FormField";
import Modal from "../../ui/Modal";

/** Reject an NGO's payment with a reason the NGO will see (it can then pay and record it again). */
const RejectPaymentModal = ({ payment, onClose, onRejected }) => {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { error: invalid } = validateRejectionReason(reason);
    setFieldError(invalid || "");
    setError("");
    if (invalid) return;
    setSaving(true);
    try {
      onRejected(await rejectPayment(payment.id, reason));
      onClose();
    } catch (saveError) {
      if (saveError.errors?.reason) setFieldError(saveError.errors.reason);
      else setError(saveError.message || "Could not reject the payment. Please try again.");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="sm"
      onClose={saving ? () => {} : onClose}
      title="Reject this payment?"
      description={`${formatINR(payment.amount)} from ${payment.ngo.name} · Ref. ${payment.reference}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="reject-payment-form" variant="destructive" loading={saving}>{saving ? "Rejecting…" : "Reject payment"}</Button>
        </>
      }
    >
      <form id="reject-payment-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField label="Reason" required error={fieldError} hint="The NGO sees this, so it can check and send the payment again.">
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={PAYMENT_REJECTION_REASON_MAX}
              placeholder="e.g. No credit of ₹48,000 in our account on this date."
            />
          )}
        </FormField>
      </form>
    </Modal>
  );
};

export default RejectPaymentModal;
