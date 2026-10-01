import { METER_TRACK_COLOR, OTHER_PARTY_COLOR, SERIES_COLORS } from "../charts/palette";

// Accent: parts that are yours (NGO) or committed (school). Success: money received.
// Muted: taken by another NGO. Free: the light track of the accent ramp.
const COLORS = { accent: SERIES_COLORS[0], success: SERIES_COLORS[2], muted: OTHER_PARTY_COLOR, free: METER_TRACK_COLOR };

/**
 * A need's budget in equal parts, one segment per part. `segments`: [{ part, tone }];
 * `labels`: the legend word for each tone used (e.g. { accent: "yours", free: "free" }).
 * The legend always shows the counts in text, so the state never depends on colour alone.
 */
const FundingPartsBar = ({ segments, labels, className = "" }) => {
  const legend = Object.keys(COLORS)
    .map((tone) => ({ tone, label: labels[tone], count: segments.filter((s) => s.tone === tone).length }))
    .filter((item) => item.label && item.count);
  const summary = legend.map((item) => `${item.count} ${item.label}`).join(", ");

  return (
    <div className={className}>
      <div role="img" aria-label={`${segments.length} funding parts: ${summary}`} className="flex gap-0.5">
        {segments.map((s) => (
          <span key={s.part} className="h-2 flex-1 first:rounded-l-full last:rounded-r-full" style={{ backgroundColor: COLORS[s.tone] }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600" aria-hidden="true">
        {legend.map((item) => (
          <li key={item.tone} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[item.tone] }} />
            {item.count} {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FundingPartsBar;
