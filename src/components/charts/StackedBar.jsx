import { useState } from "react";

/**
 * One bar split into parts (part-to-whole), with a legend that names every part and its count.
 * Each part keeps its own colour whether or not the others are present. When everything falls
 * in one part, a sentence says so instead of a one-colour bar.
 *
 * segments: [{ key, label, value, color }] in their fixed order; `unit(n)` → "2 projects".
 */
const StackedBar = ({ segments, unit, label }) => {
  const [active, setActive] = useState(null);
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((sum, s) => sum + s.value, 0);

  if (shown.length < 2) {
    const only = shown[0];
    const sentence = !only ? "Nothing to show yet." : total === 1 ? `Your only ${unit(1).replace(/^1 /, "")} is ${only.label.toLowerCase()}.` : `All ${unit(total)} are ${only.label.toLowerCase()}.`;
    return <p className="text-sm text-slate-600">{sentence}</p>;
  }

  const percent = (value) => Math.round((value / total) * 100);

  return (
    <div>
      {/* 2px white gaps separate the parts; only the far end is rounded. */}
      <div className="flex h-4 gap-[2px]" role="list" aria-label={label}>
        {shown.map((s, index) => (
          <span
            key={s.key}
            role="listitem"
            tabIndex={0}
            aria-label={`${s.label}: ${unit(s.value)}, ${percent(s.value)}%`}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(s.key)}
            onBlur={() => setActive(null)}
            className={`relative h-full min-w-[6px] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${index === shown.length - 1 ? "rounded-r-[4px]" : ""}`}
            style={{ flexGrow: s.value, flexBasis: 0, backgroundColor: s.color, opacity: active === null || active === s.key ? 1 : 0.45 }}
          >
            {active === s.key && (
              <span role="tooltip" className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
                <span className="block text-sm font-semibold text-slate-900">{unit(s.value)} · {percent(s.value)}%</span>
                <span className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  {s.label}
                </span>
              </span>
            )}
          </span>
        ))}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2" aria-hidden="true">
        {shown.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm text-slate-700">
            <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
            <span className="font-semibold text-slate-900">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StackedBar;
