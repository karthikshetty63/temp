import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LuCalendarDays } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import ProofModal from "../../../components/dashboard/ProofModal";
import FundNeedModal from "../../../components/dashboard/ngo/FundNeedModal";
import FundingView from "../../../components/dashboard/ngo/FundingView";
import NeedDetailsModal from "../../../components/dashboard/ngo/NeedDetailsModal";
import NeedsView from "../../../components/dashboard/ngo/NeedsView";
import OverviewView from "../../../components/dashboard/ngo/OverviewView";
import RecordPaymentModal from "../../../components/dashboard/ngo/RecordPaymentModal";
import VolunteerFormModal from "../../../components/dashboard/ngo/VolunteerFormModal";
import VolunteersView from "../../../components/dashboard/ngo/VolunteersView";
import YourProjectsView from "../../../components/dashboard/ngo/YourProjectsView";
import { formatINR, partsLabel, sumAmounts, unpaidParts } from "../../../components/dashboard/ngo/format";
import Alert from "../../../components/ui/Alert";
import Card from "../../../components/ui/Card";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import EmptyState from "../../../components/ui/EmptyState";
import PageHeader from "../../../components/ui/PageHeader";
import { withdrawFunding } from "../../../api/projects";
import { deleteVolunteer } from "../../../api/volunteers";
import { useAuth } from "../../../context/AuthContext";
import useApprovedProjects from "../../../hooks/useApprovedProjects";
import useMyCommitments from "../../../hooks/useMyCommitments";
import useMyPayments from "../../../hooks/useMyPayments";
import useMyProfile from "../../../hooks/useMyProfile";
import useVolunteers from "../../../hooks/useVolunteers";

// Each sidebar item opens its own view of the portal, like a separate page. The URL hash (#needs,
// #funding…) says which, so a view can be bookmarked and the back button moves between views.
const VIEWS = {
  overview: "Dashboard",
  needs: "School needs",
  projects: "Your projects",
  funding: "Funding",
  volunteers: "Volunteers",
  events: "School events",
};

const EventsView = () => (
  <>
    <PageHeader title="School events" description="Events that schools ask NGOs to partner on." />
    <Card>
      <EmptyState
        icon={LuCalendarDays}
        title="No event requests yet"
        description="Schools will soon be able to ask NGOs to partner on events. Their requests will appear here."
      />
    </Card>
  </>
);

