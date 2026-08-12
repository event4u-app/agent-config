# Findings: cli-delegate-entry-guard
<!-- completion-review: v1 | reviewed: 2026-08-12 | scope: f251aea354ba5df0fec69d3eb5702914ff698a4868dc8958c96af96295b618ef | diff: 5d8a7410da9caba0e77714dc9e5e92c370a1614e | reviewer: r2-fresh-subagent-cli-delegate-entry-guard | prompt_hash: 06afe19dd1779d0443065e10714b39d48879b6e22bd59ba829fb33845ae2cba2 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 5d8a7410da9caba0e77714dc9e5e92c370a1614e
  scope_hash: f251aea354ba5df0fec69d3eb5702914ff698a4868dc8958c96af96295b618ef
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-12T02:26:53Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/_cli/cmd_doctor.ts:3611 | The delegate branch returns a strict basename equality and returns BEFORE the realpath fallback the same function documents as load-bearing (a symlinked invocation, an installed projection, macOS /var to /private/var). Inside the bundle that protection is gone: any invocation whose basename is not literally the built filename falls to false and reproduces the exact silent exit-0 no-op this change exists to remove. Same shape in cmd_migrate, cmd_refresh, cmd_session_recycle. The smoke test cannot see it because it always invokes each bundle by its literal built filename. | open | |
| 2 | medium | tests/scripts/cli_delegate_bundles.test.ts:77 | The populated-outdir assertion grants an unexplained slack of three. The build globs one bundle per source, so the relation is exact (29/29) and the assertion should be equality. As written, three commands can drop out of the build or the sweep and both this test and the no-op sweep still report green — the precise failure class the file exists to prevent. The companion greater-than-20 floor is tied to nothing. | open | |
| 3 | medium | tests/scripts/cli_delegate_bundles.test.ts:46 | probe() maps every abnormal termination to a healthy result: a timeout kill (status null), a signal kill and a spawn failure all become code 1, and the only assertion is exit-0-with-no-output. A bundle that hangs until killed, crashes, or exits non-zero with no output passes a test whose docstring claims every bundle must actually run. The hang case is the worst: a plausible regression reported as success. | open | |
| 4 | medium | src/scripts/_cli/cmd_refresh.ts:453 | The four sibling implementations diverge and two carry a doc comment describing a mechanism they do not implement. cmd_doctor and cmd_refresh never consult __AGENT_CONFIG_BUNDLE__ at all, yet their new JSDoc points at cmd_session_recycle for why a single flag cannot answer may-I-run, implying a two-flag pairing those files lack. Any esbuild target that inlines them gets an auto-run the other two are structurally protected from. The command-name literal is duplicated across four files with nothing asserting it still matches the filename. | open | |
| 5 | low | tests/scripts/cli_delegate_bundles.test.ts:57 | The comment claims the real build step costs about 50ms. An npm run spawn alone exceeds that before esbuild bundles 29 entries; the same block budgets a 120s timeout and a 130s deadline, which contradicts the figure. An unverified cost claim invites a maintainer to move this build into a tighter hook. | open | |
| 6 | low | tests/scripts/cli_delegate_bundles.test.ts:58 | The build runs with stdio ignore, so a build failure surfaces as a bare throw with the diagnostics discarded — in a file whose purpose is diagnosing silent failure. Bare npm without shell also does not resolve on Windows, so the suite is silently platform-pinned. | open | |
