import { LuMapPin } from "react-icons/lu";
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
    <article className="flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{need.category}</Badge>
          <StatusBadge status={need.priority} />
          {need.status !== "Open" && <StatusBadge status={need.status} />}
        </div>
        <h3 className="mt-3 text-sm font-semibold text-slate-900">{need.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{need.school.name}</p>
        {place && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <LuMapPin className="w-3.5 h-3.5" aria-hidden="true" /> {place}
          </p>
        )}

        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between gap-3 text-xs text-slate-600 mb-1.5">
            <span>
              <span className="font-medium text-slate-900 tabular-nums">{formatINR(need.raised)}</span> raised of{" "}
              <span className="tabular-nums">{formatINR(need.budget)}</span>
            </span>
            <span className="font-medium text-slate-900 tabular-nums">{funded}% funded</span>
          </div>
          <ProgressBar value={funded} label={`${need.title} funding`} />
          {fullyFunded ? (
            <p className="mt-4 text-sm font-medium text-slate-600">Fully funded</p>
          ) : (
            <Button className="mt-4" fullWidth onClick={() => onDonate(need)} aria-label={`Donate to ${need.title}`}>Donate</Button>
          )}
        </div>
      </div>
    </article>
  );
};

export default NeedCard;
