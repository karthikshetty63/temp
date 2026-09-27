import { useEffect, useState } from "react";
import { LuCircleCheck, LuCircleX, LuClock } from "react-icons/lu";
import ProjectStatusBadge from "../dashboard/ProjectStatusBadge";
import Alert from "../ui/Alert";
import Badge, { StatusBadge } from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import FormField, { Textarea } from "../ui/FormField";
import Modal from "../ui/Modal";
import SegmentedControl from "../ui/SegmentedControl";
import StatCard from "../ui/StatCard";
import { approveProject, getProjectForReview, listProjectsForReview, rejectProject } from "../../api/admin";
import { PROJECT_REJECTION_REASON_MAX, PROJECT_REJECTION_REASON_MIN, REVIEW_LABELS } from "../../api/projects";

const STATUSES = ["PENDING_REVIEW", "OPEN", "REJECTED"];
const EMPTY_TITLES = { PENDING_REVIEW: "No projects waiting for review", OPEN: "No open projects yet", REJECTED: "No rejected projects" };

const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const formatDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const place = (school) => [school?.district, school?.state].filter(Boolean).join(", ");

const Details = ({ rows }) => (
  <dl className="rounded-control border border-slate-200 divide-y divide-slate-200">
    {rows.map(([label, value]) => (
      <div key={label} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 px-4 py-2.5 text-sm">
        <dt className="text-slate-500">{label}</dt>
        <dd className="sm:col-span-2 font-medium text-slate-900 break-words whitespace-pre-line">{value || "—"}</dd>
      </div>
    ))}
  </dl>
);

/* ─── Review panel ─────────────────────────────────────── */
const ProjectReviewModal = ({ projectId, onClose, onDecision }) => {
  const [project, setProject] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getProjectForReview(projectId)
      .then((res) => !cancelled && setProject(res.project))
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const decide = async (action) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const res = action === "approve" ? await approveProject(projectId) : await rejectProject(projectId, reason);
      onDecision(res.message);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const waiting = project?.reviewStatus === "PENDING_REVIEW";
  const schoolActive = project?.school?.accountStatus === "active";

  const footer = waiting && (
    <>
      {showReject ? (
        <Button variant="destructive" onClick={() => decide("reject")} disabled={reason.trim().length < PROJECT_REJECTION_REASON_MIN} loading={busy}>
          {busy ? "Rejecting…" : "Confirm rejection"}
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setShowReject(true)} disabled={busy}>Reject…</Button>
      )}
      <Button onClick={() => decide("approve")} loading={busy && !showReject} disabled={busy || !schoolActive}>Approve project</Button>
    </>
  );

  return (
    <Modal open onClose={busy ? () => {} : onClose} size="lg" title={project?.title || "Loading project…"} description="Project review" footer={footer}>
      {loadError && <Alert tone="danger">{loadError}</Alert>}
      {!project && !loadError && <p className="text-sm text-slate-500">Loading project details…</p>}

      {project && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge>{project.category}</Badge>
            <ProjectStatusBadge project={project} review />
            <StatusBadge status={project.priority} />
            <span>Submitted {formatDate(project.submittedAt)}</span>
            {project.reviewedAt && (
              <>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span>Reviewed {formatDate(project.reviewedAt)}</span>
              </>
            )}
          </div>

          {project.reviewStatus === "REJECTED" && project.rejectionReason && (
            <Alert tone="danger" title="Rejection reason">{project.rejectionReason}</Alert>
          )}
          {waiting && !schoolActive && (
            <Alert tone="warning">This school&apos;s account is not active, so the project can&apos;t be approved.</Alert>
          )}

          <section aria-labelledby="project-school-heading">
            <h3 id="project-school-heading" className="text-sm font-semibold text-slate-900 mb-2">School</h3>
            <Details
              rows={[
                ["School", project.school?.name],
                ["UDISE code", project.school?.udise],
                ["Location", place(project.school)],
                ["Contact", project.school ? `${project.school.contactName} · ${project.school.email}` : ""],
                ["Account", project.school ? (project.school.accountStatus === "active" ? "Approved" : project.school.accountStatus) : ""],
              ]}
            />
          </section>

          <section aria-labelledby="project-details-heading">
            <h3 id="project-details-heading" className="text-sm font-semibold text-slate-900 mb-2">Project</h3>
            <Details
              rows={[
                ["Problem & impact", project.problem],
                ["Estimated budget", formatINR(project.budget)],
                ["Students benefited", project.studentsBenefited.toLocaleString("en-IN")],
                ["Expected completion", formatDay(project.expectedCompletion)],
                ["Location", project.location],
                ["Required materials", project.materials.join(", ")],
              ]}
            />
          </section>

          {showReject && (
            <FormField
              id="project-reject-reason"
              label="Reason for rejection"
              required
              hint={`Shown to the school so they can fix the project and resubmit. At least ${PROJECT_REJECTION_REASON_MIN} characters.`}
            >
              {(f) => (
                <Textarea
                  {...f}
                  data-autofocus
                  maxLength={PROJECT_REJECTION_REASON_MAX}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Please break the budget down by item and attach a quotation."
                />
              )}
            </FormField>
          )}

          {actionError && <Alert tone="danger">{actionError}</Alert>}
        </div>
      )}
    </Modal>
  );
};

