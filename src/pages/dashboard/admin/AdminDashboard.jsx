import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LuExternalLink, LuHandHeart, LuHeartHandshake, LuSchool } from "react-icons/lu";
import PaymentQrReviewSection from "../../../components/admin/PaymentQrReviewSection";
import ProjectReviewSection from "../../../components/admin/ProjectReviewSection";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import Alert from "../../../components/ui/Alert";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import FormField, { Textarea } from "../../../components/ui/FormField";
import Modal from "../../../components/ui/Modal";
import PageHeader from "../../../components/ui/PageHeader";
import ProtectedImage from "../../../components/ui/ProtectedImage";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import StatCard from "../../../components/ui/StatCard";
import { approveAccount, getAccountDetails, listAccounts, rejectAccount } from "../../../api/admin";
import { fetchFileObjectUrl } from "../../../api/auth";
import { useAuth } from "../../../context/AuthContext";
import { UPLOAD_RULES } from "../../../../shared/registrationRules.js";

const STATUS_TONES = { pending: "warning", active: "success", rejected: "danger" };
const STATUS_LABELS = { pending: "Pending", active: "Approved", rejected: "Rejected" };
const ROLE_LABELS = { school: "School", ngo: "NGO", donor: "Donor" };

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const FIELD_LABELS = {
  school: [
    ["schoolName", "School name"], ["udise", "UDISE code"], ["address", "Address"], ["district", "District"], ["state", "State"],
    ["principalName", "Principal"], ["email", "Official email"], ["phone", "Phone"], ["students", "Students"], ["teachers", "Teachers"],
    ["infrastructure", "Facilities"], ["bankAccount", "Bank account"], ["ifsc", "IFSC"], ["upi", "UPI ID"],
  ],
  ngo: [
    ["ngoName", "NGO name"], ["type", "Organisation type"], ["established", "Year established"], ["website", "Website"],
    ["mission", "Mission"], ["focus", "Focus areas"], ["regNumber", "Registration no."], ["regDate", "Registration date"], ["pan", "PAN"],
    ["address", "Address"], ["district", "District"], ["state", "State"], ["contactName", "Contact person"], ["email", "Official email"],
    ["phone", "Phone"], ["altPhone", "Alternate phone"],
  ],
  donor: [
    ["phone", "Phone"], ["dob", "Date of birth"], ["address", "Address"], ["city", "City"], ["state", "State"], ["pin", "PIN code"],
    ["causes", "Preferred causes"], ["frequency", "Donation frequency"], ["anonymous", "Anonymous donations"],
  ],
};

const FACILITY_LABELS = { hasToilets: "Toilets", hasLibrary: "Library", hasComputers: "Computer lab", hasDrinkingWater: "Drinking water" };

