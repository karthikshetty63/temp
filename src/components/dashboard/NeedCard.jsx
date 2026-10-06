import { LuCircleCheck, LuHeart, LuMapPin, LuSchool } from "react-icons/lu";
import { formatINR } from "../../utils/format";
import { getFundingPercentage } from "../../utils/funding";
import Badge, { StatusBadge } from "../ui/Badge";
import Button from "../ui/Button";
import ProgressBar from "../ui/ProgressBar";
import { schoolPlace } from "./ngo/format";

/**
 * An approved school need on the donor dashboard (the donor view from GET /api/projects).
 * need: { id, title, category, priority, status, budget, raised, school: { name, district, state } }
 * Projects have no cover photo, so none is shown. `onDonate(need)` opens the donation window.
 */
const NeedCard = ({ need, onDonate }) => {
  const place = schoolPlace(need.school);
  const funded = getFundingPercentage(need.budget, need.raised);
  const fullyFunded = need.raised >= need.budget;
  return (
    <article className="flex flex-col rounded-2xl border border-surface-line bg-surface shadow-card transition-[border-color,box-shadow] duration-200 hover:border-primary-200 hover:shadow-card-hover">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{need.category}</Badge>
          <StatusBadge status={need.priority} />
          {need.status !== "Open" && <StatusBadge status={need.status} />}
        </div>
        <h3 className="mt-3 text-base font-bold leading-snug tracking-tight text-slate-900">{need.title}</h3>
        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-slate-700">
          <LuSchool className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span>{need.school.name}</span>
        </p>
        {place && (
          <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
            <LuMapPin className="mt-px h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>{place}</span>
          </p>
        )}

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-3">
            <p className="min-w-0">
              <span className="block text-lg font-bold leading-tight tabular-nums text-slate-900">{formatINR(need.raised)}</span>
              <span className="text-xs text-slate-500">
                raised of <span className="tabular-nums">{formatINR(need.budget)}</span>
              </span>
            </p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                fullyFunded ? "bg-emerald-50 text-emerald-700" : "bg-primary-50 text-primary-700"
              }`}
            >
              {funded}% funded
            </span>
          </div>
          <ProgressBar value={funded} size="md" label={`${need.title} funding`} className="mt-3" />
          {fullyFunded ? (
            <p className="mt-4 flex h-10 items-center justify-center gap-1.5 rounded-control bg-emerald-50 text-sm font-semibold text-emerald-700">
              <LuCircleCheck className="h-4 w-4" aria-hidden="true" /> Fully funded
            </p>
          ) : (
            <Button variant="brand" icon={LuHeart} className="mt-4" fullWidth onClick={() => onDonate(need)} aria-label={`Donate to ${need.title}`}>
              Donate
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};

export default NeedCard;