/* ─── Section ──────────────────────────────────────────── */
/** Admin review of school projects: the same records the schools create. */
const ProjectReviewSection = () => {
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState({ key: null, projects: [], counts: { PENDING_REVIEW: 0, OPEN: 0, REJECTED: 0 }, error: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState("");

  const requestKey = `${status}|${reloadCount}`;
  useEffect(() => {
    let cancelled = false;
    listProjectsForReview(status)
      .then((res) => !cancelled && setResult({ key: requestKey, projects: res.projects, counts: res.counts, error: "" }))
      .catch((err) => !cancelled && setResult((prev) => ({ ...prev, key: requestKey, error: err.message })));
    return () => {
      cancelled = true;
    };
  }, [status, requestKey]);

  const loading = result.key !== requestKey;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Waiting for review" value={result.counts.PENDING_REVIEW} icon={LuClock} />
        <StatCard label="Open" value={result.counts.OPEN} icon={LuCircleCheck} />
        <StatCard label="Rejected" value={result.counts.REJECTED} icon={LuCircleX} />
      </div>

      <SegmentedControl
        label="Filter projects by review status"
        value={status}
        onChange={(v) => {
          setNotice("");
          setStatus(v);
        }}
        options={STATUSES.map((s) => ({ value: s, label: REVIEW_LABELS[s] }))}
      />

      {notice && <Alert tone="success">{notice}</Alert>}
      {result.error && <Alert tone="danger">{result.error}</Alert>}

      <Card className="overflow-hidden">
        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500" role="status">Loading projects…</p>
        ) : !result.error && result.projects.length === 0 ? (
          <EmptyState title={EMPTY_TITLES[status]} description="Nothing needs your attention here right now." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  {["Project", "School", "Category", "Submitted", "Status"].map((h) => (
                    <th key={h} scope="col" className="px-5 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.projects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{p.title}</p>
                      <p className="text-xs text-slate-500">{formatINR(p.budget)} · {p.priority} priority</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-900">{p.school?.name || "—"}</p>
                      <p className="text-xs text-slate-500">{place(p.school) || "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{p.category}</td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDate(p.submittedAt)}</td>
                    <td className="px-5 py-3"><ProjectStatusBadge project={p} review /></td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setSelectedId(p.id)} aria-label={`Review ${p.title}`}>Review</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedId && (
        <ProjectReviewModal
          projectId={selectedId}
          onClose={() => setSelectedId(null)}
          onDecision={(message) => {
            setSelectedId(null);
            setNotice(message);
            setReloadCount((n) => n + 1);
          }}
        />
      )}
    </>
  );
};

export default ProjectReviewSection;
