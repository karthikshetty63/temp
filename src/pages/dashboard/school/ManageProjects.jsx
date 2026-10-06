import { useState } from "react";
import { Link } from "react-router-dom";
import { LuCircleCheck, LuFolderKanban, LuPlus, LuSearch, LuTrendingUp, LuTriangleAlert } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import ProjectStatusBadge from "../../../components/dashboard/ProjectStatusBadge";
import ProjectFormModal from "../../../components/dashboard/school/ProjectFormModal";
import Alert from "../../../components/ui/Alert";
import Badge, { StatusBadge } from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import { Input, Select } from "../../../components/ui/FormField";
import PageHeader from "../../../components/ui/PageHeader";
import ProgressBar from "../../../components/ui/ProgressBar";
import StatCard from "../../../components/ui/StatCard";
import { PROJECT_CATEGORIES, PROJECT_PRIORITIES, PROJECT_STATUSES, REVIEW_LABELS, projectStatusLabel } from "../../../api/projects";
import { useAuth } from "../../../context/AuthContext";
import useMyProjects from "../../../hooks/useMyProjects";

const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const formatDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const ManageProjects = () => {
  const { user } = useAuth();
  const { projects, loading, error, reload, upsert } = useMyProjects();
  const [creating, setCreating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [searchQ, setSearchQ] = useState("");

  const filtered = projects.filter((p) => {
    if (categoryFilter !== "All" && p.category !== categoryFilter) return false;
    if (statusFilter !== "All" && projectStatusLabel(p) !== statusFilter) return false;
    if (priorityFilter !== "All" && p.priority !== priorityFilter) return false;
    if (searchQ && !p.title.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: projects.length,
    inProgress: projects.filter((p) => p.status === "In Progress").length,
    completed: projects.filter((p) => p.status === "Completed").length,
    critical: projects.filter((p) => p.priority === "Critical").length,
  };

  const clearFilters = () => {
    setCategoryFilter("All");
    setStatusFilter("All");
    setPriorityFilter("All");
    setSearchQ("");
  };

  const newProjectButton = <Button icon={LuPlus} onClick={() => setCreating(true)}>New project</Button>;

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="Manage projects" subtitle="Your school's projects">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader
            title="Projects"
            description="Everything your school needs support for. Open a project to see its progress."
            actions={newProjectButton}
          />

          {error && (
            <Alert tone="danger">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">Try again</button>
            </Alert>
          )}

          {!loading && !error && projects.length === 0 ? (
            <Card>
              <EmptyState
                icon={LuFolderKanban}
                title="No projects yet"
                description="Create your school's first project: what's needed, why it matters, and the budget."
                action={newProjectButton}
              />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="Total projects" value={loading ? "–" : stats.total} icon={LuFolderKanban} />
                <StatCard label="In progress" value={loading ? "–" : stats.inProgress} icon={LuTrendingUp} />
                <StatCard label="Completed" value={loading ? "–" : stats.completed} icon={LuCircleCheck} />
                <StatCard label="Critical priority" value={loading ? "–" : stats.critical} icon={LuTriangleAlert} />
              </div>

              <Card className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative flex-1 min-w-0">
                  <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden="true" />
                  <Input type="search" aria-label="Search projects" placeholder="Search projects…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-9" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:w-auto">
                  <Select aria-label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="lg:w-48">
                    <option value="All">All categories</option>
                    {PROJECT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="lg:w-40">
                    <option value="All">All statuses</option>
                    {[REVIEW_LABELS.PENDING_REVIEW, REVIEW_LABELS.REJECTED, ...PROJECT_STATUSES].map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                  <Select aria-label="Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="lg:w-40">
                    <option value="All">All priorities</option>
                    {PROJECT_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
                <p className="text-sm text-slate-500 whitespace-nowrap" aria-live="polite">
                  {loading ? "Loading…" : `${filtered.length} of ${projects.length} projects`}
                </p>
              </Card>

              {!loading && filtered.length === 0 ? (
                <Card>
                  <EmptyState
                    title="No projects match these filters"
                    action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
                  />
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy={loading || undefined}>
                  {filtered.map((proj) => {
                    const funded = proj.budget ? Math.min(100, Math.round((proj.raised / proj.budget) * 100)) : 0;
                    return (
                      <Link
                        key={proj.id}
                        to={`/dashboard/school/progress?project=${proj.id}`}
                        className="flex flex-col bg-surface border border-surface-line rounded-2xl shadow-card p-5 transition-[border-color,box-shadow] duration-200 hover:border-slate-300/80 hover:shadow-card-hover"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge>{proj.category}</Badge>
                          <ProjectStatusBadge project={proj} />
                          <StatusBadge status={proj.priority} />
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-slate-900">{proj.title}</h3>
                        <p className="mt-1 text-sm text-slate-600 line-clamp-2">{proj.problem}</p>
                        {proj.reviewStatus === "REJECTED" && proj.rejectionReason && (
                          <p className="mt-2 text-xs font-medium text-red-700 line-clamp-2">Changes requested: {proj.rejectionReason}</p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          {proj.studentsBenefited.toLocaleString("en-IN")} students · Due {formatDate(proj.expectedCompletion)}
                        </p>
                        <div className="mt-auto pt-4">
                          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                            <span><span className="font-medium text-slate-900">{formatINR(proj.raised)}</span> raised of {formatINR(proj.budget)}</span>
                            <span className="font-medium text-slate-900 tabular-nums">{funded}%</span>
                          </div>
                          <ProgressBar value={funded} label={`${proj.title} funding`} />
                          {proj.location && <p className="mt-3 text-xs text-slate-500">{proj.location}</p>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {creating && <ProjectFormModal open onClose={() => setCreating(false)} onSaved={upsert} />}
    </DashboardLayout>
  );
};

export default ManageProjects;
