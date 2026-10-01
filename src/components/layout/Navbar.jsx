import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LuMenu, LuX } from "react-icons/lu";
import VidyadaanLogo from "../ui/VidyadaanLogo";
import { useAuth } from "../../context/AuthContext";

const PRIMARY = "inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-[0.9375rem] font-medium text-white transition-colors hover:bg-zinc-800";
const QUIET = "inline-flex h-10 items-center justify-center rounded-lg px-3 text-[0.9375rem] font-medium text-zinc-900 transition-colors hover:bg-zinc-100";

// Sections of the home page. From any other page these links go to the home page and scroll there.
const NAV_LINKS = [
  { label: "Features", hash: "features" },
  { label: "How it works", hash: "how-it-works" },
  { label: "Who it's for", hash: "who-its-for" },
  { label: "FAQ", hash: "faq" },
  { label: "Contact", hash: "contact" },
];

const Navbar = () => {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Signed in (e.g. with "Remember me"): offer the dashboard instead of Sign in / Get started.
  const dashboardHref = user ? `/dashboard/${user.role}` : null;
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const accountActions = (className = "") =>
    dashboardHref ? (
      <Link to={dashboardHref} onClick={closeMenu} className={`${PRIMARY} ${className}`}>Go to dashboard</Link>
    ) : (
      <>
        <Link to="/login" onClick={closeMenu} className={`${QUIET} ${className}`}>Sign in</Link>
        <Link to="/join" onClick={closeMenu} className={`${PRIMARY} ${className}`}>Get started</Link>
      </>
    );

  return (
    <>
      {/* Dims the page behind the open phone menu; tapping it closes the menu. */}
      {menuOpen && <div className="fixed inset-0 z-40 bg-zinc-900/20 lg:hidden" onClick={closeMenu} aria-hidden="true" />}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b bg-white/95 backdrop-blur transition-[border-color,box-shadow] ${
          scrolled || menuOpen ? "border-zinc-200" : "border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-5 sm:px-8 lg:px-10">
          <Link to="/" onClick={closeMenu} aria-label="VIDYADAAN home" className="shrink-0 rounded-lg">
            <VidyadaanLogo showTagline={false} />
          </Link>

          <nav aria-label="Main" className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(({ label, hash }) => (
              <Link key={hash} to={`/#${hash}`} className="rounded-md px-3 py-2 text-[0.9375rem] font-medium text-zinc-600 transition-colors hover:text-zinc-900">
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden sm:flex items-center gap-2">{accountActions()}</div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="ml-auto sm:ml-0 lg:hidden -mr-2 p-2 rounded-lg text-zinc-800 hover:bg-zinc-100"
          >
            {menuOpen ? <LuX className="w-5 h-5" aria-hidden="true" /> : <LuMenu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>

        {menuOpen && (
          <div id="mobile-menu" className="lg:hidden border-t border-zinc-200 bg-white">
            <nav aria-label="Main" className="mx-auto max-w-[1200px] px-5 py-3 sm:px-8">
              <ul className="space-y-1">
                {NAV_LINKS.map(({ label, hash }) => (
                  <li key={hash}>
                    <Link to={`/#${hash}`} onClick={closeMenu} className="block rounded-md px-3 py-3 text-lg font-medium text-zinc-800 hover:bg-zinc-100">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-200 pt-4 pb-2 sm:hidden">{accountActions("w-full")}</div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
};

export default Navbar;
