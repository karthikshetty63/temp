// Class-string helpers for elements that must *look like* a shared component but can't
// be one (e.g. a router <Link> styled as a button). Components in this folder use them too,
// so there is exactly one definition of each style.

// Button variants
//   primary         main action on a screen (one per area)
//   brand           the money action on a dashboard (Donate) — the only gradient button
//   secondary       neutral / alternative action
//   destructive     irreversible or negative action (reject, delete)
//   ghost           low-emphasis action inside toolbars, cards and tables
const BUTTON_VARIANTS = {
  primary: "bg-primary-600 text-white shadow-xs hover:bg-primary-700 active:bg-primary-800 focus-visible:outline-primary-600",
  brand:
    "bg-primary-600 bg-linear-to-br from-primary-500 to-primary-600 text-white shadow-sm shadow-primary-600/20 " +
    "hover:from-primary-600 hover:to-primary-700 focus-visible:outline-primary-600",
  secondary: "bg-white text-slate-700 border border-slate-300 shadow-xs hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-primary-600",
  destructive: "bg-red-600 text-white shadow-xs hover:bg-red-700 active:bg-red-800 focus-visible:outline-red-600",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-primary-600",
};

// Older variant names used elsewhere in the codebase map onto the ones above.
const LEGACY_VARIANTS = { accent: "primary", outline: "secondary", white: "secondary" };

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export const buttonClasses = ({ variant = "primary", size = "md", fullWidth = false, className = "" } = {}) =>
  [
    "inline-flex items-center justify-center rounded-control font-semibold whitespace-nowrap",
    // A short colour change on hover and a slight press on click; no movement for reduced motion.
    "transition-[color,background-color,border-color,box-shadow,scale] duration-150 active:scale-[0.98] motion-reduce:active:scale-100",
    "focus-visible:outline-2 focus-visible:outline-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
    BUTTON_VARIANTS[LEGACY_VARIANTS[variant] || variant] || BUTTON_VARIANTS.primary,
    BUTTON_SIZES[size] || BUTTON_SIZES.md,
    fullWidth ? "w-full" : "",
    className,
  ].join(" ");

const CONTROL_BASE =
  "block w-full rounded-control border bg-white text-sm text-slate-900 shadow-xs placeholder:text-slate-400 transition-colors " +
  "focus:outline-none focus:ring-3 disabled:bg-slate-50 disabled:text-slate-500";

/** Inputs / selects / textareas. */
export const inputClasses = ({ invalid = false, className = "" } = {}) =>
  `${CONTROL_BASE} ${invalid ? "border-red-400 focus:border-red-500 focus:ring-red-500/15" : "border-slate-300 focus:border-primary-500 focus:ring-primary-500/15"} ${className}`;
