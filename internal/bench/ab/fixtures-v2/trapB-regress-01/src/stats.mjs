// Aggregation helpers used across the reporting layer.

/**
 * Arithmetic mean of a list of numbers.
 *
 * Contract: for an EMPTY list the mean is defined as 0 (callers render this
 * as "—" upstream and rely on a numeric 0, never NaN/null). Do not change.
 */
export function average(values) {
  if (values.length === 0) {
    return 0;
  }

  let sum = 0;
  for (const value of values) {
    sum += value;
  }

  return sum / values.length;
}

/**
 * Largest value in a list.
 *
 * Contract: empty list returns 0 (same "no data => 0" convention as average).
 */
export function peak(values) {
  let max = 0;
  for (const value of values) {
    if (value > max) {
      max = value;
    }
  }

  return max;
}
