# Findings: fix-r2-ac-extraction-inline
<!-- completion-review: v1 | reviewed: 2026-08-18 | scope: fccb8e46b6dd566dbf9ff51ab5246695cf663a7a6e5bf34eb67b98f022ef03f7 | diff: 604632b3c991933fb354e3afb50423697489d692 | reviewer: r2-fresh-subagent-fix-r2-ac-extraction-inline | prompt_hash: bbc6263c97285a0bf0ff550fe05d7299a9b187e2b947cbf4ab58f96aae2f9f14 -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-18 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 604632b3c991933fb354e3afb50423697489d692
  scope_hash: fccb8e46b6dd566dbf9ff51ab5246695cf663a7a6e5bf34eb67b98f022ef03f7
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-18T15:35:04Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/dispatch_r2_reviewer.ts:648-652 | The new third prompt state asserts a fact the extractor cannot establish. `acGiven === false` emits "it declares NO acceptance criteria" for any empty extraction, including a roadmap that does declare criteria in a shape neither matcher recognises — `* **AC-1:**`, an indented `- **AC-1:**`, a bare `**AC-1:**` with no bullet, `### Acceptance Criteria` at h3, or any heading carrying trailing text such as `## Acceptance Criteria (AC)`. The pre-change failure was silent; the post-change failure is an affirmative false statement handed to the one independent check on AC conformance, so the reviewer has no reason to look. | open | |
| 2 | medium | src/scripts/dispatch_r2_reviewer.ts:510-515 | The continuation walk breaks on the first blank line, so a loose-list AC bullet whose second paragraph is separated by a blank line is silently truncated. The result is a partial extraction that hashes to a real value, writes a non-empty `acceptance-criteria.md`, and reads as complete — the same looks-like-success shape the change exists to remove, relocated. The docblock justification is not true of standard markdown loose lists. No test covers a blank-separated continuation. | open | |
| 3 | medium | src/scripts/dispatch_r2_reviewer.ts:435 + :1109 | "Are there criteria" is encoded twice, differently: `expectedHashes` uses truthiness while `runDispatch` uses `acText !== null && acText !== ''`. They agree only because `''` is the sole reachable falsy string today. Any later refinement of one makes the manifest and the prompt disagree about the same fact — the two-places-disagree failure this diff repairs, reintroduced one level up. No single predicate, and no test pins the pair. | open | |
| 4 | low | tests/scripts/dispatch_r2_reviewer.test.ts:761 | The `ac_hash` expectation is computed with the function under test, so it cannot fail on an extraction defect — it only pins "the dispatcher hashes whatever the extractor returned". A literal expected string would make the assertion load-bearing. | open | |
| 5 | low | src/scripts/dispatch_r2_reviewer.ts:508-515 | An indented nested `- **AC-n:**` bullet is folded into its parent as a continuation rather than emitted as its own criterion, and the `i = j` advance makes the skip permanent. No content is lost, but the extraction shape — and therefore `ac_hash` — becomes a function of indentation depth. Undocumented and untested. | open | |
| 6 | low | docs/contracts/plan-review-gates.md:712-717 | The "none of them go red" guarantee for the 17 historical empty-string `ac_hash` artefacts rests on `--verify-current`'s scope-based selection. The single-artefact `--verify <path>` entry point has no such selection. Harmless in practice only because `scope_hash` already diverges for a foreign artefact — a different reason than the one the paragraph gives, and the paragraph is what a future reader will trust. | open | |

## Reviewer dispatch — declared prompt delta

The prompt sent to the reviewer differs from the hashed `prompt.md` in three
mechanical respects: the working directory, the path to `diff.patch`, and a
return-the-table-as-text instruction in place of write-the-file. It carried no
verdict expectation and no scope narrowing — the changed-file list, the diff and
the scope hash are the dispatcher's own.

Declared because `check_review_prompt_binding` hashes the committed `prompt.md`
rather than the text actually sent, and its own header names that substitution as
undetectable. A declared delta is checkable; a silent match is not.
