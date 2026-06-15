// The ledger orchestrates postings inside store transactions.
//
// post()    — append a balanced posting and update the cached index, atomically.
// reverse() — append the mirror posting that cancels an existing one.
// transaction(fn) — run `fn` inside a savepoint; commit on success, roll back
//                   on a thrown error OR when `fn` returns the ABORT sentinel.
//
// Reversals are the interesting path: a reversal is itself posted inside a
// nested savepoint so that a caller can speculatively reverse-and-check, then
// abandon the reversal if a downstream rule rejects it. When the speculative
// reversal is abandoned, the journal AND the cached index must both snap back
// to exactly the pre-reversal state.

import { makePosting, invert } from './posting.mjs';

export const ABORT = Symbol('abort');

export class Ledger {
  constructor({ store, accounts, journal, seq }) {
    this.store = store;
    this.accounts = accounts;
    this.journal = journal;
    this.seq = seq;
  }

  // Run a unit of work in a savepoint. Returns whatever `fn` returns.
  // Rolls back if `fn` throws or returns ABORT; commits otherwise.
  transaction(fn) {
    this.store.begin();
    const seqMark = this.seq.peek();
    let result;
    try {
      result = fn();
    } catch (err) {
      this.store.rollback();
      this.seq.resetTo(seqMark);
      throw err;
    }
    if (result === ABORT) {
      this.store.rollback();
      this.seq.resetTo(seqMark);
      return result;
    }
    this.store.commit();
    return result;
  }

  // Append a balanced posting and fold its legs into the cached index.
  post(legs, memo) {
    return this.transaction(() => {
      const id = this.seq.take();
      const posting = makePosting(id, legs, memo);
      this.journal.append(posting);
      for (const leg of posting.legs) {
        this.accounts.open(leg.acct);
        this.accounts.applyDelta(leg.acct, leg.amount);
      }
      return posting;
    });
  }

  // Reverse a prior posting: post the mirror image and flag the original.
  // Runs in its own savepoint so it can be nested inside a speculative block.
  reverse(originalId, memo) {
    return this.transaction(() => {
      const original = this.journal.find(originalId);
      if (!original) {
        throw new Error(`cannot reverse unknown posting ${originalId}`);
      }
      if (original.reversed) {
        throw new Error(`posting ${originalId} already reversed`);
      }
      const id = this.seq.take();
      const mirror = invert(id, original, memo);
      this.journal.append(mirror);
      for (const leg of mirror.legs) {
        this.accounts.open(leg.acct);
        this.accounts.applyDelta(leg.acct, leg.amount);
      }
      this.journal.markReversed(original);
      return mirror;
    });
  }
}
