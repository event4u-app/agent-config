// Per-order state factory. Every order's fold starts from a clean state record
// describing an order that has been opened with a zero amount. The snapshot
// layer calls this once per order so each order owns an independent record.

const BASE_STATE = { status: 'open', amount: 0 };

// Returns the starting state for one order's fold.
export function freshOrderState() {
  return BASE_STATE;
}
