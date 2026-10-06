/**
 * Single-choice segmented buttons, used for filters and small option sets.
 * options: [{ value, label, count? }]
 */
const SegmentedControl = ({ label, options, value, onChange, className = "" }) => (
  <div role="group" aria-label={label} className={`inline-flex max-w-full overflow-x-auto rounded-control border border-slate-200/80 bg-slate-100/80 p-0.5 ${className}`}>
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected}
          onClick={() => onChange(option.value)}
          className={`h-8 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
            selected ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {option.label}
          {option.count !== undefined && (
            <span className={`ml-1.5 text-xs ${selected ? "text-primary-600" : "text-slate-500"}`}>{option.count}</span>
          )}
        </button>
      );
    })}
  </div>
);

export default SegmentedControl;
