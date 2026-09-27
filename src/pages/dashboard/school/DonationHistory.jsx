import { Link } from "react-router-dom";
import { LuWallet } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import Alert from "../../../components/ui/Alert";
import Card, { CardHeader } from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import PageHeader from "../../../components/ui/PageHeader";
import ProgressBar from "../../../components/ui/ProgressBar";
import { useAuth } from "../../../context/AuthContext";
import useMyProjects from "../../../hooks/useMyProjects";
import { getFundingPercentage } from "../../../utils/funding";

const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const DonationHistory = () => {
  const { user } = useAuth();
  const { projects, loading, error, reload } = useMyProjects();
  // Only approved projects can receive donations.
  const approved = projects.filter((p) => p.reviewStatus === "OPEN");

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="Donation history" subtitle="Money received for your projects">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader title="Donation history" description="Every donation to your school's projects, and how much each project has raised." />

          {error && (
            <Alert tone="danger">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">Try again</button>
            </Alert>
          )}

          <Card>
            <CardHeader title="Donations" />
            <EmptyState
              icon={LuWallet}
              title="No donations yet"
              description="Online payments aren't live yet. Once they are, each donation to your approved projects will be listed here."
            />
          </Card>

          <Card>
            <CardHeader title="Funding by project" description="Approved projects only. Projects waiting for review can't receive donations yet." />
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
    </DashboardLayout>
  );
};

export default DonationHistory;
