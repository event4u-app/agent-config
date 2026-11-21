---
complexity: lightweight
status: ready
review_by: 2026-12-21
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Carries step 4.4 of road-to-done-claims-with-read-exit-codes, taken off the live hook path by decision D11 after 23 bundle-raise ratification rounds (council strategy round of 2026-11-21: reduce the reviewed scope). Created in the same change that defers the step, per the roadmap-progress-sync preservation test, so the item stays alive in the active estate."
estate_offset_exempt: "The change that creates this roadmap also archives road-to-done-claims-with-read-exit-codes, so the estate does not grow by it; it carries one deferred step, not new scope."
relates:
  - slug: road-to-done-claims-with-read-exit-codes
    relation: extends
    note: "Its step 4.4 (`unlisted_surface` on the live path) is carried here; the reason, the reader and their tests already exist."
  - slug: road-to-done-claims-with-read-exit-codes-live-wiring
    relation: depends
    note: "Its Phase 2 registers `coverage` in `DetectorId` and wires `partial_ratio` into `runDetectors`; this chunk adds the second reason on top of that."
---
# Road to `unlisted_surface` in a claim chunk

> **Source:** decision D11 of `road-to-done-claims-with-read-exit-codes`
> (archived), and the council strategy round of 2026-11-21
> (`agents/evidence/council/done-claims-ratification-strategy-20261121.question.md`):
> the anthropic seat chose a conditional chunk for detector G's repository-reading
> half, the openai seat asked for the classifier to be ratified on its own scope
> first. The classifier landed without this half; this roadmap brings it back.

## Goal

The turn-end gate records `unlisted_surface` on the live path again, from a
chunk that only a turn with a completion claim loads, so no other hook event
pays the parse.

## Context

- **What exists.** `unlistedSurfaceIn` in `src/scripts/_lib/unlisted_surface.ts`
  and the reader in `src/scripts/_lib/live_surfaces.ts`, with their tests in
  `tests/scripts/coverage_claim.test.ts` (through `coverageGapIn` over the
  hook's own prose views) and `tests/scripts/derive_live_surfaces.test.ts`. The
  `verify:surfaces` verb uses the reader today.
- **What is missing.** Detector G is not on the live path at all since the
  owner withdrew the bundle raise (D12 of the source roadmap, 2026-11-21);
  `road-to-done-claims-with-read-exit-codes-live-wiring` Phase 2 puts
  `partial_ratio` back. The surface reader adds about 15.7 KB on top, which is
  why it goes into a chunk.
- **Constraints.** The dispatch bundle and every chunk ceiling live in
  `src/config/hook-bundle-budget.json`, a ratification-gated file (ADR-268 § 4):
  the chunk's ceiling needs a two-seat verdict. `unlisted_surface` stays
  record-only (D7 of the source roadmap) until its own revisit condition holds.

## Phase 1 — the chunk

- [ ] 1.1 Red first: a hook-level test that a claimed turn with an edit under a derived surface and no run after the edit records `unlisted_surface`, and that a turn without a completion claim does not load the chunk.
      verify: `npx vitest run tests/scripts/turn_end_gate_hook.test.ts` -> 0
- [ ] 1.2 Load `unlistedSurfaceIn` from a chunk only when `completionClaimAt` finds a claim, with its own entry and ceiling in `src/config/hook-bundle-budget.json`, the digest check the existing chunks use, and a ratification record for the ceiling.
      verify: `./scripts-run src/scripts/check_hook_bundle_composition` -> 0

## Acceptance Criteria

- [ ] AC-1: A claimed turn that edited a derived surface and drove nothing after the edit records `unlisted_surface` on the live path, and the dispatch bundle does not grow by the reader.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A chunk ceiling that does not ratify | implementation | The chunk's ceiling is a new entry in a ratification-gated file, and the source roadmap's raise for this same code did not converge in 23 rounds. | The chunk carries only `unlistedSurfaceIn` and the reader, whose round findings are already fixed with tests; the ratification prompt names that scope alone. | Phase 1 — the chunk |
| 2 | The chunk loads on every turn anyway | implementation | A loader keyed to a broad trigger would put the parse back on most Stop events. | 1.1 pins that a turn without a completion claim does not load the chunk. | Phase 1 — the chunk |

## Notes

- The ratification rounds of the source roadmap found most defects in this half
  (URL crediting, surface parsing, credit for commands that cannot run, edit and
  command order); every one is fixed with a test in the existing modules, so the
  chunk moves code, it does not rewrite it.
