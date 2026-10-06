const HEIGHTS = { sm: "h-1.5", md: "h-2" };

/** Funding / completion bar: brand indigo → violet while in progress, green when complete. */
const ProgressBar = ({ value = 0, label, size = "sm", className = "" }) => {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`${HEIGHTS[size] || HEIGHTS.sm} w-full rounded-full bg-slate-100 overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-primary-600 bg-linear-to-r from-primary-500 to-violet-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

export default ProgressBar;
