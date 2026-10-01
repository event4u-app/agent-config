---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Two verified enforcement seams no active roadmap owns: six concerns declared blocking on augment and six on cowork sit on a slot that cannot refuse, and the compiled hook tables plus the dispatcher and the kernel-rule list are served at runtime while neither the plumbing deny nor the ratification gate reaches them. road-to-a-kernel-that-guards-its-plumbing closed its file-class phases and holds only a calendar-bound step; reopening it would block its archival on work it never scoped."
relates:
  - slug: road-to-a-kernel-that-guards-its-plumbing
    relation: extends
    note: Its Phase 1 gave plumbing sources and two build outputs one mechanism each. This roadmap carries the same treatment to the files that phase left out.
  - slug: road-to-host-claims-the-tree-contradicts
    relation: disjoint
    note: That roadmap corrects what the host table says; this one decides what a blocking severity means where the host cannot refuse.
---
# Road to blocking severities where a refusal can land

> **Source:** `agents/tmp.old/inbox-2026-10-a/` — a round of sixteen external
> reviews of the 16.2.0 release plus a supplied scorecard rescore whose fifth
> fold names the kernel seam. Verified against `main` at `9bc8cd4f2` on
> 2026-10-01; disposition at
> `agents/evidence/analysis/inbox-2026-10-a-disposition.md`.

## Goal

Every concern declared `blocking` is either bound where its host can refuse or
reported as advisory on that host, and every file the dispatcher serves at
runtime is covered by the same write deny and ratification record as the source
it was compiled from. Done means: `check_enforcement_matrix` reports zero
blocking bindings on a slot with no refusal, a write to a compiled table body is
refused or detected, and the dispatcher, the kernel-rule list and the compiled
tables carry a ratification artifact when they change.

## Context

Reproduced on 2026-10-01:

- `./scripts-run src/scripts/check_enforcement_matrix` → augment `pre_tool_use`
  "block_exit is null — a refusal has nowhere to go" with **six** blocking
  concerns (`block-config-weakening`, `block-kernel-rule-writes`,
  `block-no-verify`, `block-plumbing-writes`, `block-speaking-inbox-dir`,
  `evidence-independence`); cowork `pre_tool_use` "no lowering row for this
  slot" with the same six. The source counted five on augment; the sixth is
  `block-plumbing-writes`, admitted in this release.
- `check_kernel_edit_ratified.ts:31-35` gates kernel rules, `block_*.ts`,
  `hook_manifest.yaml`, `host_lowering.yaml`, dispatcher shell scripts and the
  budget files. It does not gate `src/scripts/_lib/kernel_rules.ts`,
  `src/scripts/hooks/dispatch_hook.ts`, `hook_manifest.json` or
  `host_lowering.json`.
- `block_plumbing_writes.ts:94-97` denies writes to `dist/hooks/dispatch.js` and
  `hooks/hooks.json` only.
- `host_lowering.ts:251-256` serves the compiled `table` when the file's
  `fingerprint` field equals the YAML source's fingerprint. The table body itself
  is never checked against that fingerprint, so an edited body with an untouched
  field is served.
- `dispatch_hook.ts:200-207` still argues against a cryptographic hash on an
  8 ms start-up cost that `table_fingerprint.ts:20-31` re-measured and retired.

## Phase 1 — Say what a blocking severity does on a host that cannot refuse

- [ ] **1.1 Put the representation question to the council.** Options: (a) the
      generated host table and `doctor` print the effective severity per host —
      `advisory here, no refusal slot` — without touching the manifest; (b) the
      manifest gains a per-host severity override; (c) blocking concerns are
      unbound on hosts with no refusal slot. Record the verdict and both seats in
      `## Decisions`.
      verify: `grep -c 'council' agents/roadmaps/road-to-blocking-severities-where-a-refusal-can-land.md` -> /^[1-9]/
- [ ] **1.2 Implement the verdict.** For option (a): `check_enforcement_matrix`,
      `docs/enforcement-by-host.md` and the `doctor` host-traffic block print the
      effective severity and whether the slot honours a deny, and the
      matrix gate fails a row that reads `blocking` where `block_exit` is null.
      Test first, with a fixture lowering row that has `block_exit: null`.
      verify: `npx vitest run tests/scripts/check_enforcement_matrix.test.ts` -> 0

## Phase 2 — Everything the dispatcher serves is under one mechanism

