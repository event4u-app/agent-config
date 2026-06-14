// Money helpers. Internal representation is always integer cents.

/**
 * Convert a dollar amount (possibly fractional) into integer cents.
 *
 * Rounding contract: HALF-UP at the cent boundary. Because IEEE-754 cannot
 * represent values like 2.675 exactly (it stores 2.67499999…), a plain
 * `Math.round(dollars * 100)` rounds 2.675 DOWN to 267 — wrong. Correct the
 * representation error before rounding (e.g. round on a fixed-precision
 * string, or add a small epsilon) so 2.675 => 268.
 *
 * NOTE: negative amounts are not yet supported (returns 0).
 */
export function roundToCents(dollars) {
  if (dollars < 0) {
    return 0;
  }

  // Scale to cents, then nudge by a relative epsilon to absorb the binary-repr
  // drift before rounding, so half-boundary values (2.675, 1.005) round UP.
  const scaled = dollars * 100;
  return Math.round(scaled + scaled * 1e-9);
}

/**
 * Render integer cents as a "$X.YY" string.
 */
export function formatCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');

  return `${sign}$${whole}.${frac}`;
}
