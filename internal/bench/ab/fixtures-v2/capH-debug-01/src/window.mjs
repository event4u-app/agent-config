// Search helpers for the sorted-index layer.

/**
 * Return the number of elements in the ascending-sorted array `arr` that are
 * strictly less than `target` (i.e. the insertion point for `target` as a
 * lower bound). Pure integer logic, no floats.
 *
 * Examples:
 *   countBelow([1, 3, 3, 5], 3) === 1
 *   countBelow([1, 3, 3, 5], 4) === 3
 *   countBelow([1, 3, 3, 5], 0) === 0
 *   countBelow([1, 3, 3, 5], 9) === 4
 */
export function countBelow(arr, target) {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = arr.length;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] > target) {
      ans = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  return ans;
}

/**
 * Count of elements equal to `target` in the ascending-sorted array `arr`,
 * computed as (first index > target) - (first index >= target).
 *
 * Examples:
 *   countEqual([1, 3, 3, 3, 5], 3) === 3
 *   countEqual([1, 3, 3, 3, 5], 4) === 0
 *   countEqual([2, 2], 2) === 2
 */
export function countEqual(arr, target) {
  return countBelow(arr, target + 1) - countBelow(arr, target);
}
