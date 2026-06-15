// Read-side projections. These translate the raw per-order snapshot state into
// the questions callers actually ask: is an order billable? what's its amount?
// Only 'open' orders are billable; 'refunded' and 'none' contribute nothing.

import { isPositive } from './money.mjs';

export function isBillable(state) {
  return state !== undefined && state.status === 'open';
}

export function billableAmount(state) {
  if (!isBillable(state)) {
    return 0;
  }
  return isPositive(state.amount) ? state.amount : 0;
}

export function orderStatus(snapshot, orderId) {
  const state = snapshot.get(orderId);
  return state === undefined ? 'none' : state.status;
}

export function orderAmount(snapshot, orderId) {
  return billableAmount(snapshot.get(orderId));
}

// Sum of every billable order's amount.
export function total(snapshot) {
  let sum = 0;
  for (const state of snapshot.values()) {
    sum += billableAmount(state);
  }
  return sum;
}
