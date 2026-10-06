// Heading for a section inside a page (below PageHeader). Filters/actions go on the right.
const SectionHeader = ({ id, title, description, actions, className = "" }) => (
  <div className={`flex flex-col gap-3 md:flex-row md:items-end md:justify-between ${className}`}>
    <div className="min-w-0">
      <h2 id={id} className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 max-w-full">{actions}</div>}
  </div>
);

export default SectionHeader;
