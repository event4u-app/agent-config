# Findings: findings-that-get-a-disposition
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: fb0f364aa9982552e9a4362d63831a03686681f32407a3f6984052448ef4275a | diff: e9bb3b3b37d2d9270c2c8195ddc3da7dca565f67 | reviewer: r2-fresh-subagent-findings-that-get-a-disposition | prompt_hash: 7ebf507b3e5c8ef02be836c439fc41cd76b74833f371fb1ee2461de5e3a9f577 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-findings-that-get-a-disposition"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e9bb3b3b37d2d9270c2c8195ddc3da7dca565f67
  scope_hash: fb0f364aa9982552e9a4362d63831a03686681f32407a3f6984052448ef4275a
  roadmap: agents/roadmaps/road-to-findings-that-get-a-disposition.md
  roadmap_hash: ccaac7459ae490cd64217e00ccb9496919a4b21ddc97e80fcf8c13623532bc0a
  ac_hash: 54e9d5fc3420182ceb7a0dd55831d30e38322da85c574f9fa212b6c72fe5d382
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T20:09:22Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | CHANGELOG.md:39 | The new entry contradicts itself: it says that with `--pr` a medium security finding the self-review reported but the ledger lacks "is now red too", then says the merge gate is unchanged "so the finding still only advises on a pull request". `--pr` is the pull-request path, so a reader cannot tell whether a release PR carrying such a finding is blocked or not. State the actual scope instead, for example: red on a release PR whose version is after 16.3.0, advisory on every other PR. | fixed | CHANGELOG entry now separates the release pull request (red) from every other pull request (advisory) |
| 2 | low | agents/roadmaps/stubs/road-to-the-16-3-0-findings-residue.md:17 | The preamble says "Nothing here waits on the owner or an outside party", but item 7 (line 106) is titled "waits on the owner" and closes only when the owner picks an option (D6). The preamble's claim that every item is agent-doable is false for item 7. | fixed | stub preamble now says items 1 to 6 are agent work and item 7 waits on the owner |
| 3 | low | agents/roadmaps/road-to-findings-that-get-a-disposition.md:54 | The new parenthetical says that since fc1bdec4f both `--no-forge`/`--offline` and any `--check <id>` run skip the forge read. The unchanged text right after it (lines 57-59) still says the read happens "including on a single `--check` run; the only opt-out is an environment variable". The paragraph now contradicts itself. Strike or date-qualify the stale clauses. | fixed | Context paragraph rewritten in the past tense for the 2026-10-06 reading, with the fc1bdec4f change after it |
| 4 | low | agents/roadmaps/road-to-findings-that-get-a-disposition.md:75 | Step 1.1 is ticked `[x]`, but its title says the symlink findings "are closed against the fix", and the outcome note says they are not: both rows are `still_open`. Its verify command only checks that both rows carry some `status`, so it passes on the opposite of what the step asserts and cannot tell the two outcomes apart. Reword the step or check the expected status. | fixed | step 1.1 reworded to cover both outcomes; its verify now requires still_open naming the residue stub |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