const formatValue = (key, value) => {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return "—";
  if (key === "infrastructure") return Object.entries(FACILITY_LABELS).filter(([k]) => value[k]).map(([, l]) => l).join(", ") || "None";
  if (key === "regDate" || key === "dob") return formatDate(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

// Document label for each stored document key, taken from the registration upload rules.
const documentLabels = (role) =>
  Object.fromEntries(
    Object.values(UPLOAD_RULES[role] || {})
      .filter((rule) => rule.profilePath.startsWith("documents."))
      .map((rule) => [rule.profilePath.split(".")[1], rule.label])
  );

/* ─── Review panel ─────────────────────────────────────── */
const AccountReviewModal = ({ accountId, onClose, onDecision }) => {
  const [details, setDetails] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAccountDetails(accountId)
      .then((res) => !cancelled && setDetails(res))
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const openDocument = async (fileId) => {
    // Open the tab synchronously (so pop-up blockers allow it), then load the private file into it.
    const tab = window.open("about:blank", "_blank");
    try {
      const url = await fetchFileObjectUrl(fileId);
      if (tab) tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      setActionError(err.message);
    }
  };

  const decide = async (action) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const res = action === "approve" ? await approveAccount(accountId) : await rejectAccount(accountId, reason);
      onDecision(res.message);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const account = details?.account;
  const profile = details?.profile;
  const docLabels = account ? documentLabels(account.role) : {};

  const footer = account && (
    <>
      {account.accountStatus !== "rejected" &&
        (showReject ? (
          <Button variant="destructive" onClick={() => decide("reject")} disabled={reason.trim().length < 5} loading={busy}>
            {busy ? "Rejecting…" : "Confirm rejection"}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setShowReject(true)} disabled={busy}>Reject…</Button>
        ))}
      {account.accountStatus !== "active" && (
        <Button onClick={() => decide("approve")} loading={busy && !showReject} disabled={busy}>Approve account</Button>
      )}
    </>
  );

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      size="lg"
      title={profile?.schoolName || profile?.ngoName || account?.name || "Loading registration…"}
      description="Registration review"
      footer={footer}
    >
      {loadError && <Alert tone="danger">{loadError}</Alert>}
      {!details && !loadError && <p className="text-sm text-slate-500">Loading registration details…</p>}

      {account && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge>{ROLE_LABELS[account.role]}</Badge>
            <Badge tone={STATUS_TONES[account.accountStatus]}>{STATUS_LABELS[account.accountStatus]}</Badge>
            <span>Registered {formatDate(account.createdAt)}</span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span>Sign-in email <span className="font-medium text-slate-900">{account.email}</span></span>
          </div>

          {account.rejectionReason && (
            <Alert tone="danger" title="Rejection reason">{account.rejectionReason}</Alert>
          )}

          {account.role === "school" && (
            <div className="flex items-center gap-4">
              <span className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                <ProtectedImage fileId={profile?.photo?.id} alt="School photograph" className="w-full h-full object-cover" fallback={<LuSchool className="w-7 h-7 text-slate-400" aria-hidden="true" />} />
              </span>
              <p className="text-sm text-slate-600">{profile?.photo ? "School photograph submitted with registration." : "No school photograph was submitted."}</p>
            </div>
          )}

          <section aria-label="Registration details">
            {profile ? (
              <dl className="rounded-control border border-slate-200 divide-y divide-slate-200">
                {FIELD_LABELS[account.role].map(([key, label]) => (
                  <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="sm:col-span-2 font-medium text-slate-900 break-words">{formatValue(key, profile[key])}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Alert tone="neutral">No profile record was found for this account.</Alert>
            )}
          </section>

          <section aria-labelledby="documents-heading">
            <h3 id="documents-heading" className="text-sm font-semibold text-slate-900 mb-2">Verification documents</h3>
            <ul className="rounded-control border border-slate-200 divide-y divide-slate-200">
              {Object.entries(docLabels).map(([key, label]) => {
                const doc = profile?.documents?.[key];
                return (
                  <li key={key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="text-slate-700">{label}</span>
                    {doc ? (
                      <button type="button" onClick={() => openDocument(doc.id)} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
                        Open {doc.mimeType === "application/pdf" ? "PDF" : "image"}
                        <LuExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="text-slate-500">Not submitted</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {showReject && (
            <FormField id="reject-reason" label="Reason for rejection" required hint="Shown to the applicant when they try to sign in. At least 5 characters.">
              {(f) => (
                <Textarea
                  {...f}
                  data-autofocus
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. UDISE code could not be verified. Please re-register with the correct code."
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

/* ─── Account approvals ────────────────────────────────── */
const AccountApprovals = () => {
  const [filters, setFilters] = useState({ status: "pending", role: "all" });
  const [result, setResult] = useState({ key: null, accounts: [], pendingCounts: { school: 0, ngo: 0, donor: 0 }, error: "" });
  const [reloadCount, setReloadCount] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState("");

  const requestKey = `${filters.status}|${filters.role}|${reloadCount}`;

  useEffect(() => {
    let cancelled = false;
    listAccounts(filters)
      .then((res) => !cancelled && setResult({ key: requestKey, accounts: res.accounts, pendingCounts: res.pendingCounts, error: "" }))
      .catch((err) => !cancelled && setResult((prev) => ({ ...prev, key: requestKey, error: err.message })));
    return () => {
      cancelled = true;
    };
  }, [filters, requestKey]);

  const loading = result.key !== requestKey;
  const setFilter = (key, value) => {
    setNotice("");
    setFilters((f) => ({ ...f, [key]: value }));
  };

  return (
    <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label="Schools pending" value={result.pendingCounts?.school ?? 0} icon={LuSchool} />
            <StatCard label="NGOs pending" value={result.pendingCounts?.ngo ?? 0} icon={LuHeartHandshake} />
            <StatCard label="Donors pending" value={result.pendingCounts?.donor ?? 0} icon={LuHandHeart} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <SegmentedControl
              label="Filter by status"
              value={filters.status}
              onChange={(v) => setFilter("status", v)}
              options={["pending", "active", "rejected"].map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
            <SegmentedControl
              label="Filter by account type"
              value={filters.role}
              onChange={(v) => setFilter("role", v)}
              options={[{ value: "all", label: "All" }, { value: "school", label: "Schools" }, { value: "ngo", label: "NGOs" }, { value: "donor", label: "Donors" }]}
            />
          </div>

          {notice && <Alert tone="success">{notice}</Alert>}
          {result.error && <Alert tone="danger">{result.error}</Alert>}

          <Card className="overflow-hidden">
            {loading ? (
              <p className="px-5 py-12 text-center text-sm text-slate-500" role="status">Loading accounts…</p>
            ) : !result.error && result.accounts.length === 0 ? (
              <EmptyState title={`No ${STATUS_LABELS[filters.status].toLowerCase()} registrations`} description="Nothing needs your attention here right now." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      {["Account", "Type", "Contact", "Location", "Submitted", "Documents", "Status"].map((h) => (
                        <th key={h} scope="col" className="px-5 py-2.5 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                      <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.accounts.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          {/* Donors are people, not organisations. */}
                          <p className="font-medium text-slate-900">{a.role === "donor" ? a.name : a.organisationName || "—"}</p>
                          <p className="text-xs text-slate-500">
                            {a.role === "donor" ? "Individual donor" : `${a.role === "school" ? "UDISE" : "Reg. no."} ${a.identifier || "—"}`}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{ROLE_LABELS[a.role]}</td>
                        <td className="px-5 py-3">
                          <p className="text-slate-900 whitespace-nowrap">{a.name}</p>
                          <p className="text-xs text-slate-500">{a.email}</p>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{[a.district, a.state].filter(Boolean).join(", ") || "—"}</td>
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{a.documentCount ?? 0}{a.hasPhoto ? " + photo" : ""}</td>
                        <td className="px-5 py-3"><Badge tone={STATUS_TONES[a.accountStatus]}>{STATUS_LABELS[a.accountStatus]}</Badge></td>
                        <td className="px-5 py-3 text-right">
                          <Button size="sm" variant="secondary" onClick={() => setSelectedId(a.id)} aria-label={`Review ${a.organisationName || a.name}`}>Review</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

      {selectedId && (
        <AccountReviewModal
          accountId={selectedId}
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

/* ─── Admin console ────────────────────────────────────── */
const SECTIONS = {
  accounts: {
    title: "Account approvals",
    subtitle: "Verify school, NGO and donor registrations",
    description: "Schools, NGOs and donors can sign in only after their registration is approved.",
  },
  projects: {
    title: "Project reviews",
    subtitle: "Approve schools' projects",
    description: "A school's project becomes visible to NGOs and donors only after it is approved.",
  },
  qrs: {
    title: "Payment QR reviews",
    subtitle: "Check schools' UPI QRs",
    description: "A school's UPI QR with a UPI ID other than the one verified at registration is shown to NGOs only after it is approved.",
  },
};

const AdminDashboard = () => {
  const { user } = useAuth();
  // The section lives in the address (?tab=projects) so a refresh or a shared link keeps it.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = Object.hasOwn(SECTIONS, searchParams.get("tab") ?? "") ? searchParams.get("tab") : "accounts";
  const section = SECTIONS[tab];

  return (
    <DashboardLayout role="admin" userName={user?.name || "Admin"} userSub={user?.email || "Platform admin"} title={section.title} subtitle={section.subtitle}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <PageHeader
            title={section.title}
            description={section.description}
            actions={
              <SegmentedControl
                label="Admin section"
                value={tab}
                onChange={(v) => setSearchParams(v === "accounts" ? {} : { tab: v }, { replace: true })}
                options={[{ value: "accounts", label: "Accounts" }, { value: "projects", label: "Projects" }, { value: "qrs", label: "Payment QRs" }]}
              />
            }
          />
          {tab === "projects" && <ProjectReviewSection />}
          {tab === "qrs" && <PaymentQrReviewSection />}
          {tab === "accounts" && <AccountApprovals />}
        </div>
      </main>
    </DashboardLayout>
  );
};

export default AdminDashboard;
