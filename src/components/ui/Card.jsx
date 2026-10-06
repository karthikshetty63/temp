// Standard surface: solid fill (white, or sky blue in the donor, NGO and school portals — see the
// surface tokens in index.css), hairline border, very light shadow, 16px radius. Dense data
// (lists, tables, forms) always sits on this. Elevation is not used for decoration — only
// `interactive` cards lift slightly on hover.
const Card = ({ as: Tag = "div", className = "", interactive = false, padded = false, children, ...props }) => (
  <Tag
    className={[
      "bg-surface border border-surface-line rounded-2xl shadow-card",
      interactive ? "transition-[border-color,box-shadow] duration-200 hover:border-slate-300/80 hover:shadow-card-hover" : "",
      padded ? "p-5" : "",
      className,
    ].join(" ")}
    {...props}
  >
    {children}
  </Tag>
);

/** Card header row: section title, optional description and actions on the right. */
export const CardHeader = ({ title, description, actions, className = "" }) => (
  <div className={`flex items-start justify-between gap-4 px-5 py-4 border-b border-surface-divider ${className}`}>
    <div className="min-w-0">
      <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export default Card;
