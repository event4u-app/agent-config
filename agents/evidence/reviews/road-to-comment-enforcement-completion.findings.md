# Findings: road-to-comment-enforcement-completion
<!-- completion-review: v1 | reviewed: 2026-09-02 | scope: a73eedbc7cfc90c3d9097dee70bf8a5ad0b29a7c52b2a2c75ca44be0096b5c09 | diff: 0d5e0ec85054ee052154c9dff48b0c53cda1cbc4 | reviewer: r2-fresh-subagent-road-to-comment-enforcement-completion | prompt_hash: 260e0c75df4826c44d031c8b4fb815b0a7bfb3b415353eb159db37f11a8eb4be -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-comment-enforcement-completion"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-02 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 0d5e0ec85054ee052154c9dff48b0c53cda1cbc4
  scope_hash: a73eedbc7cfc90c3d9097dee70bf8a5ad0b29a7c52b2a2c75ca44be0096b5c09
  roadmap: agents/roadmaps/archive/road-to-comment-enforcement-completion.md
  roadmap_hash: 6d138cc10ee93378365e489d48644496b8951702ee4ef3e255210fffe1d7d62f
  ac_hash: 46eed0b548b676a3f830933b2a94a571275f8ffeeea055f14db2506aeb0654cf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-02T04:14:32Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/scripts/lint_code_comments.test.ts:26 | The new `--self-test` is executed by nothing automated. This suite imports `COMMENT_CASES` but drives only `scanText`, and CI invokes the gate solely in diff mode (`taskfiles/ci-fast.yml:763`, `.github/workflows/rule-backstops.yml:143`). A regression in the CLI half — the `--self-test` dispatch, the tmpdir/`--paths` wiring, `runGateCli`, or the exit-code mapping — ships green, which is precisely the gap `_lib/gate_self_test.ts` was built to close. | open | 8 sibling adopters run theirs from vitest (`tests/scripts/lint_settings_classes.test.ts:127`, `tests/scripts/lint_consolidation_lineage.test.ts:118`); one `it` closes it. Verified manually: 18/18, 9 rejecting, exit 0. |
| 2 | low | src/config/gate-coverage.yml:2425 | The stated benefit — the gate answering for its discrimination "in a consumer checkout where the test suite is not installed" — is unattainable in either direction. `runGateCli` spawns `<repoRoot>/node_modules/.bin/tsx` (`src/scripts/_lib/gate_self_test.ts:45-56`), and `tsx` and `vitest` are both devDependencies; `dist/scripts/` carries no compiled twin and `scripts-run` is not in `files[]`. Where the suite is absent the self-test cannot run; where it can run, the suite is present. | open | Same claim repeated in the archived roadmap step 1.1 as the rationale for the phase. Failure mode is also asymmetric: a missing `tsx` yields exit 1, which the harness scores as `reject` behaved for all 9 rejecting cases and fails only the 9 accepting ones. The other stated benefit (argv, scan-scope, exit codes) is real and stands. |
| 3 | low | src/config/gate-coverage.yml:2420 | Stale sensitivity claim left beside the new one: "4 of the 22 cases" describes the 22-`it` vitest corpus this same diff deleted. The file now holds 24 tests over an 18-case table, so the number matches no corpus in the tree, and a later re-observation compares against a phantom baseline. | open | The paragraph added at 2432-2438 restates sensitivity correctly (4 of 9 rejecting, re-derived and confirmed: cases 1-3 and 18 are the de-comment-only rejects); the adjacent older line was not updated with it. |
| 4 | low | src/scripts/lint_code_comments.ts:464 | The `--self-test` dispatch omits the `GATE_SELF_TEST_CHILD` recursion guard that all ten sibling adopters carry and that `runGateCli` sets for exactly this purpose (`src/scripts/_lib/gate_self_test.ts:56`). Latent today because the child argv is `--paths <file>`; any later change that forwards parent argv to the child recurses 18-way per level with nothing to stop it. The same line also precedes the `--help` branch, so `--help --self-test` runs the suite instead of printing usage. | open | cf. `src/scripts/lint_eval_specs.ts:520-525` and `src/scripts/lint_skill_link_reach.ts:179-184`, which return 2 on a detected recursion. |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
