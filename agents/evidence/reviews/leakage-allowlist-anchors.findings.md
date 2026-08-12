# Findings: leakage-allowlist-anchors
<!-- completion-review: v1 | reviewed: 2026-08-12 | scope: fa878f5d1236eccf0d11d828d163c577a340a042138fab8ade1a66da1bdebfdd | diff: 97d2c29ba763af06c45c5e4a4aebbed7fb531561 | reviewer: r2-fresh-subagent-leakage-allowlist-anchors | prompt_hash: c2b318f1edfedd5031bc2ecfaf320213aebff78b334fecde4df76937a697a68d -->

<!-- context-manifest: v1
inputs:
  diff_sha: 97d2c29ba763af06c45c5e4a4aebbed7fb531561
  scope_hash: fa878f5d1236eccf0d11d828d163c577a340a042138fab8ade1a66da1bdebfdd
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-12T01:27:24Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/lint_framework_leakage.ts:385 | `validate_allowlist` only checks that an anchor resolves to A LINE, never that the entry suppresses A HIT — so the silent rot the change exists to retire survives it, merely re-keyed. Entries whose anchors were lifted from line numbers that had already drifted carry the drift forward. The shipped set has 36 entries and the run reports 32 allowlisted, so at least four suppress nothing, and the new holds-for-the-shipped-allowlist test returns green over exactly that state — false assurance of the property the PR claims. | open | |
| 2 | medium | src/scripts/lint_framework_leakage.ts:388 | Validator and matcher read different text, so a validated anchor can be unusable. The validator matches the raw full line; the matcher matches the hit snippet, which is the line trimmed and sliced to 160 chars. An anchor copied with the line indentation, or drawn past column 160, validates clean and then fails to suppress — and the maintainer is pointed at the-content-is-gone for content that is present. | open | |
| 3 | medium | src/scripts/lint_framework_leakage.ts:691 | The early return fires before the ledger exists, so a broken allowlist bypasses both output contracts of this file: under --json the run exits 1 with empty stdout instead of the documented envelope, and the scanned-N line the gate-coverage collector consumes is never emitted — the denominator is lost on exactly the runs where the gate self-reports as unusable. | open | |
| 4 | medium | tests/scripts/lint_framework_leakage.test.ts:109 | The position-keyed-entry-is-refused test is tautological. Its fixture carries an un-exempted violation and the matcher no longer consults lines, so main returns 1 whether or not the validator runs. Deleting the validate_allowlist call leaves the test green — the headline CLI behaviour change has no falsifying test. The discriminating fixture is a CLEAN file plus a position-keyed entry. | open | |
| 5 | low | src/scripts/lint_framework_leakage_allowlist.json:1 | The rewrite drops version and _doc, the only in-file record of the schema and of the policy cap (more than 20 entries means the linter or the content is wrong). The same commit takes the file from 18 to 36 entries, so the cap is breached in the commit that deletes the sentence stating it, with no note that the counting unit changed from per-file to per-line. Both test fixtures still write version 1, so fixtures and shipped file now disagree. | open | |
| 6 | low | src/scripts/lint_framework_leakage.ts:616 | The suppressionKey docstring describes position keys as a tolerated legacy that a hygiene check counts until the existing 18 migrate. This commit IS that migration and the form is now rejected outright, so the comment documents a pending state that no longer exists. | open | |
| 7 | low | src/scripts/lint_framework_leakage.ts:373 | An entry carrying a whole-file key together with a stale anchor hard-fails the whole gate although the exemption works: the matcher returns true on the whole-file key before reading the anchor, while the validator falls through to the anchor branch and rejects. A whole-file exemption stops every scan for a field the matcher never uses. | open | |
