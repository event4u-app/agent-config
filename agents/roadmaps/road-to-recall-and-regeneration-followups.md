---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
estate_growth_exempt: >-
  Grows concern_count 59 -> 60 for `memory-recall`, the pre_tool_use concern that delivers a stored
  memory before the action. The growth is claimed here because the finding behind it is about the
  estate rather than about a feature: in one autonomous run the agent walked into four known traps
  and all four already had a memory file, one of them six weeks old, and the memory index records
  the same pattern measured on 2026-08-20 — of eleven error classes, nine had a file already and
  all nine were read after the failure. `memory_lookup` shipped as a CLI that nothing ever called,
  so recall was entirely model-carried. A concern that costs 768 B on the hottest slot is the price
  of closing that; a fifth memory file would have cost nothing and changed nothing.
estate_offset_exempt: >-
  Nothing in the active estate is a trade for this. The eight active roadmaps are mechanism work on
  unrelated surfaces — a conformance check, a component contract, an obligation ledger, a substrate
  stub — and archiving one to buy the slot would dispose of open work to pay for a concern that
  exists because the estate's own recall failed. The one roadmap that would have been the natural
  offset, `road-to-per-turn-hook-economy`, is already gone from the active set, which is part of
  why this concern's per-event cost had to be argued from scratch in its admission row rather than
  read off an owner.
---
# Road to recall and regeneration followups

> **Source:** the autonomous drain run of 2026-09-12, which produced both mechanisms this roadmap
> carries the residue of — `memory-recall` and `check_generator_sync`. Each item below is a gap the
> run measured in its own output, not a speculative improvement.

## Goal

The two mechanisms built on 2026-09-12 cover the incidents they were seeded from **and** the
fourth one the same run produced after they were written, and two stale records found while
building them say what is true rather than what was true.

The honest state at the end of that run: `check_generator_sync` carries two source→generator
triples and the run immediately hit a third it does not cover. That is the expected failure of a
registry seeded from known incidents, and it is worth closing rather than explaining.

## Phase 1 — The triple the registry missed

- [ ] **1.1 Add the `hook_manifest.yaml` → `hook_manifest.json` triple** to
      `check_generator_sync`. The compiled manifest is generated from the YAML by
      `compile_hook_manifest`, and a comment-only YAML edit on 2026-09-12 left the committed JSON
      on the previous fingerprint until CI caught it.
      verify: edit a comment in `src/scripts/hook_manifest.yaml` without recompiling, run
      `./scripts-run src/scripts/check_generator_sync` and read exit 1 naming the triple;
      recompile and read exit 0.
- [ ] **1.2 Record why a green local test did not catch it.** Running
      `hook_manifest_compiled.test.ts` locally passed, because an earlier `compile_hook_manifest`
      had already fixed the **working tree** while the defect was that the fix was never committed.
      verify: the note names the discriminator — read the committed blob
      (`git show HEAD:<path>`), never the worktree, when a generated artefact is the suspect.

## Phase 2 — Two records that stopped being true

- [ ] **2.1 Correct the hook-concern downstream-surface memory.** Its recipe for regenerating
      `hook_manifest.json` produces a file that reds `hook_manifest_compiled.test.ts`; the compiled
      shape is now `{manifest, fingerprint}`.
      verify: following the recipe as written produces a file the test accepts.
- [ ] **2.2 Reconcile the gate-coverage header population count.** It claims 322 against an actual
      328, and 329 once `check_generator_sync` is counted — a delta of 7 against a tested tolerance
      of 15, so it is drift rather than breakage and is worth fixing before it reaches the
      tolerance.
      verify: the header figure equals the measured row count, and
      `check_gate_coverage` stays green.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The registry grows one triple per incident forever | product | A registry seeded from known failures only ever covers the last failure, and the 2026-09-12 run hit an uncovered triple within hours of the gate landing | Phase 1.1 closes the known gap; the deeper question — whether the source set can be derived rather than enumerated — is named here and deliberately not answered, because the install-bundle triple already derives its sources from the artefact and the manifest triple may be able to as well | Phase 1 — The triple the registry missed |
| 2 | A green local test hides an uncommitted fix | implementation | A generated artefact repaired in the working tree and never committed passes every local check while CI reads the committed blob and reds | Phase 1.2 records the discriminator rather than the incident, so the lesson is the command to run and not the story | Phase 1 — The triple the registry missed |
| 3 | The recall concern is tuned out | product | A pre_tool_use nudge that fires too often is ignored within a day, and this one has no adoption instrument | The firing floor is a committed predicate table with a near-miss test per row, so a row that starts over-firing reds a test; adoption itself is stated as unmeasured rather than assumed | Phase 2 — Two records that stopped being true |
| 4 | Correcting a stale memory makes it stale differently | implementation | Both Phase 2 items are records about generated shapes, which is exactly the class that goes stale | Each verify line runs the recipe rather than reading it, so the record is checked against the mechanism it describes | Phase 2 — Two records that stopped being true |

## Acceptance Criteria

- [ ] AC-1 — `check_generator_sync` carries the manifest triple, proven red before regeneration and
      green after.
- [ ] AC-2 — The committed-blob-versus-worktree discriminator is recorded where a reader
      diagnosing a stale generated artefact will meet it.
- [ ] AC-3 — The hook-concern downstream-surface recipe produces a file its own test accepts.
- [ ] AC-4 — The gate-coverage header count equals the measured row count.
