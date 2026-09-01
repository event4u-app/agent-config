<!-- evidence-type: review -->

# Drain run 13 — neutral review of PR #1789 and PR #1790

**Why the prompt is here.** `evaluator-independence` admits a self-commissioned
review as gate evidence **only when the prompt is recorded alongside the
verdict** — otherwise nobody can check what was asked. The orchestrator that
authored the change also authored this prompt, so the prompt is the evidence.

**Date:** 2026-09-01 · **Reviewer:** an agent that wrote none of the reviewed
code · **Scope:** the complete `git diff origin/main...HEAD` of both branches, no
path excluded — 5 files / 274 insertions on `drain/harness-promotion-bridge-close`,
6 files / 886 insertions on `drain/council-topology-followups`.

## The prompt, verbatim as dispatched

> Review two branches in the `event4u/agent-config` repository and report
> findings. You did not write any of this code and you are not the author of this
> prompt's subject matter.
>
> **Scope — the whole delta of both branches, nothing excluded**
>
> - `…/ac-drain-A`, branch `drain/harness-promotion-bridge-close` (PR #1789).
>   Delta: `git diff origin/main...HEAD` — 5 files, 274 insertions.
> - `…/ac-dr-topo`, branch `drain/council-topology-followups` (PR #1790).
>   Delta: `git diff origin/main...HEAD` — 6 files, 886 insertions.
>
> Prefix every Bash call with `cd` to the relevant worktree. Read-only: do not
> edit, commit, or push anything in either worktree.
>
> **What to look for.** Report defects, in roughly this priority order. For each,
> cite `file:line` at the current commit.
>
> 1. **Correctness of the security-relevant change.**
>    `src/scripts/_lib/promotion_capability.ts` gates the only path to promoting
>    an artefact into the canonical source tree. It was changed so that a closed
>    `blocker: merge-authority` mints the capability only when the blocker body
>    also carries `- **Disposition:** granted`; `refused` and an absent
>    disposition both refuse. Check specifically: can any input reach a minted
>    capability that could not before? Is the closedness read still identical to
>    `src/scripts/lint_roadmap_blockers.ts:48`? Are the regexes anchored as the
>    code claims? Is there a body a human would reasonably write that reads as
>    granted by accident — for example prose, a quoted example, a nested list, or
>    a `Disposition` line inside a different blocker's section? `blockerSection`
>    bounds the search; verify it actually does.
> 2. **Test sensitivity.** The branches claim RED proofs. Pick at least two
>    claimed guards and check whether the test would actually fail if the
>    mechanism were neutralised — reason from the code, and where cheap, run the
>    test. A test that passes for a reason other than the one claimed is a
>    finding.
> 3. **Claims against evidence.** Both PRs make many `file:line` claims in
>    roadmap prose and PR bodies. Spot-check at least eight, spread across both
>    branches, and report any that do not resolve or do not say what the citing
>    text says they say. Include at least two from the long AC-9 and blocker
>    prose in `agents/roadmaps/road-to-harness-promotion-bridge.md`.
> 4. **Whether anything was closed that should not have been.** Check that no
>    checkbox, acceptance criterion, or blocker status moved in a direction the
>    evidence does not support, on either branch. In particular: is anything
>    marked done, resolved, or descoped whose stated criterion is not actually
>    met?
> 5. **Anything else that would bite a reader or a future maintainer** —
>    internal contradictions, a note that says the opposite of an adjacent note,
>    a fix that removes one instance of a defect while leaving siblings, dead
>    references, or a claim of generality the code does not have.
>
> **How to report.** Findings only — no summary of what the branches do, and no
> assessment of whether they are good. For each finding: the file:line, one
> sentence stating the defect, and a concrete failure scenario (inputs or state →
> wrong outcome). Rank most severe first.
>
> If you find nothing in a category, say so for that category. **An empty
> findings list is an acceptable and expected outcome if the code is clean — do
> not manufacture findings to appear thorough, and do not soften a real one.**
> Equally, do not withhold a finding because the change looks careful elsewhere.
>
> Do not write any file. Report back in your final message.

**Note on the prompt's own defect.** Its item 1 cites
`lint_roadmap_blockers.ts:48` as the closedness read. That is wrong — `:48` is
the required-field-presence regex, `:193` is the closedness one — and the
reviewer caught it as finding 4. The prompt is reproduced unaltered rather than
corrected, because a prompt edited after the fact is not the prompt that was
answered.

## Verdict — 11 findings, 9 on #1789 and 2 on #1790

The reviewer's own headline: *"no input mints that could not mint before — the
disposition reads sit strictly after the closedness guard clause, so the new mint
set is a proper subset of the old one … The defects are elsewhere."* Findings 1-3
then show that the pre-existing surface was larger than the change assumed, and
that the change enlarged one part of it.

| # | Branch | Finding | Disposition |
|---|---|---|---|
| 1 | #1789 | `blockerSection` did not strip fenced code, so a fenced EXAMPLE of the grant syntax minted while the live `Status` read `open` | **FIXED** + pinned + RED-proven |
| 2 | #1789 | `DISPOSITION_GRANTED_RE` ended in `\b`, so `granted/refused (pick one)` and three other hedges minted | **FIXED** + pinned + RED-proven |
| 3 | #1789 | the heading search accepted any `#{2,4} blocker:` anywhere in the file, so a `####` history heading could out-vote the real entry | **FIXED** + pinned + RED-proven |
| 4 | #1789 | roadmap `:821` cited `lint_roadmap_blockers.ts:48`, a field-presence regex, not `:193` | **FIXED** |
| 5 | #1789 | the roadmap crossed the documented 1000-line structural cap, silently — no gate enforces it | **NOTED + stub**, not split |
| 6 | #1789 | the section terminator fired inside fenced code and missed h5/h6 | **FIXED** (fence strip + `#{1,6}`) |
| 7 | #1789 | four stale statements still asserted the pre-change condition | **FIXED** |
| 8 | #1789 | `lint_promotion_paths.ts:615` re-derived the polarity `isRefusingStatus` exists to own | **FIXED** |
| 9 | #1789 | of the three new tests, one passed byte-identically on pre-change code and pinned nothing new | **KEPT, annotated** — it pins that closedness and direction are read independently, which findings 1 and 3 make load-bearing |
| 10 | #1790 | the dossier's line citations were invalidated by the same PR's own corrections | **FOLLOW-UP** — #1790 is merged |
| 11 | #1790 | two bare `file:line` ranges name no file, and one range starts on the wrong note | **FOLLOW-UP** — #1790 is merged |

**Categories the reviewer found clean, recorded because a null is a result.**
Claims-against-evidence on #1790: 22 citations resolved, all correct, including
an independent recomputation of the 38 = 24 + 2 + 12 partition and the 43-inbound
census. Improper closure on both branches: none — no checkbox, acceptance
criterion, `status:` field or blocker moved anywhere in either delta.

## What this review changes about the run's own claims

The PR body for #1789 originally called the change *"strictly stricter in every
direction"*. That was true of the disposition read in isolation and false of the
module as shipped: findings 1 and 3 are pre-existing holes in `blockerSection`
that the new `Disposition` line made materially easier to trip, because a
disposition line is far likelier to appear in a `What to do:` example than a
`Status` line ever was. The claim is corrected rather than defended.
