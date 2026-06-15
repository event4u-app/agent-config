// Account registry + the CACHED running-balance index.
//
// The balance index is a derived view: index[acct] must always equal the sum
// of every committed posting leg touching `acct`. Reporting reads this cache
// instead of recomputing from the journal on every call (recompute is O(N)).
//
// Every mutation to the index goes through `applyDelta`, which registers an
// inverse with the store so an aborted / rolled-back transaction leaves the
// cache consistent with the journal. The store owns WHEN the inverse runs;
// this module owns WHAT it does.

export class Accounts {
  constructor(store) {
    this.store = store;
    this.balanceIndex = new Map(); // acct -> integer minor units
  }

  open(acct) {
    if (!this.balanceIndex.has(acct)) {
      this.balanceIndex.set(acct, 0);
    }
  }

  balance(acct) {
    return this.balanceIndex.get(acct) ?? 0;
  }

  // Mutate the cached balance and register the inverse with the store so the
  // cache rolls back in lockstep with the journal.
  applyDelta(acct, delta) {
    const before = this.balanceIndex.get(acct) ?? 0;
    this.balanceIndex.set(acct, before + delta);
    this.store.onRollback(() => {
      this.balanceIndex.set(acct, before);
    });
  }

  // Snapshot for reporting.
  snapshot() {
    return new Map(this.balanceIndex);
  }
}
