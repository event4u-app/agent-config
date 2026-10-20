---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-one-upstream-that-checks-what-leaves
entry_condition:
  what: road-to-a-retro-the-merge-runs step 4.4 closes, so a retro run writes package records carrying `principle` (un-parks 5.1; 5.2 also needs retro step 2.5), or a reviewed corpus of such records shows one subject per mechanism across installations (un-parks 3.2 and AC-3)
  when: after retro 4.4 lands and records accumulate
  who: whoever closes retro 4.4; the corpus reading is any session's
review_by: 2027-01-20
estate_growth_exempt: "later_roadmaps 104 -> 105 with active_roadmaps 20 -> 19, measured by check_estate_count at this change: the parent closed every runnable step and archived, and the archival sweep carried its four deferred items here so archiving buried none of them. Parking it in later/ instead of leaving it active is the move that keeps a drain lane from picking up steps that wait on retro step 4.4 or on a corpus; the total estate is unchanged."
---
# Road to one upstream that checks what leaves — carried

> **Source:** carried by the archival sweep on 2026-10-20 from
> [`road-to-one-upstream-that-checks-what-leaves`](../archive/road-to-one-upstream-that-checks-what-leaves.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.
> Parked in `later/` the same day: every step waits on another roadmap's open
> step or on a corpus that does not exist yet, so an active `[ ]` would send a
> drain lane to work it cannot build (the parent's own 5.1 note).

## Goal

Every step road-to-one-upstream-that-checks-what-leaves deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-one-upstream-that-checks-what-leaves

- [ ] **3.2 A mechanism fingerprint.** Deferred 2026-10-19 by D10: the
      fingerprint stays on the evidence hash until a corpus of records carrying
      `principle` shows one subject per mechanism; re-opens when that corpus
      exists. Changing the key earlier changes a cross-installation contract
      on no evidence. For records carrying `target` and
      `principle`, the fingerprint hashes those instead of the evidence, so the
      F5 pair clusters.
      **Open for a named reason, executed 2026-10-14:** `DefectFinding` carries
      `target?: string[]` (`src/scripts/_lib/self_repair.ts:112`) but the
      string `principle` appears **zero** times in that file. The field is the
      retro schema's, and that schema is step 0.3 of
      `road-to-a-retro-the-merge-runs` (35 open, 0 closed). Hashing `target`
      alone would cluster two different mechanisms found in the same file, so
      the half-built version is worse than the evidence hash it replaces.
      verify: `npx vitest run tests/scripts/self_repair.test.ts -t same-mechanism-same-fingerprint --reporter=verbose` -> /✓.*same-mechanism-same-fingerprint/
      **2026-10-19:** sequenced behind the same council round as 3.1 — the
      fingerprint change is the proposal's second half, and it changes no
      stored record because no producer sets `principle` yet.
      **2026-10-19, after the round (D9): not adopted.** The openai seat's
      objection holds against the formula as proposed — the retro defines
      `subject` as a canonical *claim*, so two mechanisms may share one, and
      `defect_class | target | principle` would merge them. It asked for a
      versioned key and a stable mechanism identifier, and would accept the
      formula only on corpus evidence that each subject maps to one mechanism
      across repositories. No such corpus exists until a producer writes the
      field, so this step now waits on evidence, not on a schema, and on the
      owner's decision under 3.1 for the public-contract half. The key is
      pinned unchanged by `claim-fields-change-neither-key-nor-body-yet`.
- [ ] **5.1 At most one offer per run.** A retro run whose package record passes
      the canonical threshold appends one release offer to its output; sending
      still needs the person's word in that turn.
      verify: `npx vitest run tests/scripts/retro.test.ts -t at-most-one-upstream-offer --reporter=verbose` -> /✓.*at-most-one-upstream-offer/
      **Deferred 2026-10-19, fourth measurement.** `retro.ts` exports
      `TARGETS` with `package-record` and the `ANALYSE_AT` threshold, so the
      classification half exists — but retro step 4.4 still produces no
      package record for an offer to be about, and building one here to
      attach an offer to is the second outward route K1 forbids. Three prior
      sessions reached the same reading (2026-10-14, 2026-10-17, 2026-10-19)
      and no new evidence has arrived since, so the glyph now says what the
      prose already said. **Un-defers to `[ ]`** when
      `road-to-a-retro-the-merge-runs` step 4.4 closes; the drain queue has
      no class for a wait on another roadmap's open step, so a `[ ]` here
      reads as runnable work and sends a lane to a step it cannot build.
- [ ] **5.2 A leak stops the offers.** Any egress or authorisation leak found
      after release turns offers off until the owner decides, and `/retro status`
      says so.
      verify: `npx vitest run tests/scripts/retro.test.ts -t leak-turns-offers-off --reporter=verbose` -> /✓.*leak-turns-offers-off/
      **Deferred 2026-10-19, same measurement.** Its second half — "`/retro
      status` says so" — is retro step 2.5, open and owner-reserved there as
      a new consumer command, and a kill switch with nothing to switch off
      is 5.1's offer. **Un-defers to `[ ]`** with 5.1, once retro 4.4 and
      2.5 both close.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-20 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-one-upstream-that-checks-what-leaves |

## Acceptance Criteria

- [ ] **AC-3** The same mechanism from two projects produces one fingerprint.
      Deferred with 3.2 (D10).
