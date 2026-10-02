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

- [x] **1.1 Put the representation question to the council.** Options: (a) the
      generated host table and `doctor` print the effective severity per host —
      `advisory here, no refusal slot` — without touching the manifest; (b) the
      manifest gains a per-host severity override; (c) blocking concerns are
      unbound on hosts with no refusal slot. Record the verdict and both seats in
      `## Decisions`.
      verify: `grep -c 'council' agents/roadmaps/archive/road-to-blocking-severities-where-a-refusal-can-land.md` -> /^[1-9]/
- [x] **1.2 Implement the verdict.** For option (a): `check_enforcement_matrix`,
      `docs/enforcement-by-host.md` and the `doctor` host-traffic block print the
      effective severity and whether the slot honours a deny, and the
      matrix gate fails a row that reads `blocking` where `block_exit` is null.
      Test first, with a fixture lowering row that has `block_exit: null`.
      verify: `npx vitest run tests/scripts/check_enforcement_matrix.test.ts` -> 0
      <!-- Shipped with two corrections to this step's own wording, both recorded
      rather than absorbed. (1) The council refused the term *effective severity*:
      severity did not change, enforcement strength did, so the published columns
      are `Declared severity` and `Verified enforcement`, and a third value —
      `unverified` — keeps "no lowering row" apart from "block_exit is null",
      which this step's single-axis wording would have collapsed. (2) *The doctor
      host-traffic block* names a surface that reports network-traffic environment
      variables and has nothing to do with hook severities; the third surface is
      `agent-config hooks:status`, which is where a reader asks whether a guard is
      live on the host they are on. -->

## Phase 2 — Everything the dispatcher serves is under one mechanism

