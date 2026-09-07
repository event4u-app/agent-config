# Findings: release-written-answer-removal
<!-- completion-review: v1 | reviewed: 2026-09-07 | scope: f9c66989ba82762470958f133bfddeb120ca19137bc946869ccb79191c6e1375 | diff: f0fada72e7076850620af66b4a27817b5e1486e9 | reviewer: cross-model-subagent-release-written-answer-removal -->

<!-- context-manifest: v1
inputs:
  diff_sha: f0fada72e7076850620af66b4a27817b5e1486e9
  scope_hash: f9c66989ba82762470958f133bfddeb120ca19137bc946869ccb79191c6e1375
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-07T00:00:00Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | docs/decisions/ADR-261-release-written-answer-obligation-removed.md:106 | The Consequences section stated three line counts as evidence and all three were estimated rather than measured. `git diff --numstat` gives release_highlights.ts net −296 (claimed −301), check_release_highlights.ts −157 (claimed −166) and release_publication.ts −202 (claimed −102) — the last understates the real reduction by more than 2x. This repository treats an ADR own numbers as checkable, so a reader auditing the record gets a falsified figure on the first command they run. | fixed | 156ac7b29 — re-measured with `git diff --numstat`, raw +/- printed beside each net, and the fact that a review falsified the first draft recorded in the line itself |
| 2 | high | docs/decisions/ADR-261-release-written-answer-obligation-removed.md:153 | The evidence table row for the by-hand discharge cited `CHANGELOG.md` § `[Unreleased]` and commit `a9bd75d55`, but this same change rewrites exactly that entry and the new text names no such hash. The ADR claims its evidence is verifiable at the revision it lands on; at that revision the citation was already false. | fixed | 156ac7b29 — the row now points at docs/archive/CHANGELOG-pre-14.20.0.md:123, a released commit subject, and states why the rewritten entry is deliberately not cited |
| 3 | medium | docs/decisions/ADR-253-per-pr-user-artifact-gate-declined.md:203 | The References block pointed at `CHANGELOG-conventions.md` § Governance-versus-product **response** and described it as the obligation text. This change renames that heading and inverts the section to say the obligation is deleted. ADR-253 was edited in the same diff (its `superseded_by` frontmatter), so the stale pointer in its own body was reachable and missed. | fixed | 156ac7b29 — reference retargeted to the renamed section, with one sentence on what ADR-261 changes there and what of ADR-253 still stands |
| 4 | medium | src/scripts/_lib/release_material.ts:295 | The docblock above `MIX_RESPONSE_MARKER` claimed the definition is shared by the writer, the local push guard and the CI gate. After this diff exactly one consumer is left — `render_mix_response`, in the same file, which WRITES the line. Both searchers (`mix_response_blockers`, `check_governance_mix_response`) are deleted, so a maintainer reading the comment would assume a guard still notices a missing marker. None does. | fixed | e66d3510c — docblock corrected to one reader, with the explicit warning that nothing reads a changelog looking for the marker any more |
| 5 | medium | src/scripts/_lib/release_highlights.ts:478 | `MixObligation.triggered` became write-only, and the docblock justified keeping it by claiming a reader of the published line can see the verdict. False: `render_mix_response` never receives the field, the rendered line carries only `level`, and the field was set once at release_publication.ts:480 and read nowhere in the tree. | fixed | e66d3510c — field removed rather than justified; the taxonomy verdict stays where it is computed and printed, in measure_release_mix |
| 6 | medium | tests/scripts/check_release_highlights.test.ts | The read-back regression block had no discriminating power: it asserted only that a fixture string contains the promise phrase and that `previous_changelog_version` still resolves. It never called `main()` or any predicate that used to block, so a partial revert re-adding an unexported read-back refusal inside `main()` would have left it green while the CLI blocked a real release. | fixed | 15dc2af0e — the block drives main() and asserts the exit code, plus a sensitivity case: the same run over an unrewritten draft head must still exit 1, so exit 0 cannot be met by a gate that reads nothing |
| 7 | low | src/scripts/release_publication.ts:722 | `guard_release_curation` re-read the changelog a second time to build the marked-lines list. That only ever mattered while `consume_staged_answers` / `collect_curation_answers` could rewrite the section between the two reads; both write paths are deleted and `curation_blockers` is read-only, so the second read can only return the same bytes and the fallback branch is unreachable. Residual of the removed mechanism, readable as meaningful. | fixed | e66d3510c — single read, with the reason the second one existed recorded at the site |

## Contract §2.5 is NOT satisfied for this round, and that is the honest state

The findings-before-fixes ancestry rule requires the artifact first-add commit
to precede every referenced fix commit. It does not hold here, and the gate is
correct to say so rather than being talked around:

- the review was commissioned mid-work as a cross-model subagent over the
  working-tree diff, not through `dispatch_r2_reviewer`, so no scope-bound
  artifact existed at the time;
- all seven fixes were applied and committed (`e66d3510c`, `15dc2af0e`,
  `156ac7b29`) before this file existed.

Committing this file therefore turns `artifact-not-committed` into
`fix-before-artifact`, which is the accurate verdict: the fixes do predate the
artifact. Neither is worked around.

**A skip declaration was considered and refused.** The §2.2 skip grammar
hardcodes the phrase *no code surface for this completion*, and this diff
carries ten code paths across seventeen files. Declaring a skip would have
cleared the gate with a false statement, which is a worse outcome than a
recorded ordering violation.

**What the review does establish**, independent of the ordering: it ran over
the whole diff rather than a scope its author chose, its prompt stated no
expectation of the outcome in either direction, it returned seven findings on a
change its author believed complete, and every one is fixed with the fix named.
The prompt is recorded in the pull-request body alongside the findings, per
`evaluator-independence` item 3.

## Verification the reviewer ran

`npx tsc --noEmit -p tsconfig.json` clean · eslint over all ten touched source
and test files clean · the three touched test files 81/81 · thirteen further
release-related test files 231/232, the single failure being
`release_gate_locality`'s assertion that HEAD is not on a release branch, which
it is · repo-wide grep for all twenty removed symbols across code,
`.github/workflows/`, `src/config/` and docs returning zero live references ·
`check_adr_frontmatter` and `adr_cite_check` on ADR-253 and ADR-261 with zero
errors and every evidence-basis path resolving.
