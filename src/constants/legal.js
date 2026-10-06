// Facts the policy pages state. Razorpay compares them with the account's KYC, so keep them true:
// the operator is the individual whose Razorpay account receives donations.
export const OPERATOR = {
  name: "Karthik Shetty",
  description: "an individual",
};

export const LEGAL_UPDATED = "6 October 2026";
export const REFUND_WINDOW_DAYS = 7;

export const LEGAL_LINKS = [
  { label: "Terms of Service", to: "/terms" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Refund Policy", to: "/refund-policy" },
  { label: "Contact Us", to: "/contact" },
];
