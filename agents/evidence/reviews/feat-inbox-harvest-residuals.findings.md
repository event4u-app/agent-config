# Findings: feat-inbox-harvest-residuals
<!-- completion-review: v1 | reviewed: 2026-08-16 | scope: f3844188f0315759d9b5048110c3d76515c69bfdf00e4858c473eeaf413e1a2c | diff: 358c91db0bd44aa0c65c9f8aad000f7e2c98f3ac | reviewer: r2-fresh-subagent-feat-inbox-harvest-residuals | prompt_hash: 4c4350bbf0d28dd2267486efca353bdb0c8f9c7e2226be3bdbe8f3b075b07d6e -->

<!-- context-manifest: v1
inputs:
  diff_sha: 358c91db0bd44aa0c65c9f8aad000f7e2c98f3ac
  scope_hash: f3844188f0315759d9b5048110c3d76515c69bfdf00e4858c473eeaf413e1a2c
  roadmap: agents/roadmaps/road-to-inbox-harvest-residuals.md
  roadmap_hash: ebe2322b9dba56e0e391b6231009a039648e94f1d6fc79ed7191793be7ae8f78
  ac_hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-16T11:20:18Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/config/gate-violation-baselines.json:36 | `task ci` is red on the reviewed tree in two gates the diff does not touch: `check_gate_completeness` (220 against a baseline of 216) and `check_suppression_hygiene` (`review-prompt-binding-baseline.json` still carries `newInThisChange`). Both sit in the `ci:` task and neither is declared `local_only`. The diff cannot be the cause, but it edits the same ledger file and re-tightens `lint_roadmap_blockers:decidability` 34 to 33 there on a ratchet-must-not-lag argument while leaving the 4-over red unrecorded. | open | |
| 2 | medium | agents/roadmaps-progress.md:448 | The regenerated dashboard renders the new blocker fields as run-on text: `- **Options:**` is glued mid-line onto `If you do nothing:` (lines 448, 468) and `- **Side finding:**` onto `Resolved when:` (line 491), so a reader sees the side finding as part of the resolution condition. Cause: `BLOCKER_FIELD_RE` in `src/agent-src/scripts/update_roadmap_progress.ts` lists eight field names but not `Options` or `Side finding`, so `_blockerField` absorbs past its own field. These two blockers are the only `If you do nothing:` entries in the tree, so this branch is the first to expose it. | open | |
| 3 | low | src/scripts/check_source_size_budget.ts:321 | `--json` does not emit parseable JSON: `reportScanned` appends `scanned: N` and `checkRatchet` appends the verdict paragraph to the same stdout, so piping to a JSON reader fails. Structurally identical to `check_depth_budget`, i.e. a copied house convention rather than a new invention. | open | |
| 4 | low | src/scripts/check_source_size_budget.ts:11 | Header-count drift inside a gate whose subject is honest counting: the docstring says 1,080 `.ts` files while the gate prints `scanned: 1081` and both the coverage manifest and the baseline note say 1,081. The docstring counts the tree before this file existed. | open | |
| 5 | low | src/config/gate-coverage.yml:53 | The rewritten history clause widens `each was correct at the time` across four readings, two of which the same sentence records as internally inconsistent (32 vs 31 listed, 33 vs 34 listed). The pre-change text scoped that claim to the 2026-08-13 reading only; the edit erases the cautionary point of listing the miscounts, in the paragraph that exists to forbid deriving counts from prose. | open | |
| 6 | low | src/scripts/check_source_size_budget.ts:143 | `measure()` swallows a read failure with a bare `continue`, but the file was already `ledger.plan()`-ed and is never resolved, so `ledger.finalize()` throws `UnaccountedTargetsError` and the gate dies with a stack trace instead of a verdict. `gate_ledger.ts` names a silent `continue` as the defect it exists to catch. Reachable on a read race or a permission error. Inherited from the `check_depth_budget` template. | open | |
| 7 | low | tests/scripts/check_source_size_budget.test.ts:153 | The baseline test asserts equality, so a commit that LOWERS the excess (a split, the exact lowering commit the ratchet-before-split rationale is built around) passes the gate as `improved` but fails `task test`. The test header justifies only the above-the-truth direction. Gate and test then return different verdicts for the same tree state, and only the test blocks. | open | |
| 8 | low | src/scripts/check_source_size_budget.ts:106 | The walker counts every `*.ts` under `src/`, including `*.test.ts` and `*.d.ts`, while this repo own gate-population classifier (`_lib/gate_population.ts`) excludes both on the stated grounds that a declaration has no runtime behaviour and a test file cannot be hardened. Latent today (largest such file 301 lines) but a generated `.d.ts` over the ceiling would red a ratchet aimed at reviewable code. | open | |

