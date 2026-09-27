import { LuDownload, LuFileText, LuFolderKanban } from "react-icons/lu";
import { Link } from "react-router-dom";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import ProjectStatusBadge from "../../../components/dashboard/ProjectStatusBadge";
import Alert from "../../../components/ui/Alert";
import Button from "../../../components/ui/Button";
import Card, { CardHeader } from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import PageHeader from "../../../components/ui/PageHeader";
import StatCard from "../../../components/ui/StatCard";
import { buttonClasses } from "../../../components/ui/classes";
import { projectStatusLabel } from "../../../api/projects";
import { useAuth } from "../../../context/AuthContext";
import useMyProjects from "../../../hooks/useMyProjects";
import { downloadCsv } from "../../../utils/csv";

const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const formatDate = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const today = () => new Date().toISOString().slice(0, 10);

const COLUMNS = ["Project", "Category", "Priority", "Status", "Budget", "Raised", "Students", "Due", "Submitted"];

const Reports = () => {
  const { user } = useAuth();
  const { projects, loading, error, reload } = useMyProjects();

  // Every figure is counted from the school's own projects.
  const approved = projects.filter((p) => p.reviewStatus === "OPEN");
  const ready = !loading && !error;
  const summary = [
    { label: "Projects", value: projects.length, hint: `${approved.length} approved` },
    { label: "Budget requested", value: formatINR(projects.reduce((sum, p) => sum + p.budget, 0)), hint: "All projects" },
    { label: "Funds raised", value: formatINR(approved.reduce((sum, p) => sum + p.raised, 0)), hint: "Approved projects" },
    { label: "Students benefited", value: approved.reduce((sum, p) => sum + p.studentsBenefited, 0).toLocaleString("en-IN"), hint: "Approved projects" },
  ];

  const exportCsv = () =>
    downloadCsv(`vidyadaan-projects-${today()}.csv`, [
      [...COLUMNS, "Location", "Rejection reason"],
      ...projects.map((p) => [
        p.title, p.category, p.priority, projectStatusLabel(p), p.budget, p.raised, p.studentsBenefited,
        p.expectedCompletion, p.submittedAt.slice(0, 10), p.location, p.reviewStatus === "REJECTED" ? p.rejectionReason : "",
      ]),
    ]);

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="Reports" subtitle="Your projects in numbers">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader
            title="Reports"
            description="A summary of your school's projects, built from your own records. Download it as a spreadsheet (CSV)."
            actions={<Button variant="secondary" icon={LuDownload} onClick={exportCsv} disabled={!ready || projects.length === 0}>Download CSV</Button>}
          />

          {error && (
            <Alert tone="danger">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">Try again</button>
            </Alert>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {summary.map((s) => <StatCard key={s.label} label={s.label} value={ready ? s.value : "–"} hint={ready ? s.hint : undefined} />)}
          </div>

          <Card className="overflow-hidden">
            <CardHeader title="Projects report" description={ready ? `${projects.length} ${projects.length === 1 ? "project" : "projects"}` : undefined} />
            {loading ? (
              <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading your projects…</p>
            ) : projects.length === 0 ? (
              !error && (
                <EmptyState
                  icon={LuFolderKanban}
                  title="Nothing to report yet"
                  description="Reports are built from your projects. Create your first project to see it here."
                  action={<Link to="/dashboard/school/projects" className={buttonClasses()}>Go to projects</Link>}
                />
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      {COLUMNS.map((h) => (
                        <th key={h} scope="col" className="px-5 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {projects.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-900 min-w-48">
                          <Link to={`/dashboard/school/progress?project=${p.id}`} className="hover:underline">{p.title}</Link>
                        </td>
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{p.category}</td>
                        <td className="px-5 py-3 text-slate-600">{p.priority}</td>
                        <td className="px-5 py-3"><ProjectStatusBadge project={p} /></td>
                        <td className="px-5 py-3 text-slate-900 tabular-nums whitespace-nowrap">{formatINR(p.budget)}</td>
                        <td className="px-5 py-3 text-slate-900 tabular-nums whitespace-nowrap">{formatINR(p.raised)}</td>
                        <td className="px-5 py-3 text-slate-600 tabular-nums">{p.studentsBenefited.toLocaleString("en-IN")}</td>
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDate(p.expectedCompletion)}</td>
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDate(p.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <EmptyState
              icon={LuFileText}
              title="Donation, impact and completion reports"
              description="These will be added once online donations and verified progress updates are live, so they only ever show real records."
              className="py-8"
            />
          </Card>
        </div>
      </main>
    </DashboardLayout>
  );
};

export default Reports;
