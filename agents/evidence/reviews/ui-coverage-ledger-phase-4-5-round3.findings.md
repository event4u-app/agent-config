# Findings: ui-coverage-ledger-phase-4-5-round3
<!-- completion-review: v1 | reviewed: 2026-09-30 | scope: e65773ec95ce855a119a79c1399bd240392733ae5f61d8fea2d52d83ec7fa96b | diff: 44f90ba239cacdb85d4c0cd9933bc4641cead05a | reviewer: r2-fresh-subagent-ui-coverage-ledger-phase-4-5-round3 | prompt_hash: 237a5285d5b786d82a4a58baa5f9243f56194888743f9a1daa93bd179eb756b1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-ui-coverage-ledger-phase-4-5-round3"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-30 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 44f90ba239cacdb85d4c0cd9933bc4641cead05a
  scope_hash: e65773ec95ce855a119a79c1399bd240392733ae5f61d8fea2d52d83ec7fa96b
  roadmap: agents/roadmaps/road-to-a-ui-coverage-ledger-that-can-fail.md
  roadmap_hash: d0c2c8c31275ab6eb3f2ec33b947b504485a4501efc7ac4fd2d4b7797eb4c5a1
  ac_hash: 2b9a5747d5ce8bf179ba351b980d8e46e488266103280a8194853fbe5eb3f411
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-30T18:31:58Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/scripts/work_engine/ui_port_losses.test.ts:311-312 | The new test explicitly argues (comment at lines 316-320) that the Command column must be matched **per row**, not as a global occurrence check, because a global check cannot see divergence between the Before/After rows. That row-binding discipline is built (`row()`, lines 321-330) and applied to the Command column only. The Result column — the actual `caught N of 3` number this whole roadmap phase is about — is checked with the exact global pattern the comment argues against: `expect(text).toMatch(/caught 0 of 3/)` / `toMatch(/caught 3 of 3/)` (lines 311-312) pass as long as both substrings appear *anywhere* in the README, not specifically in the Before/After rows they claim to pin. A swap of the two numbers between the Before and After row cells (or a stale Result cell left unedited while the fenced code block below is updated) would leave both `toMatch` calls green, silently defeating "both numbers sit in the README with the command that produced each" (the test's own title) for the one column that actually carries the AC-1/pre-registration claim. | fixed | dc4d8d199 — every cell is now bound to its own row (command, result and faithful-arm count, for both rows), not just the Command column. The swap this finding names was used as the sensitivity control rather than argued away: with the two counts exchanged between the Before and After cells the test fails (1 failed / 21 passed), while `grep -c` still finds each number 3 times — which is exactly what the old global `toMatch` was looking at and why it stayed green. Restored, 22/22. |
