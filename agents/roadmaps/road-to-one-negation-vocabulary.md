---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: manual sweep over agents/roadmaps/**/*.md on 2026-09-04 for
# `isRevocation`, `REVOKE_RE`, `git_authorization_hook` and `negation` — no open
# roadmap or stub owns the revocation parser. The one non-archived hit,
# stubs/road-to-merge-confirmation-doctrine.md:9,77, back-references the drained
# parent archive/road-to-merge-op-split-and-negation-guard.md and owns a kernel
# rule edit, not the parser.
estate_growth_exempt: "Adds one active roadmap against a floor of 1. It repairs a reproduced authorization defect — a standing merge grant surviving an unambiguous withdrawal — that no artefact in the tree owns; the two sibling roadmaps in this change touch neither the hook nor its corpus, so folding would put a parser fix, a ledger gate and a dead-code sweep in one file. Parking it leaves a grant-survival path live while the fix is one function."
---
# Road to one negation vocabulary

> **Source:** `agents/tmp.old/inbox-2026-09-e/` — an external multi-model review
> round on release 14.16.0. One reviewer proposed the invariant *"Authorization
> and revocation must share the same semantic parser"* and named a leaking case.
> Reproduced empirically against `main@56aa348b3` before this file was written;
> the run is in `agents/evidence/analysis/inbox-2026-09-e-verification.md`.

## Goal

`isRevocation` and `classifyAuthorization` evaluate negation through the same
clause-scoped implementation, so a turn that withdraws a merge grant is
recognised whatever position the negation sits in — and the two functions can no
longer return contradictory readings of one prompt. The negation corpus reaches
both functions rather than one.

## The defect, reproduced

Two negation grammars live in `src/scripts/git_authorization_hook.ts`, about 240
lines apart:

| | authorization path | revocation path |
|---|---|---|
| vocabulary | `NEGATION_WORD` (`:750`), 14 forms incl. `ohne`, `without` | inline list in `REVOKE_RE` (`:676`), 10 forms |
| direction | clause before + the match + clause after | **before only** |
| window | clause-bounded, sentence-capped | fixed `{0,30}` chars |
| abbreviation-aware | yes (`ABBREVIATION_BEFORE_DOT`) | no |
| contrast-cue aware | yes (`CONTRAST_CUE`) | no |

`NEGATION_WORD`'s own docblock (`:743-748`) states the rule the second grammar
breaks: *"ONE vocabulary for the whole file, deliberately… two negation
vocabularies in one tree drift, and the drift is invisible until a prompt lands
in the gap between them."* `REVOKE_RE` is the vocabulary that consolidation
missed.

Measured by calling the real module (`npx tsx`, imports from the shipped path):

```
"Merge PR #12 auf keinen Fall."      isRevocation=false   classifyAuthorization=[]
"Merge #12 under no circumstances."  isRevocation=false   classifyAuthorization=[]
"Merge PR #12? Actually, don't."     isRevocation=false   classifyAuthorization=[]
"do not merge PR #12"                isRevocation=true    classifyAuthorization=[]

foldGrants, prior standing grant over PR #12:
  after "Merge PR #12 auf keinen Fall."  ->  [[12]]   grant SURVIVES
  after "do not merge PR #12"            ->  []       grant dropped
```

The authorization path reads all three trailing forms correctly. The revocation
path reads none of them, and a standing grant survives an unambiguous German
withdrawal. That asymmetry is the whole defect: one grammar was hardened in
14.16.0, the other was not.

It fails in **both** directions. `"Please do not push, but merge PR #7."` returns
`classifyAuthorization=["pr-merge"]` (the clause scan stops at the contrast cue
`but`) and `isRevocation=true` (`not` … 4 chars … `merge` fits the 30-char
window, and `REVOKE_RE` has no contrast-cue notion). `foldGrants` (`:711`) checks
revocation first, so that prompt authorises the merge for the turn, mints no
standing grant, and wipes any prior one — the two parsers actively contradict
each other on a corpus row asserted green
(`contrast.en.pr-merge.please-prefix-01`).

## Phase 1 — One implementation, both callers

- [ ] **1.1 Route `isRevocation` through the clause-scoped negation check.**
      The negated-merge alternation of `REVOKE_RE` (`:676`) is replaced by a call
      into the same `sentenceBounds` / `clauseStart` / `clauseEnd` /
      `NEGATION_WORD` machinery `negatedBefore` (`:915-927`) uses, so the
      before / inside / after windows and the shared vocabulary apply to
      withdrawal exactly as they apply to authorization. The bare stop-word
      alternation (`stop|halt|cancel|…`) is orthogonal to negation and stays as
      it is.
      verify: `"Merge PR #12 auf keinen Fall."`, `"Merge #12 under no
      circumstances."` and `"Merge PR #12? Actually, don't."` each return
      `isRevocation === true`, and `foldGrants` drops a prior `[[12]]` grant on
      each — run against the real module, not a re-implementation.
