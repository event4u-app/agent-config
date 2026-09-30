# Findings: feat-adversarial-verification-close-acs
<!-- completion-review: v1 | reviewed: 2026-09-30 | scope: 604c2b2f9e9faec1158bf4d068009291ec789b62303c30a47ed1299118f1db27 | diff: 1e05ec3d14875540545214a4d62503de12af1d53 | reviewer: r2-fresh-subagent-feat-adversarial-verification-close-acs | prompt_hash: bb50500ff9bbd5570eac083c2a71fdf520739321faae3c7f57ffd0aa7d10d980 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-feat-adversarial-verification-close-acs"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-30 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 1e05ec3d14875540545214a4d62503de12af1d53
  scope_hash: 604c2b2f9e9faec1158bf4d068009291ec789b62303c30a47ed1299118f1db27
  roadmap: agents/roadmaps/road-to-adversarial-verification-and-long-runs.md
  roadmap_hash: 99e797cff7e515e24e7d34a89e3722432d4470bbb99ec4ff84280b814bf083e6
  ac_hash: 78a807a2ea18becacf97c6c08418d1ed92e383e0f6f114cff4068c1dacadd077
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-30T16:11:25Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | src/scripts/_lib/forge_protection.ts:143-146 | `deployRestrictedFrom`'s new `patternsByEnv` handling treats a *confirmed-empty* pattern list for a `custom_branch_policies: true` environment (`patterns.length > 0 && !patterns.some(...)` — the `length > 0` guard fails when `patterns` is `[]`) the same as a wildcard pattern that "admits everything": both resolve to `false` (row `unsatisfied` / "accepts a deployment from any branch"). These are opposite states — GitHub's `custom_branch_policies: true` with zero named patterns blocks *every* branch from deploying, the most restrictive outcome possible, not the least. The function's own docstring explains and justifies the wildcard case in detail but never mentions the empty-pattern-list case, and the accompanying test (`'an empty pattern list is not a restriction'`) locks in the reversed-looking semantics with no rationale attached. Not currently exploitable — the live repository's one environment has a single non-empty, non-wildcard pattern (`main`), and the effect is fail-safe (under-reports satisfaction rather than over-reporting it, unlike the two defects R2 found in round 1) — but it is an undocumented, semantically-inconsistent mapping inside a function whose entire stated purpose is precise three-state provenance. | open | |
