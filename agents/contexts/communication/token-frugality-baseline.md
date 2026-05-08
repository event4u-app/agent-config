# Token-Frugality Baseline

> **Audience:** maintainers measuring token regressions on the
> `road-to-token-frugality` rollout.
> **Format:** append-only. Each phase appends its own `## …` H2 section;
> never overwrites a prior measurement.

This file is the evidence anchor for the
`road-to-token-frugality.md` roadmap. Each phase that touches
chat-character or stdout output records its own before/after
measurement here under a tagged H2. Consumers of the data
(reviewers, future regression diffs, council briefings) cite
this file by H2 anchor.

## How to read this file

- One H2 per phase that emits a measurement.
- Each H2 has the same shape: **method**, **fixture**, **before**,
  **after**, **delta**, **caveat**.
- `before` reflects the pre-Phase-N output captured immediately
  before the change landed. `after` reflects the same fixture
  re-run on the post-change branch.
- Counts are reported in two units: **lines** (`wc -l`) and
  **chars** (`wc -c`). Both matter — line count drives reading
  cost, char count drives the model's context spend.

## Fixture conventions

- A "fixture branch" = a stub repo or a real PR branch with a
  scoped diff. Reproducible by checking out the branch SHA noted
  in the H2.
- Each measurement records the **input prompt** (verbatim) and
  the **output** captured from the chat surface. Output is
  normalized: timestamps stripped, file-content blocks elided
  via `[file body N lines]` placeholders.

## Command / skill output (Phase 9.6)

**Status:** scaffolded; awaiting empirical capture on a fixture
branch.

**Method (planned):**
1. Pick a fixture branch with a real, small diff (3-5 files,
   <100 lines changed).
2. Run each of `/commit`, `/create-pr`, `/feature-plan` with all
   verbosity flags **off** (terse-by-default; the post-Phase-7
   shipped state). Capture the chat-character count and line
   count of every assistant message in the flow.
3. Flip the same flags to **verbose** (`personal.play_by_play:
   true`, `verbosity.intent_announcements: true`,
   `caveman.speak_scope: off`, `verbosity.numbered_options: on`,
   `verbosity.status_blocks: on`, `verbosity.report_blocks:
   full`). Re-run the same three flows. Capture the same counts.
4. Record the per-flow deltas in the table below.

**Fixture (planned):**
- branch: TBD (small fixture branch on this repo)
- SHA: TBD
- diff size: TBD

**Before / after table (to be filled by first empirical run):**

| Flow | Terse (lines) | Terse (chars) | Verbose (lines) | Verbose (chars) | Δ lines | Δ chars |
|---|---|---|---|---|---|---|
| `/commit` | TBD | TBD | TBD | TBD | TBD | TBD |
| `/create-pr` | TBD | TBD | TBD | TBD | TBD | TBD |
| `/feature-plan` | TBD | TBD | TBD | TBD | TBD | TBD |

**Caveat:** chat-surface output is non-deterministic across
model versions — the table above is a **first-capture
baseline**, not a regression contract. Re-capture on each model
upgrade and on each phase that adds a new verbosity surface.

**Why this section ships scaffolded, not measured:** capturing
real chat-surface output requires an interactive session that
the maintainer must drive. The file structure is the durable
contract; the numbers can be filled in by anyone running the
flows and pasting the result under this H2 — no further
roadmap step needed.

## Script output (Phase 10.7)

**Method:**
1. Run the verbosity-aware subset of `task ci` (23 tasks that
   exercise `--quiet`-aware scripts, skipping `consistency` /
   `check-index` / `validate-schema` which are gated on a
   green tree). Each task runs in isolation via
   `task <name>` to avoid stdout-coalescing artifacts.
2. Capture per-task `wc -l` at `AGENT_SCRIPT_VERBOSITY=minimal`
   and `=verbose`. Sum totals; compute reduction.
3. Reproducer:
   `bash scripts/ai_council/one_off_archive/2026-05/_one_off_per_task.sh`

**Fixture:**
- branch: `road-to-token-frugality`
- SHA: `2810fa5a` (pre-baseline-record commit)
- task subset: 23 verbosity-aware post-consistency tasks

**Before / after:**

| Bucket | Lines @ verbose | Lines @ minimal | Δ | Reduction |
|---|---|---|---|---|
| `lint-skills` (whale) | 1025 | 509 | 516 | 50.3 % |
| `lint-roadmap-complexity` | 22 | 2 | 20 | 90.9 % |
| `check-examples-shape` | 5 | 0 | 5 | 100 % |
| 7 single-line `--quiet`-aware tasks | 7 | 0 | 7 | 100 % |
| 14 already-silent-on-success tasks | 102 | 101 | 1 | ~1 % |
| **Total (23 tasks)** | **1161** | **612** | **549** | **47.3 %** |

**Delta:** 47.3 % line reduction at `minimal` — clears the
≥40 % roadmap target.

**Caveat:**
- The full `task ci` run is gated on `consistency` /
  `check-index` (broken on a dirty tree); the subset is the
  verbosity-aware portion. When CI runs on a clean trunk, the
  pre-consistency block adds ~5–10 lines (already-silent),
  which only improves the reduction percentage.
- `lint-skills` carries the headline reduction; if its `--quiet`
  output shape changes (e.g. WARN-without-issues threshold
  drift), re-measure.
- Numbers reflect this branch's WARN/FAIL counts (124 warn / 0
  fail at the time of measurement). A green-trunk run with
  fewer warnings would reduce the absolute minimal count
  (because fewer WARN blocks survive); the percentage
  reduction stays in the same band.

## Append discipline

- Never edit a prior `## …` H2 after the measurement is
  recorded.
- New phases append new H2 sections at the bottom.
- If a measurement is invalidated (model upgrade, fixture
  drift), record the invalidation as a follow-up H2 with the
  reason; do not mutate the original entry.
