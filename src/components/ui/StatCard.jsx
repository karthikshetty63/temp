import { LuArrowDownRight, LuArrowUpRight } from "react-icons/lu";

// Soft icon tiles. The tone hints at what a figure is about, not whether it is good or bad:
// indigo projects/totals · emerald money and approvals · rose impact and changes · amber pending.
const TONES = {
  indigo: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  slate: "bg-slate-100 text-slate-500 ring-slate-200",
};

/**
 * Single KPI. `icon` is a react-icons component and `tone` one of the keys above.
 * `change` (a % vs last month) is only for real, measured changes — never pass an estimate.
 */
const StatCard = ({ label, value, icon: Icon, tone = "slate", change, changeLabel = "vs last month", hint }) => (
  <div className="rounded-2xl border border-white/70 bg-surface/85 p-4 shadow-card backdrop-blur-[10px] sm:p-5">
    <div className="flex items-center gap-3">
      {Icon && (
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${TONES[tone] || TONES.slate}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      )}
      <p className="min-w-0 text-sm font-medium leading-snug text-slate-600">{label}</p>
    </div>
    <p className="mt-3 text-xl font-bold tracking-tight tabular-nums text-slate-900 sm:text-2xl">{value}</p>
    {change !== undefined && change !== null && (
      <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${change >= 0 ? "text-emerald-700" : "text-red-700"}`}>
        {change >= 0 ? <LuArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" /> : <LuArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />}
        {Math.abs(change)}% <span className="font-normal text-slate-500">{changeLabel}</span>
      </p>
    )}
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

export default StatCard;
