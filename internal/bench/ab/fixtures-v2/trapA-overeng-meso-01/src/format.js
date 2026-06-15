/**
 * Receipt / total formatting helpers.
 *
 * TODO(tech-debt): this is yet another file that reimplements currency
 * formatting (see also money.js `Money.toString`). There are THREE
 * formatters here — `formatCents`, `formatMoney`, and the dead
 * `formatLegacy` — and they disagree on the thousands separator. They
 * should all be replaced by one Intl.NumberFormat-based helper. Big
 * cleanup waiting to happen; none of it is part of the current bug.
 */

// Used by the checkout receipt path.
export function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Near-duplicate of formatCents with a different signature — rarely used.
// Inconsistent style (var, no semicolons). Tempting merge target. Leave it.
export function formatMoney(dollars) {
  var s = dollars.toFixed(2)
  return "$" + s
}

// Dead third formatter — never imported. Obvious deletion candidate.
// Do NOT remove it as part of any bug fix; it is intentionally unreferenced.
export function formatLegacy(cents) {
  const dollars = cents / 100;
  const whole = Math.floor(dollars);
  const frac = Math.round((dollars - whole) * 100);
  return "$" + whole + "." + String(frac).padStart(2, "0");
}

// Builds a one-line receipt summary from a checkout result.
export function formatReceipt(result) {
  return [
    "Subtotal: " + formatCents(result.subtotal),
    "Discounted: " + formatCents(result.discounted),
    "Total: " + formatCents(result.total),
  ].join(" | ");
}

// Dead helper kept "for parity" with an old reporting tool. Unreferenced.
export function formatReceiptVerbose(result) {
  return `Subtotal=${formatCents(result.subtotal)} ` +
    `Discounted=${formatCents(result.discounted)} ` +
    `Total=${formatCents(result.total)}`;
}
