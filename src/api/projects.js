import { apiRequest } from "./auth";

// Rules shared with the server (the server re-checks everything).
export {
  FUNDING_PARTS,
  PROJECT_BUDGET_MAX,
  PROJECT_BUDGET_MIN,
  PROJECT_CATEGORIES,
  PROJECT_PRIORITIES,
  PROJECT_REJECTION_REASON_MAX,
  PROJECT_REJECTION_REASON_MIN,
  PROJECT_REVIEW_STATUSES,
  PROJECT_STATUSES,
  splitIntoParts,
  validateProject,
} from "../../shared/projectRules.js";

export const REVIEW_LABELS = { PENDING_REVIEW: "Pending review", OPEN: "Open", REJECTED: "Rejected" };

/** Where a project stands: its review state until an admin approves it, then its work status. */
export const projectStatusLabel = (p) =>
  p.reviewStatus === "OPEN" ? p.status : REVIEW_LABELS[p.reviewStatus] || REVIEW_LABELS.PENDING_REVIEW;

/** The signed-in school's own projects, newest first. */
export const listMyProjects = () => apiRequest("/api/school/projects");

export const createProject = (values) => apiRequest("/api/school/projects", { method: "POST", body: values });

/** Approved school needs that still need support (no school contact details). NGOs get the partner view, donors a smaller read-only view. */
export const listApprovedProjects = () => apiRequest("/api/projects");

// ─── NGO funding commitments ─────────────────────────────────────────────────
/** The needs the signed-in NGO has committed to fund (completed ones too). */
export const listMyCommitments = () => apiRequest("/api/projects/committed");

/** Commit to one or more free parts of a need (`parts`: part numbers; all of them is the full amount). */
export const commitFunding = (id, parts) =>
  apiRequest(`/api/projects/${encodeURIComponent(id)}/commitments`, { method: "POST", body: { parts } });

/** Withdraw the NGO's parts that the school hasn't marked as received. */
export const withdrawFunding = (id) => apiRequest(`/api/projects/${encodeURIComponent(id)}/commitments`, { method: "DELETE" });

/** Every NGO commitment on the signed-in school's projects, newest first. */
export const listSchoolCommitments = () => apiRequest("/api/school/commitments");

/** Only the fields in `changes` are updated. */
export const updateProject = (id, changes) =>
  apiRequest(`/api/school/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: changes });
