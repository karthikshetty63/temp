import { Link } from "react-router-dom";
import VidyadaanLogo from "../ui/VidyadaanLogo";
import { CONTACT } from "../../constants/contact";
import { LEGAL_LINKS } from "../../constants/legal";

// Only links that lead somewhere real.
const COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Features", to: "/#features" },
      { label: "How it works", to: "/#how-it-works" },
      { label: "Who it's for", to: "/#who-its-for" },
      { label: "FAQ", to: "/#faq" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Register your school", to: "/join/school" },
      { label: "Register your NGO", to: "/join/ngo" },
      { label: "Create a donor account", to: "/join/donor" },
      { label: "Sign in", to: "/login" },
    ],
  },
];

const linkClass = "text-[0.9375rem] text-zinc-600 transition-colors hover:text-zinc-900";

const Footer = () => (
  <footer className="border-t border-zinc-200 bg-white">
    <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr] lg:px-10">
      <div className="max-w-xs">
        <VidyadaanLogo showTagline={false} />
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-zinc-600">
          Connecting government schools with verified NGOs and donors, one real need at a time.
        </p>
      </div>

      {COLUMNS.map(({ title, links }) => (
        <nav key={title} aria-label={title}>
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          <ul className="mt-4 space-y-3">
            {links.map(({ label, to }) => (
              <li key={label}><Link to={to} className={linkClass}>{label}</Link></li>
            ))}
          </ul>
        </nav>
      ))}

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Contact</h2>
        <ul className="mt-4 space-y-3">
          <li><a href={`mailto:${CONTACT.email}`} className={`${linkClass} break-words`}>{CONTACT.email}</a></li>
          <li><a href={`tel:${CONTACT.phone}`} className={linkClass}>{CONTACT.phoneDisplay}</a></li>
          <li className="text-[0.9375rem] text-zinc-600">{CONTACT.location}</li>
        </ul>
      </div>
    </div>

    <div className="border-t border-zinc-200">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 py-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p>© {new Date().getFullYear()} VIDYADAAN · Made for government schools in India</p>
        <nav aria-label="Policies">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map(({ label, to }) => (
              <li key={to}><Link to={to} className="transition-colors hover:text-zinc-900">{label}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  </footer>
);

export default Footer;
