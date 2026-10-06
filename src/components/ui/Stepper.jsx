import { LuCheck } from "react-icons/lu";

/**
 * Progress indicator for multi-step forms.
 * Phones: "Step 2 of 6 · Principal" + progress bar. Larger screens: the full step list.
 */
const Stepper = ({ steps, current }) => {
  const pct = Math.round(((current + 1) / steps.length) * 100);
  return (
    <nav aria-label="Registration progress" className="mb-8">
      <div className="sm:hidden">
        <p className="text-sm font-medium text-slate-700">
          Step {current + 1} of {steps.length} <span className="text-slate-400">·</span> {steps[current]}
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-primary-600 rounded-full transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="hidden sm:flex items-center">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex items-center flex-1 last:flex-none" aria-current={active ? "step" : undefined}>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    done ? "bg-primary-600 text-white" : active ? "bg-white text-primary-700 ring-2 ring-primary-600" : "bg-white text-slate-500 ring-1 ring-slate-300"
                  }`}
                >
                  {done ? <LuCheck className="w-4 h-4" aria-label="Completed" /> : i + 1}
                </span>
                <span className={`text-xs whitespace-nowrap ${active ? "font-semibold text-slate-900" : "text-slate-500"}`}>{label}</span>
              </div>
              {i < steps.length - 1 && <span className={`flex-1 h-px mx-2 mb-5 ${done ? "bg-primary-600" : "bg-slate-200"}`} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Stepper;
