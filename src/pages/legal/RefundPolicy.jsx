import { Link } from "react-router-dom";
import LegalPage, { LegalSection } from "../../components/legal/LegalPage";
import { CONTACT } from "../../constants/contact";
import { OPERATOR, REFUND_WINDOW_DAYS } from "../../constants/legal";

const RefundPolicy = () => (
  <LegalPage
    title="Cancellation & Refund Policy"
    intro={
      <p>
        This policy covers payments made online on VIDYADAAN through Razorpay: donations by donors, and NGOs&rsquo; online payments for the
        parts of a need they committed to. These payments are received by {OPERATOR.name} for VIDYADAAN. Donations and NGO funding are
        voluntary, so a confirmed payment is refunded only when something went wrong, as described below.
      </p>
    }
  >
    <LegalSection title="1. Cancelling a payment">
      <p>
        You can cancel at any time before paying by closing the Razorpay payment window. Nothing is charged. Once a payment is confirmed,
        it cannot be cancelled, but it can be refunded in the cases below.
      </p>
    </LegalSection>

    <LegalSection title={`2. When we refund (request within ${REFUND_WINDOW_DAYS} days)`}>
      <ul>
        <li>You were charged more than once for the same payment (a duplicate payment).</li>
        <li>You were charged an amount different from the one shown before you paid.</li>
        <li>Money left your account but VIDYADAAN never confirmed the payment.</li>
      </ul>
      <p>Ask within {REFUND_WINDOW_DAYS} days of the payment. Payments made for any other reason are not refunded.</p>
      <p>
        One case is refunded without being asked: if an NGO pays parts online that had already been paid another way, VIDYADAAN records the
        payment as &ldquo;refund due&rdquo;, does not count it, and refunds it.
      </p>
    </LegalSection>

    <LegalSection title="3. How to ask for a refund">
      <p>Email <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> from your registered email address, with:</p>
      <ul>
        <li>the Razorpay payment ID (it starts with &ldquo;pay_&rdquo; and is shown on your payment confirmation);</li>
        <li>the amount and date of the payment;</li>
        <li>what went wrong.</li>
      </ul>
    </LegalSection>

    <LegalSection title="4. What happens next">
      <p>
        We check the payment with Razorpay and reply by email. An approved refund is sent back to the original payment method (the same
        card, UPI account or bank account), in full. Banks usually take 5–7 working days to show it after we issue it.
      </p>
    </LegalSection>

    <LegalSection title="5. Payments made directly to a school">
      <p>
        When an NGO pays a school directly, VIDYADAAN does not receive the money and cannot refund it. If the school did not receive it, the
        school rejects the payment in VIDYADAAN with a reason, and the NGO follows up with its bank and the school.
      </p>
    </LegalSection>

    <LegalSection title="6. Test mode">
      <p>A payment made in Razorpay test mode charges no real money, so there is nothing to refund. Its confirmation says it was a test.</p>
    </LegalSection>

    <LegalSection title="7. Contact">
      <p>
        Refund questions: <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> or {CONTACT.phoneDisplay}. See also our{" "}
        <Link to="/terms">Terms of Service</Link>.
      </p>
    </LegalSection>
  </LegalPage>
);

export default RefundPolicy;
