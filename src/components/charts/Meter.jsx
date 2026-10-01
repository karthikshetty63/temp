import { METER_TRACK_COLOR, SINGLE_SERIES_COLOR } from "./palette";

/**
 * One amount against its target: a bar on a same-colour track. `caption(percent)` is the visible
 * line under it; `label` and the figures are also given to screen readers.
 */
const Meter = ({ label, value, max, format = (n) => n.toLocaleString("en-IN"), caption }) => {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${format(value)} of ${format(max)}, ${percent}%`}
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: METER_TRACK_COLOR }}
      >
        {percent > 0 && <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: SINGLE_SERIES_COLOR }} />}
      </div>
      {caption && <p className="mt-1.5 text-xs text-slate-500">{caption(percent)}</p>}
    </div>
  );
};

export default Meter;
