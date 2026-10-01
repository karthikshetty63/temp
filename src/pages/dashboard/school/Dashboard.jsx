import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LuBadgeCheck, LuCalendarDays, LuCalendarPlus, LuChartBar, LuCircleCheck, LuClock, LuFilePen, LuFileText, LuFolderKanban,
  LuHeartHandshake, LuPencil, LuPlus, LuSchool, LuTrendingUp, LuUsers, LuWallet,
} from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import ProjectStatusBadge from "../../../components/dashboard/ProjectStatusBadge";
import ProjectFormModal from "../../../components/dashboard/school/ProjectFormModal";
import { groupCommitments, groupStatus } from "../../../components/dashboard/school/commitments";
import Alert from "../../../components/ui/Alert";
import Badge, { StatusBadge } from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Card, { CardHeader } from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import PageHeader from "../../../components/ui/PageHeader";
import ProgressBar from "../../../components/ui/ProgressBar";
import ProtectedImage from "../../../components/ui/ProtectedImage";
import StatCard from "../../../components/ui/StatCard";
import { buttonClasses } from "../../../components/ui/classes";
import { PROJECT_CATEGORY_ICONS } from "../../../constants/infrastructureCategories";
import { useAuth } from "../../../context/AuthContext";
import useMyProfile, { toSchoolDisplayProfile } from "../../../hooks/useMyProfile";
import useMyProjects from "../../../hooks/useMyProjects";
import useSchoolCommitments from "../../../hooks/useSchoolCommitments";
import useSchoolPayments from "../../../hooks/useSchoolPayments";
import { FUNDING_PARTS } from "../../../api/projects";
import { getFundingPercentage } from "../../../utils/funding";
import { partsOf } from "../../../utils/format";

// Shown until the school's profile has loaded, so no sample school ever appears.
const NO_PROFILE = { name: "", udise: "", district: "", studentsCount: "—", teachersCount: "—", principalName: "", photo: null };

// What the review team last did with each project, newest first, in "Review updates".
const REVIEW_UPDATES = {
  PENDING_REVIEW: { label: "Sent for review", dot: "bg-amber-500" },
  OPEN: { label: "Approved", dot: "bg-emerald-500" },
  REJECTED: { label: "Changes requested", dot: "bg-red-500" },
};

const ViewAll = ({ to, children = "View all" }) => (
  <Link to={to} className="text-sm font-medium text-blue-700 hover:underline">{children}</Link>
);

