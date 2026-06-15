// Stair-climbing cost optimizer.
//
// You start standing on step 0 (free). You want to reach the last step.
// From step i you may move EITHER:
//   - to step i+1, paying cost[i+1], or
//   - to step i+2 (a "jump"), paying cost[i+2] — but you may use at most
//     `maxJumps` jumps over the whole climb.
// minCost returns the cheapest total cost to land exactly on the last step.

/**
 * @param {number[]} cost   per-step landing cost; cost[0] is the (free) start.
 * @param {number}   maxJumps  maximum number of +2 jumps allowed.
 * @returns {number} cheapest total cost to reach the last step.
 */
export function minCost(cost, maxJumps) {
  const last = cost.length - 1;
  const memo = new Map();

  function best(i, jumpsLeft) {
    if (i === last) {
      return 0;
    }
    if (i > last) {
      return Infinity;
    }

    if (memo.has(i)) {
      return memo.get(i);
    }

    // Single step.
    let result = cost[i + 1] + best(i + 1, jumpsLeft);

    // Jump, if we still have one.
    if (jumpsLeft > 0 && i + 2 <= last) {
      const jump = cost[i + 2] + best(i + 2, jumpsLeft - 1);
      if (jump < result) {
        result = jump;
      }
    }

    memo.set(i, result);
    return result;
  }

  return best(0, maxJumps);
}
