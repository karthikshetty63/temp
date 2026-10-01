/**
 * Commitments an NGO made in one go (same NGO, project and moment) as one entry, e.g. "parts 1 and 2".
 * Keeps the newest-first order of the list from the server.
 */
export const groupCommitments = (commitments) => {
  const groups = new Map();
  for (const c of commitments) {
    const key = `${c.projectId}|${c.ngo.name}|${c.committedAt}`;
    const group =
      groups.get(key) ||
      { key, projectId: c.projectId, projectTitle: c.projectTitle, ngo: c.ngo, committedAt: c.committedAt, parts: [], amount: 0, received: 0, toCheck: 0 };
    group.parts.push(c.part);
    group.amount += c.amount;
    if (c.status === "RECEIVED") group.received += 1;
    if (c.status === "PAYMENT_SUBMITTED") group.toCheck += 1;
    groups.set(key, group);
  }
  return [...groups.values()].map((g) => ({ ...g, parts: g.parts.sort((a, b) => a - b) }));
};

/** Where the money for a group of parts stands, in the school's words. */
export const groupStatus = (g) => {
  if (g.received === g.parts.length) return "Received";
  if (g.toCheck > 0) return "Payment to check";
  if (g.received > 0) return "Partly received";
  return "Awaiting payment";
};

export const SCHOOL_PART_LABELS = { accent: "not received yet", success: "received", free: "free" };
