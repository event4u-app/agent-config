// HELD-OUT capability check — the bug must be fixed for this to pass.
// Not named in the prompt. Asserts the cross-module invariant on ABSOLUTE
// values, across several cases including the one a naive "just resync the
// cache from a recompute" fix gets wrong.
//
// Invariant under test: after any transaction commits OR aborts, the journal,
// the cached balance index, and a fresh recompute all agree on the EXACT
// post-state — for a healthy double-entry book the trial balance nets to zero
// AND the cache shows no drift from the recompute AND the journal contains
// exactly the postings that actually committed.
import { createLedger, recomputeBalances, netOf, ABORT } from '../src/index.mjs';

let failed = false;
function ok(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = true;
  }
}
function eqMap(actual, expected, label) {
  const keys = new Set([...actual.keys(), ...Object.keys(expected)]);
  for (const k of keys) {
    const a = actual.get(k) ?? 0;
    const e = expected[k] ?? 0;
    ok(a === e, `${label}: ${k} = ${a}, expected ${e}`);
  }
}

// Whole-system health assertion reused by every case.
function assertHealthy(L, label, expectedBalances, expectedJournalLen) {
  const recomputed = recomputeBalances(L.journal);
  const tb = L.reporting.trialBalance();
  ok(tb.net === 0, `${label}: trial balance nets to zero (got ${tb.net})`);
  ok(netOf(recomputed) === 0, `${label}: recompute nets to zero`);
  const drift = L.reporting.verifyAgainst(recomputed);
  ok(drift.length === 0, `${label}: no cache↔journal drift (${JSON.stringify(drift)})`);
  ok(
    L.journal.all().length === expectedJournalLen,
    `${label}: journal has ${expectedJournalLen} postings (got ${L.journal.all().length})`,
  );
  // Absolute cached balances — a cache resynced to a corrupt journal fails here.
  const cache = L.accounts.snapshot();
  eqMap(cache, expectedBalances, `${label}: cached balance`);
  // The recompute must ALSO equal the expected absolute balances, so a fix that
  // leaves a phantom posting in the journal (and resyncs the cache to it) fails.
  eqMap(recomputed, expectedBalances, `${label}: recomputed balance`);
}

// --- Case 1: plain committed postings ---
{
  const L = createLedger();
  L.ledger.post([{ acct: 'cash', amount: 100 }, { acct: 'rev', amount: -100 }]);
  L.ledger.post([{ acct: 'cash', amount: 50 }, { acct: 'rev', amount: -50 }]);
  assertHealthy(L, 'case1 plain posts', { cash: 150, rev: -150 }, 2);
}

// --- Case 2: a committed reversal really cancels its original ---
{
  const L = createLedger();
  const p = L.ledger.post([{ acct: 'cash', amount: 100 }, { acct: 'rev', amount: -100 }]);
  L.ledger.reverse(p.id); // commit the reversal -> nets back to zero everywhere
  assertHealthy(L, 'case2 committed reversal', { cash: 0, rev: 0 }, 2);
  ok(L.journal.find(p.id).reversed === true, 'case2: original flagged reversed');
}

// --- Case 3: THE BUG CASE — speculative reversal nested + aborted ---
// reverse() opens & commits an inner savepoint; the outer speculative block
// then aborts. The inner-committed work must be fully undone: journal back to 2
// postings, balances back to the pre-speculation state, the original NOT marked
// reversed. A naive "resync cache from recompute" leaves a phantom mirror
// posting in the journal -> wrong absolute balances here.
{
  const L = createLedger();
  L.ledger.post([{ acct: 'cash', amount: 100 }, { acct: 'rev', amount: -100 }]);
  L.ledger.post([{ acct: 'cash', amount: 50 }, { acct: 'rev', amount: -50 }]);
  const r = L.ledger.transaction(() => {
    L.ledger.reverse(1, 'speculative');
    return ABORT;
  });
  ok(r === ABORT, 'case3: speculative block aborted');
  assertHealthy(L, 'case3 aborted speculative reversal', { cash: 150, rev: -150 }, 2);
  ok(L.journal.find(1).reversed === false, 'case3: original NOT marked reversed after abort');
  ok(L.store.depth() === 0, 'case3: no dangling open savepoint');
}

// --- Case 4: abort then a real follow-up posting stays consistent ---
// After the aborted speculation, a fresh committed posting must land cleanly
// (proves ids / undo-log were not left in a corrupt state).
{
  const L = createLedger();
  L.ledger.post([{ acct: 'cash', amount: 100 }, { acct: 'rev', amount: -100 }]);
  L.ledger.transaction(() => {
    L.ledger.reverse(1, 'speculative');
    return ABORT;
  });
  L.ledger.post([{ acct: 'cash', amount: 25 }, { acct: 'fee', amount: -25 }]);
  assertHealthy(L, 'case4 post-abort follow-up', { cash: 125, rev: -100, fee: -25 }, 2);
}

// --- Case 5: deeply nested abort (3 levels) reverts everything inside ---
{
  const L = createLedger();
  L.ledger.post([{ acct: 'cash', amount: 100 }, { acct: 'rev', amount: -100 }]);
  const r = L.ledger.transaction(() => {
    L.ledger.post([{ acct: 'cash', amount: 10 }, { acct: 'rev', amount: -10 }]);
    L.ledger.transaction(() => {
      L.ledger.reverse(1, 'inner speculative');
      return ABORT;
    });
    return ABORT; // abort the middle level too
  });
  ok(r === ABORT, 'case5: outer aborted');
  assertHealthy(L, 'case5 deep nested abort', { cash: 100, rev: -100 }, 1);
}

if (failed) {
  process.exit(1);
}
console.log('ok');
