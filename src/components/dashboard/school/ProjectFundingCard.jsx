import { LuHandCoins, LuMail, LuPhone } from "react-icons/lu";
import { FUNDING_PARTS, splitIntoParts } from "../../../api/projects";
import { formatDate, formatINR, formatPhone } from "../../../utils/format";
import { SCHOOL_PART_STATUS } from "../../../utils/payments";
import Badge from "../../ui/Badge";
import Card, { CardHeader } from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import FundingPartsBar from "../FundingPartsBar";
import PaymentsToCheck from "./PaymentsToCheck";
import { SCHOOL_PART_LABELS } from "./commitments";

/**
 * NGO funding on one of the school's projects: which parts NGOs have committed to, who they are and
 * how to reach them, and the payments waiting for the school to check against its bank account.
 * `commitments` and `payments` are the school's (any project); `onReviewed` gets the server's reply.
 */
const ProjectFundingCard = ({ project, commitments, payments, loading, error, onReviewed }) => {
  if (project.reviewStatus !== "OPEN") {
    return (
      <Card>
        <CardHeader title="NGO funding" />
        <p className="px-5 py-4 text-sm text-slate-500">NGOs can fund this project once the VIDYADAAN team approves it.</p>
      </Card>
    );
  }

  const mine = commitments.filter((c) => c.projectId === project.id).sort((a, b) => a.part - b.part);
  const toCheck = payments.filter((p) => p.project.id === project.id && p.status === "SUBMITTED");
  const byPart = new Map(mine.map((c) => [c.part, c]));
  const segments = splitIntoParts(project.budget).map(({ part }) => {
    const c = byPart.get(part);
    return { part, tone: !c ? "free" : c.status === "RECEIVED" ? "success" : "accent" };
  });

  return (
    <Card>
      <CardHeader title="NGO funding" description={`NGOs fund this project in ${FUNDING_PARTS} equal parts, or all of it at once, and pay your school directly.`} />
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{formatINR(project.committed)}</span> committed ·{" "}
          <span className="font-medium text-slate-900">{formatINR(project.raised)}</span> received · budget {formatINR(project.budget)}
        </p>
        <FundingPartsBar segments={segments} labels={SCHOOL_PART_LABELS} className="mt-2" />
      </div>

      {toCheck.length > 0 && (
        <section aria-labelledby={`to-check-${project.id}`} className="border-b border-slate-200 bg-amber-50/40">
          <h3 id={`to-check-${project.id}`} className="px-5 pt-4 text-sm font-semibold text-slate-900">
            Payments to check ({toCheck.length})
          </h3>
          <p className="px-5 text-xs text-slate-600">Check each one against your bank account before you accept it.</p>
          <PaymentsToCheck payments={toCheck} showProject={false} onReviewed={onReviewed} />
        </section>
      )}

      {loading && <p className="px-5 py-4 text-sm text-slate-500" role="status">Loading NGO commitments…</p>}
      {!loading && error && <p className="px-5 py-4 text-sm text-slate-500">{error}</p>}
      {!loading && !error && mine.length === 0 && (
        <EmptyState
          icon={LuHandCoins}
          title="No NGO has committed yet"
          description="When an NGO funds part or all of this project, you'll see who it is and how to reach them here."
          className="py-8"
        />
      )}
      {mine.length > 0 && (
        <ul className="divide-y divide-slate-200">
          {mine.map((c) => {
            const status = SCHOOL_PART_STATUS[c.status];
            return (
              <li key={c.part} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    Part {c.part} · {formatINR(c.amount)} <span className="font-normal text-slate-500">from</span> {c.ngo.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Committed {formatDate(c.committedAt)}
                    {c.receivedAt && ` · Received ${formatDate(c.receivedAt)}`}
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {c.ngo.email && (
                      <a href={`mailto:${c.ngo.email}`} className="inline-flex items-center gap-1 text-primary-700 hover:underline">
                        <LuMail className="h-3.5 w-3.5" aria-hidden="true" /> {c.ngo.email}
                      </a>
                    )}
                    {c.ngo.phone && (
                      <a href={`tel:${c.ngo.phone}`} className="inline-flex items-center gap-1 text-primary-700 hover:underline">
                        <LuPhone className="h-3.5 w-3.5" aria-hidden="true" /> {formatPhone(c.ngo.phone)}
                      </a>
                    )}
                  </p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export default ProjectFundingCard;
