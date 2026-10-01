// The home page's type scale and building blocks, shared by every section so sizes stay consistent.
// Font: Geist (font-landing, set on the page root) with Geist Mono for small labels.

export const WRAP = "mx-auto w-full max-w-[1200px] px-5 sm:px-8 lg:px-10";
export const SECTION = "scroll-mt-16 py-20 sm:py-28";

export const EYEBROW = "font-landing-mono text-xs font-medium uppercase tracking-[0.14em] text-blue-700";
// Headings set the family again: the global base style gives h1–h6 the dashboard heading font.
const HEADING = "font-landing font-semibold text-zinc-950 text-balance";
export const H1 = `${HEADING} text-[2.75rem] leading-[1.02] tracking-[-0.045em] sm:text-[3.75rem] lg:text-[4.5rem]`;
export const H2 = `${HEADING} text-[2rem] leading-[1.08] tracking-[-0.035em] sm:text-[2.625rem]`;
export const H3 = `${HEADING} text-[1.0625rem] leading-snug tracking-[-0.01em]`;

export const LEAD = "text-lg leading-[1.6] text-zinc-600 sm:text-xl";
export const BODY = "text-[0.9375rem] leading-relaxed text-zinc-600";

// A grid box, and the white "product surface" drawn inside it.
export const BOX = "rounded-2xl border border-zinc-200 bg-zinc-50/70";
export const SURFACE = "rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_4px_16px_-6px_rgba(24,24,27,0.08)]";

const BUTTON = "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-[0.9375rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
export const BUTTON_PRIMARY = `${BUTTON} bg-zinc-950 text-white hover:bg-zinc-800 focus-visible:outline-zinc-950`;
export const BUTTON_SECONDARY = `${BUTTON} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 focus-visible:outline-zinc-950`;
