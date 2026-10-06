/**
 * The welcome banner at the top of a portal's home page, on the lightest sky blue.
 * It says who is signed in and what to do next; every line in it comes from the account or the
 * server. Two faint rings in the corner are the only decoration.
 */
const DashboardHero = ({ eyebrow, title, description, meta, actions, leading, className = "" }) => (
  <section className={`dashboard-hero relative isolate overflow-hidden rounded-3xl border border-sky-100 px-5 py-6 shadow-card sm:px-8 sm:py-8 ${className}`}>
    <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 -z-10 h-80 w-80 rounded-full border border-sky-200/70" />
    <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 -z-10 h-48 w-48 rounded-full border border-sky-200/70" />

    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {leading}
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>}
          {meta && <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  </section>
);

/** A small fact on the banner (e.g. "Verified school", a district). */
export const HeroChip = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-sky-200">
    {Icon && <Icon className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />}
    {children}
  </span>
);

/** Square tile on the banner for a school photo or an icon. */
export const HeroTile = ({ children }) => (
  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-sky-200">
    {children}
  </span>
);

export default DashboardHero;
