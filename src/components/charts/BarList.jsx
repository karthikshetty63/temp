import { Link } from "react-router-dom";
import { DEEMPHASIS_COLOR, SINGLE_SERIES_COLOR } from "./palette";

// Room kept at the end of the longest bar for its value label.
const VALUE_ROOM = "6rem";

/**
 * A ranked list with one bar per row (one series), largest first, value at each bar's tip.
 * Every figure is visible text (no hover needed, so it works the same on phones). With fewer
 * than two rows a bar chart says nothing a sentence can't, so `summary(item)` is shown instead.
 *
 * items: [{ key, label, value, sublabel?, href? }]
 * emphasizeFirst: the first row is the point (e.g. the best result): it keeps the colour and
 *   shows `badge`; the others go gray.
 */
const BarList = ({ items, formatValue, label, summary, emphasizeFirst = false, badge = null }) => {
  if (items.length < 2) {
    return <p className="px-5 py-6 text-sm text-slate-600">{items.length ? summary(items[0]) : "Nothing to show yet."}</p>;
  }

  const max = Math.max(...items.map((i) => i.value)) || 1;

  return (
    <ol className="divide-y divide-slate-100" aria-label={label}>
      {items.map((item, index) => {
        const emphasized = emphasizeFirst && index === 0;
        const content = (
          <>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 ${emphasized ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900" title={item.label}>{item.label}</span>
              {emphasized && badge}
            </div>
            {item.sublabel && <p className="mt-0.5 pl-9 text-xs text-slate-500">{item.sublabel}</p>}
            <div className="mt-2 pl-9 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 shrink-0 rounded-r-[4px]"
                style={{
                  width: `max(3px, calc((100% - ${VALUE_ROOM}) * ${item.value / max}))`,
                  backgroundColor: emphasizeFirst && !emphasized ? DEEMPHASIS_COLOR : SINGLE_SERIES_COLOR,
                }}
              />
              <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">{formatValue(item.value)}</span>
            </div>
          </>
        );
        const rowClass = "block px-5 py-3.5";
        return (
          <li key={item.key}>
            {item.href ? (
              <Link to={item.href} className={`${rowClass} hover:bg-slate-50 transition-colors`}>{content}</Link>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default BarList;
