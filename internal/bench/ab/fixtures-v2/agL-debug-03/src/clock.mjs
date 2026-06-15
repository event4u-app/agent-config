// Monotonic sequence source for entry / posting identifiers.
//
// One shared counter per ledger instance. IDs are strictly increasing so that
// the journal preserves a total order of postings (needed by the recompute
// pass, which walks postings oldest-first).

export class Sequence {
  constructor(start = 1) {
    this.next = start;
  }

  take() {
    return this.next++;
  }

  // Roll the counter back to a previously observed value. Used when a batch of
  // postings is abandoned, so identifiers are not permanently consumed by work
  // that never committed.
  resetTo(value) {
    this.next = value;
  }

  peek() {
    return this.next;
  }
}
