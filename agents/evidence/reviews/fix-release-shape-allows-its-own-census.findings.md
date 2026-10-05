# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: 078d04ceb2031684bfe57cf12904acccc051c3feb5995fbfb610fb54a3e05c72 | diff: c9d6debfe59c4b37e3d71f6a708a70cbe1cb52d4 | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: 719d6e779b16a5dc52d6d1663f9b6b53f468a4dfe4d28ecf8888b3e93ed5e0ef -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: c9d6debfe59c4b37e3d71f6a708a70cbe1cb52d4
  scope_hash: 078d04ceb2031684bfe57cf12904acccc051c3feb5995fbfb610fb54a3e05c72
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T11:56:14Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | docs/contracts/release-pr-gating.md:190 | `static-checks` cell asserts "this job's only generated-tree step (`dist/install/`)" — false under both readings. `prepack-check` (tests.yml:367) reads `dist/cli/agent-config.js`, `dist/hooks/dispatch.js`, `dist/hooks/dispatch.sha256` and `dist/router.json` (src/scripts/prepack-check.mjs:31,86,87,242), and `MCP catalog drift --strict` (tests.yml:313) reads the committed generated `src/scripts/mcp_server/consumer_tool_catalog.json` and compares it to freshly-built content (src/scripts/build_mcp_catalog.ts:262-266). The cell's conclusion (the admitted `dist/` template twin is unread by this job) survives, but its supporting enumeration is wrong — the exact unparsed-prose decay this diff exists to remove, in the cell it rewrote. | fixed | a4145a543 —  |
| 2 | medium | docs/contracts/release-pr-gating.md:224 | The blockquote at :36-62 withdraws the categorical claim ("no entry is install or runtime code — false of several of them"), then a sibling categorical is restated UNQUALIFIED at three sites: :224 "the allowlist admits no file these jobs execute", :250 "the allowlist admitting no file those jobs execute", and .github/workflows/tests.yml:61 "admits no install script and no file this job exercises". `package.json` and `package-lock.json` ARE admitted, and every cut job executes them — `npm ci` consumes the lockfile and each step is `npm run <script>` from `package.json`; the `smoke` matrix additionally runs the tarball's `bin` entry. Only two of the five sites (:167 and smoke-public-install.yml:69-72) carry the `package.json` caveat. | fixed | a4145a543 —  |
| 3 | low | tests/scripts/check_release_pr_shape.test.ts:268 | The comment-exclusion filter `/^\s*(\/\/\|#\|\*)/` matches LEADING comment markers only, so the stated intent at :277-281 ("a comment naming the module is not a caller") is not implemented for a trailing comment (`foo(); // see report_evidence_temperature`) or a single-line `/* … */` block. Either form, added anywhere under the five scanned roots, makes `expect(invocations).toHaveLength(1)` red with a message that names a comment as a caller. Fails closed, so it is a maintenance trap rather than a hole. | fixed | a4145a543 —  |
| 4 | low | tests/scripts/check_release_pr_shape.test.ts:243 | The test asserts a universal ("every caller lets the writer choose the path it writes") over a hardcoded five-root list, with no assertion bounding reach. A direct importer of `main` / `defaultReportPath` under `src/cli/**`, `src/server/**` or `src/shared/**` would pass `--out` unseen. The same comment block (:252-257) rejects exactly this shape one level down — a scan that cannot tell "nothing here" from "did not look" — and then reintroduces it for the root set itself. Verified: no such caller exists today (`src/cli`, `src/shared`, `src/server` carry no reference), so the gap is reach, not a live miss. | fixed | a4145a543 —  |
| 5 | low | tests/scripts/check_release_pr_shape.test.ts:251 | `walk` dispatches on `fs.statSync`, which FOLLOWS symlinks, and keeps no visited set. A symlinked directory under a scanned root — `src/scripts` is walked whole — yields unbounded recursion and a RangeError stack overflow instead of a readable failure; `fs.lstatSync`, or skipping `isSymbolicLink()` entries, costs nothing here. No symlink exists under the three directory roots today, so this is latent. Secondary: the walk reads ~1.58k files per run (including the 206 KB `src/scripts/install.ts`) to answer a single-symbol question. | fixed | a4145a543 —  |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
