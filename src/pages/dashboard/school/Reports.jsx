import { LuArrowRight, LuDownload, LuFileChartColumn, LuFolderKanban, LuInfo } from "react-icons/lu";
import { Link } from "react-router-dom";
import BarList from "../../../components/charts/BarList";
import Meter from "../../../components/charts/Meter";
import StackedBar from "../../../components/charts/StackedBar";
import { SERIES_COLORS } from "../../../components/charts/palette";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import ProjectStatusBadge from "../../../components/dashboard/ProjectStatusBadge";
import Alert from "../../../components/ui/Alert";
import Badge from "../../../components/ui/Badge";
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
// Where a project stands, in order; each stage always keeps the same colour.
const STAGES = ["Pending review", "Rejected", "Open", "In Progress", "On Hold", "Completed"];
const projectCount = (n) => `${n} ${n === 1 ? "project" : "projects"}`;
const LAKH = 100000;
// "25 students" (whole numbers; one decimal below 10 so small values don't all read as 0).
const formatStudentsPerLakh = (n) => `${n < 10 ? n.toFixed(1).replace(/\.0$/, "") : Math.round(n).toLocaleString("en-IN")} students`;

// "4×", "2.5×": how many times more students per rupee the best project reaches than the last.
const formatRatio = (r) => `${r >= 10 ? Math.round(r) : Number(r.toFixed(1))}×`;

/** One measure before funding → after funding, with a single progress bar under it. */
const BeforeAfterRow = ({ title, before, beforeCaption, after, afterCaption, meter }) => (
  <div>
    <p className="text-sm font-medium text-slate-900">{title}</p>
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 sm:gap-3">
      <div className="rounded-xl bg-surface-muted px-3 sm:px-4 py-3">
        <p className="text-xs text-slate-500">Before · {beforeCaption}</p>
        <p className="mt-0.5 text-lg sm:text-xl font-semibold text-slate-900 truncate">{before}</p>
      </div>
      <span className="self-center text-slate-400" aria-hidden="true"><LuArrowRight className="w-4 h-4" /></span>
      <div className="rounded-xl bg-primary-50 px-3 sm:px-4 py-3">
        <p className="text-xs text-primary-800">After · {afterCaption}</p>
        <p className="mt-0.5 text-lg sm:text-xl font-semibold text-slate-900 truncate">{after}</p>
      </div>
    </div>
    <div className="mt-3">{meter}</div>
  </div>
);

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

  // The charts below are drawn from the same records as the table (the table is their text view).
  const stages = STAGES.map((stage, i) => ({
    key: stage,
    label: stage,
    value: projects.filter((p) => projectStatusLabel(p) === stage).length,
    color: SERIES_COLORS[i],
  }));
  // Best impact for the money: students each project helps for every ₹1 lakh, from the school's
  // own estimates. Rejected projects are left out until they're fixed and resubmitted.
  const impactRanking = projects
    .filter((p) => p.reviewStatus !== "REJECTED")
    .map((p) => ({
      key: p.id,
      label: p.title,
      value: (p.studentsBenefited / p.budget) * LAKH,
      sublabel: `${formatINR(p.budget)} for ${p.studentsBenefited.toLocaleString("en-IN")} students · ${p.priority} priority · ${projectStatusLabel(p)}`,
      href: `/dashboard/school/progress?project=${p.id}`,
    }))
    .sort((a, b) => b.value - a.value);
  const best = impactRanking[0];
  const last = impactRanking[impactRanking.length - 1];
  const bestRatio = impactRanking.length > 1 && last.value > 0 ? best.value / last.value : 1;

  // Impact before and after funding, for approved projects only (the only ones that can be funded).
  const funding = {
    needed: approved.reduce((sum, p) => sum + p.budget, 0),
    raised: approved.reduce((sum, p) => sum + Math.min(p.raised, p.budget), 0),
    studentsPlanned: approved.reduce((sum, p) => sum + p.studentsBenefited, 0),
    studentsReached: approved.filter((p) => p.status === "Completed").reduce((sum, p) => sum + p.studentsBenefited, 0),
  };

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

          {ready && projects.length > 0 && (
            <>
              <Card>
                <CardHeader title="Where your projects stand" description="Review status until approved, then the work status" />
                <div className="px-5 py-5">
                  <StackedBar segments={stages} unit={projectCount} label="Projects by stage" />
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="flex flex-col">
                  <CardHeader title="Best impact for the money" description="Students each project helps for every ₹1 lakh, from your own estimates" />
                  <BarList
                    items={impactRanking}
                    formatValue={formatStudentsPerLakh}
                    label="Projects ranked by students helped per ₹1 lakh"
                    emphasizeFirst
                    badge={<Badge tone="info">Best value</Badge>}
                    summary={(p) => `${p.label} helps ${formatStudentsPerLakh(p.value)} for every ₹1 lakh.`}
                  />
                  {impactRanking.length > 1 && (
                    <div className="mt-auto px-5 pb-5 pt-2">
                      <p className="flex gap-2.5 rounded-xl bg-surface-muted px-4 py-3 text-sm text-slate-700">
                        <LuInfo className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
                        <span>
                          {bestRatio >= 1.2 ? (
                            <>
                              <span className="font-medium text-slate-900">{best.label}</span> helps {formatRatio(bestRatio)} as many students
                              per rupee as <span className="font-medium text-slate-900">{last.label}</span>.
                            </>
                          ) : (
                            "Your projects give similar value for money, so priority and urgency matter most."
                          )}
                        </span>
                      </p>
                    </div>
                  )}
                </Card>

                <Card>
                  <CardHeader title="Impact before and after funding" description="Approved projects: what was needed, and what donors and NGOs have made happen" />
                  {approved.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-slate-600">Once the VIDYADAAN team approves a project, its funding and impact are tracked here.</p>
                  ) : (
                    <div className="px-5 py-5 space-y-6">
                      <BeforeAfterRow
                        title="Money"
                        before={formatINR(funding.needed)}
                        beforeCaption="needed"
                        after={formatINR(funding.raised)}
                        afterCaption="raised"
                        meter={<Meter label="Funding received" value={funding.raised} max={funding.needed} format={formatINR} caption={(pct) => `${pct}% funded by donors and NGOs`} />}
                      />
                      <BeforeAfterRow
                        title="Students"
                        before={funding.studentsPlanned.toLocaleString("en-IN")}
                        beforeCaption="waiting"
                        after={funding.studentsReached.toLocaleString("en-IN")}
                        afterCaption="reached"
                        meter={<Meter label="Students reached" value={funding.studentsReached} max={funding.studentsPlanned} caption={(pct) => `${pct}% reached, counted when a project is completed`} />}
                      />
                      {funding.raised === 0 && (
                        <p className="flex gap-2.5 rounded-xl bg-surface-muted px-4 py-3 text-xs text-slate-600">
                          <LuInfo className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" />
                          No donor or NGO funding has been recorded yet. This updates on its own as real funding arrives and projects are completed.
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}

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
                    <tr className="bg-surface-muted border-b border-slate-200 text-left">
                      {COLUMNS.map((h) => (
                        <th key={h} scope="col" className="px-5 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {projects.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-muted">
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
              icon={LuFileChartColumn}
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
