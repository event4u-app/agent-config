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

## Measurement units — declared before any number below

Every figure in this file is one of three counts, each with the command that
produces it. A figure carried over from the source without being re-measured is
marked as such.

- **Test-case count** — `it(`/`test(` blocks in one file:
  `grep -c '^\s*\(it\|test\)(' <file>`.
- **Line reference** — 1-based line number in `src/scripts/self_review_gate.ts`
  **at the pre-change commit `dbf1c9179`**, read with
  `git show dbf1c9179:src/scripts/self_review_gate.ts | sed -n '<n>,<m>p'`.
- **Path count** — rows of `git diff --name-status <base>...HEAD`, split by the
  `D`/rename-old rule (deleted) and the surviving-path rule (changed).

## Findings — roadmap claims that did not reproduce

1. **"the 13 existing cases in that file"** (Step 1.1). Measured 14, at the
   pre-change commit and unchanged today. The suite had four `describe` blocks
   holding 2 + 2 + 2 + 4 + 4 = 14 `it(` blocks. The number is used only as a
   regression floor, so the step's contract is unaffected: 14 stayed green.
2. **"That incident is recorded in the function's own header (`:223-230`)"**
   (Context 2). Lines 223-230 at `dbf1c9179` are the parameter list and the
   first three statements of `contradictedByTree`'s **body**. The incident text
   ("202 of 401 files at the 16.1.0 cut … two `critical security` deletions of
   skills the range never touched") is at **`:204-210`**, inside the doc comment
   that runs `:199-220`. The claim that the incident is recorded in the header
   is true; the span cited for it is wrong.
3. **"the whole-file fabrication case the header cites … stays green"**
   (Step 1.2) reproduced exactly, and is now pinned in both directions rather
   than one — see the Step 1.2 evidence.

Context 1 and Context 3 reproduced as written: `namedArtifacts` adds `f.file`
unconditionally at `:187`, `assertsDeletion` is at `:197`,
`MAX_REVIEW_CHUNKS = 6` is at `:492`, and `fact plane` appeared in no file of
the tree other than this roadmap.

## Phase 1 — Name the unsoundness before widening anything

- [x] **1.1 Pin the in-file-removal case as a failing test.** Add a case to the
      existing `self_review_contradicted` suite: a finding whose `file` is a
      *modified* path and whose detail asserts a removal of something inside it.
      The test asserts the finding is **not** annotated `contradicted`. It must
      be seen red against the current implementation before any fix.
      verify: the new case fails on unmodified `self_review_gate.ts`, and the
      13 existing cases in that file stay green

      **Evidence — seen RED against the unmodified gate.** Three cases added.
      Two fail, one (the whole-file control) passes because the unmodified gate
      ignores the new argument, which is the correct reading of a control:

      ```
       FAIL  tests/scripts/self_review_contradicted.test.ts > contradictedByTree —
             in-file removal is not a whole-artifact deletion >
             does NOT disprove a removal asserted inside a file the range modified
      - Expected: null
      + Received: "the range deletes nothing matching `src/scripts/install.ts`, and
        `src/scripts/install.ts` is present in the tree — checked against
        `git diff --name-status base...HEAD` and the working tree, not against
        the review chunk."

       FAIL  … > leaves that finding merge-blocking through the annotation pass
      AssertionError: expected 'the range deletes nothing matching `s…' to be undefined

       Test Files  1 failed (1)
            Tests  2 failed | 15 passed (17)
      ```

      15 passing = **14** pre-existing cases (not 13 — see Findings 1) plus the
      one new control. All 14 stayed green.

- [x] **1.2 Narrow the disproof to whole-artifact claims.** Restrict the
      disproof so a candidate that resolves to a path the range **modified**
      cannot carry it — a modified file is evidence the range touched the
      artifact, which is the opposite of the disproof's premise.
      verify: 1.1's case goes green; the whole-file fabrication case the header
      cites (`the range deletes nothing, tree holds the skill`) stays green

      **Evidence.** `contradictedByTree` and `annotateContradicted` take a
      fourth `modified` argument, defaulted to an empty set so no caller breaks;
      `parseModifications` / `rangeModifications` supply it from the same
      `--name-status` read `rangeDeletions` already performs. The guard skips
      the token when **any** candidate is in the modification set, not only the
      one `exists` happens to hit first — the conservative direction is fewer
      disproofs.

      ```
       ✓ tests/scripts/self_review_contradicted.test.ts (17 tests) 31ms
       Test Files  1 passed (1)
            Tests  17 passed (17)
      ```

      **Sabotage probe (Risk 1, both directions).** Replacing the guard line
      with `// SABOTAGE` and re-running:

      ```
         × does NOT disprove a removal asserted inside a file the range modified
         × leaves that finding merge-blocking through the annotation pass
         Tests  2 failed | 28 passed (30)
      ```

      Exactly the two intended cases fail. The 16.1.0 whole-file fabrication
      case stays green in both states, and the new control
      (`still disproves the whole-file fabrication when the range modified OTHER
      files`) pins that it survives a non-empty modification set. Restored from
      `/tmp/srg-good.ts`, never by `git checkout`.

- [x] **1.3 Record what the narrowed gate still cannot decide.** One paragraph
      in the module header naming the residue: a claim about a symbol, an
      export, or a behaviour has no path to check, and the gate says nothing
      about it.
      verify: `grep -c 'cannot decide' src/scripts/self_review_gate.ts` is ≥ 1

      **Evidence.** `grep -c 'cannot decide' src/scripts/self_review_gate.ts`
      → `1`. The paragraph sits in `contradictedByTree`'s own doc comment under
      the heading *WHAT THIS GATE STILL CANNOT DECIDE*, and states the reading
      an operator needs at adjudication time: a finding in that class is
      **unchecked**, not unrefuted.

## Phase 2 — Hand the reviewer its facts

- [x] **2.1 Emit the fact set the review request already computes.** The gate
      already derives the range's deleted paths, its changed paths and the
      working tree's presence check. Serialise exactly those three as a block
      inside each review request, so the model reads them rather than inferring
      them from its chunk.
      verify: a dry-run of the gate over a two-commit range prints a request
      containing the three lists, and the lists match `git diff --name-status`
      for that range

      **Evidence.** `factBlock` is pure and computed once in `buildPlan`, which
      also **reserves its length from the per-request diff budget** — the block
      rides on every chunk, and discovering its cost after the split is how a
      request goes over the provider cap, which four consecutive releases
      already paid for. `--print-request` prints the request the live run would
      send, verbatim and unspent; a summary would be this script's description
      of the request rather than the request.

      `./scripts-run src/scripts/self_review_gate --base HEAD~2 --print-request`:

      ```
      === RANGE FACTS (AUTHORITATIVE) ===
      Read from `git diff --name-status <base>...HEAD` and from the working tree,
      NOT from the diff below. The diff below is ONE PARTITION of this range: a
      path missing from it is a path outside your chunk, never a deleted path.
      A claim that contradicts these lists is a defect in the finding, not a
      finding about the tree — do not report it.

      DELETED BY THIS RANGE — 2:
        agents/roadmaps/road-to-a-content-scanner-on-a-slot-that-can-refuse.md
        agents/roadmaps/road-to-an-invocation-contract-that-reaches-the-wire.md

      CHANGED BY THIS RANGE, AND THE TREE HOLDS THEM — 38:
        .github/workflows/consistency.yml
        …
      PRESENCE CHECK (exceptions to the two lists above):
        deleted, yet still present in the working tree — 0:
        (none)
        changed, yet absent from the working tree — 0:
        (none)
      === END RANGE FACTS ===

      diff --git a/.github/workflows/consistency.yml …
      ```

      Cross-checked against the range itself — `git diff --name-status
      HEAD~2...HEAD` reduced by the `D`/rename-old and surviving-path rules
      yields `2 D` and `38 M`, matching the block's own counts exactly.

      The presence check is reported by its **exceptions** rather than as a
      third full copy of the same paths: the normal case is empty, and a third
      list would spend on every chunk what a reader can derive. AC-3 is
      satisfied by the second list's label — the tree holds those paths, minus
      whatever the exception list names.

- [x] **2.2 State in the prompt that the block is authoritative.** One sentence:
      a claim contradicting the supplied lists is a defect in the finding, not a
      finding about the tree.
      verify: the sentence is present in the emitted request from 2.1

      **Evidence.** Present verbatim in the request above: *"A claim that
      contradicts these lists is a defect in the finding, not a finding about
      the tree — do not report it."* Pinned by
      `factBlock > states that the lists are authoritative and that a
      contradiction is a finding defect`. Sabotage probe — dropping
      `(AUTHORITATIVE)` from the header line:

      ```
         × factBlock > states that the lists are authoritative and that a
           contradiction is a finding defect
         Tests  1 failed | 29 passed (30)
      ```

- [x] **2.3 Measure whether it moved anything.** Over the next release cut,
      record the count of findings that assert a factual property and the count
      the tree disproved. A rise in disproofs after 2.1 falsifies the premise
      that supplying the facts prevents the class.
      verify: the two counts are readable from the release-findings artifact of
      the next cut, and this file records them

      **Evidence — the readability half is built; the reading is pending, and
      the baseline is not what the step assumed.** `factClaimCounts` writes
      `fact_claims: { asserting_removal, disproved_by_tree }` into the findings
      artifact, so the next cut is read rather than recomputed from 50 findings.

      **The baseline is "never observed", not "observed as zero".** Measured over
      all 13 recorded findings artifacts on 2026-09-29 — unit: findings matching
      the `deleted|removed|deletion|removal` vocabulary, and findings carrying a
      non-blank `contradicted`:

      | cut | findings | assert removal | disproved |
      |---|---|---|---|
      | 14.15.0 | 9 | 2 | 0 |
      | 14.21.0 | 40 | 10 | 0 |
      | 14.22.0 | 56 | 12 | 0 |
      | 14.23.0 | 49 | 2 | 0 |
      | 15.0.0 | 50 | 9 | 0 |
      | 16.0.0 | 74 | 3 | 0 |
      | 16.1.0 | 49 | 3 | 0 |

      (14.16.0 and 9.14.0 carry findings with zero removal claims; 14.17.0–14.20.0
      are the four cuts that reviewed nothing.) **`disproved` is 0 everywhere for
      a reason that is not a measurement: the annotation pass landed after the
      last recorded cut.** The 16.1.0 artifact still holds both fabrications —
      *"adversarial-review skill removed without threat analysis"* and
      *"agent-security-review skill removed without migration"* — with no
      `contradicted` field at all. So a "rise in disproofs" has no zero to rise
      from, and the falsifier as written could have been read as satisfied by
      a mechanism that never ran.

      **Falsifier, restated so the next cut can settle it.** On the first cut
      after this change, `asserting_removal` is the population and
      `disproved_by_tree` the refuted subset. The premise predicts
      `asserting_removal` **falls** against the 2–12 band above. If it does not,
      that is the honest null (Risk 3: the model asserts regardless of what it
      was handed) and this file records it rather than the mechanism being
      widened to chase it. A non-zero `disproved_by_tree` is the mechanism
      working, never evidence against the block.

## Acceptance criteria

- [x] AC-1 — A finding asserting removal of something inside a file the range
      modified blocks, and a test pins it.
      (`contradictedByTree — in-file removal …`, two cases, seen red.)
- [x] AC-2 — A finding fabricating a whole-artifact deletion the range never
      made is still disproved, and the existing test pins it.
      (`disproves the 16.1.0 fabrication: range deletes nothing, tree holds the
      skill`, unchanged, plus a new control under a non-empty modification set.)
- [x] AC-3 — A reader of one emitted review request can name, from that request
      alone, which paths the range deleted and which the tree holds.
      (Both lists are labelled with exactly that reading; see Step 2.1.)
- [x] AC-4 — The module header names one class of factual claim the gate still
      cannot decide.
      (*WHAT THIS GATE STILL CANNOT DECIDE* — symbol, export, config key,
      behaviour, or a sentence inside a surviving file.)
- [x] AC-5 — No new `contradictedBy*` function is added by this roadmap.
      (`grep -c 'function contradictedBy' src/scripts/self_review_gate.ts` → 1,
      the pre-existing `contradictedByTree`.)

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Narrowing the disproof re-blocks the fabrications it was built to stop | implementation | `contradictedByTree` exists because a partitioned reviewer asserted deletions of skills the range never touched, and the mechanism's header records that incident. Step 1.2 removes the disproof from any candidate resolving to a modified path — and a fabricated finding can name a modified file just as easily as an untouched one. Narrow it by one step too far and every release cut regains the fabricated-critical blocks the gate was written to absorb. | Step 1.2's verify pins both directions at once: the new in-file case must go green, and the whole-file fabrication case the header cites — the range deletes nothing while the tree holds the skill — must stay green. Step 1.1 requires the new case to be seen red against the unmodified gate first, so a fix that passes by weakening the test is visible rather than silent. | Phase 1 — Name the unsoundness before widening anything |
| 2 | The supplied fact block grows the request past its budget | implementation | The review request is already chunked at `MAX_REVIEW_CHUNKS = 6` because the span does not fit; the cut that produced this source read 202 of 401 files. Prepending a fact block to every chunk spends budget the diff needs, and on a large range a naive serialisation of the same three lists into six requests multiplies the cost while displacing the code the reviewer is there to read. | Step 2.1 serialises only the three lists the gate already computes — deleted paths, changed paths, tree presence — and they are paths rather than diffs, so the block scales with file count and not with change size. Nothing new is computed and no fourth list is added; the budget question of raising the chunk cap is an explicit non-goal. | Phase 2 — Hand the reviewer its facts |
| 3 | Supplying facts changes nothing because the model ignores them | product | The whole premise is that a reviewer fabricates factual claims because it cannot see the range, and that showing it the range stops the fabrication. The competing explanation is that the model asserts confidently regardless of what it was handed, in which case Phase 2 adds tokens to every request and prevents nothing — and the change would look successful because the gate still blocks the same findings it always did. | Step 2.3 pre-registers the falsifier before the change lands: the count of findings asserting a factual property and the count the tree disproved are recorded over the next release cut, and a disproof count that does not fall after 2.1 is the honest null. This file records that result rather than the mechanism being widened to chase it. | Phase 2 — Hand the reviewer its facts |
| 4 | The narrowed gate refuses a release on a finding that is still wrong | product | After Step 1.2 a finding naming a modified path keeps its block even when its claim is false, because the gate can no longer disprove that class. An operator then faces a red release over a fabricated finding with nothing in the output explaining why the usual disproof did not apply, and the cheapest exit is to override the gate wholesale. | Step 1.3 puts one paragraph in the module header naming the residue — a claim about a symbol, an export or a behaviour has no path to check and the gate says nothing about it — verified by a grep for `cannot decide`. An operator adjudicating a block can then read what the gate did and did not check, and override that one finding rather than the mechanism. | Phase 1 — Name the unsoundness before widening anything |
