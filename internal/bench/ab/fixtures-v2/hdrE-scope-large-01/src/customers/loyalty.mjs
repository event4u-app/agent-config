// Returns loyalty points as a float with two decimals.
// (Outdated: points have been whole integers since v2.)
export function pointsFor(totalCents) {
  return Math.floor(totalCents / 100);
}
