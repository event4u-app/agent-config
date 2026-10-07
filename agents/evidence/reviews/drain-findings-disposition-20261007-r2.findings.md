# Findings: drain-findings-disposition-20261007-r2
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: da6b73d18365c8292427350a9e8e54d081cc951655432427c8238c9f8059f0c9 | diff: 90b1c153c8ae305508698d7583f40c83f7e45bcc | reviewer: r2-fresh-subagent-drain-findings-disposition-20261007-r2 | prompt_hash: 4a03f021958bc2c84c58d96f8a9df28509c47760fba44006ca721f91707755b4 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-findings-disposition-20261007-r2"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 90b1c153c8ae305508698d7583f40c83f7e45bcc
  scope_hash: da6b73d18365c8292427350a9e8e54d081cc951655432427c8238c9f8059f0c9
  roadmap: agents/roadmaps/road-to-findings-that-get-a-disposition.md
  roadmap_hash: 43744b8763b029d0b15f60c2e2a6f9e20e3618fc2368a99fb16595b654dec57c
  ac_hash: 53952eb8170a57903d778199761720816f66099681c29e17f9ef5095c183c80a
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T19:30:31Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/self_review_gate.ts:1005 | `classifyBlocking` was widened by this diff to admit `security × medium` (step 2.1), and the doc-comment above it (line 86) and `check_finding_dispositions.ts:276` were both updated to say so. The rendered PR-comment verdict line in `renderReview` was not: `` `❌ ${blocking.length} merge-blocking finding(s) (security/claim × high+).` `` still hard-codes the pre-widening criterion. A reviewer reading a live self-review-gate comment on a PR carrying a medium-severity security finding sees a count of blocking findings labelled "(security/claim × high+)" even though the thing that made it blocking is a medium-severity row — the exact self-description-vs-code mismatch this roadmap's own "claim" finding category exists to catch. The per-row `(Blocking)`/`(Advisory)` markers (line 997-998) are computed from `classifyBlocking` directly and stay correct; only the aggregate summary string is stale. No test in `self_review_gate.test.ts` exercises `renderReview`'s rendered text with a medium-security finding — the existing `(Blocking)/(Advisory)` row test (lines 79-89) and the `classifyBlocking` matrix test (lines 28-43) both cover the predicate but not this literal, so the gap passed CI. | open | |
