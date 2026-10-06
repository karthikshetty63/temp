// Small status label. Tone carries meaning — don't pick a tone for decoration.
const TONES = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-primary-50 text-primary-700 ring-primary-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
};

const Badge = ({ tone = "neutral", icon: Icon, className = "", children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${TONES[tone] || TONES.neutral} ${className}`}>
    {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
    {children}
  </span>
);

// Common status words used across the app → tone.
const STATUS_TONES = {
  active: "success", approved: "success", completed: "success", verified: "success", "fully sponsored": "success", funded: "success",
  pending: "warning", processing: "info", "in progress": "info", "on hold": "neutral",
  rejected: "danger", failed: "danger", urgent: "danger", critical: "danger",
  high: "warning", medium: "neutral", low: "neutral",
};

/** Badge whose tone is chosen from the status text (e.g. "Completed", "Pending"). */
export const StatusBadge = ({ status, children, className = "" }) => (
  <Badge tone={STATUS_TONES[String(status || "").toLowerCase()] || "neutral"} className={className}>
    {children ?? status}
  </Badge>
);

export default Badge;
