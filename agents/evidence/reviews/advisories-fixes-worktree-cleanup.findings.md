# Findings: advisories-fixes-worktree-cleanup
<!-- completion-review: v1 | reviewed: 2026-10-21 | scope: 0092cb6cac489ce9cf524b46b4480602c01ff6dec3a78104fab6f57326e90353 | diff: 7247c0ca9f463189e06d7cdfc501831b623ced77 | reviewer: r2-fresh-subagent-advisories-fixes-worktree-cleanup | prompt_hash: 002899e0c061ed6a579de42b9ab5d4b91d187c7c44fbc7e423ef9040ff1bcee4 | round: 1 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-advisories-fixes-worktree-cleanup"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-21 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 7247c0ca9f463189e06d7cdfc501831b623ced77
  scope_hash: 0092cb6cac489ce9cf524b46b4480602c01ff6dec3a78104fab6f57326e90353
  roadmap: agents/roadmaps/road-to-advisories-heard-the-same-day.md
  roadmap_hash: 9e15c84ec8491f6afdf7e011a16ce7e86914fc731be186145539560843504cd8
  ac_hash: 8dda282441a3e6bef9452f0a649b48d74791623af97060560f619c9ad232d992
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-21T13:29:46Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/worktree_cleanup_check.ts:789 | The `/pr:merge` path (`apply --branch --no-delay --respect-setting`) cannot remove the tree it just merged: the 48 h mtime live window and the merging session's own register record make it `live`; `--no-delay` waives only D4. Tests pass only on a one-year-ahead clock. | fixed | 0f4aa3376 |
| 2 | high | src/scripts/advisories.ts:171 | Cross-project OSV attribution matches package name + relative file but never the version, so project A's vulnerable version becomes a finding in project B that pins a fixed one. | fixed | 0f4aa3376 |
| 3 | high | src/scripts/advisories.ts:155 | `egress` is read from `todo[0]` only; under `--all-projects` a project with `advisories.egress: none` still has its names sent. | fixed | 0f4aa3376 |
| 4 | high | src/scripts/_lib/advisory_sources.ts:264 | A non-200 detail fetch `continue`s: a vulnerability querybatch reported is dropped while the report stays `ok`. | fixed | 0f4aa3376 |
| 5 | medium | src/scripts/_lib/advisory_inventory.ts:236 | The image regex is not anchored after the name: `phpmyadmin:5`, `nodered/node-red` become php/node runtimes. | fixed | 0f4aa3376 |
| 6 | medium | src/scripts/_lib/advisory_sources.ts:275 | OSV severity read only from `database_specific.severity`; CVSS vectors in `severity[]` are ignored, so many records land in T3. | fixed | 0f4aa3376 |
| 7 | medium | src/scripts/_lib/security_fix.ts:117 | `direct` is always false: the inventory never emits package.json dependencies, so direct dependencies get the transitive plan. | fixed | 0f4aa3376 |
| 8 | medium | src/scripts/_lib/security_fix.ts:148 | `runtimePlan` edits pins on other release lines (Node 18 → 22.11.1), an unannounced major. | fixed | 0f4aa3376 |
| 9 | medium | src/scripts/advisories.ts:442 | The PR-body cooldown field claims the audit ran without evidence; `suspiciousPaths` is called by no CLI path. | fixed | 0f4aa3376 |
| 10 | medium | src/scripts/advisories.ts:414 | `verify` on a held refresh lock reads stale state and reports `fix-failed`; it also overwrites the `reopenMitigations` result. | fixed | 0f4aa3376 |
| 11 | medium | src/scripts/_lib/advisory_notice.ts:64 | The cache lives in the git common dir shared by every worktree: a refresh in a fix worktree overwrites the main checkout's findings. | fixed | 0f4aa3376 |
| 12 | medium | src/scripts/advisories.ts:470 | `track --deployed` marks every merged fix deployed; any successful `release`-named run also counts as a deploy. | fixed | 0f4aa3376 |
| 13 | medium | src/scripts/_lib/security_fix.ts:340 | `mergedNotDeployed` lines carry cache-derived `merge_sha`/`key` into session context without `safeField`. | fixed | 0f4aa3376 |
| 14 | medium | src/scripts/advisories.ts:162 | `egress: none` is presented as "the source did not answer" and later as a 3-day silence; vendor-patched `unknown` reads the same. | fixed | 0f4aa3376 |
| 15 | medium | src/scripts/worktree_cleanup_check.ts:521 | `commentSaysGenerated` lets one matching comment mark every pattern of its block regenerable (`# local secrets and generated files` above `.env`). | fixed | 0f4aa3376 |
| 16 | medium | src/scripts/worktree_cleanup_check.ts:1044 | The pre-removal re-check reuses the inventory's `sessionPaths` snapshot; a session registering in between is not seen. | fixed | 0f4aa3376 |
| 17 | medium | src/scripts/worktree_cleanup_check.ts:1200 | `git worktree remove` inside the daily deadline can be killed mid-deletion; a throw discards the journal of removals already done. | fixed | 0f4aa3376 |
| 18 | medium | docs/decisions/ADR-295-worktree-removal-on-the-proven-set.md:53 | "Not locked" is in the safe predicate, but the `locked` porcelain line is never read. | fixed | 0f4aa3376 |
| 19 | medium | src/domains/git/pr/merge/command.md:300 | The merge-time removal uses `./scripts-run …`, which only exists in this checkout; consumers need `agent-config worktree:cleanup`. | fixed | 0f4aa3376 |
| 20 | low | src/scripts/_lib/advisory_sources.ts:153 | Native-audit version/line lookup by name only picks the wrong nested duplicate. | fixed | 0f4aa3376 |
| 21 | low | src/scripts/_lib/advisory_sources.ts:253 | OSV querybatch `next_page_token` pagination is ignored. | fixed | 0f4aa3376 |
| 22 | low | src/scripts/advisories.ts:370 | `accept` does not recompute findings; within the refresh window the accepted finding keeps its tier. | fixed | 0f4aa3376 |
| 23 | low | src/scripts/advisories.ts:151 | Stale-lock takeover writes without `wx`; two processes can both take it over. | fixed | 0f4aa3376 |
| 24 | low | src/agent-src/templates/github-workflows/advisories-daily.yml:41 | Unpinned `npx --yes @event4u/agent-config` with an `issues: write` token; actions pinned by tag; a daily full comment rather than a delta. | fixed | 0f4aa3376 |
| 25 | low | src/scripts/_lib/advisory_notice.ts:103 | `safeField(f.file, 200)` is capped by `FIELD`'s `{1,120}`. | fixed | 0f4aa3376 |
| 26 | low | src/scripts/_lib/advisory_inventory.ts:334 | `readInventory` walks the tree twice (fingerprint re-calls `sources()`). | fixed | 0f4aa3376 |
