// Reducers fold a single order's events into its state record { status, amount }.
//
// status is one of: 'open' (billable — the default for any placed order) or
// 'refunded' (not billable). A 'placed' event records the order amount; a
// 'refund' event flips the status to refunded. An order's status is therefore
// 'open' unless and until a refund event flips it.

function applyPlaced(state, event) {
  state.amount = event.amount;
  return state;
}

function applyRefund(state, event) {
  state.status = 'refunded';
  return state;
}

// Fold one order's events (already filtered to the order and sorted by seq)
// into the supplied state record, applying each event in turn.
export function reduceOrder(state, events) {
  for (const event of events) {
    if (event.type === 'placed') {
      applyPlaced(state, event);
    } else if (event.type === 'refund') {
      applyRefund(state, event);
    }
  }
  return state;
}
