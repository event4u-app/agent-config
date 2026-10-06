# Findings: fix-module-reach-r3-findings-20261006
<!-- completion-review: v1 | reviewed: 2026-10-06 | scope: 256450939c8b0185cfeb72115d9e5739bd164744c85a1a15a2074c5c76dcd252 | diff: 9909c8f537ae6d55411263ef59857f19b2bcf470 | reviewer: r2-fresh-subagent-fix-module-reach-r3-findings-20261006 | prompt_hash: 56422ec8a1f91200259e9b3c4fd048fc81d5414516f866d99bf490df02132228 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-module-reach-r3-findings-20261006"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-06 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 9909c8f537ae6d55411263ef59857f19b2bcf470
  scope_hash: 256450939c8b0185cfeb72115d9e5739bd164744c85a1a15a2074c5c76dcd252
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-06T07:09:40Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | low | src/scripts/report_module_reach.ts:187-193 | The default (no-flag) branch of `main()` writes `human(modules)` to stdout and only afterward calls `reportScanned(scanOpts)` (which internally runs `assertScanned`). This is the opposite order from the `--json` and `--markdown` branches, both of which now call `assertScanned(scanOpts)` BEFORE writing their body (that reordering is exactly this round's `--json` fix). If `modules.length` were ever 0 (a dead/moved scan root — the exact failure class `scan_scope.ts` exists to catch), the default branch would print a human report first and only then throw `DeadScopeError`, while the other two branches print nothing before throwing. The branch's own comment ("kept after for consistency with the other two branches") is also now inaccurate post-fix: after this diff, neither `--json` nor `--markdown` prints a trailing `scanned:` line at all, so there is no shared "after" convention left to be consistent with — the only remaining convention is "assert before any output," which this branch does not follow. Untested: no test in this file ever calls `main()` against a zero-module root. | open | Comment at report_module_reach.ts:189-192 vs. the `assertScanned`-then-write ordering in the `--json` (line ~180) and `--markdown` (line ~185) branches of the same diff hunk. |
| 2 | low | tests/scripts/report_module_reach.test.ts:253 | Comment on the "a level-4+ heading resets the step-block tracker too (R2 finding 2)" test says "The mention sits on the line IMMEDIATELY after the heading" — but in the fixture below it, the mention (`` `past_subheading` ``) is on the SAME line as the `####` heading, not on a following line. The test itself still correctly isolates the heading-regex fix (tracing through `findRoadmapMentions`, the old `(#\|##\|###)` pattern would have failed to match the `####` line and left `currentGlyph` at `' '` from the prior step, producing `open-or-deferred-step`; the new `#{1,6}` pattern resets it), so this is a comment-accuracy nit only, not a test-logic defect. | open | tests/scripts/report_module_reach.test.ts:261-262 (fixture: heading line and mention are the same string). |
| 3 | low | tests/scripts/report_module_reach.test.ts:67 | Comment references `check-gate_reachability's own --json branch` — inconsistent hyphen/underscore spelling of the actual file `check_gate_reachability.ts` (correctly spelled with an underscore and backticks elsewhere in this same diff, e.g. `src/scripts/report_module_reach.ts`'s own `--json`-branch comment). Cosmetic only. | open | Compare to the correctly-spelled reference in src/scripts/report_module_reach.ts (the `` `check_gate_reachability.ts`'s own `--json` branch `` comment). |