- [ ] **2.1 Extend the ratification path set.** Add `_lib/kernel_rules.ts`,
      `hooks/dispatch_hook.ts`, `hook_manifest.json` and `host_lowering.json` to
      the set `check_kernel_edit_ratified` gates. The gate gates itself, so this
      change carries its own ratification artifact, produced through the council.
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified --files src/scripts/hooks/dispatch_hook.ts src/scripts/_lib/kernel_rules.ts` -> /out_of_scope 0/
- [ ] **2.2 Deny direct writes to the compiled tables.** Add the two compiled
      JSON tables to `PLUMBING_BUILD_OUTPUTS` with their regenerating command,
      as the bundle and `hooks.json` already are. A `block_*.ts` edit, so it
      rides with 2.1's ratification or its own.
      verify: `npx vitest run tests/scripts/hooks/block_plumbing_writes.test.ts` -> 0
- [ ] **2.3 Check the served body, not only its label.** `resolveTable` (and
      the manifest's twin) recomputes the fingerprint of the compiled `table`
      body it is about to serve and falls through to the YAML source on a
      mismatch, as it already does on a stale label. A test edits one cell of a
      compiled body, keeps the label, and expects the YAML path.
      verify: `npx vitest run tests/scripts/hooks/host_lowering_compiled.test.ts -t body` -> 0

## Phase 3 — One account of the fingerprint

- [ ] **3.1 Correct the dispatcher's hash rationale.** Rewrite the comment at
      `dispatch_hook.ts:200-207` to match the measurement in
      `table_fingerprint.ts:20-31`, or move the manifest fingerprint onto
      `tableFingerprint` if 2.3 makes that the cheaper path. Comment-only unless
      2.3 changes the function.
      verify: `grep -c '8 ms of' src/scripts/hooks/dispatch_hook.ts` -> /^0$/

## Gap table

| Source item | Verdict | Where |
|---|---|---|
| Five blocking guards on augment slots with null block_exit — rehang or downgrade | KEEP, re-measured at six plus six on cowork | Phase 1 |
| `kernel_rules.ts`, `dispatch_hook.ts`, compiled tables outside deny and ratification | KEEP | 2.1, 2.2 |
| Fingerprint covers the YAML source, not the served body | KEEP | 2.3 |
| `dispatch_hook.ts:204` contradicts `table_fingerprint.ts` | KEEP | 3.1 |
| Bind roughly ten observer rules to real backstops | CUT here — no rule named, each needs its own false-positive corpus | disposition |
| Cross-host hard enforcement beyond 3 of 32 pairs | CUT — a host property, recorded by the matrix | disposition |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council | Representation of a blocking severity on a host with no refusal slot | Pending 1.1; recommendation (a), because it changes no runtime behaviour and makes the table truthful | Council verdict lands |
| D2 | reversible-technical | evidence | Fall through to source on a body mismatch rather than refuse the dispatch | `resolveTable` is documented as slow-never-wrong (`host_lowering.ts:216-221`); refusing on a mismatch would turn a tamper into an outage on every host | A tamper is observed that the YAML path also serves |
| D3 | deterministic | evidence | Closure-scan C1 and C3 (contradictory) are a related roadmap's slug and the stale-comment defect step 3.1 removes; neither is a contradiction in this plan | Lines 11 and the gap table | — |
| D4 | contested-technical | council | Closure-scan C2 (the goal offers bound-or-advisory) is decision D1, routed to the council by step 1.1 | Step 1.1 names the three options and a recommendation | Council verdict lands |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Widening the ratification set blocks routine dispatcher fixes | product | `dispatch_hook.ts` changes often; requiring a ratification artifact for each change may slow ordinary repairs enough that they are batched or skipped. | The council in 2.1 weighs the cost explicitly, and the existing ratification flow already handles `block_*.ts` at that cadence. | Phase 2 — Everything the dispatcher serves is under one mechanism |
| 2 | The body re-hash adds latency on every dispatch | implementation | 2.3 hashes a 5.9 kB body on the hot path. | `table_fingerprint.ts:20-31` measured SHA-256 at about 0.1 ms over the same order of bytes; 2.3's test asserts the fast path is still taken on an intact file. | Phase 2 — Everything the dispatcher serves is under one mechanism |
| 3 | Effective-severity labelling hides a guard nobody honours | product | Printing `advisory here` is honest and also removes the pressure to find a refusing slot. | The matrix keeps the blocking count per host visible, and the row names the slot it would need. | Phase 1 — Say what a blocking severity does on a host that cannot refuse |

## Acceptance Criteria

- [ ] AC-1 — No concern reads `blocking` in the generated host table on a slot
      whose `block_exit` is null, and the matrix gate fails a fixture that does.
- [ ] AC-2 — A diff touching `dispatch_hook.ts`, `kernel_rules.ts` or either
      compiled table is gated by `check_kernel_edit_ratified`.
- [ ] AC-3 — An edited compiled table body with an unchanged fingerprint label
      is not served.
