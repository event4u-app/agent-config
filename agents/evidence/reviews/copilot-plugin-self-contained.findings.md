# Findings: copilot-plugin-self-contained
<!-- completion-review: v1 | reviewed: 2026-10-24 | scope: 9eb842e20fc04e3a58c965de1c96c8287a436f7dab4becf90086502d9c3dcb49 | diff: 821d768e37e70f07c37752a4abe8fc90628d0674 | reviewer: r2-fresh-subagent-copilot-plugin-self-contained | prompt_hash: 3bcda7858813d0be5869b908dd88fa95ccabb4fdd14b219053d94ac2557703f4 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-copilot-plugin-self-contained"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-24 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 821d768e37e70f07c37752a4abe8fc90628d0674
  scope_hash: 9eb842e20fc04e3a58c965de1c96c8287a436f7dab4becf90086502d9c3dcb49
  roadmap: agents/roadmaps/later/road-to-listings-the-owner-submits.md
  roadmap_hash: 07373119b35610c6496e928361ddece1e2753fad38a041f246e8a99fc47c811b
  ac_hash: 6c2c44db4230ab0129bebde5691e26a90b2f30807a08e348951b7c1e6c7d9a82
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-24T06:14:21Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | docs/distribution/registry-submissions.md:99 | The precondition no longer requires that a clean Copilot install of the release being submitted loads the plugin; it was replaced by evidence from a local install of the unreleased repair. The submission gate therefore no longer names the check that caught the 17.3.0 defect, so a future release could be submitted without re-running it. | open | diff hunk registry-submissions.md @@ -96 |
| 2 | low | src/scripts/condense.ts:2197 | The symlink guard (`_isSymlink` then unlink) is applied only to the `.claude-plugin` pointer file; the new `.github/plugin/skills/install-agent-config/SKILL.md` target is written with `writeFileSync` without it, so a symlinked copy would be written through instead of replaced, inconsistent with the sibling path. | open | condense.ts:2194-2199 |
| 3 | low | src/scripts/condense.ts:2229 | The success message still reports the pointer skill only in `.claude-plugin/skills/` although the function now also materialises it under `.github/plugin/skills/`. | open | condense.ts info() message |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
