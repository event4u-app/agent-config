# Findings: fix-gate-completeness-new-arrivals
<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: ede514a782c72234fc4aea9e9cb2b1a503808a0ad850aca26ee3b0c8537bda26 | diff: 686821324b2ad94533a277a43cb857d21bb600c6 | reviewer: r2-fresh-subagent-fix-gate-completeness-new-arrivals | prompt_hash: bc44bd7d86b41fec1603ac24e32588bcaf00fc50809d210995e0a4dfb3afd003 -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-17 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 686821324b2ad94533a277a43cb857d21bb600c6
  scope_hash: ede514a782c72234fc4aea9e9cb2b1a503808a0ad850aca26ee3b0c8537bda26
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-17T20:52:52Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/check_pr_ci_current.ts:61 | The ledger-exempt reason claims "no target population", but the file enumerates one (`f.rows`) and silently drops members whose `state` is not a string — the exemption permanently closes the door on counting exactly that. | fixed | 8ec1dbb65 |
| 2 | medium | src/scripts/check_gate_coverage.ts:351-357 | `estate_invalid` is recorded as `fail`, which counts into the ledger's `scanned=`, although the gate's own comment says such a target could not be MEASURED — the ledger then over-reports inspection. | fixed | 8ec1dbb65 |
| 3 | medium | src/scripts/check_gate_coverage.ts:349 | `unavailable` is mapped to `missing_credentials`, whose printed sentence names a credential; the only such gate is unavailable for a stale build artefact, so the audit sentence sends the reader after a token that does not exist. | fixed | 8ec1dbb65 |
| 4 | medium | src/scripts/build_archive_index.ts:322-324 | The ledger plans the RESULT set and completes it immediately, so `planned === completed, skipped=0` by construction; the enumeration to plan is `archiveFiles(dir)`, upstream of `buildIndex`. | fixed | 8ec1dbb65 |
| 5 | low | src/scripts/check_gate_coverage.ts:353 | Same class as 2 for `crashed`: nothing was inspected, yet it counts into `scanned=`. | fixed | 8ec1dbb65 |
| 6 | low | src/scripts/check_gate_coverage.ts:335 | `plan()` sits outside the manifest try/catch and ids are not uniqueness-checked, so a duplicated row throws `LedgerUsageError` as an uncaught stack trace with exit 1, which this file's contract reads as "a gate is blind". | fixed | 8ec1dbb65 |
| 7 | low | src/scripts/build_archive_index.ts:341-344 | The added comment claims the ledger reports before either exit path branches; there are three, and the earliest (`DeadScopeError` → return 1) returns without reporting. | fixed | 8ec1dbb65 |
| 8 | low | src/scripts/build_archive_index.ts:117-124 | The comment justifies unconditional `complete()` via `not-extractable` being a real reading, but `_frontmatter` swallows a parse failure, which is a genuine per-target degrade the reasoning does not cover. | fixed | 8ec1dbb65 |
| 9 | low | src/scripts/check_gate_coverage.ts:327-333 | The justification overstates the gap — the gate already emits counted `pending`/`unavailable` warnings — and the run now prints two different numbers under the word `scanned`. | fixed | 8ec1dbb65 |
| 10 | low | src/config/gate-violation-baselines.json:39 | The note cites "landed + 456 days"; the literal 456 appears nowhere in the test, which computes `STALE_AFTER_DAYS + 400`, so a reader verifying by grep finds nothing. | fixed | 8ec1dbb65 |
| 11 | low | tests/scripts/check_gate_coverage.test.ts | No test exercises the new code; findings 2, 3 and 5 are exactly the class a verdict-to-outcome discrimination test would have caught. | fixed | 8ec1dbb65 |
