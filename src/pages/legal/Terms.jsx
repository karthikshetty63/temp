import { Link } from "react-router-dom";
import LegalPage, { LegalSection } from "../../components/legal/LegalPage";
import { DONATION_MAX, DONATION_MIN } from "../../api/donations";
import { CONTACT } from "../../constants/contact";
import { OPERATOR } from "../../constants/legal";
import { formatINR } from "../../utils/format";

const Terms = () => (
  <LegalPage
    title="Terms of Service"
    intro={
      <p>
        These terms apply to everyone who uses VIDYADAAN: its website and its school, NGO, donor and admin portals. VIDYADAAN is run by{" "}
        {OPERATOR.name}, {OPERATOR.description}, at {CONTACT.location}. In these terms, &ldquo;VIDYADAAN&rdquo;, &ldquo;we&rdquo; and
        &ldquo;us&rdquo; mean {OPERATOR.name} running VIDYADAAN. By creating an account or making a donation, you agree to these terms.
      </p>
    }
  >
    <LegalSection title="1. What VIDYADAAN does">
      <p>
        VIDYADAAN connects government schools in India with NGOs and donors. Schools list their infrastructure needs, such as classrooms,
        toilets or drinking water. The VIDYADAAN team reviews each need before NGOs and donors can see it. NGOs can fund parts of a need;
        donors can donate online.
      </p>
      <p>
        VIDYADAAN is free to use. It charges schools, NGOs and donors no fee, and no fee is deducted from the money a school receives.
      </p>
    </LegalSection>

    <LegalSection title="2. Accounts and verification">
      <ul>
        <li>Give true and complete information and documents when you register. The VIDYADAAN team checks every school, NGO and donor account before it can sign in.</li>
        <li>Keep your password safe. You are responsible for what happens in your account.</li>
        <li>We may refuse, suspend or close an account that gives false information or misuses VIDYADAAN.</li>
      </ul>
    </LegalSection>

    <LegalSection title="3. School needs">
      <ul>
        <li>A school is responsible for making sure its needs, figures and updates are true, and for using money only for the need it was given for.</li>
        <li>We review needs before listing them, but we cannot check every statement a school makes.</li>
        <li>We may remove a need that is inaccurate or breaks these terms.</li>
      </ul>
    </LegalSection>

    <LegalSection title="4. Donations by donors">
      <ul>
        <li>
          Donations are paid online through Razorpay, by UPI, card, net banking or the other methods Razorpay offers. Razorpay handles the
          payment; VIDYADAAN never sees or stores your card, UPI or bank login details.
        </li>
        <li>
          A single donation can be from {formatINR(DONATION_MIN)} to {formatINR(DONATION_MAX)}, in whole rupees (INR). A need accepts
          donations only up to the amount still open to donors.
        </li>
        <li>A donation is confirmed only after we have verified the payment with Razorpay. Only then is it counted towards the need.</li>
        <li>
          Donations are received by {OPERATOR.name} for VIDYADAAN through Razorpay. VIDYADAAN then transfers the full amount of the
          donations made to a need to the bank account of that school, which the VIDYADAAN team verified when the school registered.
        </li>
        <li>
          VIDYADAAN is not a registered charity. Donations are not eligible for an income-tax deduction under section 80G, and we do not
          issue tax-exemption receipts. The confirmation shown after a donation, with its Razorpay payment ID and time, is your record of it.
        </li>
        <li>Donations are voluntary. Refunds are covered by our <Link to="/refund-policy">Refund Policy</Link>.</li>
        <li>While we test the service, payments may run in Razorpay test mode. No real money is charged in test mode, and the confirmation says so.</li>
      </ul>
    </LegalSection>

    <LegalSection title="5. Funding by NGOs">
      <p>An NGO commits to fund parts of a need, then pays for them in one of two ways:</p>
      <ul>
        <li>
          <span className="font-medium text-zinc-950">Online, through Razorpay.</span> The payment is received by {OPERATOR.name} for
          VIDYADAAN. The parts count as paid as soon as we have verified the payment with Razorpay, and VIDYADAAN transfers the full amount
          to the school&rsquo;s verified bank account. If the parts turn out to have been paid another way already, we refund the online payment.
        </li>
        <li>
          <span className="font-medium text-zinc-950">Directly to the school,</span> by bank transfer, UPI or another method, recorded in
          VIDYADAAN with its proof. The school confirms whether the money reached its account. VIDYADAAN does not receive or hold these
          payments and is not a party to them.
        </li>
      </ul>
      <p>
        A school&rsquo;s bank account, IFSC, UPI ID and UPI QR are shown only to NGOs that have committed to one of its needs, and only to
        pay that school. A UPI QR whose UPI ID differs from the one verified at registration is shown only after the VIDYADAAN team
        approves it.
      </p>
    </LegalSection>

    <LegalSection title="6. Acceptable use">
      <p>Do not:</p>
      <ul>
        <li>give false information or documents, or pretend to be someone else;</li>
        <li>use another school&rsquo;s or person&rsquo;s details for anything other than the purpose VIDYADAAN shows them for;</li>
        <li>upload harmful files, or try to break, overload or get around the security of VIDYADAAN.</li>
      </ul>
    </LegalSection>

    <LegalSection title="7. What you upload">
      <p>
        You keep ownership of the documents, photos and text you upload. You allow us to store them and show them to the people VIDYADAAN
        shows them to, only to run the service. Schools must have permission before uploading photos in which students can be identified.
      </p>
    </LegalSection>

    <LegalSection title="8. Delivery of the service">
      <p>
        VIDYADAAN is an online service. Nothing is shipped. A donation&rsquo;s confirmation is shown on screen as soon as the payment has been
        verified.
      </p>
    </LegalSection>

    <LegalSection title="9. Limits of our responsibility">
      <p>
        We work to keep VIDYADAAN accurate and available, but it is provided as it is. To the extent the law allows, we are not
        responsible for indirect losses, for interruptions outside our control, or for statements by schools and NGOs that we could not
        reasonably check.
      </p>
    </LegalSection>

    <LegalSection title="10. Changes to these terms">
      <p>We may update these terms. The date at the top shows the latest version. If a change is significant, we will say so on the website.</p>
    </LegalSection>

    <LegalSection title="11. Law">
      <p>These terms are governed by the laws of India, and the courts of Karnataka have jurisdiction.</p>
    </LegalSection>

    <LegalSection title="12. Contact">
      <p>
        Questions about these terms: <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> or {CONTACT.phoneDisplay}. See also our{" "}
        <Link to="/contact">Contact page</Link>.
      </p>
    </LegalSection>
  </LegalPage>
);

export default Terms;
