import { useEffect, useState } from "react";
import { LuCircleCheck, LuCircleX, LuClock } from "react-icons/lu";
import { UPI_QR_REJECTION_REASON_MAX, UPI_QR_REJECTION_REASON_MIN } from "../../../shared/upiQrRules.js";
import { approvePaymentQr, listPaymentQrs, rejectPaymentQr } from "../../api/admin";
import Alert from "../ui/Alert";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import FormField, { Textarea } from "../ui/FormField";
import Modal from "../ui/Modal";
import SegmentedControl from "../ui/SegmentedControl";
import StatCard from "../ui/StatCard";
import UpiQrCode from "../ui/UpiQrCode";

const STATUSES = ["PENDING", "ACTIVE", "REJECTED"];
const LABELS = { PENDING: "Waiting for review", ACTIVE: "Active", REJECTED: "Rejected" };
const TONES = { PENDING: "warning", ACTIVE: "success", REJECTED: "danger" };
const EMPTY_TITLES = { PENDING: "No QRs waiting for review", ACTIVE: "No active QRs yet", REJECTED: "No rejected QRs" };

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const place = (school) => [school?.district, school?.state].filter(Boolean).join(", ");

/* ─── Review panel ─────────────────────────────────────── */
const PaymentQrReviewModal = ({ item, onClose, onDecision }) => {
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const { school, paymentQr: qr } = item;
  const waiting = qr.status === "PENDING";

  const decide = async (action) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      // The link reviewed here goes back with the decision: if the school has replaced its QR since, nothing changes.
      const res = action === "approve" ? await approvePaymentQr(school.id, qr.link) : await rejectPaymentQr(school.id, qr.link, reason);
      onDecision(res.message);
    } catch (err) {
      setActionError(err.message);
      setBusy(false);
    }
  };

  const footer = waiting && (
    <>
      {showReject ? (
        <Button variant="destructive" onClick={() => decide("reject")} disabled={reason.trim().length < UPI_QR_REJECTION_REASON_MIN} loading={busy}>
          {busy ? "Rejecting…" : "Confirm rejection"}
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setShowReject(true)} disabled={busy}>Reject…</Button>
      )}
      <Button onClick={() => decide("approve")} loading={busy && !showReject} disabled={busy || school.accountStatus !== "active"}>Approve QR</Button>
    </>
  );

  return (
    <Modal open onClose={busy ? () => {} : onClose} size="lg" title={school.name} description="UPI payment QR review" footer={footer}>
      <div className="space-y-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <UpiQrCode link={qr.link} label={`UPI QR submitted by ${school.name}`} size={168} />
          <dl className="min-w-0 flex-1 divide-y divide-slate-200 rounded-control border border-slate-200 text-sm">
            {[
              ["UPI ID in the QR", qr.upiId],
              ["Name in the QR", qr.payeeName || "—"],
              ["UPI ID verified at registration", item.verifiedUpiId || "None given"],
              ["School", `${school.name}${school.udise ? ` · UDISE ${school.udise}` : ""}`],
              ["Location", place(school) || "—"],
              ["Contact", school.email || "—"],
              ["Submitted", formatDate(qr.submittedAt)],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-5 sm:gap-4">
                <dt className="text-slate-500 sm:col-span-2">{label}</dt>
                <dd className="break-words font-medium text-slate-900 sm:col-span-3">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {waiting && (
          <Alert tone="warning" title={item.verifiedUpiId ? "This UPI ID is not the one verified at registration" : "No UPI ID was verified at registration"}>
            NGOs will send money to it. Approve only if you have confirmed it belongs to {school.name}, for example by checking with the school
            that it is linked to the school&rsquo;s own bank account.
          </Alert>
        )}
        {waiting && school.accountStatus !== "active" && (
          <Alert tone="warning">This school&apos;s account is not active, so its QR can&apos;t be approved.</Alert>
        )}
        {qr.status === "REJECTED" && qr.rejectionReason && <Alert tone="danger" title="Rejection reason">{qr.rejectionReason}</Alert>}

        {showReject && (
          <FormField
            id="qr-reject-reason"
            label="Reason for rejection"
            required
            hint={`Shown to the school so it can upload the right QR. At least ${UPI_QR_REJECTION_REASON_MIN} characters.`}
          >
            {(f) => (
              <Textarea
                {...f}
                data-autofocus
                maxLength={UPI_QR_REJECTION_REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. This UPI ID is not in the school's name. Upload the QR of the school's own bank account."
              />
            )}
          </FormField>
        )}

        {actionError && <Alert tone="danger">{actionError}</Alert>}
      </div>
    </Modal>
  );
};

/* ─── Section ──────────────────────────────────────────── */
/**
 * Admin review of schools' UPI QRs whose UPI ID differs from the one verified at registration
 * (a QR with the verified UPI ID is active without review). NGOs see a QR only once it is active.
 */
const PaymentQrReviewSection = () => {
  const [status, setStatus] = useState("PENDING");
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState({ key: null, qrs: [], counts: { PENDING: 0, ACTIVE: 0, REJECTED: 0 }, error: "" });
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState("");

  const requestKey = `${status}|${reloadCount}`;
  useEffect(() => {
    let cancelled = false;
    listPaymentQrs(status)
      .then((res) => !cancelled && setResult({ key: requestKey, qrs: res.qrs, counts: res.counts, error: "" }))
      .catch((err) => !cancelled && setResult((prev) => ({ ...prev, key: requestKey, error: err.message })));
    return () => {
      cancelled = true;
    };
  }, [status, requestKey]);

  const loading = result.key !== requestKey;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Waiting for review" value={result.counts.PENDING} icon={LuClock} />
        <StatCard label="Active" value={result.counts.ACTIVE} icon={LuCircleCheck} />
        <StatCard label="Rejected" value={result.counts.REJECTED} icon={LuCircleX} />
      </div>

      <SegmentedControl
        label="Filter QRs by status"
        value={status}
        onChange={(v) => {
          setNotice("");
          setStatus(v);
        }}
        options={STATUSES.map((s) => ({ value: s, label: LABELS[s] }))}
      />

      {notice && <Alert tone="success">{notice}</Alert>}
      {result.error && <Alert tone="danger">{result.error}</Alert>}

      <Card className="overflow-hidden">
        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500" role="status">Loading QRs…</p>
        ) : !result.error && result.qrs.length === 0 ? (
          <EmptyState title={EMPTY_TITLES[status]} description="Nothing needs your attention here right now." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  {["School", "UPI ID in the QR", "Verified UPI ID", "Submitted", "Status"].map((h) => (
                    <th key={h} scope="col" className="px-5 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.qrs.map((item) => (
                  <tr key={item.school.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{item.school.name}</p>
                      <p className="text-xs text-slate-500">{place(item.school) || "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900 break-words">{item.paymentQr.upiId}</p>
                      {item.paymentQr.payeeName && <p className="text-xs text-slate-500">{item.paymentQr.payeeName}</p>}
                    </td>
                    <td className="px-5 py-3 text-slate-600 break-words">{item.verifiedUpiId || "None given"}</td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDate(item.paymentQr.submittedAt)}</td>
                    <td className="px-5 py-3"><Badge tone={TONES[item.paymentQr.status]}>{LABELS[item.paymentQr.status]}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(item)} aria-label={`Review the QR of ${item.school.name}`}>Review</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <PaymentQrReviewModal
          item={selected}
          onClose={() => setSelected(null)}
          onDecision={(message) => {
            setSelected(null);
            setNotice(message);
            setReloadCount((n) => n + 1);
          }}
        />
      )}
    </>
  );
};

export default PaymentQrReviewSection;
