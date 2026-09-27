import { apiRequest } from "./auth";

// Rules shared with the server (the server re-checks everything).
export {
  PROJECT_BUDGET_MAX,
  PROJECT_BUDGET_MIN,
  PROJECT_CATEGORIES,
  PROJECT_PRIORITIES,
  PROJECT_REJECTION_REASON_MAX,
  PROJECT_REJECTION_REASON_MIN,
  PROJECT_REVIEW_STATUSES,
  PROJECT_STATUSES,
  validateProject,
} from "../../shared/projectRules.js";

export const REVIEW_LABELS = { PENDING_REVIEW: "Pending review", OPEN: "Open", REJECTED: "Rejected" };

/** Where a project stands: its review state until an admin approves it, then its work status. */
export const projectStatusLabel = (p) =>
  p.reviewStatus === "OPEN" ? p.status : REVIEW_LABELS[p.reviewStatus] || REVIEW_LABELS.PENDING_REVIEW;

/** The signed-in school's own projects, newest first. */
export const listMyProjects = () => apiRequest("/api/school/projects");

export const createProject = (values) => apiRequest("/api/school/projects", { method: "POST", body: values });

/** Only the fields in `changes` are updated. */
export const updateProject = (id, changes) =>
  apiRequest(`/api/school/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: changes });
