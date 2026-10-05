# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: ba6c3be2f662db1b84b8556f3c2ef1bfa3e30e0ab6b6e953d6a9eca812dde6ca | diff: 848cdbcc8f52460ee0953e8eecedc9616504b442 | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: e56e1fa043bd3038856f69ea299ee0bc7b066c4deb7edcc60ba3922ab98c9eb2 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 848cdbcc8f52460ee0953e8eecedc9616504b442
  scope_hash: ba6c3be2f662db1b84b8556f3c2ef1bfa3e30e0ab6b6e953d6a9eca812dde6ca
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T08:05:24Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/scripts/check_release_pr_shape.test.ts:154 | The "producer/consumer link" test pins the directory, the prefix and the extension, but not the date segment. `defaultReportPath` takes `generatedAt` as a parameter, so the test supplies the date itself — once hardcoded (`'2026-10-01'`), once by re-spelling `buildCensus`'s own derivation, `new Date().toISOString().slice(0, 10)`, byte-identical to `report_evidence_temperature.ts:365`. Nothing in either test file asserts the shape `buildCensus` stamps, so changing it (adding a time component, `YYYYMMDD`, a local-time date) keeps every assertion here green and reds `task release` only live — the exact writer/gate-disagreement class the diff cites for 16.3.0. The comment at :152-153 claims the opposite ("Re-deriving only the directory and prefix here would leave the date shape and the extension un-pinned, which is two thirds of a coupling"), so the artifact documents coverage it does not have. The `today` line in particular adds no assertion the fixed date does not already make, while importing a clock dependency. | open | |
| 2 | medium | docs/contracts/release-pr-gating.md:46 | The rewritten skip justification now rests on the categorical "none of its entries is install or runtime code", but the same paragraph states both skipped jobs "trigger on `package.json`", and `package.json` plus `package-lock.json` are the first two allowlist entries. `check_release_pr_shape` matches paths only and never inspects content, so a release PR may edit `bin`, `files`, `dependencies` or `engines` with Public Install Smoke skipped. The replaced wording was anchored on an observation of PR #238's actual file set; the categorical replacement is falsified by its own enumeration and carries less weight than the sentence it displaced, in the one paragraph that justifies skipping the install matrix. | open | |
| 3 | low | src/scripts/check_release_pr_shape.ts:54 | "A second report here is a decision" is false for the documented resume path. `--resume` re-runs step 2 (`release.ts:985-987` invokes `task release-prepare`, annotated idempotent) and `release-prepare` writes the census unconditionally, so a release resumed across a UTC midnight produces a second census under a new date with no decision taken. Both files match the glob, so the gate stays green and the defect is confined to the comment — but it is the same false-comment class this diff removed two hunks below, where the previous `_fnmatchToRegExp` comment claimed no allowlist entry used a range. | open | |
