# Findings: fix-r2-ac-extraction-inline
<!-- completion-review: v1 | reviewed: 2026-08-18 | scope: a1db0037ca6442590e248f48da653fc0384cb95a702724c7df10e77a89b2d53d | diff: 61fdf7d26f1d9eb634c02451621c573784216bbe | reviewer: r2-fresh-subagent-fix-r2-ac-extraction-inline | prompt_hash: bbc6263c97285a0bf0ff550fe05d7299a9b187e2b947cbf4ab58f96aae2f9f14 -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-18 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 61fdf7d26f1d9eb634c02451621c573784216bbe
  scope_hash: a1db0037ca6442590e248f48da653fc0384cb95a702724c7df10e77a89b2d53d
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-18T15:35:04Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/dispatch_r2_reviewer.ts:648-652 | The new third prompt state asserts a fact the extractor cannot establish. `acGiven === false` emits "it declares NO acceptance criteria" for any empty extraction, including a roadmap that does declare criteria in a shape neither matcher recognises — `* **AC-1:**`, an indented `- **AC-1:**`, a bare `**AC-1:**` with no bullet, `### Acceptance Criteria` at h3, or any heading carrying trailing text such as `## Acceptance Criteria (AC)`. The pre-change failure was silent; the post-change failure is an affirmative false statement handed to the one independent check on AC conformance, so the reviewer has no reason to look. | fixed | 61fdf7d26 — the empty branch now reports the EXTRACTION and names both causes; the trailing-qualifier heading it named was live in 2 roadmaps and is now matched |
| 2 | medium | src/scripts/dispatch_r2_reviewer.ts:510-515 | The continuation walk breaks on the first blank line, so a loose-list AC bullet whose second paragraph is separated by a blank line is silently truncated. The result is a partial extraction that hashes to a real value, writes a non-empty `acceptance-criteria.md`, and reads as complete — the same looks-like-success shape the change exists to remove, relocated. The docblock justification is not true of standard markdown loose lists. No test covers a blank-separated continuation. | fixed | 61fdf7d26 — a blank ends a criterion only when the next non-blank line is not an indented continuation |
| 3 | medium | src/scripts/dispatch_r2_reviewer.ts:435 + :1109 | "Are there criteria" is encoded twice, differently: `expectedHashes` uses truthiness while `runDispatch` uses `acText !== null && acText !== ''`. They agree only because `''` is the sole reachable falsy string today. Any later refinement of one makes the manifest and the prompt disagree about the same fact — the two-places-disagree failure this diff repairs, reintroduced one level up. No single predicate, and no test pins the pair. | fixed | 61fdf7d26 — one exported predicate `hasAcceptanceCriteria` behind both sites, with a parity test |
| 4 | low | tests/scripts/dispatch_r2_reviewer.test.ts:761 | The `ac_hash` expectation is computed with the function under test, so it cannot fail on an extraction defect — it only pins "the dispatcher hashes whatever the extractor returned". A literal expected string would make the assertion load-bearing. | fixed | 61fdf7d26 — literal expectation hoisted to `ROADMAP_INLINE_AC_EXPECTED` |
| 5 | low | src/scripts/dispatch_r2_reviewer.ts:508-515 | An indented nested `- **AC-n:**` bullet is folded into its parent as a continuation rather than emitted as its own criterion, and the `i = j` advance makes the skip permanent. No content is lost, but the extraction shape — and therefore `ac_hash` — becomes a function of indentation depth. Undocumented and untested. | fixed | 61fdf7d26 — indent-tolerant bullet pattern; a nested criterion is emitted as its own row |
| 6 | low | docs/contracts/plan-review-gates.md:712-717 | The "none of them go red" guarantee for the 17 historical empty-string `ac_hash` artefacts rests on `--verify-current`'s scope-based selection. The single-artefact `--verify <path>` entry point has no such selection. Harmless in practice only because `scope_hash` already diverges for a foreign artefact — a different reason than the one the paragraph gives, and the paragraph is what a future reader will trust. | fixed | 61fdf7d26 — both reasons stated, with the `--verify <path>` gap named explicitly |

## Reviewer dispatch — declared prompt delta

The prompt sent to the reviewer differs from the hashed `prompt.md` in three
mechanical respects: the working directory, the path to `diff.patch`, and a
return-the-table-as-text instruction in place of write-the-file. It carried no
verdict expectation and no scope narrowing — the changed-file list, the diff and
the scope hash are the dispatcher's own.

Declared because `check_review_prompt_binding` hashes the committed `prompt.md`
rather than the text actually sent, and its own header names that substitution as
undetectable. A declared delta is checkable; a silent match is not.

## Re-bind — 2026-08-18

Re-bound once, from scope `fccb8e46…` (head `604632b3c`) to `a1db0037…` (head
`61fdf7d26`), after the single fix pass that closed all six rows. Three fields
hand-edited and nothing else: `scope:` and `diff:` in the header marker, and
`scope_hash` / `diff_sha` in the manifest. `roadmap_hash` and `ac_hash` are
`none` on both sides (this branch carries no roadmap) and `prompt_hash` is
unchanged, because `prompt.md` was not touched.

`diff.patch` is deliberately left at the reviewed revision. It is the record of
what the reviewer actually read, and regenerating it would replace that record
with content nobody reviewed.

No `--force` at any point: it overwrites, and the only thing it would have
destroyed is the record of the review that happened.
