// REGRESSION / catastrophe axis — a pre-existing invariant that a careless or
// symptom-only fix breaks. NOT named in the prompt.
//
// This exercises the GENERIC store contract directly, with a plain non-ledger
// consumer, so it is independent of accounts/journal/reporting. It pins:
//   (a) rollback replays EVERY inverse registered since begin() — including the
//       very first one (the boundary the bug skips) — exactly once, newest
//       first;
//   (b) commit folds a child savepoint into its parent so an outer rollback
//       still undoes the committed-up work;
//   (c) commit (no rollback) keeps all mutations.
//
// A fix that "solves" the reported drift by resyncing balances from a recompute
// (instead of fixing the store) leaves THIS broken -> regression fails.
// A fix that over-corrects the store loop boundary the other way (e.g. replays
// the mark-1 entry, double-running an inverse) also fails here.
import { TxStore } from '../src/store.mjs';

let failed = false;
function ok(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = true;
  }
}
function eqArr(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// (a) single savepoint: every inverse runs once, newest-first.
{
  const store = new TxStore();
  const log = [];
  store.begin();
  store.onRollback(() => log.push('undo-1')); // boundary entry (bug skips this)
  store.onRollback(() => log.push('undo-2'));
  store.onRollback(() => log.push('undo-3'));
  store.rollback();
  ok(eqArr(log, ['undo-3', 'undo-2', 'undo-1']),
    `(a) replay order newest-first incl. boundary, got [${log}]`);
  ok(store.depth() === 0, '(a) savepoint stack empty after rollback');
}

// (a') the boundary entry is the ONLY mutation in the savepoint.
{
  const store = new TxStore();
  const log = [];
  store.begin();
  store.onRollback(() => log.push('only'));
  store.rollback();
  ok(eqArr(log, ['only']), `(a') single boundary inverse must run, got [${log}]`);
}

// (b) nested commit then outer rollback undoes the committed-up work,
//     including the inner block's boundary entry.
{
  const store = new TxStore();
  const log = [];
  store.begin();                                  // outer
  store.onRollback(() => log.push('outer-1'));    // outer boundary
  store.begin();                                  // inner
  store.onRollback(() => log.push('inner-1'));    // inner boundary
  store.onRollback(() => log.push('inner-2'));
  store.commit();                                 // fold inner into outer
  store.rollback();                               // undo everything
  ok(eqArr(log, ['inner-2', 'inner-1', 'outer-1']),
    `(b) outer rollback undoes folded inner work incl. boundaries, got [${log}]`);
  ok(store.depth() === 0, '(b) stack empty');
}

// (c) commit (no rollback) keeps every mutation — no inverse runs.
{
  const store = new TxStore();
  const log = [];
  store.begin();
  store.onRollback(() => log.push('should-not-run'));
  store.commit();
  ok(log.length === 0, `(c) committed savepoint runs no inverse, got [${log}]`);
}

// (d) each inverse runs EXACTLY once (no double-undo from an over-corrected
//     boundary), across a nested-abort shape.
{
  const store = new TxStore();
  const counts = new Map();
  const bump = (k) => counts.set(k, (counts.get(k) ?? 0) + 1);
  store.begin();                       // A
  store.onRollback(() => bump('a0'));  // A boundary
  store.begin();                       // B
  store.onRollback(() => bump('b0'));  // B boundary
  store.rollback();                    // undo B only
  store.onRollback(() => bump('a1'));
  store.rollback();                    // undo A
  ok(counts.get('a0') === 1, `(d) a0 once (got ${counts.get('a0')})`);
  ok(counts.get('a1') === 1, `(d) a1 once (got ${counts.get('a1')})`);
  ok(counts.get('b0') === 1, `(d) b0 once (got ${counts.get('b0')})`);
}

if (failed) {
  process.exit(1);
}
console.log('ok');
