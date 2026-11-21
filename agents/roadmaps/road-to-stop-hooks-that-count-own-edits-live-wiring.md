---
complexity: lightweight
status: ready
review_by: 2026-12-21
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Carries steps 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 3.2, 3.5, 4.1 and 4.2 of road-to-stop-hooks-that-count-own-edits, whose live-hook halves the owner took off the dispatch path on 2026-11-21 (option 2: land the features without growing the hook bundle). Created in the same change that defers those steps, so the items stay alive in the active estate. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
estate_offset_exempt: "Created in the same change that defers the live-hook halves of road-to-stop-hooks-that-count-own-edits, which stays active because its step 4.4 waits on the owner blocker legal-work-product-cadence; no active roadmap is done, so none can be archived to offset. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md (option 2, no hook-bundle raise)."
relates:
  - slug: road-to-stop-hooks-that-count-own-edits
    relation: extends
    note: "Its live-hook halves of 1.1-1.4, 2.2-2.4, 3.2, 3.5, 4.1 and 4.2 are carried here: the libraries and their tests exist off the live path; this file wires them in and carries the bundle raise and the ratification records."
  - slug: road-to-done-claims-with-read-exit-codes-live-wiring
    relation: disjoint
    note: "Same-day sibling. Both swap a predicate in `_lib/verification_command.ts` and both raise the same bundle ceiling; whichever lands second re-measures its raise on top of the first."
  - slug: road-to-a-language-pin-from-owner-prose-live-wiring
    relation: disjoint
    note: "Same-day sibling wiring a different concern (the language pin); shares only the bundle ceiling, re-measured by whichever lands second."
  - slug: road-to-goal-record-live-wiring
    relation: disjoint
    note: "Same-day sibling wiring the goal record; shares only the bundle ceiling."
  - slug: road-to-17-0-follow-ups
    relation: extends
    note: "Parked in later/. Its step 1.8 (pattern-operand narrowing of block-credential-reads) is executed by 4.1 here and flipped there with a pointer."
  - slug: road-to-f4-full-stop-block
    relation: disjoint
    note: "Owns the block-versus-advisory decision for end-review-nudge; 2.2 here only adds the attribution field its calibration selects on."
  - slug: road-to-a-stop-that-holds
    relation: disjoint
    note: "Archived; built the run-record classifier. 3.1 here changes only the command selector that feeds it."
  - slug: road-to-a-stop-that-holds-carried
    relation: disjoint
    note: "Parked kill-switch table and stop ladder; no overlap with the counting or classification wired here."
  - slug: road-to-a-stop-slot-that-knows-it-continues
    relation: disjoint
    note: "Archived; corrected the stop-slot contract wording of end_review_nudge_hook. No detector logic overlaps."
  - slug: road-to-touched-files-that-pass-their-own-tools
    relation: disjoint
    note: "Archived parent of the carried file below; it names commands in a refusal, this file accepts commands."
  - slug: road-to-touched-files-that-pass-their-own-tools-carried
    relation: disjoint
    note: "Parked; its 2.5 makes a turn-end refusal NAME commands; 3.1 here makes the gate ACCEPT container verifiers. Both pay the same bundle bytes."
  - slug: road-to-a-council-that-spreads-across-accounts
    relation: disjoint
    note: "Lexical hit only (council seat spreading)."
  - slug: road-to-a-recurrence-count-that-survives-the-round
    relation: disjoint
    note: "Lexical hit only (arrival counters on held objects)."
  - slug: road-to-an-agent-the-owner-does-not-drive
    relation: disjoint
    note: "Lexical hit only (release/merge autonomy)."
  - slug: road-to-an-ownership-record-that-belongs-to-the-user
    relation: disjoint
    note: "Lexical hit only (consumer edits to installed files)."
  - slug: road-to-ci-time-that-counts-the-queue
    relation: disjoint
    note: "Lexical hit only (CI queue time)."
  - slug: road-to-cross-repo-differential-loop
    relation: disjoint
    note: "Lexical hit only (reference-analysis command)."
  - slug: road-to-estate-drawdown
    relation: disjoint
    note: "Lexical hit only (roadmap estate campaign)."
  - slug: road-to-inbox-harvest-2026-08-d-scheduled-deprecation
    relation: disjoint
    note: "Lexical hit only (deprecation table dates)."
  - slug: road-to-inbox-harvest-residuals
    relation: disjoint
    note: "Lexical hit only (inbox harvest residue)."
  - slug: road-to-owner-asks-that-survive-a-round
    relation: disjoint
    note: "Lexical hit only (star-ask delivery)."
  - slug: road-to-rule-delivery-integrity
    relation: disjoint
    note: "Lexical hit only (rule delivery to hosts)."
  - slug: road-to-the-delivery-flip-that-tells-the-truth
    relation: disjoint
    note: "Lexical hit only (delivery flip reporting)."
  - slug: road-to-unknowns-that-say-so
    relation: disjoint
    note: "Lexical hit only (unknown models and prices)."
  - slug: road-to-webfont-delivery-ownership
    relation: disjoint
    note: "Lexical hit only (webfont delivery)."
