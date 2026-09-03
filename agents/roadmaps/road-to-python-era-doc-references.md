---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-self-description-truth
    relation: extends
    note: "carries that roadmap's step 2.2 finding, which asked for a count and got 946 across 233 live doc files"
---
# Road to python-era doc references

> **Source:** step 2.2 of `road-to-self-description-truth`, swept on 2026-09-03
> against `2b3d2b347`. That step asked for the count of `.py` references under
> `docs/` that resolve to no file. It is not zero, and the population is three
> orders of magnitude larger than the single instance that prompted the sweep.

## Goal

A reader following a script path named in a live doc reaches a file that exists,
or is told plainly that the path is historical. When this is finished, no live
doc under `docs/` names a Python-era entry point as if it were callable today,
and something notices the next time one appears.

## Context

The Python era ended with ADR-200. The entry points did not stop being named.

Swept over every `docs/**/*.md`, matching path-shaped `.py` tokens and testing
each against the tree:

| Bucket | Occurrences | Distinct paths |
|---|---|---|
| live docs (contracts, decisions, guidelines, top-level) | **946** | 449 |
| historical (`docs/archive/`, CHANGELOGs, `docs/migrations/`) | 143 | 51 |
| **total** | **1,089** | 475 |

The historical bucket is not drift and must not be "fixed": a changelog naming a
file as it existed then is correct, and rewriting it would falsify the record.
The live bucket is drift, and it spans **233 files**.

Densest live files: `docs/decisions/adr-evidence-sweep-2026-08.md` (43),
`docs/migration/yaml-roundtrip-spike.md` (25),
`docs/contracts/install-layout.md` (15), `docs/contracts/STABILITY.md` (15),
`docs/contracts/hook-architecture-v1.md` (14),
`docs/contracts/implement-ticket-flow.md` (14),
`docs/decisions/ADR-006-skill-tools-python-pilot.md` (14),
`docs/architecture.md` (12), `docs/threat-model.md` (12).

Most-cited dead paths: `scripts/install.py` (62), `install.py` (51),
`scripts/release.py` (45), `scripts/condense.py` (23),
`scripts/skill_linter.py` (19), `scripts/check_always_budget.py` (12).

### Two things this roadmap must not assume

**Not every live-doc mention is drift.** An ADR whose *subject* is the Python
pilot (`ADR-006-skill-tools-python-pilot.md`) names Python files correctly — the
decision was about them. A decision record describing what was true when it was
written is history wearing a live path. The rename set and the leave-alone set
have to be separated by reading, not by a regex over the whole tree.

**A mechanical rename is the tempting wrong fix.** `install.py` → `install.ts`
is right where a TypeScript successor exists at the same relative path and wrong
everywhere else — several Python-era scripts were merged, split, or dropped
rather than ported, and a rename that invents a successor is worse than the dead
path it replaces, because it looks resolvable.

## Phase 1 — Separate drift from history

- [ ] **1.1 Classify the 449 distinct live paths.** Three buckets: has a
      successor at a derivable path · was merged, split or dropped · is
      correctly historical in context. The classification is the deliverable;
      the edits are Phase 2.
      verify: every one of the 449 carries a bucket and, for the first bucket,
      the successor path it maps to. A path with no bucket fails the step.
- [ ] **1.2 Record the leave-alone set and why.** History-in-context mentions and
      the whole `docs/archive/` tree stay untouched, and the reason is written
      down where the next sweep will find it.
      verify: a named list, and a re-run of the 2.2 sweep whose live count minus
      the leave-alone set equals the Phase 2 work set.

## Phase 2 — Repair the drift set

- [ ] **2.1 Rewrite the has-a-successor bucket.** Path-for-path, no prose
      rewrites beyond what the path change forces.
      verify: the sweep reports zero live dead paths in this bucket, and no
      file outside the bucket changed.
- [ ] **2.2 Handle the merged/split/dropped bucket by describing, not renaming.**
      Where no successor exists, say what happened rather than invent a path —
      the pattern `road-to-self-description-truth` used for the capability-matrix
      header, where the dead paths were described rather than reproduced.
      verify: no invented path; each entry either resolves or is prose that names
      no file.

## Phase 3 — Notice the next one

- [ ] **3.1 Decide whether a gate is warranted, and record the answer either
      way.** A dead-path linter over `docs/` is cheap to write and easy to make
      noisy — `docs/archive/` alone would need an exclusion, and the
      history-in-context class cannot be recognised mechanically. A `no` with the
      reason is a complete answer to this step.
      verify: the decision is in this file with its reasoning, and if the answer
      is yes, the gate exists, is registered, and its polarity is tested in both
      directions.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A mechanical rename invents a successor that never existed | implementation | Several Python-era scripts were merged, split or dropped rather than ported; a rename makes a dead path look resolvable, which is worse than leaving it dead | 1.1 forces every path into a bucket before any edit, and 2.2 forbids inventing a path for the no-successor bucket | Phase 1 — Separate drift from history |
| 2 | History is rewritten as if it were drift | product | A changelog or a decision record naming a file as it existed then is correct; editing it falsifies the record | 1.2 names the leave-alone set explicitly and the archive tree is excluded by construction | Phase 1 — Separate drift from history |
| 3 | The sweep is re-run with a different matcher and the numbers move | implementation | A count nobody can reproduce is not a baseline | The matcher is pinned in this file's Context and 1.2 requires the arithmetic to close against it | Phase 1 — Separate drift from history |
| 4 | A dead-path gate lands noisy and is ignored | product | An unignorable exclusion list is the shape a warning takes on its way to being a comment | 3.1 makes "no gate, here is why" a complete and acceptable answer rather than a failure | Phase 3 — Notice the next one |

## Acceptance Criteria

- [ ] AC-1 — every one of the 449 distinct live dead paths carries a
      classification, and the three buckets partition the set with no remainder.
- [ ] AC-2 — the live-doc dead-path count is zero for the has-a-successor
      bucket, measured with the same matcher this roadmap's Context pins.
- [ ] AC-3 — no path was invented: every rewrite either points at a file that
      exists or names no file at all.
- [ ] AC-4 — `docs/archive/`, the CHANGELOGs and the named history-in-context
      files are byte-identical to their state at the start of the work.
- [ ] AC-5 — Phase 3 carries a recorded decision on the gate question, and a
      "no" states its reasoning.
