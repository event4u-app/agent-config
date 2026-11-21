---
complexity: lightweight
status: ready
review_by: 2026-12-21
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Carries steps 1.3, 1.4, 1.5, 3.2, 3.3 and 4.4 of road-to-done-claims-with-read-exit-codes, which the owner took off the live hook path on 2026-11-21 (option 2: land the features without growing the dispatch bundle). Created in the same change that defers those steps, so the items stay alive in the active estate. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
relates:
  - slug: road-to-done-claims-with-read-exit-codes
    relation: extends
    note: "Its steps 1.3, 1.4, 1.5, 3.2, 3.3 and 4.4 are carried here: the classifier, the ratio check and their tests already exist off the live path; this file wires them in."
  - slug: road-to-live-trigger-eval
    relation: disjoint
    note: "Keyword overlap only (`live`, `read`); it evaluates trigger delivery, not the turn-end gate."
  - slug: road-to-single-line-estate-claims
    relation: disjoint
    note: "Keyword overlap only (`claims`, `read`); it is about estate claims, not run classification."
  - slug: road-to-standing-rule-delivery-per-machine
    relation: disjoint
    note: "Keyword overlap only (`live`, `read`); it is about rule delivery, not the hook bundle."
---
# Road to done claims with read exit codes — live wiring

> **Source:** decision D12 of `road-to-done-claims-with-read-exit-codes`
> (archived). On 2026-11-21 the owner withdrew the dispatch-bundle raise that
> 33 ratification rounds did not converge on (option 2): the features landed as
> library, CLI and tests, and `src/config/hook-bundle-budget.json` kept
> origin/main's ceiling. This roadmap carries exactly the live wiring and the
> bundle raise it needs.

## Goal

The turn-end gate reads masked exit codes, `rtk`-wrapped runs and partial
ratios on the live path, with a ratified ceiling for the bytes that costs, and
records `unlisted_surface` from a chunk that only a claimed turn loads.

## Context

- **What exists.** `exitMasking`, `commandSegments` and `classifyRunWithMasking`
  in `src/scripts/_lib/exit_masking.ts`; `partialRatioIn`, `completionClaimAt`
  and the record-only counter helpers in `src/scripts/_lib/coverage_claim.ts`.
  Tests: `tests/scripts/exit_masking.test.ts`,
  `tests/scripts/verification_command_anchoring.test.ts`,
  `tests/scripts/coverage_claim.test.ts`. The coverage report and the roadmap
  lint read them; nothing the hook dispatcher imports does.
- **What is missing.** `classifyRun` in `_lib/verification_evidence.ts` does not
  return `exit_masked`; `segmentVerifies` and `COMMAND_PREFIXES` do not peel
  `rtk`; `runDetectors` in `hooks/turn_end_gate_hook.ts` does not run G, and
  `coverage` is not in `DetectorId` / `DETECTOR_IDS`.
- **Constraint.** The branch measured the full wiring at +14,137 B over
  origin/main (1,609,365 B against 1,595,228 B), with 72 B of headroom.
  `hook-bundle-budget.json` is ratification-gated (ADR-268 § 4): any raise needs
  a ratified record, and every reason stays record-only (D5, D6 of the source).

## Phase 1 — masked exit codes on the live path

- [ ] 1.1 Red first: a hook-level test that a turn whose only run after the edit is `npx tsc --noEmit | tail -5` with exit 0 reads as an instrument gap, not a pass, and that the finding text names `set -o pipefail` and the runner's filter flag. Then route `classifyRun` through the masking check (`exit_masked` in `InvalidRunReason` and `INSTRUMENT_GAP_REASONS`, only a recorded 0 replaced) and add the repair text to `describeRecordFinding`.
      verify: `npx vitest run tests/scripts/verification_evidence.test.ts tests/scripts/turn_end_gate_hook.test.ts` -> 0
- [ ] 1.2 Red first: `rtk vitest run` and `rtk proxy npx vitest run` with exit 1 classify as failures, `rtk gain` as no verification. Then peel `rtk` / `rtk proxy` in `DELEGATING_HEADS` and `COMMAND_PREFIXES`.
      verify: `npx vitest run tests/scripts/verification_command_anchoring.test.ts tests/scripts/verification_evidence.test.ts` -> 0

