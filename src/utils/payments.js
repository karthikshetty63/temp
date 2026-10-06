// How payment and part states read to each side (the NGO paid; the school checks and accepts).

/** A recorded payment, as the NGO that made it sees it. */
export const NGO_PAYMENT_STATUS = {
  SUBMITTED: { label: "Waiting for school", tone: "info" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

/** A recorded payment, as the school that must check it sees it. */
export const SCHOOL_PAYMENT_STATUS = {
  SUBMITTED: { label: "To check", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

/** An online (Razorpay) payment: it counts as soon as Razorpay confirms it, so there is nothing to check. */
const ONLINE_PAYMENT_STATUS = {
  ACCEPTED: { label: "Paid online", tone: "success" },
  REFUND_DUE: { label: "Refund due", tone: "warning" },
};

/** The badge for a payment, from one of the maps above (online payments read the same to both sides). */
export const paymentBadge = (pay, map) => (pay.channel === "ONLINE" && ONLINE_PAYMENT_STATUS[pay.status]) || map[pay.status];

/** One committed part, as the school sees it. */
export const SCHOOL_PART_STATUS = {
  AWAITING_PAYMENT: { label: "Awaiting payment", tone: "neutral" },
  PAYMENT_SUBMITTED: { label: "Payment to check", tone: "warning" },
  RECEIVED: { label: "Received", tone: "success" },
};
