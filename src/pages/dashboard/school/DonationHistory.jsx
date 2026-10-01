import { useState } from "react";
import { Link } from "react-router-dom";
import { LuReceipt } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import ProofModal from "../../../components/dashboard/ProofModal";
import PaymentsToCheck from "../../../components/dashboard/school/PaymentsToCheck";
import Alert from "../../../components/ui/Alert";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Card, { CardHeader } from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import PageHeader from "../../../components/ui/PageHeader";
import ProgressBar from "../../../components/ui/ProgressBar";
import { useAuth } from "../../../context/AuthContext";
import useMyProjects from "../../../hooks/useMyProjects";
import useSchoolPayments from "../../../hooks/useSchoolPayments";
import { formatDate, formatINR, partsLabel } from "../../../utils/format";
import { getFundingPercentage } from "../../../utils/funding";
import { SCHOOL_PAYMENT_STATUS } from "../../../utils/payments";

const th = "whitespace-nowrap px-5 py-2.5 text-xs font-medium text-slate-500";

const DonationHistory = () => {
  const { user } = useAuth();
  const { projects, loading, error, reload, upsert } = useMyProjects();
  const paymentList = useSchoolPayments();
  const [viewing, setViewing] = useState(null);
  const [notice, setNotice] = useState("");
  // Only approved projects can receive money.
  const approved = projects.filter((p) => p.reviewStatus === "OPEN");
  const toCheck = paymentList.payments.filter((p) => p.status === "SUBMITTED");
  const decided = paymentList.payments.filter((p) => p.status !== "SUBMITTED");

  const handleReviewed = async (data) => {
    if (data.project) upsert(data.project);
    await paymentList.refresh();
    setNotice(data.message);
  };

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="Donation history" subtitle="Money received for your projects">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader
            title="Donation history"
            description="Money NGOs have sent for your projects. Check each payment against your bank account before you accept it."
          />

          {(error || paymentList.error) && (
            <Alert tone="danger">
              {error || paymentList.error}{" "}
              <button type="button" onClick={() => { reload(); paymentList.reload(); }} className="font-medium underline underline-offset-2">Try again</button>
            </Alert>
          )}
          {notice && <Alert tone="success">{notice}</Alert>}

          {toCheck.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader title={`Payments to check (${toCheck.length})`} description="Accept a payment only once the money has reached your school's account." />
              <PaymentsToCheck payments={toCheck} onReviewed={handleReviewed} />
            </Card>
          )}

          <Card>
            <CardHeader title="Payment history" description="Payments you've accepted or rejected." />
            {paymentList.loading && <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading payments…</p>}
            {!paymentList.loading && !paymentList.error && decided.length === 0 && (
              <EmptyState
                icon={LuReceipt}
                title={toCheck.length ? "No payments decided yet" : "No payments yet"}
                description="When an NGO pays for one of your approved projects and records it with proof, you check it here."
                className="py-8"
              />
            )}
            {decided.length > 0 && (
              <>
                <ul className="divide-y divide-slate-200 md:hidden">
                  {decided.map((pay) => {
                    const status = SCHOOL_PAYMENT_STATUS[pay.status];
                    return (
                      <li key={pay.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{formatINR(pay.amount)} from {pay.ngo.name}</p>
                            <p className="text-xs text-slate-500">{pay.project.title} · paid {formatDate(pay.paidOn)}</p>
                          </div>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{pay.method} · Ref. {pay.reference}</p>
                        {pay.status === "REJECTED" && <p className="mt-1 text-xs text-red-700">{pay.rejectionReason}</p>}
                        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setViewing(pay)} aria-label={`View proof: ${pay.reference}`}>View proof</Button>
                      </li>
                    );
                  })}
                </ul>
                <div className="relative hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left">
                        {["Paid on", "From", "Project", "Amount", "Method & reference", "Status"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
                        <th scope="col" className="px-5 py-2.5"><span className="sr-only">Proof</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {decided.map((pay) => {
                        const status = SCHOOL_PAYMENT_STATUS[pay.status];
                        return (
                          <tr key={pay.id}>
                            <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(pay.paidOn)}</td>
                            <td className="px-5 py-3 font-medium text-slate-900">{pay.ngo.name}</td>
                            <td className="px-5 py-3">
                              <p className="text-slate-900">{pay.project.title}</p>
                              <p className="text-xs text-slate-500">{partsLabel(pay.parts)}</p>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-900">{formatINR(pay.amount)}</td>
                            <td className="px-5 py-3">
                              <p className="text-slate-700">{pay.method}</p>
                              <p className="text-xs text-slate-500">Ref. {pay.reference}</p>
                            </td>
                            <td className="px-5 py-3">
                              <Badge tone={status.tone}>{status.label}</Badge>
                              {pay.reviewedAt && <p className="mt-1 text-xs text-slate-500">on {formatDate(pay.reviewedAt)}</p>}
                              {pay.status === "REJECTED" && <p className="mt-1 max-w-xs text-xs text-red-700">{pay.rejectionReason}</p>}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-right">
                              <Button variant="ghost" size="sm" onClick={() => setViewing(pay)} aria-label={`View proof: ${pay.reference}`}>View proof</Button>
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

          <Card>
            <CardHeader title="Funding by project" description="Money received (accepted payments) against each approved project's budget." />
            {loading ? (
              <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading your projects…</p>
            ) : approved.length === 0 ? (
              !error && (
                <p className="px-5 py-4 text-sm text-slate-600">
                  None of your projects has been approved yet.{" "}
                  <Link to="/dashboard/school/projects" className="font-medium text-blue-700 hover:underline">See your projects</Link>
                </p>
              )
            ) : (
              <ul className="divide-y divide-slate-200">
                {approved.map((p) => {
                  const funded = getFundingPercentage(p.budget, p.raised);
                  return (
                    <li key={p.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <Link to={`/dashboard/school/progress?project=${p.id}`} className="text-sm font-medium text-slate-900 hover:underline">{p.title}</Link>
                        <span className="text-xs text-slate-600 tabular-nums">{formatINR(p.raised)} of {formatINR(p.budget)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <ProgressBar value={funded} label={`${p.title} funding`} />
                        <span className="text-xs font-medium text-slate-900 tabular-nums shrink-0">{funded}%</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </main>

      {viewing && (
        <ProofModal
          proof={viewing.proof}
          description={`${formatINR(viewing.amount)} from ${viewing.ngo.name} · Ref. ${viewing.reference}`}
          onClose={() => setViewing(null)}
        />
      )}
    </DashboardLayout>
  );
};

export default DonationHistory;