- [x] **2.1 Extend the ratification path set.** Add `_lib/kernel_rules.ts`,
      `hooks/dispatch_hook.ts`, `hook_manifest.json` and `host_lowering.json` to
      the set `check_kernel_edit_ratified` gates. The gate gates itself, so this
      change carries its own ratification artifact, produced through the council.
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified --files src/scripts/hooks/dispatch_hook.ts src/scripts/_lib/kernel_rules.ts` -> /out_of_scope 0/
- [x] **2.2 Deny direct writes to the compiled tables.** Add the two compiled
      JSON tables to `PLUMBING_BUILD_OUTPUTS` with their regenerating command,
      as the bundle and `hooks.json` already are. A `block_*.ts` edit, so it
      rides with 2.1's ratification or its own.
      verify: `npx vitest run tests/scripts/hooks/block_plumbing_writes.test.ts` -> 0
- [x] **2.3 Check the served body, not only its label.** `resolveTable` (and
      the manifest's twin) recomputes the fingerprint of the compiled `table`
      body it is about to serve and falls through to the YAML source on a
      mismatch, as it already does on a stale label. A test edits one cell of a
      compiled body, keeps the label, and expects the YAML path.
      verify: `npx vitest run tests/hooks/host_lowering_compiled.test.ts -t body` -> 0
      <!-- Verify path corrected at execution time: the step named
      `tests/scripts/hooks/…`, which does not exist. The compiled-table tests have
      always lived at `tests/hooks/host_lowering_compiled.test.ts`, beside their
      manifest twin, and the new cases were added there rather than in a duplicate
      file created to satisfy a wrong literal. 3 of 12 cases match `-t body`. -->
      <!-- The manifest twin got the same two cases, in
      `tests/hooks/hook_manifest_compiled.test.ts` — the step says "and the
      manifest's twin" in its own text but its verify reaches only the lowering
      half, and the manifest table is the one with the larger blast radius: it
      decides which concern runs on which slot on every host. -->
      <!-- Two existing fixtures were updated, and neither is a weakening. Both
      hand-built a compiled payload with only the source label; a servable file now
      needs both, so they supply both. The property each test asserts — mtime-is-
      not-freshness, and the fast path actually runs — is unchanged, and each was
      re-run RED against a neutralised body check before being accepted. -->
      <!-- An ABSENT `body_fingerprint` falls through to the YAML source rather than
      being accepted. The roadmap did not say which way absence goes, and accepting
      it would have made the check skippable by omission — the one way an integrity
      check fails with nobody noticing. -->
      <!-- What this buys, bounded: it closes a PARTIAL edit — a hand edit, a bad
      merge, a truncated write. Anyone who edits a body can recompute the label as
      easily as the compiler, so this is not a signature; 2.2's deny and 2.1's
      record are the mechanisms aimed at an author. Both council seats raised the
      same point and both readers' comments now say so. -->
- [x] **2.4 Regenerate both compiled tables.** Not a step in the original plan:
      2.3 changed the compiled payload's shape, so the committed JSON tables had
      to be rewritten by their compiler or every reader would have fallen through
      to the slow path on a tree that looked current.
      verify: `./scripts-run src/scripts/check_generator_sync` -> 0

## Phase 3 — One account of the fingerprint

- [x] **3.1 Correct the dispatcher's hash rationale.** Rewrite the comment at
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
| D1 | contested-technical | council:step-1.1 | **Option (a), revised: publish TWO columns — `Declared severity` and `Verified enforcement` — and never one merged value.** The manifest is untouched; no binding and no runtime behaviour changes | Council 2026-10-01, 2/2 present, both seats option (a). `openai/codex-default` refused the term *effective severity* — severity did not change, enforcement strength did — and both seats independently required `unverified` (no lowering row) to stay apart from `warning-only` (`block_exit: null`), because `host_lowering.yaml` disclaims the host fact an absence would otherwise assert. Prompt committed at `agents/evidence/analysis/blocking-severities-ratification-prompt.md` | A host gains a refusing slot, or a reader is measured confusing the two columns |
| D5 | contested-technical | author | **The gap-count ratchet both 1.1 seats proposed is NOT in this change.** CI failing when the blocking-but-unenforceable count grows, or when a refusing slot regresses | Both seats proposed it unprompted and neither made it a condition of their verdict; it is a new ratchet with its own baseline file and its own suppression gates, and riding it on the change that first made the number visible would bury that decision under this one | Someone proposes it on its own evidence, or the count moves without anyone noticing |
| D6 | contested-technical | council:ratification | **Recorded verdict `ratified` on a 2/2 approval that split on the label.** `anthropic` read "authority" as a governed actor's capability envelope and said `confirmed-non-expanding`; `openai` read the contract's "anyone's authority" literally, counted the gate's and the guard's widened jurisdiction, and said `ratified` — calling it "the safer and more literal classification" | `agents/evidence/ratifications/drain-blocking-severities-20261001.md`. The contract warns against exactly one misclassification direction — recording an expansion as non-expanding — so the stricter of two approving labels is the one that cannot make it. `non-convergent` would have been wrong: the seats converged on landing it and split on the word | The contract settles whose authority is counted; until then this record does not settle it either |
| D2 | reversible-technical | evidence | Fall through to source on a body mismatch rather than refuse the dispatch | `resolveTable` is documented as slow-never-wrong (`host_lowering.ts:216-221`); refusing on a mismatch would turn a tamper into an outage on every host | A tamper is observed that the YAML path also serves |
| D3 | deterministic | evidence | Closure-scan C1 and C3 (contradictory) are a related roadmap's slug and the stale-comment defect step 3.1 removes; neither is a contradiction in this plan | Lines 11 and the gap table | — |
| D4 | contested-technical | council:step-1.1 | Closure-scan C2 (the goal offers bound-or-advisory) is decision D1, routed to the council by step 1.1 — **resolved with D1: neither, the two facts are published side by side** | Step 1.1 named the three options and a recommendation; the council took (a) and split the single axis the goal assumed into two | Council verdict lands |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Widening the ratification set blocks routine dispatcher fixes | product | `dispatch_hook.ts` changes often; requiring a ratification artifact for each change may slow ordinary repairs enough that they are batched or skipped. | **LIVE, not mitigated.** The ratification council was asked and approved the widening, but the cost question was not put to it separately and no measurement of dispatcher-edit frequency exists. The existing flow handling `block_*.ts` at that cadence is an argument, not evidence. The honest watch is: a routine `dispatch_hook.ts` repair that gets batched or deferred because of the artifact is the signal to narrow the set, and the narrowing would be its own ratification. | Phase 2 — Everything the dispatcher serves is under one mechanism |
| 2 | The body re-hash adds latency on every dispatch | implementation | 2.3 hashes a 5.9 kB body on the hot path. | **MEASURED, 2026-10-01, and smaller than the estimate the row assumed.** `JSON.stringify` plus SHA-256 over the committed bodies, n=400 after a 50-call warm-up, one machine: **0.0165 ms** for the 18.6 kB manifest body and **0.0063 ms** for the 6.4 kB lowering body. Against a ~81 ms dispatch that is two parts in ten thousand, and it is paid only on the fast path it protects — a fall-through pays the YAML parse instead, which is the 12 ms the compiled table exists to avoid. A test asserts the fast path is still taken on an intact file. | Phase 2 — Everything the dispatcher serves is under one mechanism |
| 3 | Published enforcement labelling hides a guard nobody honours | product | Printing an honest `warning-only` removes the pressure to find a refusing slot: the gap becomes documented and therefore comfortable. | **LIVE, and now the roadmap's largest open risk.** Both 1.1 seats raised exactly this and both proposed the same guard — a ratchet failing CI when the blocking-but-unenforceable count grows or a refusing slot regresses. That ratchet is **not in this change** (D5). What shipped is visibility only: the count is published per host rather than printed, and the row names the slot it would need. Visibility without a ratchet is the state the risk describes, so this row is carried forward unmitigated rather than closed. | Phase 1 — Say what a blocking severity does on a host that cannot refuse |
| 4 | A fingerprint reads as authentication | product | 2.3 adds a second fingerprint to files the runtime serves, in a roadmap whose subject is integrity. A later reader can take `body_fingerprint` for tamper-proofing and build on a guarantee it does not carry. | **Named in three places rather than mitigated, because it cannot be mitigated by a cheaper mechanism.** Anyone who edits a compiled body can recompute the label as easily as the compiler. Both council seats raised it independently; both readers' code comments now say so in their own words, the compiler's header says so, and AC-3 carries the bound beside the claim. The mechanisms aimed at an author are 2.2's deny and 2.1's record. | Phase 2 — Everything the dispatcher serves is under one mechanism |

## Acceptance Criteria

- [x] AC-1 — No concern reads `blocking` **as its enforcement** in the generated
      host table on a slot whose `block_exit` is null, and the matrix gate fails a
      fixture that does.
      <!-- Amended at execution time, and the amendment is the council's verdict
      rather than a convenience. As written, AC-1 assumed one severity axis: it
      would be met only by a table where `blocking` does not appear at all on an
      augment row. The shipped table does show `blocking` there — in the
      `Declared severity` column, which is the manifest's own fact and which
      D1 deliberately keeps visible, because hiding it would make the gap
      invisible rather than honest. What AC-1 was protecting is that no row claims
      a refusal the host cannot deliver, and that is what the `Verified
      enforcement` column and the gate now carry: `warning-only` on augment,
      `unverified` on cowork, `refusal` only on a slot whose `block_exit` can deny.
      The gate fails a fixture in BOTH directions — a published `refusal` over a
      null or absent `block_exit`, and a published `warning-only` over an absent
      row, which would assert a host fact nobody established. Evidence: the
      generated region in `docs/enforcement-by-host.md` reads 21 blocking bindings,
      9 `refusal` / 6 `warning-only` / 6 `unverified` / 0 `proof-expired`; the
      fixture cases are in `tests/scripts/check_enforcement_matrix.test.ts`
      § `blocking-severity region — the gate`, each run RED against a neutralised
      derivation before being accepted. -->
      <!-- One clause of the Goal is NOT met and is reported rather than quietly
      satisfied: *"`check_enforcement_matrix` reports zero blocking bindings on a
      slot with no refusal"*. It reports twelve, as it did before — six on augment
      and six on cowork — because that audit counts BINDINGS and the council kept
      it non-failing on purpose. Reaching zero means rehanging or unbinding those
      guards, which is option (c), which both seats rejected: on those hosts the
      concern still runs and still warns, and (c) trades a truthful label for a
      lost warning. The number is now published instead of only printed. -->
      <!-- The gap is documented and therefore at risk of becoming comfortable —
      the roadmap's own Risk 3. Both seats proposed the same guard, a ratchet on
      the gap count, and it is NOT in this change; see D5 for why, and treat it as
      live residue rather than a closed risk. -->
      <!-- Third surface: `agent-config hooks:status`, annotated per slot. Not the
      `doctor` host-traffic block the step named, which reports network-traffic
      environment variables and has nothing to do with hook severities. -->
      verify: `./scripts-run src/scripts/check_enforcement_matrix` -> 0
- [x] AC-2 — A diff touching `dispatch_hook.ts`, `kernel_rules.ts` or either
      compiled table is gated by `check_kernel_edit_ratified`.
      <!-- Demonstrated on this diff, which touches three of the four and could
      not be pushed without `agents/evidence/ratifications/drain-blocking-
      severities-20261001.md`. The rejecting half is pinned too: another `_lib`
      module, another `hooks/*.ts`, the manifest's schema file and a fixture copy
      of a compiled table all stay out. -->
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified --files src/scripts/hooks/dispatch_hook.ts src/scripts/_lib/kernel_rules.ts src/scripts/hook_manifest.json src/scripts/hooks/host_lowering.json agents/evidence/ratifications/drain-blocking-severities-20261001.md` -> 0
- [x] AC-3 — An edited compiled table body with an unchanged fingerprint label
      is not served.
      <!-- Both tables, both readers. The test edits `claude`/`pre_tool_use`'s
      `block_exit` from 2 to null in the compiled body, leaves the source label
      alone, and asserts the caller still sees 2 — i.e. the YAML path ran. The
      manifest twin does the same against `_load_yaml`. Both were run RED against
      a neutralised body check.
      What this does NOT establish, stated because the honest bound belongs beside
      the claim: an editor who recomputes `body_fingerprint` is served, exactly as
      one who recomputes `fingerprint` always was. The deny (2.2) and the record
      (2.1) are the mechanisms aimed at an author; this one is aimed at a partial
      edit — a hand edit, a bad merge, a truncated write. -->
      verify: `npx vitest run tests/hooks/host_lowering_compiled.test.ts tests/hooks/hook_manifest_compiled.test.ts` -> 0
