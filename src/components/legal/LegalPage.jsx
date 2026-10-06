import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Footer from "../layout/Footer";
import Navbar from "../layout/Navbar";
import { LEGAL_LINKS, LEGAL_UPDATED } from "../../constants/legal";

/**
 * Layout for the policy pages (Terms, Privacy, Refund, Contact): the home page's header, type and
 * footer, a readable column, and links between the policies. Text styles apply to plain p / ul / a.
 */
const LegalPage = ({ title, intro, children }) => {
  const { pathname } = useLocation();
  // Opening a policy from the footer starts at its top, not where the last page was scrolled to.
  useEffect(() => {
    // Instant, not the site-wide smooth scroll. Braces matter: newer browsers return a Promise here,
    // which React would otherwise treat as a cleanup function.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div className="font-landing text-zinc-950 antialiased">
      <Navbar />
      <main className="pt-16">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
          <header className="border-b border-zinc-200 pb-8">
            <p className="font-landing-mono text-xs uppercase tracking-[0.12em] text-zinc-500">VIDYADAAN</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-2 text-sm text-zinc-500">Last updated {LEGAL_UPDATED}</p>
            {intro && <div className="mt-5 text-[0.9375rem] leading-relaxed text-zinc-700">{intro}</div>}
          </header>

          <div className="[&_a]:font-medium [&_a]:text-zinc-950 [&_a]:underline [&_a]:underline-offset-2 [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 text-[0.9375rem] leading-relaxed text-zinc-700">
            {children}
          </div>

          <nav aria-label="Policies" className="mt-12 border-t border-zinc-200 pt-6">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {LEGAL_LINKS.map(({ label, to }) => (
                <li key={to}>
                  <Link to={to} aria-current={pathname === to ? "page" : undefined} className={pathname === to ? "font-semibold text-zinc-950" : "text-zinc-600 hover:text-zinc-950"}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
      <Footer />
    </div>
  );
};

/** A numbered or titled part of a policy. */
export const LegalSection = ({ title, children }) => (
  <section className="mt-10">
    <h2 className="text-lg font-semibold tracking-tight text-zinc-950">{title}</h2>
    {children}
  </section>
);

export default LegalPage;
