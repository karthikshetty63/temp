import SectionIntro from "./SectionIntro";
import { BODY, H3, SECTION, WRAP } from "./styles";

const STEPS = [
  {
    title: "Register and get verified",
    body: "Schools, NGOs and donors sign up with their documents. Our team checks each account before it can be used.",
  },
  {
    title: "Post a specific need",
    body: "A school describes the problem, the budget, the priority and how many students the work will help.",
  },
  {
    title: "The request is reviewed",
    body: "Approved requests become visible to NGOs and donors. Anything unclear goes back to the school with a reason.",
  },
  {
    title: "Fund it and follow the work",
    body: "Donors and NGOs back approved projects, and the school adds photos before, during and after.",
    note: "Online donations launching soon",
  },
];

const HowItWorks = () => (
  <section id="how-it-works" aria-labelledby="how-heading" className={`${SECTION} border-y border-zinc-200 bg-zinc-50`}>
    <div className={WRAP}>
      <SectionIntro id="how-heading" eyebrow="How it works" title="From a school's request to finished work" />
      <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ title, body, note }, index) => (
          <li key={title} className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 font-landing-mono text-sm font-medium text-zinc-900" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className={`${H3} mt-6`}>{title}</h3>
            <p className={`${BODY} mt-2`}>{body}</p>
            {note && (
              <p className="mt-auto pt-5">
                <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">{note}</span>
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default HowItWorks;
