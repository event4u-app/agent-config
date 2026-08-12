# Findings: negative-test-antipattern
<!-- completion-review: v1 | reviewed: 2026-08-12 | scope: 0dc952ac3b087f691d281b612528b06dbf0f58cfd1077ca4b84771ae8fd14170 | diff: 8bef27e8adae4e742350970323232981d8b499d0 | reviewer: r2-fresh-subagent-negative-test-antipattern | prompt_hash: 9fc1c44a83ee15f7019d358e8ee629f5fe0227e7001e1894a53883a3ca34287b -->

<!-- context-manifest: v1
inputs:
  diff_sha: 8bef27e8adae4e742350970323232981d8b499d0
  scope_hash: 0dc952ac3b087f691d281b612528b06dbf0f58cfd1077ca4b84771ae8fd14170
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-12T01:04:10Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/skills/testing-anti-patterns/SKILL.md:174 | The new Gate block tells the agent to delete or invert the control it claims to pin but contains no restore step; the only put-it-back instruction lives outside the block, in the prose at :180. Every other gate in this skill is self-contained, and gate blocks are the fragment agents lift verbatim, so the mutation can be applied to a production security guard and left in place. | fixed | 67b747e95 — restore step moved inside the gate block |
| 2 | medium | src/skills/testing-anti-patterns/SKILL.md:221 | The diff introduces a distinct, nameable failure mode but wires none of the skill dispatch surfaces: no bullet in `## Do NOT` (where all seven existing anti-patterns each have one) and no entry in `## Auto-trigger keywords`. The pattern is unreachable by keyword and absent from the closing checklist a reviewer scans. | fixed | 67b747e95 — Do NOT bullet + three keywords; description left alone on purpose |
| 3 | low | src/skills/testing-anti-patterns/SKILL.md:177 | The unqualified delete instruction for an assertion that cannot fail sits ~20 lines above Anti-Pattern 7, which forbids deleting an assertion to obtain green. The two are mechanically compatible (a vacuous assertion is already green) but nothing distinguishes them, and cannot-fail-for-any-implementation is exactly the judgement an agent makes about an assertion it cannot get to pass. | fixed | 67b747e95 — qualified and cross-referenced to Anti-Pattern 7 |
