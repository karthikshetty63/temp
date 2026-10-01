import { Link } from "react-router-dom";
import { LuFolderKanban } from "react-icons/lu";
import Badge, { StatusBadge } from "../../ui/Badge";
import Card from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import PageHeader from "../../ui/PageHeader";
import { buttonClasses } from "../../ui/classes";
import { formatDate, formatINR, fundingStatus, myParts, partsOf, schoolPlace, sumAmounts } from "./format";

/** The school needs this NGO is funding, how the work is going and whether the money has arrived. */
const YourProjectsView = ({ projects, loading, error, notice, onView }) => (
  <>
    <PageHeader
      title="Your projects"
      description="The school needs you're funding, how the work is going and whether your money has reached the school."
      actions={<Link to="#needs" className={buttonClasses({ variant: "secondary" })}>Browse school needs</Link>}
    />
    {notice}
    <Card>
      {loading && <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading your projects…</p>}
      {!loading && error && projects.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">{error}</p>}
      {!loading && !error && projects.length === 0 && (
        <EmptyState
          icon={LuFolderKanban}
          title="No projects yet"
          description="When you fund a school need, it becomes one of your projects and appears here."
        />
      )}
      {projects.length > 0 && (
        <ul className="divide-y divide-slate-200">
          {projects.map((p) => {
            const mine = myParts(p);
            const money = fundingStatus(mine);
            const place = schoolPlace(p.school);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onView(p)}
                  className="flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{p.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {p.school.name}{place && ` · ${place}`} · Due {formatDate(p.expectedCompletion)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 md:justify-end md:shrink-0">
                    <StatusBadge status={p.status}>{p.status === "Open" ? "Work not started" : p.status}</StatusBadge>
                    <span className="text-xs tabular-nums text-slate-600">
                      {partsOf(mine.map((x) => x.part), p.parts.length)} · {formatINR(sumAmounts(mine))}
                    </span>
                    <Badge tone={money.tone}>{money.label}</Badge>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  </>
);

export default YourProjectsView;
