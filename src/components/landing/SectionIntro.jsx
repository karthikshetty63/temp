import { BODY, EYEBROW, H2 } from "./styles";

/** A section's label, heading and one-line intro, centred above its grid. */
const SectionIntro = ({ id, eyebrow, title, description }) => (
  <div className="mx-auto max-w-2xl text-center">
    <p className={EYEBROW}>{eyebrow}</p>
    <h2 id={id} className={`${H2} mt-4`}>{title}</h2>
    {description && <p className={`${BODY} mx-auto mt-4 max-w-xl text-base sm:text-[1.0625rem]`}>{description}</p>}
  </div>
);

export default SectionIntro;
