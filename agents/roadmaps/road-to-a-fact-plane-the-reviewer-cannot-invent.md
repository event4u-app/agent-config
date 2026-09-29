---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Nothing in the active estate can be archived to pay for this: the one roadmap on an adjacent subject (`road-to-trigger-eval-freshness-has-no-writer`) owns a different gate and a different field, and parking it would drop a live finding rather than pay for one; merging this into it would put a release-gate soundness defect behind a freshness roadmap's checkpoints, where the release gate cannot see it."
relates:
  - slug: road-to-trigger-eval-freshness-has-no-writer
    relation: disjoint
---
# Road to a fact plane the reviewer cannot invent

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t05/` — a transcript of sixteen
> independent release reviews of the same cut, plus a scored comparative audit
> of this tree against nine peer packages. The convergence below is the source's,
> re-derived here against the current tree.

## Goal

A self-review finding that asserts a *factual* property of the span — an
artifact was deleted, a path is absent, a feature is outside the range, a count
is N — is decided against a recorded fact, never reconstructed by a model from
the partition of the diff it happened to receive. Finished means: the review
prompt is handed those facts as inputs, `contradictedByTree` no longer has to
disprove a class of claim the reviewer should never have been able to make, and
a finding that asserts removal *within* a surviving file still blocks.

## Context — three facts re-derived at current `main`

1. **`contradictedByTree` is sound for whole-file deletion and unsound for
   in-file removal.** `src/scripts/self_review_gate.ts:185-193` — `namedArtifacts`
   adds `f.file` unconditionally as its first token. `:221-241` — the loop returns
   a disproof on the **first** named artifact that is absent from the range's
   deletion set *and* present in the tree. A finding reading "digest verification
   was removed in `install.ts`" satisfies `assertsDeletion` (`:197`), names a file
   that was modified rather than deleted, and that file exists — so it is
   annotated `contradicted` and de-blocked. The function's own header (`:217-219`)
   claims "a genuine deletion satisfies neither half", which holds only for the
   whole-file case it was written against.
2. **The reviewer sees part of the span by construction.** `MAX_REVIEW_CHUNKS = 6`
   (`self_review_gate.ts:492`); the cut that produced this source read 202 of 401
   files, and two `critical security` findings asserted deletions of skills the
   range never touched. That incident is recorded in the function's own header
   (`:223-230`) as the reason the mechanism exists.
3. **No fact plane exists.** The string `fact plane` appears in no file of this
   tree and in no earlier inbox round — this is a first arrival, not a repeat.

## Non-goals

- A second reviewer that reviews the first. The source names this explicitly as
  the wrong direction, and a family of `contradictedByX()` filters is that
  shape.
- Raising `MAX_REVIEW_CHUNKS`. Coverage is a budget question this roadmap does
  not reopen.
- Weakening any existing refusal. A genuine deletion blocks before this change
  and blocks after it.

## Phase 1 — Name the unsoundness before widening anything

- [ ] **1.1 Pin the in-file-removal case as a failing test.** Add a case to the
      existing `self_review_contradicted` suite: a finding whose `file` is a
      *modified* path and whose detail asserts a removal of something inside it.
      The test asserts the finding is **not** annotated `contradicted`. It must
      be seen red against the current implementation before any fix.
      verify: the new case fails on unmodified `self_review_gate.ts`, and the
      13 existing cases in that file stay green
- [ ] **1.2 Narrow the disproof to whole-artifact claims.** Restrict the
      disproof so a candidate that resolves to a path the range **modified**
      cannot carry it — a modified file is evidence the range touched the
      artifact, which is the opposite of the disproof's premise.
      verify: 1.1's case goes green; the whole-file fabrication case the header
      cites (`the range deletes nothing, tree holds the skill`) stays green
- [ ] **1.3 Record what the narrowed gate still cannot decide.** One paragraph
      in the module header naming the residue: a claim about a symbol, an
      export, or a behaviour has no path to check, and the gate says nothing
      about it.
      verify: `grep -c 'cannot decide' src/scripts/self_review_gate.ts` is ≥ 1

## Phase 2 — Hand the reviewer its facts

- [ ] **2.1 Emit the fact set the review request already computes.** The gate
      already derives the range's deleted paths, its changed paths and the
      working tree's presence check. Serialise exactly those three as a block
      inside each review request, so the model reads them rather than inferring
      them from its chunk.
      verify: a dry-run of the gate over a two-commit range prints a request
      containing the three lists, and the lists match `git diff --name-status`
      for that range
- [ ] **2.2 State in the prompt that the block is authoritative.** One sentence:
      a claim contradicting the supplied lists is a defect in the finding, not a
      finding about the tree.
      verify: the sentence is present in the emitted request from 2.1
- [ ] **2.3 Measure whether it moved anything.** Over the next release cut,
      record the count of findings that assert a factual property and the count
      the tree disproved. A rise in disproofs after 2.1 falsifies the premise
      that supplying the facts prevents the class.
      verify: the two counts are readable from the release-findings artifact of
      the next cut, and this file records them

## Acceptance criteria

- [ ] AC-1 — A finding asserting removal of something inside a file the range
      modified blocks, and a test pins it.
- [ ] AC-2 — A finding fabricating a whole-artifact deletion the range never
      made is still disproved, and the existing test pins it.
- [ ] AC-3 — A reader of one emitted review request can name, from that request
      alone, which paths the range deleted and which the tree holds.
- [ ] AC-4 — The module header names one class of factual claim the gate still
      cannot decide.
- [ ] AC-5 — No new `contradictedBy*` function is added by this roadmap.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Narrowing the disproof re-blocks the fabrications it was built to stop | implementation | `contradictedByTree` exists because a partitioned reviewer asserted deletions of skills the range never touched, and the mechanism's header records that incident. Step 1.2 removes the disproof from any candidate resolving to a modified path — and a fabricated finding can name a modified file just as easily as an untouched one. Narrow it by one step too far and every release cut regains the fabricated-critical blocks the gate was written to absorb. | Step 1.2's verify pins both directions at once: the new in-file case must go green, and the whole-file fabrication case the header cites — the range deletes nothing while the tree holds the skill — must stay green. Step 1.1 requires the new case to be seen red against the unmodified gate first, so a fix that passes by weakening the test is visible rather than silent. | Phase 1 — Name the unsoundness before widening anything |
| 2 | The supplied fact block grows the request past its budget | implementation | The review request is already chunked at `MAX_REVIEW_CHUNKS = 6` because the span does not fit; the cut that produced this source read 202 of 401 files. Prepending a fact block to every chunk spends budget the diff needs, and on a large range a naive serialisation of the same three lists into six requests multiplies the cost while displacing the code the reviewer is there to read. | Step 2.1 serialises only the three lists the gate already computes — deleted paths, changed paths, tree presence — and they are paths rather than diffs, so the block scales with file count and not with change size. Nothing new is computed and no fourth list is added; the budget question of raising the chunk cap is an explicit non-goal. | Phase 2 — Hand the reviewer its facts |
| 3 | Supplying facts changes nothing because the model ignores them | product | The whole premise is that a reviewer fabricates factual claims because it cannot see the range, and that showing it the range stops the fabrication. The competing explanation is that the model asserts confidently regardless of what it was handed, in which case Phase 2 adds tokens to every request and prevents nothing — and the change would look successful because the gate still blocks the same findings it always did. | Step 2.3 pre-registers the falsifier before the change lands: the count of findings asserting a factual property and the count the tree disproved are recorded over the next release cut, and a disproof count that does not fall after 2.1 is the honest null. This file records that result rather than the mechanism being widened to chase it. | Phase 2 — Hand the reviewer its facts |
| 4 | The narrowed gate refuses a release on a finding that is still wrong | product | After Step 1.2 a finding naming a modified path keeps its block even when its claim is false, because the gate can no longer disprove that class. An operator then faces a red release over a fabricated finding with nothing in the output explaining why the usual disproof did not apply, and the cheapest exit is to override the gate wholesale. | Step 1.3 puts one paragraph in the module header naming the residue — a claim about a symbol, an export or a behaviour has no path to check and the gate says nothing about it — verified by a grep for `cannot decide`. An operator adjudicating a block can then read what the gate did and did not check, and override that one finding rather than the mechanism. | Phase 1 — Name the unsoundness before widening anything |
