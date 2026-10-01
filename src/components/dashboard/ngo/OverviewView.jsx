import { Link } from "react-router-dom";
import { LuCircleCheck, LuClipboardList, LuFolderKanban, LuHandCoins, LuHeartHandshake, LuUsers, LuWallet } from "react-icons/lu";
import Alert from "../../ui/Alert";
import Badge from "../../ui/Badge";
import Card, { CardHeader } from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import PageHeader from "../../ui/PageHeader";
import StatCard from "../../ui/StatCard";
import { buttonClasses } from "../../ui/classes";
import { formatINR, freeParts, fundingStatus, myParts, schoolPlace, sumAmounts } from "./format";

const PREVIEW_ROWS = 4;

const ViewAll = ({ to, children = "View all" }) => (
  <Link to={to} className="text-sm font-medium text-blue-700 hover:underline">{children}</Link>
);

/**
 * The NGO portal's home: who the NGO is, its key figures, and a preview of the newest open needs
 * and its own projects. Every figure is counted from approved needs and the NGO's own commitments.
 */
const OverviewView = ({ profile, userName, needs, needsLoading, funded, fundedLoading, loadError, notice, onRetry, onViewNeed }) => {
  const ngoName = profile?.ngoName || userName || "";
  const place = [profile?.district, profile?.state].filter(Boolean).join(", ");
  const focus = profile?.focus || [];

  const openNeeds = needs.filter((n) => freeParts(n).length > 0);
  const openSchools = new Set(openNeeds.map((n) => `${n.school.name}|${n.school.district}|${n.school.state}`));
  const myTotal = funded.reduce((sum, n) => sum + sumAmounts(myParts(n)), 0);
  const myReceived = funded.reduce((sum, n) => sum + sumAmounts(myParts(n).filter((p) => p.receivedAt)), 0);
  const ready = !needsLoading && !fundedLoading && !loadError;
  const stats = [
    {
      label: "Open school needs",
      value: openNeeds.length,
      icon: LuClipboardList,
      hint: openNeeds.length ? `In ${openSchools.size} ${openSchools.size === 1 ? "school" : "schools"}` : undefined,
    },
    {
      label: "Still needed",
      value: formatINR(needs.reduce((sum, n) => sum + sumAmounts(freeParts(n)), 0)),
      icon: LuWallet,
      hint: needs.length ? `of ${formatINR(needs.reduce((sum, n) => sum + n.budget, 0))} in total` : undefined,
    },
    { label: "You've committed", value: formatINR(myTotal), icon: LuHandCoins, hint: funded.length ? `${formatINR(myReceived)} received by schools` : undefined },
    {
      label: "Students you support",
      value: funded.reduce((sum, n) => sum + n.studentsBenefited, 0).toLocaleString("en-IN"),
      icon: LuUsers,
      hint: funded.length ? `Across ${funded.length} ${funded.length === 1 ? "project" : "projects"}` : undefined,
    },
  ];

  const browseNeeds = (
    <Link to="#needs" className={buttonClasses()}>
      <LuClipboardList className="w-4 h-4" aria-hidden="true" /> Browse school needs
    </Link>
  );

  return (
    <>
      <PageHeader
        leading={
          <span className="w-14 h-14 rounded-control border border-slate-200 bg-white flex items-center justify-center shrink-0">
            <LuHeartHandshake className="w-6 h-6 text-slate-400" aria-hidden="true" />
          </span>
        }
        title={ngoName || "Your NGO"}
        meta={
          <>
            {/* Only accounts the admin has approved can sign in, so this is always true here. */}
            <Badge tone="success" icon={LuCircleCheck}>Verified NGO</Badge>
            {profile?.type && <span>{profile.type}</span>}
            {place && <span>{place}</span>}
            {focus.length > 0 && <span>Focus: {focus.join(", ")}</span>}
          </>
        }
        actions={browseNeeds}
      />
      {notice}

      {loadError && (
        <Alert tone="danger">
          {loadError}{" "}
          <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">Try again</button>
        </Alert>
      )}

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="sr-only">Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((card) => (
            <StatCard key={card.label} label={card.label} value={ready ? card.value : "–"} icon={card.icon} hint={ready ? card.hint : undefined} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Newest school needs"
            description={ready && openNeeds.length ? `${openNeeds.length} open to funding` : undefined}
            actions={openNeeds.length > 0 && <ViewAll to="#needs" />}
          />
          {needsLoading && <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading school needs…</p>}
          {!needsLoading && !loadError && openNeeds.length === 0 && (
            <EmptyState
              icon={LuClipboardList}
              title="No open school needs right now"
              description="When the VIDYADAAN team approves a school's request, it will appear here."
              className="py-8"
            />
          )}
          {openNeeds.length > 0 && (
            <ul className="divide-y divide-slate-200">
              {openNeeds.slice(0, PREVIEW_ROWS).map((n) => {
                const free = freeParts(n);
                const where = schoolPlace(n.school);
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => onViewNeed(n)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-slate-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{n.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{n.school.name}{where && ` · ${where}`}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-medium tabular-nums text-slate-900">{formatINR(sumAmounts(free))}</span>
                        <span className="block text-xs text-slate-500">{free.length} of {n.parts.length} parts free</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Your projects" actions={funded.length > 0 && <ViewAll to="#projects" />} />
          {fundedLoading && <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading your projects…</p>}
          {!fundedLoading && !loadError && funded.length === 0 && (
            <EmptyState
              icon={LuFolderKanban}
              title="No projects yet"
              description="Fund part or all of a school need and it becomes one of your projects."
              className="py-8"
            />
          )}
          {funded.length > 0 && (
            <ul className="divide-y divide-slate-200">
              {funded.slice(0, PREVIEW_ROWS).map((p) => {
                const mine = myParts(p);
                const money = fundingStatus(mine);
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => onViewNeed(p)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{p.title}</span>
                        <span className="mt-0.5 block text-xs tabular-nums text-slate-500">{formatINR(sumAmounts(mine))} committed</span>
                      </span>
                      <Badge tone={money.tone}>{money.label}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
};

export default OverviewView;
