import { useState } from "react";
import { LuCalendarDays, LuClipboardList, LuHandHeart, LuReceipt } from "react-icons/lu";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import { useAuth } from "../../../context/AuthContext";
import StatsWidget from "../../../components/dashboard/StatsWidget";
import DonationTable from "../../../components/dashboard/DonationTable";
import TimelineWidget from "../../../components/dashboard/TimelineWidget";
import NeedCard from "../../../components/dashboard/NeedCard";
import EventCard from "../../../components/events/EventCard";
import SponsorEventModal from "../../../components/events/SponsorEventModal";
import Alert from "../../../components/ui/Alert";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Card, { CardHeader } from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";
import PageHeader from "../../../components/ui/PageHeader";
import PaymentFlowModal from "../../../components/payment/PaymentFlowModal";
import SectionHeader from "../../../components/ui/SectionHeader";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import { initialEvents } from "../../../data/events";
import useApprovedProjects from "../../../hooks/useApprovedProjects";

const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/* ─── MOCK DATA ─────────────────────────────────────────── */
const stats = [
  { icon: LuHandHeart, label: "Total donated", value: "₹45,000", change: 15 },
  { icon: LuClipboardList, label: "School needs funded", value: "4", change: 33 },
  { icon: LuCalendarDays, label: "Events sponsored", value: "2", change: 100 },
  { icon: LuReceipt, label: "Tax savings (80G)", value: "₹22,500", change: 15 },
];

const myDonations = [
  { project: "Smart Classroom & Interactive Board", school: "Honnali Govt. Primary School", amount: 15000, date: "27 Jul 2026", status: "Completed", cert: "80G Certificate" },
  { project: "Annual Sports Meet (Medals & Food)", school: "Honnali Govt. Primary School", amount: 16500, date: "22 Jul 2026", status: "Completed", cert: "80G Certificate" },
  { project: "Science Fair (Experiment Kits)", school: "Govt. HS Shikaripura", amount: 9000, date: "28 Feb 2026", status: "Completed", cert: "80G Certificate" },
  { project: "Drinking Water Purifier Unit", school: "GTHS Chitradurga", amount: 4500, date: "02 Feb 2026", status: "Completed", cert: "80G Certificate" },
];