---
# Road to stop hooks that count own edits — live wiring

> **Source:** decisions D4 and D5 of `road-to-stop-hooks-that-count-own-edits`.
> On 2026-11-21 the owner ruled the hook bundle's ceiling may not grow in that
> change (option 2): its four fixes landed as libraries and tests that no hook
> imports, and `src/config/hook-bundle-budget.json` kept origin/main's
> ceiling (1,595,300 B; the bundle measured 1,595,224 B on the branch). This
> roadmap carries exactly the live wiring and the raise it needs.

## Goal

The four false alarms of the 2026-11-21 retro stop on the live path: the review
nudge charges only a session's own lines, a container-run verifier clears
detector C, a `git fetch` writes no push marker, and a credential token that is
a search pattern, filter, message or `echo` argument is not refused.

## Context

- **What exists.** `src/scripts/_lib/own_edit_attribution.ts`
  (`sessionWritesFromTranscript`, `ownEditCount`; D4),
  `src/scripts/_lib/project_verify_shapes.ts`
  (`isVerificationCommandInContainer`; D5),
  `src/scripts/_lib/push_report.ts` (`pushedBranchFromReport`; D2 of the
  source), `src/scripts/_lib/credential_operands.ts`
  (`narrowedSegmentVerdict`, with its threat pass in the header). Tests:
  `tests/scripts/own_edit_attribution.test.ts`,
  `tests/scripts/project_verify_shapes.test.ts`,
  `tests/scripts/push_report.test.ts`,
  `tests/scripts/credential_operands.test.ts`. Each test file also pins the
  live reader's current false alarm, so a wiring that does not take effect is
  visible there.
- **What is missing.** `end_review_nudge_hook.ts`, `turn_end_gate_hook.ts` /
  `verification_evidence.ts`, `push_settle_hook.ts` and
  `block_credential_reads.ts` still call the old readers.
- **Constraint.** Every swap grows the dispatch bundle; the wired delta is
  unmeasured. `hook-bundle-budget.json` and `block_*.ts` are
  ratification-gated: each raise or guard edit needs a ratified record (cap:
  3 rounds per record; not ratified → stop and return to the owner).

## Phase 1 — push reading

- [ ] 1.1 Red first: in `tests/scripts/push_settle_hook.test.ts`, the real `git fetch` and `git pull` reports from a temp bare remote fire no reminder and write no merge marker; a push and a `fetch && merge && push` run fire. Then call `pushedBranchFromReport` from `pushedBranch`.
      verify: `npx vitest run tests/scripts/push_settle_hook.test.ts tests/scripts/push_report.test.ts` -> 0

## Phase 2 — own-edit count in the review nudge

- [ ] 2.1 Red first: fixtures (a)-(c) of the source's 1.1 and the shell-only fixture through `end_review_nudge_hook.main` with a transcript and a baseline. Then count with `ownEditCount` (start head from the baseline), fire only when the verified count exceeds the threshold, and keep the legacy count as a shadow figure.
      verify: `npx vitest run tests/scripts/end_review_nudge_hook.test.ts tests/scripts/review_baseline_hook.test.ts` -> 0
