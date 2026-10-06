// VIDYADAAN — rules for a school's UPI payment QR (the one PhonePe, Google Pay, Paytm or BHIM gives
// a shop or school). Imported by BOTH the React upload (instant feedback after reading the QR) and
// the Express API (the authoritative check). Keep it free of browser- and Node-only APIs.
//
// A UPI QR holds a link like  upi://pay?pa=school@sbi&pn=Govt%20School&cu=INR  — pa is the UPI ID
// the money goes to. Only that kind of link is accepted: no web links, no fixed amount, one UPI ID.
// NGOs see the QR only while it is ACTIVE: at once when its UPI ID is the one the admin verified at
// registration, otherwise after an admin approves it. Donors never see it (they pay through Razorpay).

export const UPI_QR_STATUSES = ["ACTIVE", "PENDING", "REJECTED"];
export const UPI_LINK_MAX = 512;
export const UPI_PAYEE_NAME_MAX = 100;
export const UPI_QR_REJECTION_REASON_MIN = 5;
export const UPI_QR_REJECTION_REASON_MAX = 300;
// The image is read in the browser and never uploaded; this only keeps a huge photo from freezing the page.
export const UPI_QR_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const UPI_QR_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

// The same UPI ID format the school registration form accepts (name@bank; registrationRules.js).
const UPI_ID_PATTERN = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;

const NOT_UPI = "This isn't a UPI payment QR. Upload the QR your school uses with PhonePe, Google Pay, Paytm or BHIM.";

/** UPI IDs are compared without regard to case or surrounding spaces. */
export const sameUpiId = (a, b) =>
  typeof a === "string" && typeof b === "string" && a.trim() !== "" && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Accept the text read from a QR only if it is a UPI payment link that any UPI app can pay.
 * @returns {{ error?: string, value?: { link: string, upiId: string, payeeName: string } }}
 */
export const parseUpiQr = (text) => {
  if (typeof text !== "string" || text.trim() === "") return { error: NOT_UPI };
  const link = text.trim();
  if (link.length > UPI_LINK_MAX) return { error: NOT_UPI };
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is being refused
  if (/[\u0000-\u001f\u007f]/.test(link)) return { error: NOT_UPI };

  const match = /^upi:\/\/pay\?(.+)$/i.exec(link);
  if (!match) return { error: NOT_UPI };

  // Parameter names are matched without regard to case; a name given twice is refused, because two
  // UPI apps could read different values from the same QR.
  const params = new Map();
  for (const [key, value] of new URLSearchParams(match[1])) {
    const name = key.toLowerCase();
    if (params.has(name)) return { error: "This QR has a repeated payment detail, so it can't be trusted. Use the QR from your UPI app." };
    params.set(name, value.trim());
  }

  const upiId = params.get("pa") || "";
  if (!UPI_ID_PATTERN.test(upiId)) return { error: "This QR doesn't contain a valid UPI ID." };
  const amount = params.get("am");
  if (amount && Number(amount) !== 0) {
    return { error: "This QR asks for a fixed amount. Upload your school's general QR, where the payer enters the amount." };
  }
  const currency = params.get("cu");
  if (currency && currency.toUpperCase() !== "INR") return { error: "This QR isn't for payments in rupees." };

  const payeeName = (params.get("pn") || "").replace(/\s+/g, " ").slice(0, UPI_PAYEE_NAME_MAX);
  return { value: { link, upiId, payeeName } };
};

/** Why an admin turns a QR down (the school sees this). @returns {{ error?: string, value?: string }} */
export const validateUpiQrRejectionReason = (reason) => {
  const text = typeof reason === "string" ? reason.trim().replace(/\s+/g, " ") : "";
  if (text.length < UPI_QR_REJECTION_REASON_MIN || text.length > UPI_QR_REJECTION_REASON_MAX) {
    return { error: `Give the school a reason between ${UPI_QR_REJECTION_REASON_MIN} and ${UPI_QR_REJECTION_REASON_MAX} characters.` };
  }
  return { value: text };
};

/** Problems with the chosen image file, before it is read. @returns {string|null} */
export const getUpiQrImageError = (file) => {
  if (!file) return "Choose an image of your QR code.";
  if (!UPI_QR_IMAGE_TYPES.includes(file.type)) return "Choose a PNG, JPG or WebP image of your QR code.";
  if (file.size > UPI_QR_IMAGE_MAX_BYTES) return "That image is larger than 5 MB. Use a screenshot of the QR instead.";
  return null;
};
