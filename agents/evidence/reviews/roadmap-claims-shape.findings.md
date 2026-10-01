# Findings: roadmap-claims-shape
<!-- completion-review: v1 | reviewed: 2026-10-01 | scope: 3338359f7582d8e2f10ca35155ebe23dcbe43143ec8a651074fe3d7bf0bbb36b | diff: 23944d6a350c30ec4c14760f006820859e9f5337 | reviewer: ai-council-2-of-2-anthropic-openai | prompt_hash: e651ae3cce9703524828bec69a7c854211710896f0e53341941c07961ba4ddac -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

> **Reviewer:** ai-council, 2 of 2 seats present (anthropic, openai), one round,
> 2026-10-01. Neither seat is the author. Subject: `check_verify_expectation_delta`
> in full, its tests in full, the block-scalar reader and the disposition
> vocabulary. Commissioned because a prior ratification round returned
> `confirmed-non-expanding` with a merge-level `REQUEST_CHANGES` whose substance
> was "the diff asks reviewers to trust comments for the new gate's correctness".
>
> **The prompt is committed verbatim** at `roadmap-claims-shape.review-input/prompt.md`
> and its sha256 is the `prompt_hash` above, so what was asked can be checked
> rather than taken on the author's word. It named no expected outcome in either
> direction; it asked for findings in six priority-ordered areas and said that
> "no findings" was acceptable only with an explicit statement of what was and
> was not checked.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/check_estate_count.ts:592 | A trailing YAML comment on a block header was a BYPASS, not a parse gap. `estate_offset_exempt: >- # offset` failed the indicator test, fell through to the flat parser, and came back as the string `">- # offset"` — which the shape rule then searched for a disposition word and found one, IN THE COMMENT, over a body it never read. An exemption could pass the shape rule by writing a disposition word in a YAML comment above a reason that named nothing. | fixed | Indicator pattern accepts a trailing comment and both legal indicator orders (`>2-`, `>-2`); `>0` is refused as not a legal indentation indicator. Pinned by `exemptionReason shape — a trailing YAML comment on the header is not a bypass`. (23944d6a350c30ec4c14760f006820859e9f5337) |
| 2 | high | src/scripts/check_verify_expectation_delta.ts:100 | `replay()` turned a git failure into a successful measurement: it ignored the exit status on every call, so a missing ref, a failed spawn or a `maxBuffer` overrun printed a confident table of zeroes — and this gate's own header cites that table as the evidence for shipping it. A measurement that can silently measure nothing cannot justify the thing it measures. | fixed | `git()` throws `GitReadError`; `--replay` exits 2 and prints no table. Pinned by `throws rather than returning an empty replay when the ref does not resolve`. (23944d6a350c30ec4c14760f006820859e9f5337) |
| 3 | medium | src/scripts/check_verify_expectation_delta.ts:418 | The reported scan count did not describe the enforced set. `added` came from a line filter and the verdict from a parse, so a patch carrying ten `verify:` lines of which three were prose reported scanning ten while enforcing over seven — the false-denominator shape the gate-coverage manifest exists to prevent. | fixed | One parsed pass, `addedClausesIn()`, feeds both halves. Pinned by `counts the same parsed clauses the verdict is drawn from`. (23944d6a350c30ec4c14760f006820859e9f5337) |
| 4 | medium | src/scripts/check_verify_expectation_delta.ts:122 | An added CONTENT line whose own text begins with `++` renders `+++…` in a unified diff and was discarded by a `startsWith('+++')` prefix test as though it were a file header. Narrow in practice and wrong in principle: the reader claimed to parse a unified diff and was reading its first character. | fixed | The file header is matched whole (`+++ b/<path>` or `/dev/null`). Pinned by `does not mistake an added line whose own content begins with ++ for a file header`. (23944d6a350c30ec4c14760f006820859e9f5337) |
| 5 | high | src/scripts/check_verify_expectation_delta.ts:86 | An executable script was exempted as a pointer. `./src/scripts/check.ts` ends in `.ts` and the carve-out matched it, while being exactly the shape a shebang-bearing script is RUN as in this tree — a false negative on the gate's own subject. | fixed | An invocation prefix (`./`, `../`, `/`) is never a pointer. Both directions pinned, including the four extensionless pointers the pattern still refuses, so a later widening is a deliberate act against a failing assertion. (23944d6a350c30ec4c14760f006820859e9f5337) |
| 6 | medium | src/scripts/_lib/exemption_shape.ts:52 | The stem `park\w*` matches `parkour` at a word boundary. Not a minimal string passing a weak rule — a WRONG string satisfying it, so a reason saying nothing about dispositions could pass on a word that is not one. | fixed | `park` is enumerated (`park`/`parked`/`parking`/`parks`, plus the `unpark` forms) rather than stemmed. Every other lemma keeps its stem; none has a plausible false friend in a sentence about roadmap dispositions. (23944d6a350c30ec4c14760f006820859e9f5337) |
| 7 | medium | tests/scripts/check_verify_expectation_delta.test.ts:0 | The "single-sourced grammar" test proved nothing: `expect(VERIFY_ARROW_SOURCE).toBe(GRAMMAR_SOURCE)` compared two equal STRINGS across a re-export this gate itself added, which establishes nothing about where either came from. | fixed | Deleted rather than re-tested; the re-export is gone. The property is structural — the gate asks `parseVerifyClause` whether a clause has an expectation and never inspects the arrow — plus one behavioural assertion: the gate accepts the Unicode arrow `→`, which appears nowhere in its own source. (23944d6a350c30ec4c14760f006820859e9f5337) |
| 8 | medium | src/scripts/check_verify_expectation_delta.ts:362 | The self-test's grandfathering case overstated its coverage: under `--unified=0` the unchanged `verify:` line does not appear in the patch at all, so the case does not exercise context-line handling and would stay green if that handling broke. | fixed | Not re-engineered — relabelled. The case now states the weaker property it actually tests, and both the comment and the gate-coverage row name the unit test that pins the stronger one. (23944d6a350c30ec4c14760f006820859e9f5337) |
| 9 | medium | src/scripts/_lib/exemption_shape.ts:0 | The shape rule is satisfiable by the single word `park`, and `park 1` / `park 2` are two distinct reasons to the duplicate rule. One seat called this high; the other called it the stated design rather than a defect. | accepted-risk | Documented in the module. The check verifies that a disposition word APPEARS, not that anyone thought about one, and no check can do the latter. The real control is a human reading a one-line reason in a diff — which is the key's own stated purpose; what this removes is the case where there was nothing to read because the reason was free text nobody had looked at. |
| 10 | low | src/scripts/check_verify_expectation_delta.ts:140 | A fenced Markdown example inside a roadmap containing the live `verify:` token can be convicted: the reader hands every added line carrying the token to the parser, which has no notion of a code fence. | accepted-risk | A line-oriented patch reader cannot see fence state without tracking it, and the sibling share reader (`closure_scan`'s `units()`) already owns fence exclusion for the estate-wide view. Recorded as a known false positive an author resolves by writing the example without the live token. |
| 11 | low | src/scripts/check_estate_count.ts:600 | `blockScalar()` is not a YAML implementation: it treats `>` and `\|` alike and drops blank-line semantics. | accepted-risk | Correct for the one thing it is used for — reading a prose reason — and wrong for anything else, which is why it is local to `exemptionReason` rather than offered as a parser. The module says so in its own header. |

## The §2.5 ordering is violated, and the gate says so

`check_completion_review` reports `fix-before-artifact` on all eight `fixed`
rows: the fix commit `23944d6a` predates this artefact's first-add commit. That
is accurate and is not worked around. The review was commissioned after the
branch was pushed, in answer to a prior round's objection, so the findings
could not have been committed before the fixes they produced; and rewriting the
history to reorder them is what `git-history-discipline` forbids.

What §2.5 protects against is findings invented after the fact to match fixes
already made. The committed prompt package is a stronger guarantee of that same
property than the commit order would be: `prompt.md` is hashed into the marker
above, so the questions are pinned and can be re-read, and the diff the
reviewers saw is committed beside it. A reader who distrusts the ordering can
check what was asked instead of taking the sequence on trust.

The gate's CI invocation is `--advisory` and exits 0; the finding stands in its
output rather than being suppressed.

## What the reviewers could not check

The full workflow file, the surrounding gates, `parseVerifyClause`'s own
implementation, and any CI run — the scope was four code artefacts, and the
committed prompt shows exactly which. Both seats stated their own bounds; one
explicitly declined to accept the replay figures as verified evidence, which is
correct and is why `--replay` exists as a command rather than as a number in a
comment.

One disagreement between the seats is recorded unresolved rather than averaged:
on finding 9, one seat called a one-word reason a HIGH-severity gameable rule
and the other called it the design working as stated. The disposition above
takes the second position and says why; a reader who takes the first will find
the argument in the module header rather than having to reconstruct it.

## After the fixes

`--replay 30` over the same corpus: 145 / 96 / 8 / 41, 6 of 30 red — unchanged.
70 test cases green across the two touched files; the gate's `--self-test` at
10 of 10 with 4 rejecting; `check_estate_count --self-test` at 19 of 19 with 12
rejecting.
