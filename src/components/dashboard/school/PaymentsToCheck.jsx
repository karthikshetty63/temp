import { useState } from "react";
import { LuMail, LuPhone } from "react-icons/lu";
import { acceptPayment } from "../../../api/payments";
import { formatDate, formatINR, formatPhone, partsLabel } from "../../../utils/format";
import Button from "../../ui/Button";
import ConfirmModal from "../../ui/ConfirmModal";
import ProofModal from "../ProofModal";
import RejectPaymentModal from "./RejectPaymentModal";

/**
 * Payments NGOs have recorded and the school hasn't decided on yet: the details, the proof, and
 * Accept (only once the money is in the school's account) or Reject with a reason.
 * `onReviewed` gets the server's reply ({ message, payment, project }).
 */
const PaymentsToCheck = ({ payments, showProject = true, onReviewed }) => {
  const [viewing, setViewing] = useState(null);
  const [accepting, setAccepting] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  return (
    <>
      <ul className="divide-y divide-slate-200">
        {payments.map((pay) => (
          <li key={pay.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                <span className="tabular-nums">{formatINR(pay.amount)}</span> <span className="font-normal text-slate-500">from</span> {pay.ngo.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                {showProject && <>{pay.project.title} · </>}
                {partsLabel(pay.parts).toLowerCase()} · {pay.method} · paid {formatDate(pay.paidOn)}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Ref. <span className="font-medium tabular-nums text-slate-900">{pay.reference}</span>
              </p>
              {pay.note && <p className="mt-1 text-xs italic text-slate-600">&ldquo;{pay.note}&rdquo;</p>}
              <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {pay.ngo.email && (
                  <a href={`mailto:${pay.ngo.email}`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                    <LuMail className="h-3.5 w-3.5" aria-hidden="true" /> {pay.ngo.email}
                  </a>
                )}
                {pay.ngo.phone && (
                  <a href={`tel:${pay.ngo.phone}`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                    <LuPhone className="h-3.5 w-3.5" aria-hidden="true" /> {formatPhone(pay.ngo.phone)}
                  </a>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setViewing(pay)} aria-label={`View proof: ${pay.reference}`}>View proof</Button>
              <Button variant="ghost" size="sm" onClick={() => setRejecting(pay)} aria-label={`Reject payment: ${pay.reference}`}>Reject</Button>
              <Button size="sm" onClick={() => setAccepting(pay)} aria-label={`Accept payment: ${pay.reference}`}>Accept</Button>
            </div>
          </li>
        ))}
      </ul>

      {viewing && (
        <ProofModal
          proof={viewing.proof}
          description={`${formatINR(viewing.amount)} from ${viewing.ngo.name} · Ref. ${viewing.reference}`}
          onClose={() => setViewing(null)}
        />
      )}
      {accepting && (
        <ConfirmModal
          title="Accept this payment?"
          variant="primary"
          confirmLabel="Accept payment"
          busyLabel="Accepting…"
          onConfirm={async () => onReviewed(await acceptPayment(accepting.id))}
          onClose={() => setAccepting(null)}
        >
          <p>
            Accept only after you&rsquo;ve checked that <span className="font-semibold">{formatINR(accepting.amount)}</span> (ref.{" "}
            {accepting.reference}) from {accepting.ngo.name} has reached your school&rsquo;s bank account. It will be added to &ldquo;Raised so
            far&rdquo; and can&rsquo;t be undone.
          </p>
        </ConfirmModal>
      )}
      {rejecting && <RejectPaymentModal payment={rejecting} onClose={() => setRejecting(null)} onRejected={onReviewed} />}
    </>
  );
};

export default PaymentsToCheck;
