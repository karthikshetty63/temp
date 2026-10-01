import { LuCircleCheck, LuClock, LuHandCoins, LuReceipt, LuWallet } from "react-icons/lu";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Card, { CardHeader } from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import PageHeader from "../../ui/PageHeader";
import StatCard from "../../ui/StatCard";
import { NGO_PAYMENT_STATUS } from "../../../utils/payments";
import { formatDate, formatINR, fundingStatus, myParts, partsLabel, partsOf, sumAmounts } from "./format";

const th = "whitespace-nowrap px-5 py-2.5 text-xs font-medium text-slate-500";

/**
 * What the NGO has committed and paid: totals, each need it funds (record a payment, withdraw
 * unpaid parts) and every payment it has recorded with what the school decided.
 */
const FundingView = ({ projects, payments, loading, error, notice, onRecordPayment, onWithdraw, onViewProof }) => {
  const rows = projects.map((p) => {
    const mine = myParts(p);
    const unpaid = mine.filter((x) => x.status === "AWAITING_PAYMENT");
    // Payments are newest first, so this is the latest one for the need.
    const last = payments.find((pay) => pay.project.id === p.id);
    return {
      project: p,
      mine,
      unpaid,
      amount: sumAmounts(mine),
      status: fundingStatus(mine),
      rejection: unpaid.length && last?.status === "REJECTED" ? last.rejectionReason : null,
    };
  });
  const all = rows.flatMap((r) => r.mine);
  const sumOf = (status) => sumAmounts(all.filter((x) => x.status === status));
  const figures = [
    { label: "Committed", value: sumAmounts(all), icon: LuHandCoins },
    { label: "Received by schools", value: sumOf("RECEIVED"), icon: LuCircleCheck },
    { label: "Waiting for school", value: sumOf("PAYMENT_SUBMITTED"), icon: LuClock },
    { label: "Still to pay", value: sumOf("AWAITING_PAYMENT"), icon: LuWallet },
  ];

  const actions = (r, { phone = false } = {}) =>
    r.unpaid.length > 0 && (
      <div className={`flex items-center gap-1 ${phone ? "mt-3" : "justify-end"}`}>
        <Button size="sm" onClick={() => onRecordPayment(r.project)} aria-label={`Record payment: ${r.project.title}`}>Record payment</Button>
        <Button variant="ghost" size="sm" onClick={() => onWithdraw(r.project)} aria-label={`Withdraw commitment: ${r.project.title}`}>Withdraw</Button>
      </div>
    );
  const rejectionNote = (r) => r.rejection && <p className="mt-1 text-xs font-medium text-red-700">Payment rejected: {r.rejection}</p>;

  return (
    <>
      <PageHeader
        title="Funding"
        description="Pay the school directly, then record the payment here with its proof. The school accepts it once the money reaches its account."
      />
      {notice}

      {loading && <Card><p className="px-5 py-4 text-sm text-slate-500" role="status">Loading your funding…</p></Card>}
      {!loading && error && rows.length === 0 && <Card><p className="px-5 py-4 text-sm text-slate-500">{error}</p></Card>}
      {!loading && !error && rows.length === 0 && (
        <Card>
          <EmptyState
            icon={LuWallet}
            title="No funding yet"
            description="When you fund part or all of a school need, it's tracked here from payment to the school's confirmation."
          />
        </Card>
      )}
      {rows.length > 0 && (
        <>
          <section aria-label="Funding totals">
            {/* Phones: the totals two by two in one compact card. */}
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-xs sm:hidden">
              {figures.map((f) => (
                <div key={f.label} className="flex flex-col justify-between bg-white px-4 py-3">
                  <dt className="text-xs text-slate-500">{f.label}</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{formatINR(f.value)}</dd>
                </div>
              ))}
            </dl>
            <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
              {figures.map((f) => <StatCard key={f.label} label={f.label} value={formatINR(f.value)} icon={f.icon} />)}
            </div>
          </section>

          <Card>
            <CardHeader title="Commitments" description="One row for each school need you fund." />
            {/* Phones: one card per commitment instead of a squeezed table. */}
            <ul className="divide-y divide-slate-200 md:hidden">
              {rows.map((r) => (
                <li key={r.project.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{r.project.title}</p>
                      <p className="text-xs text-slate-500">{r.project.school.name}</p>
                    </div>
                    <Badge tone={r.status.tone}>{r.status.label}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium tabular-nums text-slate-900">{formatINR(r.amount)}</span> · {partsOf(r.mine.map((x) => x.part), r.project.parts.length)}
                  </p>
                  {rejectionNote(r)}
                  {actions(r, { phone: true })}
                </li>
              ))}
            </ul>
            {/* relative: keeps the sr-only header inside the scroller, so it can't widen the page */}
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    {["School need", "Your parts", "Amount", "Status"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
                    <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.project.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{r.project.title}</p>
                        <p className="text-xs text-slate-500">{r.project.school.name}</p>
                        {rejectionNote(r)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">{partsOf(r.mine.map((x) => x.part), r.project.parts.length)}</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-900">{formatINR(r.amount)}</td>
                      <td className="px-5 py-3"><Badge tone={r.status.tone}>{r.status.label}</Badge></td>
                      <td className="whitespace-nowrap px-5 py-3">{actions(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment history" description="Payments you've recorded, and what the school decided." />
            {payments.length === 0 ? (
              <EmptyState
                icon={LuReceipt}
                title="No payments recorded yet"
                description="After you pay a school, choose “Record payment” above and add the challan, receipt or transaction screenshot."
                className="py-8"
              />
            ) : (
              <>
                <ul className="divide-y divide-slate-200 md:hidden">
                  {payments.map((pay) => {
                    const status = NGO_PAYMENT_STATUS[pay.status];
                    return (
                      <li key={pay.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{pay.project.title}</p>
                            <p className="text-xs text-slate-500">{pay.school.name} · paid {formatDate(pay.paidOn)}</p>
                          </div>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          <span className="font-medium tabular-nums text-slate-900">{formatINR(pay.amount)}</span> · {partsLabel(pay.parts)} · {pay.method}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">Ref. {pay.reference}</p>
                        {pay.status === "REJECTED" && <p className="mt-1 text-xs font-medium text-red-700">{pay.rejectionReason}</p>}
                        <Button variant="secondary" size="sm" className="mt-3" onClick={() => onViewProof(pay)} aria-label={`View proof: ${pay.reference}`}>View proof</Button>
                      </li>
                    );
                  })}
                </ul>
                <div className="relative hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left">
                        {["Paid on", "School need", "Parts", "Amount", "Method & reference", "Status"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
                        <th scope="col" className="px-5 py-2.5"><span className="sr-only">Proof</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((pay) => {
                        const status = NGO_PAYMENT_STATUS[pay.status];
                        return (
                          <tr key={pay.id}>
                            <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(pay.paidOn)}</td>
                            <td className="px-5 py-3">
                              <p className="font-medium text-slate-900">{pay.project.title}</p>
                              <p className="text-xs text-slate-500">{pay.school.name}</p>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-slate-600">{partsLabel(pay.parts)}</td>
                            <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-900">{formatINR(pay.amount)}</td>
                            <td className="px-5 py-3">
                              <p className="text-slate-700">{pay.method}</p>
                              <p className="text-xs text-slate-500">Ref. {pay.reference}</p>
                            </td>
                            <td className="px-5 py-3">
                              <Badge tone={status.tone}>{status.label}</Badge>
                              {pay.status === "ACCEPTED" && pay.reviewedAt && <p className="mt-1 text-xs text-slate-500">on {formatDate(pay.reviewedAt)}</p>}
                              {pay.status === "REJECTED" && <p className="mt-1 max-w-xs text-xs text-red-700">{pay.rejectionReason}</p>}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-right">
                              <Button variant="ghost" size="sm" onClick={() => onViewProof(pay)} aria-label={`View proof: ${pay.reference}`}>View proof</Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </>
  );
};

export default FundingView;
