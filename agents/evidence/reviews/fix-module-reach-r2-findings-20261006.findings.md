# Findings: fix-module-reach-r2-findings-20261006
<!-- completion-review: v1 | reviewed: 2026-10-06 | scope: b4439b830b61dcdbe7710598db8bf6f194189ce576f55ad4f59d57c90a7c28bf | diff: ddc0bdcf10f6803164aa240bddd310f85487d9e1 | reviewer: r2-fresh-subagent-fix-module-reach-r2-findings-20261006 | prompt_hash: 2af517ab4769358e3676f7b9ee90a4d6330ac5aa335caf7b789cddeaa60502e8 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-module-reach-r2-findings-20261006"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-06 -->

<!-- context-manifest: v1
inputs:
  diff_sha: ddc0bdcf10f6803164aa240bddd310f85487d9e1
  scope_hash: b4439b830b61dcdbe7710598db8bf6f194189ce576f55ad4f59d57c90a7c28bf
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-06T06:56:39Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/scripts/report_module_reach.test.ts:252-273 | The "R2 finding 2" regression test (level-4+ heading) is confounded by its own fixture and does not isolate the fix it names. The fixture is an open step, then the level-4 heading, then a BLANK LINE (line 265), then the mention. Tracing the fixed code: the heading line resets the tracker (new regex), so the blank line's reset is redundant for this input. But trace it with ONLY the R2-finding-1 blank-line fix applied and the heading regex reverted to its old `(#|##|###)` form (1-3 hashes): the heading line fails to match and does not reset, yet the very next line is blank and DOES reset under the finding-1 fix alone, before the mention line is ever reached. The assertion `m?.group).not.toBe('open-or-deferred-step')` therefore still passes. Reverting the heading-regex widening at src/scripts/_lib/module_reach.ts:344 alone, while leaving the blank-line fix in place, would not be caught by this test — the only regression guard this diff adds for that specific fix. A fixture with the mention directly after the heading (no intervening blank line) would actually isolate it. | open | Traced by hand against module_reach.ts:339-357's control flow for both the fixed code and the finding-2-reverted/finding-1-kept variant; no other test in the file exercises a heading above level 3 without a trailing blank line. |
| 2 | low | src/scripts/report_module_reach.ts:180-185 | The new `assertScanned({ gate: 'report_module_reach', scanned: modules.length, units: 'module(s) under src/scripts/_lib', roots: ['src/scripts/_lib'] })` call in the `--json` branch duplicates the identical five-line options literal already present in the `--markdown` branch (lines 192-197) and inside the `scan()` closure used by the default branch (lines 167-173). This diff grows the file from two copies of that literal to three. A single `const scanOpts = { gate: 'report_module_reach', scanned: modules.length, units: 'module(s) under src/scripts/_lib', roots: ['src/scripts/_lib'] }` declared once in `main()` and passed to all three call sites would remove the duplication without changing behavior. | open | Not a correctness bug — flagged per the review brief's "inefficiencies" criterion; purely a maintainability nit the diff author could have avoided by factoring the literal it was about to copy a third time. |
