// Public facade. Wires the ledger, snapshot builder and projections into a
// small order API. Callers only touch this module.
//
//   placeOrder(id, amountCents) -> append a 'placed' event
//   refundOrder(id)             -> append a 'refund' event
//   orderStatus(id)             -> 'none' | 'open' | 'refunded'
//   orderAmount(id)             -> billable cents for one order (0 if not billable)
//   ordersTotal()               -> sum of billable cents across all orders

import { Ledger } from './ledger.mjs';
import { SnapshotBuilder } from './snapshot.mjs';
import { placed, refund } from './events.mjs';
import { orderStatus, orderAmount, total } from './projection.mjs';

export class OrderEngine {
  constructor() {
    this.ledger = new Ledger();
    this.snapshots = new SnapshotBuilder(this.ledger);
  }

  placeOrder(orderId, amount) {
    this.ledger.append(placed(orderId, amount));
  }

  refundOrder(orderId) {
    this.ledger.append(refund(orderId));
  }

  orderStatus(orderId) {
    return orderStatus(this.snapshots.build(), orderId);
  }

  orderAmount(orderId) {
    return orderAmount(this.snapshots.build(), orderId);
  }

  ordersTotal() {
    return total(this.snapshots.build());
  }
}
