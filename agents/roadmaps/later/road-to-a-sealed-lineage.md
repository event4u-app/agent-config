---
complexity: structural
status: later
review_by: 2027-01-15
owner: maintainer
capability_gap: none
tree_pin: 2ccb435632
execution:
  mode: phase-checkpoints
entry_condition:
  what: >
    A free slot among the five active roadmaps, and the owner's answer to the
    vault-design question in Phase 0 (an encryption design is a security
    decision that changes what is stored on every machine running the lineage
    commands).
  when: >
    When one of the active roadmaps completes and the owner opts in.
  who: >
    The owner.
relates:
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "Owns graph quality and benchmarks. This roadmap renders nothing and parses no code; it references graph nodes, never copies them."
  - slug: road-to-a-map-that-knows-what-happened
    relation: disjoint
    note: "Owns user knowledge, bugs and outcome history in the map. A private lineage view, if it ever renders, goes through the hub it already owns."
estate_growth_exempt: "THIS CHANGE (2026-11-01) adds one later/ roadmap: later_roadmaps +1, active 0. Owner search run 2026-11-01: grep -rlF over agents/roadmaps/*.md, later/ and stubs/ for 'lineage_ledger', 'lineage_watch', 'lineage vault', 'source-provenance' returned nothing, so the subject has no owner; parking it keeps a twice-delivered proposal (19.1.0 v4, 19.2.0 v5) alive instead of dropping it, without taking an active slot."
estate_offset_exempt: "Adds a later/ roadmap only; the active estate is unchanged. Owner search: grep -rlF -e lineage_ledger -e lineage_watch -e 'lineage vault' -e source-provenance -- agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs returned no file."
---

# Road to a sealed lineage

> **Source:** `agents/tmp.old/inbox-2026-11-d/` (topics t1, t2) — two revisions
> of an external evolution proposal (v4 at 19.1.0, v5 at 19.2.0), verified at
> `2ccb435632`.
>
> **Arrivals:** 3 — latest `inbox-2026-11-wo` (2026-11-10): the 20.0.0 review restates v6 of the proposal: relations and metadata are still stored in plain text (the five lineage files are unchanged since 2026-10-24). v6 adds phases 3 to 7 (typed evidence, a watch state machine, gap scoring, an outcome ledger, a private viewer); they stay notes here until 2.2's oracle exists, as v6 itself proposes. Before that, latest `inbox-2026-11-d` (2026-11-01): v5 of the proposal;
> v4 arrived in the same round one release earlier.

## Goal

Sealed. A maintainer can trace an external
resource to the AC feature it shaped, and an upstream change to the gap it
opens, with no identifying source metadata in the tracked tree, a public map, a
log, or a model tool result.

## What is true today (verified at `2ccb435632`)

- `src/scripts/_lib/lineage_ledger.ts` writes `sources.jsonl` and `edges.jsonl`;
  source identity, pin and locator are sealed per field as `ENC1:` tokens, but
  the edge graph (relation, timestamps, license, watch status) is plaintext.
  Unchanged since 19.0.0 (`git diff 19.1.0 HEAD` on the lineage files is empty).
- `src/scripts/_lib/lineage_watch.ts` watches opt-in git repositories by pinned
  HEAD and file-level diff; classes `reverify`, `reopen`, `drift`, `candidate`,
  `license-alert`. No semantic capability delta.
- `code-graph lineage` (`src/scripts/code_graph/lineage_cli.ts`) writes its
  source view and watch reports as plaintext markdown under the user-global home.
  A user-global path with mode 0600 is not encryption.
- `src/scripts/_lib/link_crypto.ts` is the `ENC1` PBKDF2/HMAC token scheme; it
  must stay decryptable for every token already in the tree.

## Phase 0 — Decide before building

- [ ] **0.1 Inventory every reader, writer and sink.** Ledger, CLI, watch, seed,
      backfill, map and settings paths, with file:line pins: which records carry
      unsealed fields, and where decrypted values reach stdout, a report, a map
      file, a log or a tool result.
      verify: `test -f agents/evidence/analysis/lineage-sink-inventory.md` -> 0
- [ ] **0.2 Red-team fixtures that fail today.** Private repository names,
      credential-bearing git URLs, symlinked output paths, a hostile README, an
      interrupted write, a wrong key — each with a marker string the test then
      searches for in every generated file, journal, cache and log.
      verify: `test -f tests/scripts/lineage_vault_redteam.test.ts` -> 0
- [ ] **0.3 The vault design is the owner's.** Options: (a) application-level
      AEAD (AES-256-GCM or XChaCha20-Poly1305) over the existing JSONL; (b) an
      encrypted SQLite store; (c) keep per-field sealing and only stop the
      plaintext reports and maps. Each with key storage, a stolen-key threat
      model, platform packaging and bundle cost. Recorded as an ADR; the run does
      not pick.
      verify: `ls docs/decisions | grep -c lineage-vault` -> /^[1-9]/

## Phase 1 — Migrate without losing the last good ledger

- [ ] **1.1 Exact-once migration with rollback.** Versioned manifest, verified
      backup, atomic pointer swap; the old ledger is never rewritten before the
      new one reads back clean. `ENC1` tokens stay decryptable.
      verify: `npx vitest run tests/scripts/lineage_vault_migration.test.ts` -> 0
- [ ] **1.2 No plaintext projection by default.** `lineage map --sources` and the
      watch report render transiently or into the vault; an export is an explicit,
      allow-listed act. The 0.2 fixtures go green.
      verify: `npx vitest run tests/scripts/lineage_vault_redteam.test.ts` -> 0

## Phase 2 — A watcher that is right before it is smart

- [ ] **2.1 Watch correctness.** Separate last-observed and last-analysed
      revisions; renames, deletions, force-pushes, unreachable pins and shallow
      fetches covered; a bounded fetch budget with an honest `inconclusive`. No
      network for a locked vault, and never from the per-turn code-graph refresh.
      verify: `npx vitest run tests/scripts/lineage_watch.test.ts` -> 0
- [ ] **2.2 Semantic deltas only with an oracle.** A capability-level delta
      (feature, fix, breaking, license) is added only behind a pinned
      precision/recall oracle with negative cases (a README change, a same-name
      function); otherwise this step is closed as `[-]` with the measurement.
      verify: `test -f agents/evidence/analysis/lineage-delta-oracle.md` -> 0

## What this roadmap is NOT

- Not a second graph, map renderer or code parser.
- Not an automatic adoption loop: no change is proposed, merged or sent anywhere
  because an upstream moved.
- Not multi-device sync; that waits until a tested encrypted backup and restore
  exist, and is a separate owner decision.

## Risk Register

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A migration corrupts the only ledger | data loss | The ledger is the sole record of which mechanism came from where | Backup + read-back before the pointer swap; old ledger untouched until then | Phase 1 — Migrate without losing the last good ledger |
| 2 | Crypto chosen by the implementer | security | A homegrown scheme or an unreviewed library choice | 0.3 is an owner ADR with a threat model; the run does not pick | Phase 0 — Decide before building |
| 3 | Watch traffic on every turn | cost | A freshness hook that fetches upstreams would add network per turn | 2.1 forbids network from the per-turn refresh | Phase 2 — A watcher that is right before it is smart |

## Acceptance Criteria

- [ ] AC-1 — The 0.2 fixtures fail before Phase 1 and pass after it.
- [ ] AC-2 — No identifying source string appears in any tracked file, generated
      map, log or report produced by the lineage commands.
