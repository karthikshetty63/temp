import { LuMapPin } from "react-icons/lu";
import Badge, { StatusBadge } from "../../ui/Badge";
import Button from "../../ui/Button";
import FundingPartsBar from "../FundingPartsBar";
import { NGO_PART_LABELS, formatDate, formatINR, freeParts, myParts, myShare, ngoSegments, schoolPlace, sumAmounts } from "./format";

/** One approved school need, as NGOs see it. */
const ApprovedNeedCard = ({ need, onView, onFund }) => {
  const place = schoolPlace(need.school);
  const free = freeParts(need);
  const mine = myParts(need);
  return (
    <article className="flex flex-col rounded-2xl border border-surface-line bg-surface p-5 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-primary-200 hover:shadow-card-hover">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{need.category}</Badge>
        <StatusBadge status={need.priority} />
        {need.status !== "Open" && <StatusBadge status={need.status} />}
      </div>
      <h3 className="mt-3 text-base font-bold leading-snug tracking-tight text-slate-900">{need.title}</h3>
      <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
        <LuMapPin className="mt-px w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{need.school.name}{place && ` · ${place}`}</span>
      </p>
      <p className="mt-3 text-sm text-slate-600 line-clamp-2">{need.problem}</p>
      <p className="mt-2 text-xs text-slate-500">
        {need.studentsBenefited.toLocaleString("en-IN")} students · Due {formatDate(need.expectedCompletion)}
      </p>
      <div className="mt-auto pt-4">
        <p className="mb-2 text-xs text-slate-600">
          <span className="font-medium text-slate-900">{formatINR(need.committed)}</span> committed of {formatINR(need.budget)}
        </p>
        <FundingPartsBar segments={ngoSegments(need)} labels={NGO_PART_LABELS} />
        {mine.length > 0 && (
          <p className="mt-2 text-xs font-medium text-primary-700">
            You&rsquo;ve committed {formatINR(sumAmounts(mine))} ({myShare(need)})
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          {free.length > 0 ? (
            <Button size="sm" className="flex-1" onClick={() => onFund(need)} aria-label={`Fund this need: ${need.title}`}>Fund this need</Button>
          ) : (
            <p className="flex-1 text-sm font-medium text-slate-600">Fully committed</p>
          )}
          <Button variant="secondary" size="sm" onClick={() => onView(need)} aria-label={`Details: ${need.title}`}>Details</Button>
        </div>
      </div>
    </article>
  );
};

export default ApprovedNeedCard;
