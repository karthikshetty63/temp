import { apiRequest } from "./auth";

/** status: pending | active | rejected ; role: all | school | ngo */
export const listAccounts = ({ status = "pending", role = "all" } = {}) =>
    apiRequest(`/api/admin/accounts?status=${encodeURIComponent(status)}&role=${encodeURIComponent(role)}`);

export const getAccountDetails = (id) => apiRequest(`/api/admin/accounts/${encodeURIComponent(id)}`);

export const approveAccount = (id) => apiRequest(`/api/admin/accounts/${encodeURIComponent(id)}/approve`, { method: "PATCH" });

export const rejectAccount = (id, reason) =>
    apiRequest(`/api/admin/accounts/${encodeURIComponent(id)}/reject`, { method: "PATCH", body: { reason } });

/* ─── Project review ─────────────────────────────────────── */

/** status: PENDING_REVIEW | OPEN | REJECTED → { projects, counts } */
export const listProjectsForReview = (status = "PENDING_REVIEW") =>
    apiRequest(`/api/admin/projects?status=${encodeURIComponent(status)}`);

export const getProjectForReview = (id) => apiRequest(`/api/admin/projects/${encodeURIComponent(id)}`);

export const approveProject = (id) => apiRequest(`/api/admin/projects/${encodeURIComponent(id)}/approve`, { method: "PATCH" });

export const rejectProject = (id, reason) =>
    apiRequest(`/api/admin/projects/${encodeURIComponent(id)}/reject`, { method: "PATCH", body: { reason } });
