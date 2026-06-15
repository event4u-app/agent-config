// Append-only journal of committed postings.
//
// Like the balance index, appends are transactional: a posting appended inside
// an open savepoint is removed again if that savepoint rolls back. The journal
// is the SOURCE OF TRUTH — `recompute` walks it to derive balances, and the
// integration check compares that recompute against the cached index.

export class Journal {
  constructor(store) {
    this.store = store;
    this.postings = [];
  }

  append(posting) {
    this.postings.push(posting);
    this.store.onRollback(() => {
      // Undo the append. Postings are pushed in order, so the inverse pops.
      const idx = this.postings.indexOf(posting);
      if (idx !== -1) {
        this.postings.splice(idx, 1);
      }
    });
  }

  // Mark a posting as reversed (a soft flag used by reporting / audits).
  markReversed(posting) {
    const before = posting.reversed;
    posting.reversed = true;
    this.store.onRollback(() => {
      posting.reversed = before;
    });
  }

  all() {
    return this.postings.slice();
  }

  find(id) {
    return this.postings.find((p) => p.id === id);
  }
}
