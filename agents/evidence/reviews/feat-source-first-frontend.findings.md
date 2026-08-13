# Findings: feat-source-first-frontend
<!-- completion-review: v1 | reviewed: 2026-08-13 | scope: 975af0b2532154b89c92da7ed2f2ee4c7b870fc622cb172e1436705b0cc66155 | diff: 40a8b5e94db4b6a2eadfeb18a66d71aae6151cec | reviewer: r2-fresh-subagent-feat-source-first-frontend | prompt_hash: 8f800861815936abd56ff9955d035e1c3c5ea83722c03f1e40eeffccf10b779a -->

<!-- context-manifest: v1
inputs:
  diff_sha: 40a8b5e94db4b6a2eadfeb18a66d71aae6151cec
  scope_hash: 975af0b2532154b89c92da7ed2f2ee4c7b870fc622cb172e1436705b0cc66155
  roadmap: agents/roadmaps/road-to-source-first-frontend.md
  roadmap_hash: eb291bb78f60f528c6730413ebd3b40f71021e3a5903842db32c41223a056152
  ac_hash: e03ec29dc72033d4c8d6693ceaab4473032eaa46e5f81970ebeab800a6d6320b
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-13T01:04:14Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/scripts/ui_route_nudge_artifact_read.test.ts:11-14 | The header claims parsing the rule's frontmatter means "the copy cannot drift silently", but both guard tests (:116, :123) only assert the rule STILL declares the two triggers the predicate already copied. Adding a third `file_pattern` / `path_prefix` to `design-fidelity` leaves `isArtifactRead` silently incomplete with every test green. This is the same "the near-miss tests a direction that was already closed" failure the branch itself names in `design-fidelity` § Routing as the reason the builder-URL class was withdrawn — reproduced one file over, in the guarantee wording. | open | |
| 2 | medium | src/scripts/report_consultation_rate.ts:357-360 | The printed definition of the quotable denominator — "sessions that read a provided artifact at all" — is narrowed twice in code and neither narrowing is printed. `isArtifactRead` recognises only `*design.html` and `.claude/design-system/`, i.e. two of the rule's handover shapes rather than "a provided artifact"; and `measureStore`:309 additionally drops every session with `uiWriteTurns === 0`. The output goes to eleven lines naming two other blind spots while omitting the one that decides membership in the denominator, and AC A8 claims the blind spot is stated in the output. Same wording in the `handoverSessions` doc comment (:121, "the ONLY honest denominator"). | open | |
| 3 | low | src/scripts/report_consultation_rate.ts:189-193 | `readBeforeFirstWrite` derives ordering from the index of `tool_use` parts inside one assistant message, but parallel tool calls in a single message carry no temporal order — a read emitted alongside the first UI write scores as "read before write" although its result was not available when the write was composed. The metric's entire content is ordering, so this is load-bearing in a way it was not for the pre-existing consultation rate. Direction matches the declared ceiling, so the conclusion survives; it is a third inflation source the ceiling paragraph does not name. | open | |
| 4 | low | src/skills/fe-design/SKILL.md:4 | The description still enumerates the loop as "audit, brief, build, review" after the Inventory step was inserted at position 3, so the skill's activation surface summarises a five-step loop as four stages. `nudgeReason` (src/scripts/hooks/ui_route_nudge_hook.ts:158) was updated for the same change; the description was not. | open | |
| 5 | low | docs/guidelines/design-fidelity-mechanics.md:194 | "**The fourth member, and why it is not obvious.**" sits immediately after the "Scope — three things this does NOT license" numbered list, so it reads as item 4 of that list rather than as the precedence chain's fourth member. It also splits the scope list from "The mechanical half", which continues the scope discussion. | open | |
| 6 | low | agents/roadmaps/road-to-source-first-frontend.md:204-215 | Step 2 is marked `[x]` while its own completion note states "the multi-host half of this step stays open by host limitation", so the dashboard reports Phase 1 as 100% done. The Execution-status note's Phase-3 dependency list records the payload-field and X3 dependencies but not this census gap, although the step body says a Phase-3 matcher built from this census "would watch the wrong surface". `[~]` or a `## Blockers` entry is the shape the repo carries for a half-done step; the only record of the gap is prose inside a closed checkbox. | open | |
