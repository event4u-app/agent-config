---
complexity: structural
status: done
tree_pin: 58d43073b7
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner search: grep -rliE 'oracle_verified|would_be_oracle|verify_mode: oracle|evidence.?cache|red_at' over agents/, src/ and docs/ found no owner; the nearest, road-to-a-verify-clause-that-can-fail, is archived. Opened active because the operator's invocation asked for this round's roadmaps to be processed in the same run (inbox-2026-10-bj); closed and archived in the PR that opens it."
relates:
  - slug: road-to-a-verify-clause-that-can-fail
    relation: extends
    note: "Archived parent: gave verify clauses a grammar and a reader. This adds a vacuity report and a red-before-green pair."
---
# Road to work that checks itself

> **Source:** `agents/tmp.old/inbox-2026-10-bj/` (t2) — a review of a family of
> agent-built clean-room apps. Arrival 2: the same files sat unprocessed in an
> earlier inbox folder. Own analysis: their speed came from treating the target
> product as the spec and gating "shipped" on a test that can fail, not from a
> package.

## Goal

A roadmap step's `verify:` evidence can say no. The tree reports which open
steps' checks already pass before any work (vacuous checks), warns when a newly
written check already passes, and can record a red-before-green pair as data.
Nothing here executes roadmap commands outside a read-only allowlist, changes
the judge, or touches the network.

## Phase 1 — Truth line

- [x] **1.1 Stale architecture line.** `docs/architecture.md:3` says the package <!-- receipt: class=R0 · active · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      is "never a resident process", which ADR-249 no longer says.
      verify: `grep -c 'never a resident process' docs/architecture.md` -> /^0$/

## Phase 2 — Oracles that can say no

- [x] **2.1 Vacuity run.** `roadmap_verify_share --run` executes only clauses <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/roadmap_verify_share.ts -->
      whose first token is on a hardcoded read-only allowlist (`grep`, `test`,
      `ls`, `wc`), with a timeout, and lists open steps whose check is already met.
      Non-allowlisted clauses are named as skipped. Exits 0.
      verify: `npx vitest run tests/scripts/roadmap_verify_share.test.ts` -> exit 0

## Phase 3 — The pair, as data

- [x] **3.1 Pair record.** Pure `src/scripts/_lib/verify_pair.ts` builds <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/verify_pair.ts -->
      `{cmd, red_at, green_at}` from verification records; no failing record
      before the green one yields `red: unseen`.
      verify: `npx vitest run tests/scripts/verify_pair.test.ts` -> exit 0
- [x] **3.2 Wiring-only class.** The same module classes a clause as `wiring` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/verify_pair.ts -->
      when it only proves presence (a route listed, a file exists, a menu entry),
      so presence is never read as behavior.
      verify: `npx vitest run tests/scripts/verify_pair.test.ts` -> exit 0

## Stubs and owner decisions

- Making `roadmap_set_step --verify` the binding writer executes roadmap commands
  — owner decision, recorded in `agents/owner-questions.md`.
- A shadow "would-be-oracle" verdict beside the judge, a verdict cache, and a
  measured pilot need a window and a ratification.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The vacuity run executes something that writes | implementation | A roadmap clause could be any shell command | Hardcoded first-token allowlist, no shell, timeout; everything else is skipped and named | Phase 2 — Oracles that can say no |

## Acceptance Criteria

- [x] AC-1 — The tree can list open steps whose check already passes, without
      running any non-allowlisted command.
- [x] AC-2 — A green verification without a preceding red is reported as
      `red: unseen`, and a presence-only check is classed `wiring`.
