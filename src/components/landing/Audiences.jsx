import { Link } from "react-router-dom";
import { LuArrowRight, LuCheck, LuHandHeart, LuHeartHandshake, LuSchool } from "react-icons/lu";
import SectionIntro from "./SectionIntro";
import { SECTION, WRAP } from "./styles";

// `soon: true` marks what isn't available yet, so the page never promises more than the product does.
// Schools come first and are highlighted: they are who the platform exists for.
const AUDIENCES = [
  {
    icon: LuSchool,
    title: "Schools",
    summary: "Ask for exactly what your students need, and show the work as it happens.",
    points: [
      { text: "Post projects with a budget, priority and the students they help" },
      { text: "See every review decision, with the reason if changes are needed" },
      { text: "Add photos before, during and after the work" },
      { text: "Download a report of all your projects" },
    ],
    cta: { label: "Register your school", to: "/join/school" },
    featured: true,
  },
  {
    icon: LuHeartHandshake,
    title: "NGOs",
    summary: "Work only with schools and requests that have already been checked.",
    points: [
      { text: "Register with your registration certificate and PAN" },
      { text: "Only verified schools and approved requests are shown" },
      { text: "Take on approved projects and verify progress", soon: true },
    ],
    cta: { label: "Register your NGO", to: "/join/ngo" },
  },
  {
    icon: LuHandHeart,
    title: "Donors",
    summary: "Give to a specific, verified need instead of a general fund.",
    points: [
      { text: "Create a verified donor account with your PAN" },
      { text: "Browse approved projects and give online", soon: true },
      { text: "Follow the work through the school's photos", soon: true },
    ],
    cta: { label: "Create a donor account", to: "/join/donor" },
  },
];

const Audiences = () => (
  <section id="who-its-for" aria-labelledby="audiences-heading" className={`${SECTION} bg-white`}>
    <div className={WRAP}>
      <SectionIntro
        id="audiences-heading"
        eyebrow="Who it's for"
        title="One platform, three ways to take part"
        description="Each has its own account and dashboard, and each is verified before it can take part."
      />

      <div className="mt-14 grid gap-4 lg:grid-cols-3">
        {AUDIENCES.map(({ icon: Icon, title, summary, points, cta, featured }) => (
          <article
            key={title}
            className={`flex flex-col rounded-2xl border p-7 ${featured ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-zinc-50/70"}`}
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${featured ? "bg-white/10 text-white" : "border border-zinc-200 bg-white text-zinc-900"}`}
              aria-hidden="true"
            >
              <Icon className="w-5 h-5" />
            </span>
            <h3 className={`mt-6 font-landing text-xl font-semibold tracking-[-0.02em] ${featured ? "text-white" : "text-zinc-950"}`}>{title}</h3>
            <p className={`mt-2 text-[0.9375rem] leading-relaxed ${featured ? "text-zinc-300" : "text-zinc-600"}`}>{summary}</p>

            <ul className={`mt-6 space-y-3 border-t pt-6 ${featured ? "border-white/10" : "border-zinc-200"}`}>
              {points.map(({ text, soon }) => (
                <li key={text} className={`flex gap-3 text-[0.9375rem] leading-snug ${featured ? "text-zinc-200" : "text-zinc-700"}`}>
                  <LuCheck
                    className={`mt-0.5 w-4 h-4 shrink-0 ${soon ? (featured ? "text-zinc-600" : "text-zinc-300") : featured ? "text-emerald-400" : "text-emerald-600"}`}
                    aria-hidden="true"
                  />
                  <span>
                    {text}
                    {soon && (
                      <span className="ml-2 inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2 py-px align-middle text-[0.6875rem] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                        Coming soon
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              to={cta.to}
              className={`mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-[0.9375rem] font-medium transition-colors lg:mt-auto ${
                featured ? "bg-white text-zinc-950 hover:bg-zinc-100" : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {cta.label} <LuArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Audiences;
