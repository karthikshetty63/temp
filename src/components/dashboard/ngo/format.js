import { partsLabel } from "../../../utils/format";

export { formatDate, formatINR, formatPhone, partsLabel, partsOf } from "../../../utils/format";

/** "Davangere, Karnataka" */
export const schoolPlace = (school) => [school.district, school.state].filter(Boolean).join(", ");

export const sumAmounts = (parts) => parts.reduce((sum, p) => sum + p.amount, 0);
export const freeParts = (need) => need.parts.filter((p) => !p.takenBy);
export const myParts = (need) => need.parts.filter((p) => p.takenBy === "you");

/** The NGO's share of a need in a sentence: "parts 1 and 2", or "the full amount". */
export const myShare = (need) => {
  const mine = myParts(need);
  return mine.length === need.parts.length ? "the full amount" : partsLabel(mine.map((p) => p.part)).toLowerCase();
};

/** A need's parts as the NGO sees them, for FundingPartsBar. */
export const ngoSegments = (need) =>
  need.parts.map((p) => ({
    part: p.part,
    tone: p.takenBy === "you" ? (p.receivedAt ? "success" : "accent") : p.takenBy === "other" ? "muted" : "free",
  }));
export const NGO_PART_LABELS = { accent: "yours", success: "yours, received", muted: "taken by others", free: "free" };

/** Where the NGO's money for one need stands (`mine`: its parts of that need). */
export const fundingStatus = (mine) => {
  const count = (status) => mine.filter((p) => p.status === status).length;
  const received = count("RECEIVED");
  const submitted = count("PAYMENT_SUBMITTED");
  if (received === mine.length) return { label: "Received", tone: "success" };
  if (received + submitted === mine.length) return { label: "Waiting for school", tone: "info" };
  if (received + submitted > 0) return { label: "Partly paid", tone: "warning" };
  return { label: "Awaiting payment", tone: "warning" };
};

/** The NGO's parts of a need that it still has to pay for. */
export const unpaidParts = (need) => myParts(need).filter((p) => p.status === "AWAITING_PAYMENT");
