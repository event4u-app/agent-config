// Integer apportionment for the billing/seat-allocation layer.

/**
 * Distribute an integer `total` across buckets in proportion to `weights`
 * (non-negative numbers) using the largest-remainder (Hamilton) method, so
 * that the returned integers sum EXACTLY to `total`.
 *
 * Each bucket gets floor(total * weight / sumWeights); the leftover units
 * (total minus the sum of the floors) are handed out one-by-one to the
 * buckets with the largest fractional remainder. On a remainder tie the
 * lower index wins (stable).
 *
 * Example:
 *   apportion(100, [1, 1, 1]) -> [34, 33, 33]   // first bucket gets the +1
 *   apportion(10,  [0, 0, 0]) -> [0, 0, 0]       // no weight -> all zero
 */
export function apportion(total, weights) {
  const sumWeights = weights.reduce((acc, w) => acc + w, 0);
  if (sumWeights === 0) {
    return weights.map(() => 0);
  }

  const exact = weights.map((w) => (total * w) / sumWeights);
  const base = exact.map((q) => Math.floor(q));

  let allocated = base.reduce((acc, n) => acc + n, 0);
  let leftover = total - allocated;

  // Buckets ranked by fractional remainder; the largest remainders should be
  // first in line for a leftover unit, lower index breaking ties.
  const order = weights.map((_, i) => i).sort((a, b) => {
    const ra = exact[a] - base[a];
    const rb = exact[b] - base[b];
    if (ra === rb) {
      return a - b;
    }
    return ra - rb;
  });

  const result = base.slice();
  for (let k = 0; k < leftover; k++) {
    result[order[k]] += 1;
  }

  return result;
}
