import { useRef, useState } from "react";
import { LuQrCode, LuTrash2, LuUpload } from "react-icons/lu";
import { UPI_QR_IMAGE_TYPES, getUpiQrImageError, parseUpiQr } from "../../../../shared/upiQrRules.js";
import { removePaymentQr, savePaymentQr } from "../../../api/profile";
import { readQrCode } from "../../../utils/readQrCode";
import Alert from "../../ui/Alert";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Card, { CardHeader } from "../../ui/Card";
import ConfirmModal from "../../ui/ConfirmModal";
import UpiQrCode from "../../ui/UpiQrCode";

const STATUS = {
  ACTIVE: { tone: "success", label: "Active", text: "NGOs paying your school can scan it." },
  PENDING: { tone: "warning", label: "Waiting for approval", text: null },
  REJECTED: { tone: "danger", label: "Not approved", text: null },
};

const formatDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const Detail = ({ label, children }) => (
  <div>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{children}</dd>
  </div>
);

/**
 * The school's UPI payment QR (PhonePe, Google Pay, Paytm, BHIM). The image is read in the browser and
 * only accepted if it holds a real UPI payment link (shared/upiQrRules.js); only that link is sent.
 * `verifiedUpiId` is the UPI ID checked at registration: a QR with it is active at once, any other
 * UPI ID waits for the VIDYADAAN team. NGOs see the QR when they pay; donors never do.
 */
const PaymentQrCard = ({ paymentQr, verifiedUpiId, loading, onChange }) => {
  const inputRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | reading | saving
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState(false);
  const busy = phase !== "idle";

  const choose = () => inputRef.current?.click();

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // choosing the same file again should read it again
    if (!file) return;
    setError("");
    setNotice("");
    const fileError = getUpiQrImageError(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    setPhase("reading");
    let text;
    try {
      text = await readQrCode(file);
    } catch {
      text = null;
    }
    if (!text) {
      setPhase("idle");
      setError("No QR code was found in this image. Use a clear, straight screenshot of the QR.");
      return;
    }
    const { error: qrError, value } = parseUpiQr(text);
    if (qrError) {
      setPhase("idle");
      setError(qrError);
      return;
    }

    setPhase("saving");
    try {
      const data = await savePaymentQr(value.link);
      onChange(data.paymentQr);
      setNotice(data.message);
    } catch (saveError) {
      setError(saveError.errors?.link || saveError.message || "Couldn't save the QR. Please try again.");
    } finally {
      setPhase("idle");
    }
  };

  const remove = async () => {
    await removePaymentQr();
    onChange(null);
    setNotice("QR removed. NGOs will see only your bank details and UPI ID.");
  };

  const status = paymentQr ? STATUS[paymentQr.status] : null;
  const uploadLabel = phase === "reading" ? "Reading the QR…" : phase === "saving" ? "Saving…" : paymentQr ? "Replace QR" : "Upload QR";

  return (
    <Card as="section" aria-labelledby="payment-qr-heading">
      <CardHeader
        title={<span id="payment-qr-heading">UPI payment QR</span>}
        description="NGOs that fund your projects can scan it with PhonePe, Google Pay, Paytm or BHIM to pay your school directly. Donors never see it."
        actions={
          paymentQr && (
            <>
              <Button variant="secondary" size="sm" icon={LuUpload} onClick={choose} loading={busy} disabled={busy}>{uploadLabel}</Button>
              <Button variant="ghost" size="sm" icon={LuTrash2} onClick={() => setRemoving(true)} disabled={busy}>Remove</Button>
            </>
          )
        }
      />
      <input ref={inputRef} type="file" accept={UPI_QR_IMAGE_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleFile} />

      <div className="space-y-4 p-5">
        {notice && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="danger" title="This QR can't be used">{error}</Alert>}

        {loading && <p className="text-sm text-slate-500" role="status">Loading…</p>}

        {!loading && !paymentQr && (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 ring-1 ring-inset ring-surface-line">
              <LuQrCode className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">No QR added yet</p>
              <p className="mt-0.5 text-sm text-slate-600">
                Upload a screenshot or photo of your school&rsquo;s UPI QR. Only real UPI payment QRs are accepted, and the image stays on
                your device: only the payment link inside it is saved.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {verifiedUpiId
                  ? <>A QR for your verified UPI ID <span className="font-medium text-slate-700">{verifiedUpiId}</span> is active at once. Any other UPI ID is checked by the VIDYADAAN team first.</>
                  : "No UPI ID was verified at registration, so the VIDYADAAN team checks your QR before NGOs see it."}
              </p>
            </div>
            <Button icon={LuUpload} onClick={choose} loading={busy} disabled={busy} className="shrink-0">{uploadLabel}</Button>
          </div>
        )}

        {!loading && paymentQr && (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <UpiQrCode link={paymentQr.link} label={`UPI QR for ${paymentQr.payeeName || paymentQr.upiId}`} size={160} />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <Badge tone={status.tone}>{status.label}</Badge>
                {status.text && <p className="mt-1.5 text-sm text-slate-600">{status.text}</p>}
                {paymentQr.status === "PENDING" && (
                  <p className="mt-1.5 text-sm text-slate-600">
                    Its UPI ID isn&rsquo;t the one verified at registration{verifiedUpiId ? ` (${verifiedUpiId})` : ""}, so the VIDYADAAN team checks it first.
                    Until then NGOs see your bank details and UPI ID.
                  </p>
                )}
              </div>
              {paymentQr.status === "REJECTED" && (
                <Alert tone="danger" title="The VIDYADAAN team didn't approve this QR">
                  {paymentQr.rejectionReason} Upload another QR to try again.
                </Alert>
              )}
              <dl className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
                <Detail label="UPI ID">{paymentQr.upiId}</Detail>
                <Detail label="Name in the QR">{paymentQr.payeeName || "—"}</Detail>
                <Detail label="Added on">{formatDate(paymentQr.submittedAt)}</Detail>
              </dl>
            </div>
          </div>
        )}
      </div>

      {removing && (
        <ConfirmModal title="Remove your UPI QR?" confirmLabel="Remove QR" busyLabel="Removing…" onConfirm={remove} onClose={() => setRemoving(false)}>
          <p>NGOs will no longer see it. They will still see your bank details and UPI ID when they pay.</p>
        </ConfirmModal>
      )}
    </Card>
  );
};

export default PaymentQrCard;
