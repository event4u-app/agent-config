// Snapshot layer. Builds a Map<orderId, state> by folding the whole ledger and
// memoizes it keyed by the ledger version (event count): if the ledger hasn't
// grown since the last build, the cached snapshot is returned unchanged.

import { reduceOrder } from './reducers.mjs';
import { freshOrderState } from './state.mjs';

export class SnapshotBuilder {
  constructor(ledger) {
    this.ledger = ledger;
    this._cachedVersion = -1;
    this._cached = null;
  }

  build() {
    const version = this.ledger.version();
    if (version === this._cachedVersion && this._cached !== null) {
      return this._cached;
    }

    const events = this.ledger.all();

    // Group events by orderId, preserving replay order within each group.
    const byOrder = new Map();
    for (const event of events) {
      if (!byOrder.has(event.orderId)) {
        byOrder.set(event.orderId, []);
      }
      byOrder.get(event.orderId).push(event);
    }

    const snapshot = new Map();
    for (const [orderId, orderEvents] of byOrder) {
      // Each order folds into its own fresh state record.
      snapshot.set(orderId, reduceOrder(freshOrderState(), orderEvents));
    }

    this._cachedVersion = version;
    this._cached = snapshot;
    return snapshot;
  }
}
