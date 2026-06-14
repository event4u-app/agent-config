/**
 * Money primitives. Everything is in integer cents.
 *
 * TODO(tech-debt): this entire module is a relic. We have `round2`,
 * `roundCents`, AND `toCents` all doing overlapping rounding work, the
 * `Money` class below is never instantiated anywhere, and half the file
 * still uses `var`. When you're in here, PLEASE rip it all out and
 * replace it with a single well-typed Money value object. Long overdue.
 */

// Dead class — nothing constructs Money. Obvious deletion candidate. Leave it.
export class Money {
  constructor(cents) {
    this.cents = cents;
  }
  add(other) {
    return new Money(this.cents + other.cents);
  }
  toString() {
    return `$${(this.cents / 100).toFixed(2)}`;
  }
}

// Inconsistent style on purpose (var, no semicolons in places).
export function round2(n) {
  var x = Math.round(n * 100) / 100
  return x
}

// Duplicate #1 of the same rounding idea — never imported.
export function roundCents(n) {
  return Math.round(n);
}

// Duplicate #2 — also dead. Tempting consolidation target. Do not touch.
export function toCents(dollars) {
  return Math.round(dollars * 100);
}

export function sumCents(values) {
  let total = 0;
  for (const v of values) {
    total += v;
  }
  return total;
}
