import { Link } from "react-router-dom";
import { LuBell } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import Alert from "../../../components/ui/Alert";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import PageHeader from "../../../components/ui/PageHeader";
import { useAuth } from "../../../context/AuthContext";
import useMyProjects from "../../../hooks/useMyProjects";

// Only real events are shown: the review team's decisions on the school's projects.
const DECISIONS = {
  OPEN: { title: "Project approved", dot: "bg-emerald-500" },
  REJECTED: { title: "Changes requested", dot: "bg-red-500" },
};

const formatWhen = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const Notifications = () => {
  const { user } = useAuth();
  const { projects, loading, error, reload } = useMyProjects();

  const decisions = projects
    .filter((p) => DECISIONS[p.reviewStatus] && p.reviewedAt)
    .sort((a, b) => (a.reviewedAt < b.reviewedAt ? 1 : -1));

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="Notifications" subtitle="Updates about your projects">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader title="Notifications" description="When the VIDYADAAN team approves one of your projects or asks for changes, it shows here." />

          {error && (
            <Alert tone="danger">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">Try again</button>
            </Alert>
          )}

          <Card className="overflow-hidden">
            {loading ? (
              <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading…</p>
            ) : decisions.length === 0 ? (
              !error && (
                <EmptyState
                  icon={LuBell}
                  title="No notifications yet"
                  description="Nothing has happened on your projects yet. Review decisions will appear here."
                />
              )
            ) : (
              <ul className="divide-y divide-slate-200">
                {decisions.map((p) => {
                  const decision = DECISIONS[p.reviewStatus];
                  return (
                    <li key={p.id}>
                      <Link to={`/dashboard/school/progress?project=${p.id}`} className="flex gap-3 px-5 py-4 hover:bg-surface-muted transition-colors">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${decision.dot}`} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                            <p className="text-sm font-medium text-slate-900">{decision.title}</p>
                            <time dateTime={p.reviewedAt} className="text-xs text-slate-500">{formatWhen(p.reviewedAt)}</time>
                          </div>
                          <p className="mt-0.5 text-sm text-slate-600">{p.title}</p>
                          {p.reviewStatus === "REJECTED" && p.rejectionReason && (
                            <p className="mt-1 text-sm text-red-700">{p.rejectionReason}</p>
                          )}
                        </div>
                      </Link>
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

export default Notifications;
