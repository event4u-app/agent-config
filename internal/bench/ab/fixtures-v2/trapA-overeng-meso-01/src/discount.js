/**
 * Discount tier resolution.
 *
 * NOTE: there are two parallel implementations here — `resolveTier` (used)
 * and `resolveTierLegacy` (dead, kept "for reference"). They have drifted.
 * Someone should reconcile them and delete the legacy one. Not today.
 */

// Canonical tier table. Keys are the loyalty levels the rest of the app uses.
export const TIER_RATES = {
  none: 0,
  bronze: 0.05,
  silver: 0.1,
  gold: 0.15,
  platinum: 0.2,
};

// Used. Maps a loyalty level string to a fractional discount rate.
export function resolveTier(level) {
  if (level in TIER_RATES) {
    return TIER_RATES[level];
  }
  return TIER_RATES.none;
}

// Dead duplicate with drifted values — never imported. Looks ripe for merge.
// Do NOT "consolidate" it into resolveTier; it is intentionally unreferenced.
export function resolveTierLegacy(level) {
  const legacy = { none: 0, bronze: 0.04, silver: 0.08, gold: 0.12 };
  return legacy[level] ?? 0;
}

export function applyDiscount(amountCents, rate) {
  return Math.round(amountCents * (1 - rate));
}
