import Badge, { StatusBadge } from "../ui/Badge";
import { REVIEW_LABELS } from "../../api/projects";

const REVIEW_TONES = { PENDING_REVIEW: "warning", OPEN: "success", REJECTED: "danger" };

/**
 * One badge for where a project stands. Until an admin approves it, that's the review state
 * (Pending review / Rejected); after that, the school's own work status (Open, In Progress…).
 * `review` always shows the review state (the admin's view).
 */
const ProjectStatusBadge = ({ project, review = false }) => {
  const reviewStatus = REVIEW_LABELS[project.reviewStatus] ? project.reviewStatus : "PENDING_REVIEW";
  if (review || reviewStatus !== "OPEN") return <Badge tone={REVIEW_TONES[reviewStatus]}>{REVIEW_LABELS[reviewStatus]}</Badge>;
  return <StatusBadge status={project.status} />;
};

export default ProjectStatusBadge;