- [ ] **1.2 Fix the opposite-direction contradiction.** With 1.1 landed,
      `"Please do not push, but merge PR #7."` must not be read as a revocation:
      the contrast cue that makes `classifyAuthorization` return `["pr-merge"]`
      is now visible to the revocation path too.
      verify: that prompt returns `isRevocation === false` and
      `classifyAuthorization === ["pr-merge"]`, and `foldGrants` leaves a prior
      grant intact.
- [ ] **1.3 State the shared-parser property where the next reader will look.**
      One line in `NEGATION_WORD`'s docblock (`:743-748`) naming both callers, so
      the "one vocabulary" claim is checkable against the code rather than
      aspirational.
      verify: the docblock names `classifyAuthorization` and `isRevocation`, and
      `grep -c 'REVOKE_RE' src/scripts/git_authorization_hook.ts` shows no second
      negation alternation.

## Phase 2 — The corpus reaches both functions

- [ ] **2.1 Run the negation corpus against `isRevocation`.**
      `tests/scripts/fixtures/git_auth_negation_corpus.ts` (20 rows) is fed only
      to `classifyAuthorization`
      (`tests/scripts/git_auth_negation_corpus.test.ts:15,32`). Every row whose
      expectation is a withdrawal is asserted against `isRevocation` as well.
      Rows that are not about withdrawal are excluded explicitly, not silently.
      verify: the corpus test file references both functions, and removing the
      1.1 fix makes at least one of the new rows fail — a corpus that cannot go
      red on the reverted fix has not tested it.
- [ ] **2.2 Add the trailing-negation rows to the `isRevocation` unit tests.**
      `tests/scripts/git_auth_grants.test.ts:82-100` covers three positive rows,
      all forward negation. The three reproduced trailing forms and the
      contrast-cue row from 1.2 join them.
      verify: the six rows are present and pass; `git stash` the source fix and
      the three trailing rows fail.

## Phase 3 — The orphan promise

- [ ] **3.1 Give the recorded KNOWN LIMIT a receiver or a decline.**
      `git_auth_negation_corpus.ts:109-119` records
      `interrogative.en.pr-merge.known-limit-01` — `"do not push, but merge PR #7"`
      classifies as `[]` although it should authorise `pr-merge` — with the note
      *"Carried to the follow-up"*, restated in
      `agents/roadmaps/archive/road-to-binding-findings.md:278-282` as *"Carried
      to the receiver."* A sweep over `agents/roadmaps/**` finds no receiver for
      either. Either this roadmap becomes it (the interrogative-detection limit
      is a different mechanism from the revocation gap, so folding it in is a
      decision, not a default), or the row's `why` states that the false negative
      is accepted and names why. Recording the decline is a complete discharge;
      leaving the promise dangling is not.
      verify: the corpus row's `why` field either names this roadmap's phase or
      states the acceptance, and a grep for `Carried to the` in the corpus and in
      archived roadmaps resolves to a named receiver in every remaining case, or
      the unresolved ones are listed in the closing note.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The unified parser under-revokes where the regex over-revoked | product | `REVOKE_RE`'s 30-char window is crude and therefore broad; a clause-bounded check is narrower, so a withdrawal the old regex caught by accident could stop being caught. Under-revoking is the dangerous direction — the docblock at `:667-673` states the deliberate bias toward costing a prompt rather than keeping a grant | 2.1 requires the existing three forward-negation rows to stay green, and 2.2 keeps them as unit rows; the corpus must go red on a reverted fix, which is what proves the new path is doing the work rather than the old alternation | Phase 2 — The corpus reaches both functions |
| 2 | The contrast-cue fix re-opens the interrogative limit | implementation | 1.2 and 3.1 touch adjacent readings of the same sentence shape, and a change that makes `"Please do not push, but merge PR #7."` behave can plausibly move the prefix-less row the corpus asserts as `[]` | 3.1 is a separate phase precisely so the interrogative limit is decided rather than drifted into; its verify re-runs the whole corpus, where that row's `expect: []` is asserted | Phase 3 — The orphan promise |

## Acceptance Criteria

- [ ] AC-1 — `src/scripts/git_authorization_hook.ts` contains one negation
      vocabulary and one clause-scoping implementation, reached by both
      `classifyAuthorization` and `isRevocation`.
- [ ] AC-2 — A standing merge grant over PR #12 does not survive
      `"Merge PR #12 auf keinen Fall."`, `"Merge #12 under no circumstances."` or
      `"Merge PR #12? Actually, don't."`, demonstrated by calling `foldGrants` on
      the real module.
- [ ] AC-3 — `"Please do not push, but merge PR #7."` produces one consistent
      reading across both functions.
- [ ] AC-4 — The negation corpus is asserted against both functions, and reverting
      the Phase 1 fix turns it red.
- [ ] AC-5 — The `Carried to the follow-up` promise on the interrogative KNOWN
      LIMIT resolves to a named receiver or a recorded acceptance.