## Phase 2 — detector G on the live path

- [ ] 2.1 Red first: a claimed turn reporting `165 von 405` ends allowed and counts one `partial_ratio` finding in `<key>.recorded.json`. Then add `coverage` to `DetectorId` and `DETECTOR_IDS`, run `partialRatioIn` in `runDetectors` when no dispatch is open, keep it out of the verdict (`refusingFindings`), age the counter file in the pruner, and add `coverage` to the dispatch-censored set in `measure_turn_end_gate.ts`.
      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts tests/scripts/turn_end_refusals.test.ts tests/scripts/measure_turn_end_gate.test.ts` -> 0
- [ ] 2.2 Register G's row, its 40 % / 3 bar and its recorded-findings sample floor in `docs/contracts/turn-end-detector-demotion.md`, now that `DetectorId` carries it.
      verify: `grep -c "coverage" docs/contracts/turn-end-detector-demotion.md` -> /[1-9]/

## Phase 3 — the ceiling

- [ ] 3.1 Measure the dispatch bundle with Phases 1-2 in place, raise `max_bytes` in `src/config/hook-bundle-budget.json` by the measured growth plus the stated margin with a `raise_log` entry, and land it with a ratified record (cap: 3 rounds; not ratified → stop and return to the owner).
      verify: `./scripts-run src/scripts/check_hook_bundle_composition` -> 0

## Phase 4 — `unlisted_surface` in a claim chunk

Carried from step 4.4 of the source (D11): `unlistedSurfaceIn` in
`src/scripts/_lib/unlisted_surface.ts` and the reader in
`src/scripts/_lib/live_surfaces.ts` exist with their tests
(`tests/scripts/coverage_claim.test.ts`, `tests/scripts/derive_live_surfaces.test.ts`);
`verify:surfaces` uses the reader today. Inline, the reader adds about 15.7 KB
to the dispatch bundle, which is why it goes into a chunk. It stays record-only
(D7 of the source) until its own revisit condition holds.

- [ ] 4.1 Red first: a hook-level test that a claimed turn with an edit under a derived surface and no run after the edit records `unlisted_surface`, and that a turn without a completion claim does not load the chunk.
      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts` -> 0
- [ ] 4.2 Load `unlistedSurfaceIn` from a chunk only when `completionClaimAt` finds a claim, with its own entry and ceiling in `src/config/hook-bundle-budget.json`, the digest check the existing chunks use, and a ratification record for the ceiling.
      verify: `./scripts-run src/scripts/check_hook_bundle_composition` -> 0

## Acceptance Criteria

- [ ] AC-1: On the live path, a masked 0 reads as `exit_masked` and an `rtk`-wrapped run gets a verdict; a nonzero recorded code keeps its refusal (1.1, 1.2).
- [ ] AC-2: A claimed partial ratio is counted as a `coverage` finding and never refuses the turn (2.1).
- [ ] AC-3: The bundle ceiling is raised only under a ratified record (3.1).
- [ ] AC-4: A claimed turn that edited a derived surface and drove nothing after the edit records `unlisted_surface` on the live path, and the dispatch bundle does not grow by the reader (4.1, 4.2).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The raise does not ratify again | implementation | The same raise failed to converge in 33 rounds on the source branch. | Phases 1 and 2 land as separate measured slices, so a raise can be ratified on the smaller scope first; the 3-round cap returns the decision to the owner. | Phase 3 — the ceiling |
| 3 | The chunk loads on every turn anyway | implementation | A loader keyed to a broad trigger would put the parse back on most Stop events. | 4.1 pins that a turn without a completion claim does not load the chunk. | Phase 4 — `unlisted_surface` in a claim chunk |
| 2 | A masked reading demotes a real failure | implementation | Shell paths where a verifier's nonzero code looks like a filter's. | Only a recorded 0 is ever replaced (D9 of the source), pinned by the existing exit-masking tests. | Phase 1 — masked exit codes on the live path |

## Notes

- The ratification-prompt evidence of the source branch's 33 rounds stays under
  `agents/evidence/` as the record of what the reviewers found; every finding is
  already fixed with a test in the off-path modules.
