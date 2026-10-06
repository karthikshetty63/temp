import { LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert } from "react-icons/lu";

const TONES = {
  info: { box: "bg-primary-50 border-primary-200 text-primary-900", icon: LuInfo, iconColor: "text-primary-600" },
  success: { box: "bg-emerald-50 border-emerald-200 text-emerald-900", icon: LuCircleCheck, iconColor: "text-emerald-600" },
  warning: { box: "bg-amber-50 border-amber-200 text-amber-900", icon: LuTriangleAlert, iconColor: "text-amber-600" },
  danger: { box: "bg-red-50 border-red-200 text-red-800", icon: LuCircleAlert, iconColor: "text-red-600" },
  neutral: { box: "bg-slate-50 border-slate-200 text-slate-700", icon: LuInfo, iconColor: "text-slate-500" },
};

/**
 * Inline message. Errors use role="alert" (announced immediately); everything else
 * uses role="status" so screen readers aren't interrupted.
 */
const Alert = ({ tone = "info", title, className = "", children }) => {
  const t = TONES[tone] || TONES.info;
  const Icon = t.icon;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex gap-3 rounded-control border px-4 py-3 text-sm ${t.box} ${className}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.iconColor}`} aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
};

export default Alert;