- [ ] 2.2 The `review_skipped` row gains `attribution: own | fallback | baseline` (`baseline` for the legacy shadow figure), so the F4 stub's calibration can select own-edit rows.
      verify: `npx vitest run tests/scripts/end_review_nudge_hook.test.ts -t attribution` -> 0
- [ ] 2.3 Rewrite the "Diff source" block of `end_review_nudge_hook.ts` and the "WHAT IT IS NOT" paragraph of `review_baseline.ts` to describe the D4 attribution and its residue (a file two writers touched is charged in full).
      verify: `grep -c 'own_edit_attribution' src/scripts/hooks/end_review_nudge_hook.ts` -> /[1-9]/

## Phase 3 — container verifiers in detector C

- [ ] 3.1 Red first: the two container commands of the source's F2 table clear detector C in `tests/scripts/turn_end_gate_hook.test.ts`, the container negatives do not. Then route detector C and the run recorder through `isVerificationCommandInContainer`.
      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts tests/scripts/verification_command_anchoring.test.ts tests/scripts/verification_command_resolver_parity.test.ts` -> 0
- [ ] 3.2 Replay: `./scripts-run src/scripts/measure_turn_end_gate --store <store> --show-fires` before and after on the local stores; detector C fires whose last shell call is a `docker exec` / `docker compose exec` verifier drop to 0.
      verify: the after-run prints 0 detector C fires on a container-verifier command

## Phase 4 — credential operands

- [ ] 4.1 Red first: the must-allow shapes of `tests/scripts/credential_operands.test.ts` pass `verdictFor` in `tests/scripts/hooks/block_credential_reads.test.ts`, every must-refuse shape stays refused. Then judge each segment with `narrowedSegmentVerdict`, produce the ratification record (`block_*.ts` is gated), and flip step 1.8 of `road-to-17-0-follow-ups` with a pointer here.
      verify: `npx vitest run tests/scripts/hooks/block_credential_reads.test.ts tests/scripts/credential_operands.test.ts` -> 0 and `./scripts-run src/scripts/check_kernel_edit_ratified` -> 0

## Phase 5 — the ceiling

- [ ] 5.1 Measure the dispatch bundle with Phases 1-4 in place, raise `max_bytes` in `src/config/hook-bundle-budget.json` by the measured growth plus the stated margin with a `raise_log` entry, and land it with a ratified record (cap: 3 rounds; not ratified → stop and return to the owner).
      verify: `./scripts-run src/scripts/check_hook_bundle_composition` -> 0

## Acceptance Criteria

- [ ] AC-1: On the live path a read-only session beside 703 foreign lines gets no review advisory, and a session's count equals its attributed lines (2.1).
- [ ] AC-2: A container-run verifier clears detector C and the container negatives do not (3.1).
- [ ] AC-3: A `git fetch` or `git pull` report writes no merge marker and emits no push reminder (1.1).
- [ ] AC-4: Every must-allow credential shape passes the live guard and every must-refuse shape is still refused (4.1).
- [ ] AC-5: The bundle ceiling is raised only under a ratified record (5.1).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Own-edit attribution hides real work | implementation | A shell write whose target the text does not name leaves the verified count short, so a session that owes a review can stay silent (D4 chose under-reporting) | `fallback` carries the reason; the legacy count stays in shadow so the miss rate is measurable before the advisory is trusted | Phase 2 — own-edit count in the review nudge |
| 2 | Credential narrowing opens a read path | product | A pattern-operand class could be abused to print a secret | the threat pass and the must-refuse list in `credential_operands.test.ts`; ratification record required | Phase 4 — credential operands |
| 3 | The raise does not ratify | implementation | The sibling wiring's raise failed to converge in 33 rounds | phases land as separate measured slices; the 3-round cap returns the decision to the owner | Phase 5 — the ceiling |
