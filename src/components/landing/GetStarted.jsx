import { Link } from "react-router-dom";
import { LuArrowRight, LuMail, LuMapPin, LuPhone } from "react-icons/lu";
import { CONTACT } from "../../constants/contact";
import { SECTION, WRAP } from "./styles";

const CHANNELS = [
  { icon: LuMail, label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  { icon: LuPhone, label: "Phone", value: CONTACT.phoneDisplay, href: `tel:${CONTACT.phone}` },
  { icon: LuMapPin, label: "Based at", value: CONTACT.location },
];

const GetStarted = () => (
  <section id="contact" aria-labelledby="get-started-heading" className={`${SECTION} bg-white`}>
    <div className={WRAP}>
      <div className="relative grid gap-12 overflow-hidden rounded-3xl bg-zinc-950 px-6 py-12 text-white sm:px-10 sm:py-14 lg:grid-cols-[1.25fr_1fr] lg:gap-16 lg:px-14 lg:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_80%_80%_at_0%_0%,black,transparent)]"
        />
        <div className="relative">
          <h2 id="get-started-heading" className="font-landing text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[2.625rem]">
            Start with one real need.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-zinc-400 sm:text-[1.0625rem]">
            Registering takes a few minutes. Our team reviews every application, and you can sign in as soon as yours is approved.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/join/school"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-[0.9375rem] font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              Register your school <LuArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              to="/join"
              className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-[0.9375rem] font-medium text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/10"
            >
              Join as an NGO or donor
            </Link>
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-[0.9375rem] font-semibold">Talk to us</p>
          <p className="mt-1 text-sm text-zinc-400">Questions about joining, or want to partner with us?</p>
          <ul className="mt-6 space-y-4">
            {CHANNELS.map(({ icon: Icon, label, value, href }) => (
              <li key={label} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10" aria-hidden="true">
                  <Icon className="w-4 h-4 text-zinc-300" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">{label}</p>
                  {href ? (
                    <a href={href} className="break-words text-[0.9375rem] font-medium text-white hover:underline">{value}</a>
                  ) : (
                    <p className="text-[0.9375rem] font-medium text-white">{value}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

export default GetStarted;
