# Findings: post-merge blind pass (unsteered)
<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: 408f260cb77b6aa85dbec40ce09c272541dffcdd9f6ac22f6a3e5a9a00aa5370 | diff: 3d9be1ebcd6976d9507809db1b8cde0bb1a4f629 | reviewer: r2-fresh-subagent-postmerge-blindpass -->

<!-- context-manifest: v1
inputs:
  diff_sha: 3d9be1ebcd6976d9507809db1b8cde0bb1a4f629
  scope_hash: 408f260cb77b6aa85dbec40ce09c272541dffcdd9f6ac22f6a3e5a9a00aa5370
  roadmap: agents/roadmaps/archive/road-to-plan-governance-gates.md
  roadmap_hash: 7be2dc5ef4ca9bbda0e022e39a2a62c55c5fb9823dbcac734a0bbe2756cd7241
  ac_hash: 1c3cd7678aacae91ea045d13cde1f09e0bd97738d2f5a63857a2da04efc48dca
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-04T14:46:17Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/scripts/check_completion_review.ts:434 | The mis-pairing fail-open the change claims to close survives with a labelled opener: an unclosed labelled opener is closed by the first later BARE fence anywhere in the artefact, so every line between them is added to `fenced` (a live `open` finding row among them disappears from `rows`), `open` returns to null so `strays` stays empty and no `unbalanced-fence` is emitted, and an earlier well-formed row keeps the neither-table-nor-honest-null fallback quiet — the gate exits 0 on an unreviewed `open` finding. Fires on the exact arrangement `markdown-safe-codeblocks` prescribes: a tilde-wrapped illustration quoting an unpaired labelled opener plus any bare fence later in the file. | open | |
| 2 | high | src/scripts/check_completion_review.ts:779 | The remediation text printed with every `unbalanced-fence` violation ("Label the opener and close it") walks the author straight into finding 1: applied to the repo's own two-stray fixture, labelling only the first stray turns it into an unclosed labelled opener that the still-bare second stray closes, swallowing the `open` row between them and flipping a blocking exit 1 into a silent pass. | open | |
| 3 | high | docs/contracts/plan-review-gates.md:332 | The normative contract asserts "A labelled opener that is never closed is a stray too, and likewise skips nothing", which the parser does not implement — a later bare fence closes such an opener, so it skips everything up to that fence and is reported as no stray at all; the same over-claim appears in the JSDoc at `check_completion_review.ts:420`, so the doc certifies the property that would otherwise prompt the next author to test this hole. | open | |
| 4 | medium | src/scripts/check_completion_review.ts:442 | Retroactive breaking grammar change with no migration or grandfathering: under the removed round-7 rule a closed bare pair was a valid illustrative region, and any already-committed findings artefact that quoted the six-column template inside a bare pair now emits a blocking `unbalanced-fence` (exit 1) and fails pre-push and CI for a completion whose artefact was correct when written — the §2.2 rewrite documents the new rule but records no transition for artefacts authored under the old one. | open | |
| 5 | low | src/scripts/check_completion_review.ts:451 | `strays.sort()` is dead: bare strays can only be pushed while no opener is open, so they are appended in ascending index order, and the post-loop push of an unterminated opener is always the largest index — the sort can never reorder anything. | open | |

## Provenance

Post-merge blind pass over the delta that reached `main` **without** a
completion review: round 8 was dispatched at head `39f071fad`, and three commits
landed after it (`9937ad9b7` "a bare fence never delimits a region — close the
fourth fail-open route", the round-8 closure, and a merge-in of main). Bound to
scope `408f260c…` (head `3d9be1ebc`) — 272 changed lines across the contract,
the R2 validator, and its tests.

**The prompt was deliberately unsteered**, because a steered prompt is what
produced the false honest-null this pass exists to answer for (contract § 5,
case zero). It carried: no prior-round outcomes, no statement of an expected
result, no "NO-FINDINGS is welcome" framing, and no narrowing to
requester-selected files. It named the search grid and let the reviewer set the
count and severity.

Result: **5 findings, 1 critical.** The gap the maintainer flagged before this
pass ran — "the first entry of the 10-PR baseline should not start with a known
hole" — was not hypothetical: an unreviewed fail-open fix had itself shipped a
fail-open.

## Verification before adoption

Each finding was reproduced or read against the code before being written down;
none was taken on the reviewer's word.

Finding 1 was reproduced directly. An artefact carrying one terminal row, then a
labelled opener, then a live `| 2 | critical | b.ts:9 | … | open | |` row, then a
bare fence, parses to:

```
rows parsed: 1:fixed
open rows present? false
malformedLines: 0   malformedRows: 0
rowViolations: (none)
```

The `open` row is gone and the artefact validates clean — an unreviewed critical
finding passes the gate. Findings 2, 3 and 5 were confirmed by reading the cited
lines (`check_completion_review.ts:779` remediation text, contract line 332 plus
the JSDoc at line 420, and the `strays.sort` after ascending-only pushes).

## Disposition

Findings 3 and 5 are unambiguous and are fixed in this change. Findings 1, 2
and 4 are **held open on purpose**: the obvious fix (treat a findings-shaped row
inside a fenced region as a violation) fires on every artefact that legitimately
quotes the template — including the skeleton the dispatcher itself writes, which
contains `| 1 | critical | path/to/file.ts:42 | … | open | |`. Choosing between
"declare illustrative regions explicitly" and "relax fence pairing and move the
safety check elsewhere" changes the § 2.2 grammar, so it is a decision to make
deliberately rather than a patch to improvise. Writing a fix whose false-positive
rate reds every future artefact would repeat the mistake this document records.
