# agL-debug-03 — transactional double-entry ledger

A small in-memory **double-entry accounting ledger** with nested transactions.

## Modules

- `src/clock.mjs` — monotonic id sequence (`Sequence`).
- `src/store.mjs` — generic transactional store with nested savepoints
  (`begin` / `commit` / `rollback`) and an undo-log of inverse closures.
- `src/accounts.mjs` — account registry + a **cached running-balance index**.
- `src/posting.mjs` — balanced-posting constructor (legs must net to zero).
- `src/journal.mjs` — append-only log of committed postings (source of truth).
- `src/recompute.mjs` — authoritative balance derivation from the journal.
- `src/ledger.mjs` — orchestrates `post` / `reverse` inside savepoints.
- `src/reporting.mjs` — trial balance from the cached index + drift check.
- `src/index.mjs` — wiring (`createLedger()`).

## Domain invariants

1. Every posting's legs net to zero (enforced at construction).
2. The cached balance index equals a fresh recompute from the journal.
3. A trial balance over a healthy book nets to zero.
4. Aborting / rolling back a transaction leaves the journal **and** the cached
   index exactly as they were before the transaction opened — including across
   nested savepoints.

## Run

```bash
node tests/integration.check.mjs
```

There is no build step and there are no dependencies — plain ESM on bare
`node`.