const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const formatDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatWhen = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const Dashboard = () => {
  const { user } = useAuth();
  const { profile: myProfile } = useMyProfile();
  const profile = toSchoolDisplayProfile(myProfile, NO_PROFILE);
  const { projects, loading, error, reload, upsert } = useMyProjects();
  const { commitments, loading: commitmentsLoading, error: commitmentsError } = useSchoolCommitments();
  const ngoActivity = groupCommitments(commitments);
  const { payments } = useSchoolPayments();
  const paymentsToCheck = payments.filter((p) => p.status === "SUBMITTED");
  const [isNeedModalOpen, setIsNeedModalOpen] = useState(false);

  // Every figure below is counted from the school's own projects. Only approved projects count
  // towards students and funds; donations, NGOs and events have no records yet, so they show none.
  const approved = projects.filter((p) => p.reviewStatus === "OPEN");
  const stats = {
    total: projects.length,
    pending: projects.filter((p) => p.reviewStatus === "PENDING_REVIEW").length,
    approved: approved.length,
    rejected: projects.filter((p) => p.reviewStatus === "REJECTED").length,
    inProgress: approved.filter((p) => p.status === "In Progress").length,
    completed: approved.filter((p) => p.status === "Completed").length,
    critical: projects.filter((p) => p.priority === "Critical").length,
    students: approved.reduce((sum, p) => sum + p.studentsBenefited, 0),
    raised: approved.reduce((sum, p) => sum + p.raised, 0),
    needed: approved.reduce((sum, p) => sum + p.budget, 0),
  };
  const ready = !loading && !error;

  const summaryCards = [
    { label: "Total projects", value: stats.total, icon: LuFolderKanban, hint: stats.critical ? `${stats.critical} critical priority` : undefined },
    { label: "Waiting for review", value: stats.pending, icon: LuClock },
    { label: "Approved", value: stats.approved, icon: LuBadgeCheck },
    { label: "Changes requested", value: stats.rejected, icon: LuFilePen, hint: stats.rejected ? "Edit and resubmit" : undefined },
    { label: "In progress", value: stats.inProgress, icon: LuTrendingUp },
    { label: "Completed", value: stats.completed, icon: LuCircleCheck },
    { label: "Students benefited", value: stats.students.toLocaleString("en-IN"), icon: LuUsers, hint: "Across approved projects" },
    { label: "Funds raised", value: formatINR(stats.raised), icon: LuWallet, hint: stats.needed ? `of ${formatINR(stats.needed)} needed` : undefined },
  ];

  const recentProjects = projects.slice(0, 3);
  const reviewUpdates = projects
    .map((p) => ({ project: p, at: (p.reviewStatus === "PENDING_REVIEW" ? p.submittedAt : p.reviewedAt) || p.submittedAt }))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 4);

  const quickActions = [
    { icon: LuPlus, label: "New infrastructure project", desc: "Create a need request", onClick: () => setIsNeedModalOpen(true) },
    { icon: LuCalendarPlus, label: "School events", desc: "Plan an event and request support", to: "/dashboard/school/events" },
    { icon: LuTrendingUp, label: "Project progress", desc: "Details and updates for each project", to: "/dashboard/school/progress" },
    { icon: LuSchool, label: "School profile", desc: "Update school details", to: "/dashboard/school/profile" },
    { icon: LuFileText, label: "Reports", desc: "Donation and impact reports", to: "/dashboard/school/reports" },
    { icon: LuChartBar, label: "All projects", desc: "Complete project list", to: "/dashboard/school/projects" },
  ];

  const newProjectButton = <Button icon={LuPlus} onClick={() => setIsNeedModalOpen(true)}>New project</Button>;

  return (
    <DashboardLayout
      role="school"
      userName={user?.name}
      userSub={user?.email}
      title="Dashboard"
      subtitle={[profile.name, profile.district].filter(Boolean).join(" · ")}
    >
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader
            leading={
              <span className="w-14 h-14 rounded-control border border-slate-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                <ProtectedImage
                  fileId={profile.photo?.id}
                  alt={`${profile.name} photograph`}
                  className="w-full h-full object-cover"
                  fallback={<LuSchool className="w-6 h-6 text-slate-400" aria-hidden="true" />}
                />
              </span>
            }
            title={profile.name || "Your school"}
            meta={
              <>
                {/* Only accounts the admin has approved can sign in, so this is always true here. */}
                <Badge tone="success" icon={LuCircleCheck}>Verified school</Badge>
                {profile.udise && <span>UDISE {profile.udise}</span>}
                {profile.district && <span>{profile.district}</span>}
                {(myProfile?.students != null || myProfile?.teachers != null) && (
                  <span>{profile.studentsCount} students · {profile.teachersCount} teachers</span>
                )}
              </>
            }
            actions={
              <>
                <Link to="/dashboard/school/profile" className={buttonClasses({ variant: "secondary" })}>
                  <LuPencil className="w-4 h-4" aria-hidden="true" /> Edit profile
                </Link>
                {newProjectButton}
              </>
            }
          />

          {error && (
            <Alert tone="danger">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">Try again</button>
            </Alert>
          )}
          {paymentsToCheck.length > 0 && (
            <Alert tone="warning" title={`${paymentsToCheck.length} ${paymentsToCheck.length === 1 ? "payment is" : "payments are"} waiting for you to check`}>
              NGOs have paid your school and sent proof. Check your bank account, then accept or reject each payment.{" "}
              <Link to="/dashboard/school/donations" className="font-medium underline underline-offset-2">Check payments</Link>
            </Alert>
          )}

          <section aria-labelledby="overview-heading">
            <h2 id="overview-heading" className="sr-only">Overview</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {summaryCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={ready ? card.value : "–"}
                  icon={card.icon}
                  hint={ready ? card.hint : undefined}
                />
              ))}
            </div>
          </section>

          <Card>
            <CardHeader title="Quick actions" />
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px bg-slate-200 rounded-b-2xl overflow-hidden">
              {quickActions.map(({ icon: Icon, label, desc, onClick, to }) => {
                const content = (
                  <>
                    <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{label}</span>
                      <span className="block text-xs text-slate-500">{desc}</span>
                    </span>
                  </>
                );
                const cls = "flex items-center gap-3 w-full h-full px-5 py-4 bg-white text-left hover:bg-slate-50 transition-colors";
                return (
                  <li key={label}>
                    {to ? <Link to={to} className={cls}>{content}</Link> : <button type="button" onClick={onClick} className={cls}>{content}</button>}
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Recent infrastructure projects"
                description={ready ? `${stats.total} ${stats.total === 1 ? "project" : "projects"} in total` : undefined}
                actions={ready && stats.total > 0 && <ViewAll to="/dashboard/school/projects" />}
              />
              {loading && <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading your projects…</p>}
              {!loading && error && projects.length === 0 && (
                <p className="px-5 py-4 text-sm text-slate-500">Your projects couldn&rsquo;t be loaded.</p>
              )}
              {ready && recentProjects.length === 0 && (
                <EmptyState
                  icon={LuFolderKanban}
                  title="No projects yet"
                  description="Create your school's first project. The VIDYADAAN team reviews it before NGOs and donors can see it."
                  action={newProjectButton}
                />
              )}
              {recentProjects.length > 0 && (
                <ul className="divide-y divide-slate-200">
                  {recentProjects.map((proj) => {
                    const funded = getFundingPercentage(proj.budget, proj.raised);
                    return (
                      <li key={proj.id}>
                        <Link to={`/dashboard/school/progress?project=${proj.id}`} className="flex gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                          <span className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-xl shrink-0" aria-hidden="true">
                            {PROJECT_CATEGORY_ICONS[proj.category] || "📦"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900">{proj.title}</p>
                              <div className="flex gap-1.5">
                                <ProjectStatusBadge project={proj} />
                                <StatusBadge status={proj.priority} />
                              </div>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {proj.category} · {proj.studentsBenefited.toLocaleString("en-IN")} students · Due {formatDate(proj.expectedCompletion)}
                            </p>
                            {proj.reviewStatus === "REJECTED" && proj.rejectionReason && (
                              <p className="mt-1 text-xs font-medium text-red-700 line-clamp-1">Changes requested: {proj.rejectionReason}</p>
                            )}
                            <div className="mt-2.5 flex items-center gap-3">
                              <ProgressBar value={funded} label={`${proj.title} funding`} />
                              <span className="text-xs text-slate-600 tabular-nums shrink-0">{formatINR(proj.raised)} of {formatINR(proj.budget)}</span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Review updates"
                description={ready ? (stats.pending ? `${stats.pending} waiting for review` : "From the VIDYADAAN team") : undefined}
                actions={<ViewAll to="/dashboard/school/notifications" />}
              />
              {ready && reviewUpdates.length === 0 && (
                <EmptyState
                  icon={LuClock}
                  title="No review updates yet"
                  description="When you submit a project, you'll see here when it's approved or needs changes."
                  className="py-8"
                />
              )}
              {reviewUpdates.length > 0 && (
                <ul className="divide-y divide-slate-200">
                  {reviewUpdates.map(({ project, at }) => {
                    const update = REVIEW_UPDATES[project.reviewStatus];
                    return (
                      <li key={project.id}>
                        <Link to={`/dashboard/school/progress?project=${project.id}`} className="flex gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${update.dot}`} aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{update.label}</p>
                            <p className="mt-0.5 text-xs text-slate-600 truncate">{project.title}</p>
                            {project.reviewStatus === "REJECTED" && project.rejectionReason && (
                              <p className="mt-0.5 text-xs text-red-700 line-clamp-2">{project.rejectionReason}</p>
                            )}
                            <p className="mt-1 text-xs text-slate-500">{formatWhen(at)}</p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title="School events" />
            <EmptyState
              icon={LuCalendarDays}
              title="No school events yet"
              description="Planning events and asking for support is coming soon. Your events will appear here."
              className="py-8"
            />
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Latest donations" />
              <EmptyState
                icon={LuWallet}
                title="No donations yet"
                description="Donations to your approved projects will appear here once online payments are live."
                className="py-8"
              />
            </Card>

            <Card>
              <CardHeader
                title="NGO activity"
                description={ngoActivity.length ? `${formatINR(commitments.reduce((sum, c) => sum + c.amount, 0))} committed by NGOs` : undefined}
              />
              {commitmentsLoading && <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading NGO activity…</p>}
              {!commitmentsLoading && commitmentsError && <p className="px-5 py-4 text-sm text-slate-500">{commitmentsError}</p>}
              {!commitmentsLoading && !commitmentsError && ngoActivity.length === 0 && (
                <EmptyState
                  icon={LuHeartHandshake}
                  title="No NGO activity yet"
                  description="When an NGO commits to fund one of your approved projects, it will appear here."
                  className="py-8"
                />
              )}
              {ngoActivity.length > 0 && (
                <ul className="divide-y divide-slate-200">
                  {ngoActivity.slice(0, 4).map((a) => (
                    <li key={a.key}>
                      <Link to={`/dashboard/school/progress?project=${a.projectId}`} className="flex gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${a.received === a.parts.length ? "bg-emerald-500" : a.toCheck ? "bg-amber-500" : "bg-blue-500"}`} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{a.ngo.name} committed {formatINR(a.amount)}</p>
                          <p className="mt-0.5 text-xs text-slate-600 truncate">
                            {a.projectTitle} · {partsOf(a.parts, FUNDING_PARTS).toLowerCase()}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatWhen(a.committedAt)} ·{" "}
                            {groupStatus(a)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </main>

      {isNeedModalOpen && <ProjectFormModal open onClose={() => setIsNeedModalOpen(false)} onSaved={upsert} />}
    </DashboardLayout>
  );
};

export default Dashboard;
