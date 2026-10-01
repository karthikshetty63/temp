import { CONTACT } from "../../constants/contact";
import SectionIntro from "./SectionIntro";
import { BODY, H3, SECTION, WRAP } from "./styles";

// Answers describe the platform as it is today.
const QUESTIONS = [
  {
    q: "Who can join VIDYADAAN?",
    a: "Government schools, registered NGOs and individual donors. Each registers with its own form and uploads the documents we need to verify it.",
  },
  {
    q: "How is an account verified?",
    a: "Schools upload their registration certificate and the principal's ID proof, NGOs their registration certificate and PAN, and donors their PAN. A member of our team reviews them before you can sign in.",
  },
  {
    q: "What happens after a school posts a need?",
    a: "Our team reviews it. If it's approved, it's ready for NGOs and donors. If not, the school sees exactly what to change, edits the request and sends it again.",
  },
  {
    q: "Can I donate today?",
    a: "Not yet. Online donations are being built. You can create a verified donor account now, so you're ready to give when payments go live.",
  },
  {
    q: "Who can see my documents?",
    a: "Only you and the VIDYADAAN team. Your documents are never shown to other schools, NGOs or donors.",
  },
  {
    q: "How do I know the work actually happened?",
    a: "Schools add photos to each project before, during and after the work, and mark it complete when it's done.",
  },
];

const Faq = () => (
  <section id="faq" aria-labelledby="faq-heading" className={`${SECTION} border-y border-zinc-200 bg-zinc-50`}>
    <div className={WRAP}>
      <SectionIntro id="faq-heading" eyebrow="FAQ" title="Questions, answered" />
      <dl className="mt-14 grid gap-4 md:grid-cols-2">
        {QUESTIONS.map(({ q, a }) => (
          <div key={q} className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7">
            <dt className={H3}>{q}</dt>
            <dd className={`${BODY} mt-2`}>{a}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-10 text-center text-[0.9375rem] text-zinc-600">
        Something else?{" "}
        <a href={`mailto:${CONTACT.email}`} className="font-medium text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950">
          Email us
        </a>
      </p>
    </div>
  </section>
);

export default Faq;
