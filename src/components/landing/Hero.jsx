import { Link } from "react-router-dom";
import { LuArrowRight } from "react-icons/lu";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, H1, LEAD, WRAP } from "./styles";

// The promise, what actually happens, and the two ways in. No stock photos or invented numbers.
const Hero = () => (
  <section aria-labelledby="hero-heading" className="relative overflow-hidden bg-white">
    {/* A faint grid that fades out towards the bottom. */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#f1f1f3_1px,transparent_1px),linear-gradient(to_bottom,#f1f1f3_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
    />
    <div className={`${WRAP} relative pb-12 pt-20 text-center sm:pb-16 sm:pt-28`}>
      <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 font-landing-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-zinc-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        For government schools in India
      </p>
      <h1 id="hero-heading" className={`${H1} mx-auto mt-7 max-w-[17ch]`}>
        Real needs from government schools, verified by real people.
      </h1>
      <p className={`${LEAD} mx-auto mt-6 max-w-2xl`}>
        Schools ask for what their students need, like a girls&rsquo; toilet, a library or a computer lab. Our team checks every
        school and every request before NGOs and donors see it.
      </p>
      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/join/school" className={BUTTON_PRIMARY}>
          Register your school <LuArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <Link to="/join" className={BUTTON_SECONDARY}>Join as an NGO or donor</Link>
      </div>
    </div>
  </section>
);

export default Hero;
