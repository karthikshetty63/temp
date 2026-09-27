// Build and download CSV files in the browser.

// A cell starting with = + - @ (or a tab/return) could run as a formula when the file is opened in
// Excel or Sheets, so such text cells get a leading apostrophe. Numbers are left as numbers.
const safeCell = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

/** rows: array of arrays (the first is the header). */
export const toCsv = (rows) => rows.map((row) => row.map(safeCell).join(",")).join("\r\n");

/** Save `rows` as a .csv file. The BOM makes Excel read it as UTF-8. */
export const downloadCsv = (filename, rows) => {
  const blob = new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
