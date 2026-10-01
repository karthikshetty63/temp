/** 125000 → "₹1,25,000" */
export const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/** "2026-09-30" or a full ISO timestamp → "30 Sept 2026" (the calendar date, in UTC). */
export const formatDate = (iso) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "+919845012345" → "+91 98450 12345" */
export const formatPhone = (phone) => (/^\+91\d{10}$/.test(phone) ? `+91 ${phone.slice(3, 8)} ${phone.slice(8)}` : phone);

/** "Part 3", "Parts 1 and 2", "Parts 1, 2 and 4" */
export const partsLabel = (numbers) => {
  if (numbers.length === 1) return `Part ${numbers[0]}`;
  return `Parts ${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
};

/** Some parts of `total`: "Parts 1 and 2 of 5"; all of them: "All 5 parts". */
export const partsOf = (numbers, total) => (numbers.length === total ? `All ${total} parts` : `${partsLabel(numbers)} of ${total}`);
