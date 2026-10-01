import Badge, { StatusBadge } from "../../ui/Badge";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import FundingPartsBar from "../FundingPartsBar";
import { NGO_PART_LABELS, formatDate, formatINR, freeParts, myParts, myShare, ngoSegments, schoolPlace, sumAmounts, unpaidParts } from "./format";

const Detail = ({ label, children }) => (
  <div>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
  </div>
);

/**
 * Everything an NGO can see about one approved need. `onFund` opens the funding window;
 * `onRecordPayment` the window for recording a payment for the NGO's unpaid parts.
 */
const NeedDetailsModal = ({ need, onClose, onFund, onRecordPayment }) => {
  const place = schoolPlace(need.school);
  const mine = myParts(need);
  const canFund = need.status !== "Completed" && freeParts(need).length > 0;
  const canPay = unpaidParts(need).length > 0;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={need.title}
      description={`${need.school.name}${place ? ` · ${place}` : ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {canPay && onRecordPayment && <Button variant="secondary" onClick={() => onRecordPayment(need)}>Record payment</Button>}
          {canFund && onFund && <Button onClick={() => onFund(need)}>Fund this need</Button>}
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{need.category}</Badge>
          <StatusBadge status={need.priority} />
          <StatusBadge status={need.status} />
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Detail label="Budget">{formatINR(need.budget)}</Detail>
          <Detail label="Committed by NGOs">{formatINR(need.committed)}</Detail>
          <Detail label="Students benefited">{need.studentsBenefited.toLocaleString("en-IN")}</Detail>
          <Detail label="Expected completion">{formatDate(need.expectedCompletion)}</Detail>
        </dl>

        <section>
          <h3 className="text-sm font-semibold text-slate-900">Funding parts</h3>
          <FundingPartsBar segments={ngoSegments(need)} labels={NGO_PART_LABELS} className="mt-2" />
          {mine.length > 0 && (
            <p className="mt-2 text-sm text-slate-600">
              You&rsquo;ve committed <span className="font-medium text-slate-900">{formatINR(sumAmounts(mine))}</span> ({myShare(need)}). The
              school has received{" "}
              {formatINR(sumAmounts(mine.filter((p) => p.receivedAt)))} of it.
            </p>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900">What&rsquo;s needed and why</h3>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">{need.problem}</p>
        </section>

        {need.materials.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-900">Required materials</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {need.materials.map((m) => <Badge key={m}>{m}</Badge>)}
            </div>
          </section>
        )}

        {need.location && <p className="text-sm text-slate-600"><span className="font-medium text-slate-900">Location:</span> {need.location}</p>}
        {need.approvedAt && <p className="text-xs text-slate-500">Approved by the VIDYADAAN team on {formatDate(need.approvedAt)}.</p>}
      </div>
    </Modal>
  );
};

export default NeedDetailsModal;
