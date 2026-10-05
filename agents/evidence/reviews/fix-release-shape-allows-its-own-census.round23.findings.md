# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: 8c79d14f1c03660bec512b469121097adf900d0d7fe40ff4ef1cd88fcfe5c5fa | diff: b9719c8a3c7dafe858aba661a489133f9c0d0497 | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: abd09dad738a554f85b04629d2f81d557a5193678dcdfbb412a10913e6439c1a -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: b9719c8a3c7dafe858aba661a489133f9c0d0497
  scope_hash: 8c79d14f1c03660bec512b469121097adf900d0d7fe40ff4ef1cd88fcfe5c5fa
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T11:45:48Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | docs/contracts/release-pr-gating.md:190 | The new `static-checks` cut-surface row asserts "the allowlist carries no TypeScript, no test file and no generated tree". The third conjunct is false: § Release-PR shape admits `dist/agent-src/templates/agents/agent-project-settings.example.yml`, and this very section's preamble calls that entry "the project-settings template pin with its regenerated twin" and counts "six paths under `src/` and `dist/`". The row therefore contradicts the enumeration it argues from and its own preamble seventeen lines above, in the same cell the diff rewrote to replace a step list with a property claim — and a property claim that is false is worse than the list it replaced, because it reads as stable. Nothing parses these cells, so only review holds it. The coverage conclusion survives (dist/agent-src freshness is gated by `consistency.yml` on the kept surface; `static-checks`'s only generated-tree step reads `dist/install/`), so this is a wrong claim rather than a gap. | fixed | 8f4fa3e08 —  |
| 2 | low | docs/contracts/release-pr-gating.md:190 | Same row closes "and `npm ci` runs in every one of those jobs", quantifying over the three twins it just named. `release-validation.yml` § `audit-gate` runs no `npm ci`: its steps are checkout, setup-node and `npm audit --omit=dev --audit-level=high`, and its own comment says "Lockfile-driven — no npm ci needed" (.github/workflows/release-validation.yml:405). The universal is false for one of three. Twin coverage for `npm ci` survives via `consumer-matrix.yml` and `evaluator-umbrella.yml`, which do run it, so narrowing the sentence to those two costs the argument nothing. | fixed | 8f4fa3e08 —  |
| 3 | low | tests/scripts/check_release_pr_shape.test.ts:246 | The caller scan behind "every caller lets the writer choose the path it writes" filters files through a TEXT extension allowlist, which silently drops every extensionless file inside a declared root. `src/scripts/install` and `src/scripts/agent-config` are exactly that shape — executable dispatch scripts in a scanned root — so an invocation added to either leaves `toHaveLength(1)` green. The adjacent comment hardens the ROOT dimension against this precise failure ("a scan that cannot tell 'nothing here' from 'did not look'") and then reopens it one level down on the FILE dimension. The stated motive, skipping binary fixtures, is met by a binary sniff or a short denylist without excluding the plausible caller shape. | fixed | 8f4fa3e08 —  |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