const impactGallery = [
  { before: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=400&auto=format&fit=crop", after: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=400&auto=format&fit=crop", label: "Smart Classroom Installed", school: "Honnali Primary", date: "Jul 2026" },
  { before: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=400&auto=format&fit=crop", after: "https://images.unsplash.com/photo-1529390079861-591de354faf5?q=80&w=400&auto=format&fit=crop", label: "Library Books Delivered", school: "GPS Tumkur", date: "May 2026" },
];

const timeline = [
  { icon: "💙", title: "Donated ₹5,000 to Smart Classroom", desc: "Fulfilling urgent infrastructure need at Honnali Primary", time: "10m ago", color: "bg-blue-100 text-blue-600" },
  { icon: "🎉", title: "You sponsored Sports Day Medals!", desc: "₹4,500 contribution to Honnali Primary School Sports Day", time: "2h ago", color: "bg-amber-100 text-amber-600" },
  { icon: "📜", title: "80G Tax Certificate Generated", desc: "Download your certificate for donation #VD-EVT-9921", time: "2h ago", color: "bg-emerald-100 text-emerald-600" },
  { icon: "📸", title: "New Progress Photo Uploaded", desc: "Honnali Primary uploaded classroom installation photos", time: "1d ago", color: "bg-purple-100 text-purple-600" },
];

/* ─── DONOR DASHBOARD ─────────────────────────────────────── */
const DonorDashboard = () => {
  const { user } = useAuth();
  // Approved school needs from the server (the donor view).
  const { projects: needs, loading: needsLoading, error: needsError, reload: reloadNeeds, refresh: refreshNeeds } = useApprovedProjects();
  // The need being donated to. After a confirmed donation its funding is reloaded from the server.
  const [donatingTo, setDonatingTo] = useState(null);
  const [eventsList, setEventsList] = useState(initialEvents);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [needCategory, setNeedCategory] = useState("All");

  const [selectedEventForSponsor, setSelectedEventForSponsor] = useState(null);

  const handleEventSponsorSuccess = ({ eventId, donorName, totalAmt, sponsoredItemIds }) => {
    setEventsList((prev) =>
      prev.map((e) => {
        if (e.id === eventId) {
          const updatedItems = e.requestedItems.map((item) =>
            sponsoredItemIds.includes(item.id)
              ? { ...item, sponsored: true, sponsorName: donorName }
              : item
          );
          const newRaised = e.raisedAmount + totalAmt;
          return {
            ...e,
            raisedAmount: newRaised,
            requestedItems: updatedItems,
            status: newRaised >= e.requiredBudget ? "Fully Sponsored" : "Active",
          };
        }
        return e;
      })
    );
  };

  // Only categories that actually have a need are offered.
  const needCategories = [...new Set(needs.map((n) => n.category))].sort();
  const filteredNeeds = needs.filter(
    (n) => needCategory === "All" || n.category === needCategory
  );

  const filteredEvents = eventsList.filter(
    (e) => selectedCategory === "All" || e.category === selectedCategory
  );

  return (
    <DashboardLayout
      role="donor"
      userName={user?.name || "Donor"}
      userSub={user?.email || "Individual donor"}
      title="Donor dashboard"
      subtitle={`Signed in as ${user?.email || "donor"}`}
    >
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          <section id="overview" className="scroll-mt-6 space-y-6">
            <PageHeader
              title={`Welcome back, ${user?.name || "there"}`}
              description="Fund verified needs in government schools and follow the progress of what you supported."
              actions={<Button onClick={() => scrollToSection("needs")}>Browse school needs</Button>}
            />
            <StatsWidget stats={stats} />
          </section>

          <section id="needs" aria-labelledby="needs-heading" className="scroll-mt-6 space-y-4">
            <SectionHeader
              id="needs-heading"
              title="School infrastructure needs"
              description="Requests from government schools that the VIDYADAAN team has checked and approved."
              actions={
                needs.length > 0 && (
                  <SegmentedControl
                    label="Filter needs by category"
                    value={needCategory}
                    onChange={setNeedCategory}
                    options={["All", ...needCategories].map((c) => ({ value: c, label: c }))}
                  />
                )
              }
            />
            {needsError && (
              <Alert tone="danger">
                {needsError}{" "}
                <button type="button" onClick={reloadNeeds} className="font-medium underline underline-offset-2">Try again</button>
              </Alert>
            )}
            {needsLoading && <Card><p className="px-5 py-4 text-sm text-slate-500" role="status">Loading school needs…</p></Card>}
            {!needsLoading && !needsError && needs.length === 0 && (
              <Card>
                <EmptyState
                  icon={LuClipboardList}
                  title="No approved school needs yet."
                  description="When the VIDYADAAN team approves a school's request, it will appear here."
                />
              </Card>
            )}
            {!needsLoading && needs.length > 0 && (
              filteredNeeds.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredNeeds.map((need) => (
                    <NeedCard key={need.id} need={need} onDonate={setDonatingTo} />
                  ))}
                </div>
              ) : (
                <Card><EmptyState title="No needs in this category" description="Try another category." /></Card>
              )
            )}
          </section>

          <section id="events" aria-labelledby="events-heading" className="scroll-mt-6 space-y-4">
            <SectionHeader
              id="events-heading"
              title="School events"
              description="Sponsor food, medals, sports kits or sound systems for school events."
              actions={
                <SegmentedControl
                  label="Filter events by category"
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  options={["All", "Sports Day", "Science Fair", "Children's Day"].map((c) => ({ value: c, label: c }))}
                />
              }
            />
            {filteredEvents.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    userRole="donor"
                    onSponsorItems={(evt) => setSelectedEventForSponsor(evt)}
                    onDonateAmount={(evt) => setSelectedEventForSponsor(evt)}
                    onViewDetails={(evt) => setSelectedEventForSponsor(evt)}
                  />
                ))}
              </div>
            ) : (
              <Card><EmptyState title="No events in this category" description="Try another category." /></Card>
            )}
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card as="section" id="impact" aria-labelledby="impact-heading" className="xl:col-span-2 scroll-mt-6">
              <CardHeader
                title={<span id="impact-heading">Before and after</span>}
                description="Photos from schools you supported"
                actions={<Badge tone="success">Verified by NGO partners</Badge>}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5">
                {impactGallery.map((g) => (
                  <figure key={g.label}>
                    <div className="grid grid-cols-2 gap-2">
                      {[["Before", g.before], ["After", g.after]].map(([label, src]) => (
                        <div key={label}>
                          <img src={src} alt={`${g.label} — ${label.toLowerCase()}`} className="w-full h-28 object-cover rounded-lg bg-slate-100" />
                          <p className="mt-1 text-xs text-slate-500">{label}</p>
                        </div>
                      ))}
                    </div>
                    <figcaption className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">{g.label}</span>
                      <span className="text-xs text-slate-500">{g.school} · {g.date}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Card>

            <TimelineWidget events={timeline} title="Your activity" />
          </div>

          <section id="donations" className="scroll-mt-6">
            <DonationTable rows={myDonations} title="Donation history" />
          </section>

          <Card as="section" id="settings" className="scroll-mt-6">
            <CardHeader title="Quick actions" />
            <div className="flex flex-wrap gap-2 p-5">
              <Button variant="secondary" icon={LuClipboardList} onClick={() => scrollToSection("needs")}>Donate to a school need</Button>
              <Button variant="secondary" icon={LuCalendarDays} onClick={() => scrollToSection("events")}>Sponsor a school event</Button>
            </div>
          </Card>
        </div>
      </main>

      {donatingTo && <PaymentFlowModal need={donatingTo} onClose={() => setDonatingTo(null)} onConfirmed={refreshNeeds} />}

      <SponsorEventModal
        isOpen={!!selectedEventForSponsor}
        onClose={() => setSelectedEventForSponsor(null)}
        event={selectedEventForSponsor}
        onSponsorSuccess={handleEventSponsorSuccess}
      />
    </DashboardLayout>
  );
};

export default DonorDashboard;
