// Event constructors. The system is event-sourced: nothing mutates order state
// directly — every change is an immutable event appended to the ledger, and the
// current state is derived by folding the events through the reducers.
//
// Event shapes:
//   { type: 'placed',  seq, orderId, amount }   -- a new order for `amount` cents
//   { type: 'refund',  seq, orderId }           -- fully refunds an existing order

import { clock } from './clock.mjs';

export function placed(orderId, amount) {
  return { type: 'placed', seq: clock.next(), orderId, amount };
}

export function refund(orderId) {
  return { type: 'refund', seq: clock.next(), orderId };
}
