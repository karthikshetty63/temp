import { Link } from "react-router-dom";
import LegalPage, { LegalSection } from "../../components/legal/LegalPage";
import { CONTACT } from "../../constants/contact";
import { OPERATOR } from "../../constants/legal";

const Privacy = () => (
  <LegalPage
    title="Privacy Policy"
    intro={
      <p>
        This policy explains what personal information VIDYADAAN collects, why, who can see it and what you can ask us to do with it.
        VIDYADAAN is run by {OPERATOR.name}, {OPERATOR.description}, at {CONTACT.location}, who is responsible for this information.
      </p>
    }
  >
    <LegalSection title="1. What we collect">
      <p><span className="font-medium text-zinc-950">Every account:</span> name, email address, phone number and password. Your password is stored only as a one-way hash (bcrypt), so no one can read it. If you sign in with Google, we receive your name and email address from Google.</p>
      <p><span className="font-medium text-zinc-950">Donors:</span> address, city, state and PIN code; date of birth if you give it; your donation preferences; and a copy of your PAN card for verification.</p>
      <p>
        <span className="font-medium text-zinc-950">Schools:</span> the school&rsquo;s name, UDISE code, address, district and state; the principal&rsquo;s
        name and contact details; student and teacher numbers and facilities; bank account number, IFSC, UPI ID and UPI payment QR; a school
        photo; the registration certificate and the principal&rsquo;s ID proof; and the needs, progress updates and photos the school adds.
      </p>
      <p>
        <span className="font-medium text-zinc-950">NGOs:</span> the organisation&rsquo;s name, type, year, website, mission, focus areas,
        registration number and date, PAN and address; the contact person&rsquo;s details; registration documents; funding commitments,
        payments made directly to schools with their proofs; and the details of volunteers the NGO adds.
      </p>
      <p>
        <span className="font-medium text-zinc-950">Online payments (donations, and NGO payments made through Razorpay):</span> the amount,
        the need, the parts paid for, the time, and the Razorpay order and payment IDs. Razorpay collects your payment details in its own
        checkout. We never receive or store card numbers, CVV, UPI PIN or bank login details.
      </p>
    </LegalSection>

    <LegalSection title="2. Why we use it">
      <ul>
        <li>To verify accounts before they can sign in.</li>
        <li>To run VIDYADAAN: listing needs, recording NGO funding, online payments and donations, and showing how much each need has raised.</li>
        <li>To show a school&rsquo;s payment details to the NGOs that pay it.</li>
        <li>To send you emails you ask for, such as password reset links.</li>
        <li>To keep VIDYADAAN secure and to meet legal requirements.</li>
      </ul>
      <p>We do not sell your information, show advertising or use analytics or tracking tools.</p>
    </LegalSection>

    <LegalSection title="3. Who can see it">
      <ul>
        <li>Registration documents (PAN card, certificates, ID proof) are private: only you and VIDYADAAN administrators can open them.</li>
        <li>Signed-in NGOs and donors see approved needs. Donors see only a need&rsquo;s title, category, priority, status, budget, amount raised, and the school&rsquo;s name, district and state.</li>
        <li>A school&rsquo;s bank details, UPI ID and UPI QR are shown only to NGOs that have committed to one of its needs, and to administrators. Donors never see them.</li>
        <li>An NGO&rsquo;s payment proof is seen only by that NGO, the school it paid and administrators. A school sees the NGO payments made for its needs, online or direct.</li>
      </ul>
    </LegalSection>

    <LegalSection title="4. Services we use">
      <p>These companies process information for us, only to provide their service:</p>
      <ul>
        <li>Razorpay, for online payments;</li>
        <li>Google, if you choose to sign in with Google;</li>
        <li>MongoDB Atlas, where our database is hosted;</li>
        <li>our email provider, to send emails such as password reset links.</li>
      </ul>
    </LegalSection>

    <LegalSection title="5. Cookies">
      <p>
        VIDYADAAN uses one cookie, which keeps you signed in. It cannot be read by scripts on the page, and it lasts longer only if you
        choose &ldquo;Remember me&rdquo;. We use no advertising or analytics cookies.
      </p>
    </LegalSection>

    <LegalSection title="6. Security and how long we keep information">
      <p>
        Passwords are hashed, uploaded files are private and are served only to the people allowed to see them, and payments are handled
        in Razorpay&rsquo;s own checkout. We keep your information while your account is active. Records of payments and donations are kept for
        as long as the law requires.
      </p>
    </LegalSection>

    <LegalSection title="7. Your choices">
      <ul>
        <li>Schools can update their editable profile details in their dashboard. To correct anything else, email us.</li>
        <li>You can ask for a copy of your information, or ask us to delete your account. We will delete it, except for records we must keep by law.</li>
      </ul>
      <p>Send these requests from your registered email address to <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.</p>
    </LegalSection>

    <LegalSection title="8. Changes to this policy">
      <p>We may update this policy. The date at the top shows the latest version.</p>
    </LegalSection>

    <LegalSection title="9. Contact">
      <p>
        Privacy questions: <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> or {CONTACT.phoneDisplay}. See also our{" "}
        <Link to="/contact">Contact page</Link>.
      </p>
    </LegalSection>
  </LegalPage>
);

export default Privacy;
