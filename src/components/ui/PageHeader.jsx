// Top of every dashboard page: title, optional description/meta, actions on the right.
const PageHeader = ({ title, description, meta, actions, leading, className = "" }) => (
  <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}>
    <div className="flex items-start gap-4 min-w-0">
      {leading}
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">{meta}</div>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
