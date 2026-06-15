// Minimal CSV reader. No quoting/escaping support is needed for this dataset
// (no commas inside fields). Splits on newlines and commas, trims the header
// labels, and yields one plain object per data row keyed by the *header label*
// (not the canonical field name — that mapping happens in validate.mjs).

export function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    return { header: [], rows: [] };
  }

  const header = lines[0].split(',').map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const row = {};
    for (let c = 0; c < header.length; c++) {
      // Preserve the raw cell (may be undefined if the line has fewer cells).
      row[header[c]] = cells[c];
    }
    rows.push(row);
  }

  return { header, rows };
}
