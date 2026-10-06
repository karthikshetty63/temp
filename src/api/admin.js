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

/* ─── School UPI QR review ───────────────────────────────── */

/** status: PENDING | ACTIVE | REJECTED → { qrs, counts } */
export const listPaymentQrs = (status = "PENDING") => apiRequest(`/api/admin/payment-qrs?status=${encodeURIComponent(status)}`);

/** `link` is the QR the admin reviewed; nothing changes if the school has replaced it since. */
export const approvePaymentQr = (schoolId, link) =>
    apiRequest(`/api/admin/payment-qrs/${encodeURIComponent(schoolId)}/approve`, { method: "PATCH", body: { link } });

export const rejectPaymentQr = (schoolId, link, reason) =>
    apiRequest(`/api/admin/payment-qrs/${encodeURIComponent(schoolId)}/reject`, { method: "PATCH", body: { link, reason } });
