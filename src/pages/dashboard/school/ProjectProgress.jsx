import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LuCamera, LuFolderKanban, LuPencil } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import ProjectStatusBadge from "../../../components/dashboard/ProjectStatusBadge";
import ProjectFormModal from "../../../components/dashboard/school/ProjectFormModal";
import ProjectFundingCard from "../../../components/dashboard/school/ProjectFundingCard";
import Alert from "../../../components/ui/Alert";
import Badge, { StatusBadge } from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import { Select } from "../../../components/ui/FormField";
import PageHeader from "../../../components/ui/PageHeader";
import { buttonClasses } from "../../../components/ui/classes";
import { useAuth } from "../../../context/AuthContext";
import useMyProjects from "../../../hooks/useMyProjects";
import useSchoolCommitments from "../../../hooks/useSchoolCommitments";
import useSchoolPayments from "../../../hooks/useSchoolPayments";

const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const formatDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const Detail = ({ label, children }) => (
  <div>
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
  </div>
);

const ProjectProgress = () => {
  const { user } = useAuth();
  const { projects, loading, error, reload, upsert } = useMyProjects();
  const funding = useSchoolCommitments();
  const paymentList = useSchoolPayments();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState(null); // { projectId, message } after accepting or rejecting a payment

  // The project comes from the link (?project=…) so it survives a refresh; default to the newest.
  const current = projects.find((p) => p.id === searchParams.get("project")) || projects[0];
  const selectProject = (id) => setSearchParams({ project: id }, { replace: true });

  return (
    <DashboardLayout role="school" userName={user?.name} userSub={user?.email} title="Project progress" subtitle="Updates and evidence photos">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader
            title="Project progress"
            description="Each project's details and its progress updates."
            actions={
              projects.length > 0 && (
                <Select aria-label="Project" className="w-full sm:w-80" value={current?.id || ""} onChange={(e) => selectProject(e.target.value)}>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </Select>
              )
            }
          />

          {error && (
            <Alert tone="danger">
              {error}{" "}
              <button type="button" onClick={reload} className="font-medium underline underline-offset-2">Try again</button>
            </Alert>
          )}

          {loading && <p className="text-sm text-slate-500" role="status">Loading your projects…</p>}

          {!loading && !error && !current && (
            <Card>
              <EmptyState
                icon={LuFolderKanban}
                title="Create a project first"
                description="Progress updates belong to a project. Add your school's first project, then come back here."
                action={<Link to="/dashboard/school/projects" className={buttonClasses()}>Go to projects</Link>}
              />
            </Card>
          )}

          {current && (
            <>
              {current.reviewStatus === "PENDING_REVIEW" && (
                <Alert tone="info" title="Waiting for review">
                  The VIDYADAAN team checks every project before NGOs and donors can see it. You can still edit it while you wait.
                </Alert>
              )}
              {current.reviewStatus === "REJECTED" && (
                <Alert tone="danger" title="Changes requested">
                  {current.rejectionReason}
                  <span className="block mt-1 text-red-700">Edit the project to make these changes. Saving sends it back for review.</span>
                </Alert>
              )}

              <Card className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge>{current.category}</Badge>
                      <ProjectStatusBadge project={current} />
                      <StatusBadge status={current.priority} />
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-slate-900">{current.title}</h2>
                    <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{current.problem}</p>
                  </div>
                  <Button variant="secondary" icon={LuPencil} onClick={() => setEditing(true)} className="shrink-0">
                    {current.reviewStatus === "REJECTED" ? "Edit and resubmit" : "Edit project"}
                  </Button>
                </div>

                <dl className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-slate-200 pt-5">
                  <Detail label="Budget">{formatINR(current.budget)}</Detail>
                  <Detail label="Raised so far">{formatINR(current.raised)}</Detail>
                  <Detail label="Students benefited">{current.studentsBenefited.toLocaleString("en-IN")}</Detail>
                  <Detail label="Expected completion">{formatDate(current.expectedCompletion)}</Detail>
                  {current.location && <Detail label="Location">{current.location}</Detail>}
                  {current.materials.length > 0 && (
                    <div className="col-span-2 lg:col-span-3">
                      <dt className="text-xs text-slate-500">Required materials</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {current.materials.map((m) => <Badge key={m}>{m}</Badge>)}
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>

              {notice?.projectId === current.id && <Alert tone="success">{notice.message}</Alert>}
              <ProjectFundingCard
                project={current}
                commitments={funding.commitments}
                payments={paymentList.payments}
                loading={funding.loading || paymentList.loading}
                error={funding.error || paymentList.error}
                onReviewed={async (data) => {
                  if (data.project) upsert(data.project);
                  await Promise.all([funding.refresh(), paymentList.refresh()]);
                  setNotice({ projectId: current.id, message: data.message });
                }}
              />

              <Card>
                <EmptyState
                  icon={LuCamera}
                  title="No progress updates yet"
                  description="Photo updates for this project (before, during and after the work) will appear here. Adding them is coming soon."
                />
              </Card>
            </>
          )}
        </div>
      </main>
      {editing && current && <ProjectFormModal open project={current} onClose={() => setEditing(false)} onSaved={upsert} />}
    </DashboardLayout>
  );
};

export default ProjectProgress;
