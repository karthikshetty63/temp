/** Multi-select list of toggle chips (e.g. preferred causes). */
const ChoiceChips = ({ label, options, value = [], onChange, error }) => (
  <fieldset>
    <legend className="block text-sm font-medium text-slate-700 mb-2">{label}</legend>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? value.filter((v) => v !== option) : [...value, option])}
            className={`h-8 px-3 rounded-full border text-sm transition-colors ${
              selected ? "bg-primary-50 border-primary-300 text-primary-800 font-medium" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
    {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
  </fieldset>
);

export default ChoiceChips;
