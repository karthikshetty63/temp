import { LuMail, LuMapPin, LuPhone } from "react-icons/lu";
import LegalPage, { LegalSection } from "../../components/legal/LegalPage";
import { CONTACT } from "../../constants/contact";
import { OPERATOR } from "../../constants/legal";

const DETAILS = [
  { icon: LuMail, label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  { icon: LuPhone, label: "Phone", value: CONTACT.phoneDisplay, href: `tel:${CONTACT.phone}` },
  { icon: LuMapPin, label: "Address", value: CONTACT.location },
];

const Contact = () => (
  <LegalPage
    title="Contact Us"
    intro={<p>VIDYADAAN is run by {OPERATOR.name}, {OPERATOR.description}. Reach us by email or phone.</p>}
  >
    <dl className="mt-8 grid gap-4 sm:grid-cols-3">
      {DETAILS.map(({ icon: Icon, label, value, href }) => (
        <div key={label} className="rounded-xl border border-zinc-200 p-4">
          <dt className="flex items-center gap-2 text-sm text-zinc-500">
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </dt>
          <dd className="mt-1.5 break-words font-medium text-zinc-950">{href ? <a href={href}>{value}</a> : value}</dd>
        </div>
      ))}
    </dl>

    <LegalSection title="What to include">
      <ul>
        <li>Your registered email address, and whether you are a school, an NGO or a donor.</li>
        <li>For a payment or refund question, the Razorpay payment ID (it starts with &ldquo;pay_&rdquo;).</li>
        <li>For a school need, the need&rsquo;s title and the school&rsquo;s name.</li>
      </ul>
    </LegalSection>
  </LegalPage>
);

export default Contact;