const NGODashboard = () => {
  const location = useLocation();
  const requested = location.hash.slice(1);
  const view = Object.hasOwn(VIEWS, requested) ? requested : "overview";

  const { user } = useAuth();
  const { profile } = useMyProfile();
  const needsList = useApprovedProjects();
  const commitments = useMyCommitments();
  const paymentList = useMyPayments();
  const volunteerList = useVolunteers();
  const needs = needsList.projects;
  const funded = commitments.projects;
  const payments = paymentList.payments;

  const [viewingId, setViewingId] = useState(null);
  const [fundingId, setFundingId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [viewingProof, setViewingProof] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);
  const [volunteerForm, setVolunteerForm] = useState(null); // { volunteer } — null volunteer means a new one
  const [removingVolunteer, setRemovingVolunteer] = useState(null);
  // A success message for the view it happened on; it disappears once you move to another view.
  const [notice, setNotice] = useState(null); // { key: location.key, message }
  const say = (message) => setNotice({ key: location.key, message });
  const noticeHere = notice?.key === location.key && <Alert tone="success">{notice.message}</Alert>;

  // A new view starts at the top, and focus moves to its heading, as it would on a new page.
  const mainRef = useRef(null);
  const viewRef = useRef(null);
  const shownView = useRef(view);
  useEffect(() => {
    if (shownView.current === view) return;
    shownView.current = view;
    mainRef.current?.scrollTo({ top: 0 });
    const heading = viewRef.current?.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [view]);

  const place = [profile?.district, profile?.state].filter(Boolean).join(", ");

  // Always the latest version of a need, so an open window reflects parts taken meanwhile.
  const findNeed = (id) => needs.find((n) => n.id === id) || funded.find((n) => n.id === id);
  const viewing = viewingId && findNeed(viewingId);
  const funding = fundingId && findNeed(fundingId);
  const paying = payingId && findNeed(payingId);
  // Payments are newest first: if the latest for this need was rejected, show the school's reason.
  const lastPayment = paying && payments.find((p) => p.project.id === paying.id);

  const openDetails = (need) => setViewingId(need.id);
  const openFunding = (need) => {
    setNotice(null);
    setViewingId(null);
    setFundingId(need.id);
  };
  const openPayment = (need) => {
    setNotice(null);
    setViewingId(null);
    setPayingId(need.id);
  };
  const handleCommitted = (project, message) => {
    needsList.update(project);
    commitments.refresh();
    setFundingId(null);
    say(
      <>
        {message} Next, pay the school and <Link to="#funding" className="font-medium underline underline-offset-2">record the payment</Link>.
      </>
    );
  };
  const handlePaid = (data) => {
    needsList.update(data.project);
    commitments.refresh();
    paymentList.refresh();
    setPayingId(null);
    say(data.message);
  };
  const handleConflict = () => {
    needsList.refresh();
    commitments.refresh();
  };
  const confirmWithdraw = async () => {
    const data = await withdrawFunding(withdrawing.id);
    needsList.update(data.project);
    await commitments.refresh();
    say(data.message);
  };
  const confirmRemoveVolunteer = async () => {
    await deleteVolunteer(removingVolunteer.id);
    volunteerList.remove(removingVolunteer.id);
    say(`${removingVolunteer.name} has been removed.`);
  };
  const retry = () => {
    needsList.reload();
    commitments.reload();
  };

  const content = {
    overview: (
      <OverviewView
        profile={profile}
        userName={user?.name}
        needs={needs}
        needsLoading={needsList.loading}
        funded={funded}
        fundedLoading={commitments.loading}
        loadError={needsList.error || commitments.error}
        notice={noticeHere}
        onRetry={retry}
        onViewNeed={openDetails}
      />
    ),
    needs: (
      <NeedsView
        needs={needs}
        loading={needsList.loading}
        error={needsList.error}
        homeState={profile?.state}
        notice={noticeHere}
        onView={openDetails}
        onFund={openFunding}
      />
    ),
    projects: <YourProjectsView projects={funded} loading={commitments.loading} error={commitments.error} notice={noticeHere} onView={openDetails} />,
    funding: (
      <FundingView
        projects={funded}
        payments={payments}
        loading={commitments.loading || paymentList.loading}
        error={commitments.error || paymentList.error}
        notice={noticeHere}
        onRecordPayment={openPayment}
        onWithdraw={setWithdrawing}
        onViewProof={setViewingProof}
      />
    ),
    volunteers: (
      <VolunteersView
        volunteers={volunteerList.volunteers}
        loading={volunteerList.loading}
        error={volunteerList.error}
        reload={volunteerList.reload}
        notice={noticeHere}
        onAdd={() => setVolunteerForm({ volunteer: null })}
        onEdit={(v) => setVolunteerForm({ volunteer: v })}
        onRemove={setRemovingVolunteer}
      />
    ),
    events: <EventsView />,
  }[view];

  return (
    <DashboardLayout
      role="ngo"
      userName={user?.name}
      userSub={user?.email}
      title={VIEWS[view]}
      subtitle={[profile?.ngoName, place].filter(Boolean).join(" · ")}
    >
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        {/* The fade-in moves only the inner box, so the view's own top edge (which the sidebar scrolls to) stays put. */}
        <div key={view} ref={viewRef} id={view} className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-6 animate-view-enter motion-reduce:animate-none">{content}</div>
        </div>
      </main>

      {viewing && <NeedDetailsModal need={viewing} onClose={() => setViewingId(null)} onFund={openFunding} onRecordPayment={openPayment} />}
      {funding && <FundNeedModal need={funding} onClose={() => setFundingId(null)} onCommitted={handleCommitted} onConflict={handleConflict} />}
      {paying && (
        <RecordPaymentModal
          need={paying}
          lastRejection={lastPayment?.status === "REJECTED" ? lastPayment.rejectionReason : null}
          onClose={() => setPayingId(null)}
          onSubmitted={handlePaid}
        />
      )}
      {viewingProof && (
        <ProofModal
          proof={viewingProof.proof}
          description={`${viewingProof.project.title} · ${formatINR(viewingProof.amount)} · Ref. ${viewingProof.reference}`}
          onClose={() => setViewingProof(null)}
        />
      )}
      {withdrawing && (
        <ConfirmModal
          title="Withdraw your commitment?"
          confirmLabel="Withdraw"
          busyLabel="Withdrawing…"
          onConfirm={confirmWithdraw}
          onClose={() => setWithdrawing(null)}
        >
          {(() => {
            const unpaid = unpaidParts(withdrawing);
            return (
              <p>
                {unpaid.length === withdrawing.parts.length ? `All ${unpaid.length} parts` : partsLabel(unpaid.map((p) => p.part))} (
                {formatINR(sumAmounts(unpaid))}) of &ldquo;{withdrawing.title}&rdquo; will be free for other NGOs again. Parts you&rsquo;ve
                already paid for stay with you.
              </p>
            );
          })()}
        </ConfirmModal>
      )}
      {volunteerForm && (
        <VolunteerFormModal
          volunteer={volunteerForm.volunteer}
          projects={funded}
          onClose={() => setVolunteerForm(null)}
          onSaved={(v) => {
            volunteerList.upsert(v);
            say(volunteerForm.volunteer ? `${v.name}'s details have been saved.` : `${v.name} has been added.`);
          }}
        />
      )}
      {removingVolunteer && (
        <ConfirmModal
          title="Remove this volunteer?"
          confirmLabel="Remove"
          busyLabel="Removing…"
          onConfirm={confirmRemoveVolunteer}
          onClose={() => setRemovingVolunteer(null)}
        >
          <p>{removingVolunteer.name} ({removingVolunteer.role}) will be removed from your NGO&rsquo;s volunteer list.</p>
        </ConfirmModal>
      )}
    </DashboardLayout>
  );
};

export default NGODashboard;
