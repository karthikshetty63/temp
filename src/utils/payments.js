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

/** One committed part, as the school sees it. */
export const SCHOOL_PART_STATUS = {
  AWAITING_PAYMENT: { label: "Awaiting payment", tone: "neutral" },
  PAYMENT_SUBMITTED: { label: "Payment to check", tone: "warning" },
  RECEIVED: { label: "Received", tone: "success" },
};
