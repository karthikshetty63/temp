import { useState } from "react";
import { Link } from "react-router-dom";
import { LuChevronRight, LuFolderKanban, LuPlus } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import ProjectStatusBadge from "../../../components/dashboard/ProjectStatusBadge";
import ProjectFormModal from "../../../components/dashboard/school/ProjectFormModal";
import Alert from "../../../components/ui/Alert";
import { StatusBadge } from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Card, { CardHeader } from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import PageHeader from "../../../components/ui/PageHeader";
import ProgressBar from "../../../components/ui/ProgressBar";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import CategoryIcon from "../../../components/ui/CategoryIcon";
import { INFRASTRUCTURE_CATEGORIES } from "../../../constants/infrastructureCategories";
import { useAuth } from "../../../context/AuthContext";
import useMyProjects from "../../../hooks/useMyProjects";
import { getFundingPercentage } from "../../../utils/funding";

const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const formatDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const Infrastructure = () => {
  const { user } = useAuth();
  const { projects, loading, error, reload, upsert } = useMyProjects();
  const [isNeedModalOpen, setIsNeedModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const tabFilter = {
    all: projects,
    critical: projects.filter((p) => p.priority === "Critical"),
    "in-progress": projects.filter((p) => p.reviewStatus === "OPEN" && p.status === "In Progress"),
    completed: projects.filter((p) => p.reviewStatus === "OPEN" && p.status === "Completed"),
  };

  const tabs = [
    { value: "all", label: "All", count: projects.length },
    { value: "critical", label: "Critical", count: tabFilter.critical.length },
    { value: "in-progress", label: "In progress", count: tabFilter["in-progress"].length },
    { value: "completed", label: "Completed", count: tabFilter.completed.length },
  ];

  const displayed = tabFilter[activeTab] || projects;
  // A category is "active" while it has a project that isn't finished yet.
  const activeCategories = new Set(projects.filter((p) => p.status !== "Completed").map((p) => p.category));
  const submitButton = <Button icon={LuPlus} onClick={() => setIsNeedModalOpen(true)}>Submit new need</Button>;

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="Infrastructure needs" subtitle="School infrastructure management">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader
            title="Infrastructure needs"
            description="Log, track and manage your school's infrastructure improvement requests."
            actions={submitButton}
          />

          {error && (
            <Alert tone="danger">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">Try again</button>
            </Alert>
          )}

          <Card>
            <CardHeader title="Category coverage" description="Categories with an active request are highlighted." />
            <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 p-5">
              {INFRASTRUCTURE_CATEGORIES.map(({ id, schoolLabel }) => {
                const hasProject = activeCategories.has(id);
                return (
                  <li
                    key={id}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                      hasProject ? "border-primary-200 bg-primary-50 text-primary-800 font-medium" : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    <CategoryIcon category={id} className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 truncate" title={id}>{schoolLabel}</span>
                    {hasProject && <span className="sr-only">(active request)</span>}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Requests</h2>
              <SegmentedControl label="Filter requests" value={activeTab} onChange={setActiveTab} options={tabs} />
            </div>

            {loading ? (
              <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading your projects…</p>
            ) : error && projects.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">Your projects couldn&rsquo;t be loaded.</p>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={LuFolderKanban}
                title="No infrastructure needs yet"
                description="Submit your school's first need. The VIDYADAAN team reviews it before NGOs and donors can see it."
                action={submitButton}
              />
            ) : displayed.length === 0 ? (
              <EmptyState title="No infrastructure needs in this view" />
            ) : (
              <ul className="divide-y divide-slate-200">
                {displayed.map((proj) => (
                  <li key={proj.id}>
                    <Link to={`/dashboard/school/progress?project=${proj.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted transition-colors">
                      <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <CategoryIcon category={proj.category} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-medium text-slate-900">{proj.title}</p>
                          <StatusBadge status={proj.priority} />
                          <ProjectStatusBadge project={proj} />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {proj.category} · {proj.studentsBenefited.toLocaleString("en-IN")} students · Due {formatDate(proj.expectedCompletion)}
                        </p>
                        {proj.reviewStatus === "REJECTED" && proj.rejectionReason && (
                          <p className="mt-1 text-xs font-medium text-red-700 line-clamp-1">Changes requested: {proj.rejectionReason}</p>
                        )}
                        <div className="mt-2 flex items-center gap-3 sm:max-w-md">
                          <ProgressBar value={getFundingPercentage(proj.budget, proj.raised)} label={`${proj.title} funding`} />
                          <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">{formatINR(proj.raised)} of {formatINR(proj.budget)}</span>
                        </div>
                      </div>
                      <LuChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
      {isNeedModalOpen && <ProjectFormModal open onClose={() => setIsNeedModalOpen(false)} onSaved={upsert} />}
    </DashboardLayout>
  );
};

export default Infrastructure;
