# Findings: road-to-comment-enforcement-completion
<!-- completion-review: v1 | reviewed: 2026-09-02 | scope: 1e7151ebc77f20924e401f048ef3a819672901d8c9deedf815007d24a9528f82 | diff: ba7907c4a8076cb47bd13c24c7b8685d0c23fb17 | reviewer: r2-fresh-subagent-road-to-comment-enforcement-completion | prompt_hash: 260e0c75df4826c44d031c8b4fb815b0a7bfb3b415353eb159db37f11a8eb4be -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-road-to-comment-enforcement-completion"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-02 -->

<!-- context-manifest: v1
inputs:
  diff_sha: ba7907c4a8076cb47bd13c24c7b8685d0c23fb17
  scope_hash: 1e7151ebc77f20924e401f048ef3a819672901d8c9deedf815007d24a9528f82
  roadmap: agents/roadmaps/archive/road-to-comment-enforcement-completion.md
  roadmap_hash: 6d138cc10ee93378365e489d48644496b8951702ee4ef3e255210fffe1d7d62f
  ac_hash: 46eed0b548b676a3f830933b2a94a571275f8ffeeea055f14db2506aeb0654cf
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-02T04:14:32Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/scripts/lint_code_comments.test.ts:26 | The new `--self-test` is executed by nothing automated. This suite imports `COMMENT_CASES` but drives only `scanText`, and CI invokes the gate solely in diff mode (`taskfiles/ci-fast.yml:763`, `.github/workflows/rule-backstops.yml:143`). A regression in the CLI half — the `--self-test` dispatch, the tmpdir/`--paths` wiring, `runGateCli`, or the exit-code mapping — ships green, which is precisely the gap `_lib/gate_self_test.ts` was built to close. | fixed | `2eb6a95a4` — `tests/scripts/lint_code_comments.test.ts` now drives the real binary through `./scripts-run … --self-test` and asserts exit 0 plus `case(s) behaved`, in the shape the sibling adopters use. A second `it` asserts the new recursion refusal. 26 tests pass. |
| 2 | low | src/config/gate-coverage.yml:2425 | The stated benefit — the gate answering for its discrimination "in a consumer checkout where the test suite is not installed" — is unattainable in either direction. `runGateCli` spawns `<repoRoot>/node_modules/.bin/tsx` (`src/scripts/_lib/gate_self_test.ts:45-56`), and `tsx` and `vitest` are both devDependencies; `dist/scripts/` carries no compiled twin and `scripts-run` is not in `files[]`. Where the suite is absent the self-test cannot run; where it can run, the suite is present. | fixed | `2eb6a95a4` — The consumer-checkout claim is withdrawn in `src/config/gate-coverage.yml` and replaced with what the self-test actually buys: the CLI half the vitest file cannot reach, given that CI runs the gate only in diff mode and a diff-mode run exits 0 on an empty diff. The asymmetric-failure observation is recorded here rather than fixed — it lives in the shared `_lib/gate_self_test.ts` harness and repairing it would change every adopter, which is a separate change. |
| 3 | low | src/config/gate-coverage.yml:2420 | Stale sensitivity claim left beside the new one: "4 of the 22 cases" describes the 22-`it` vitest corpus this same diff deleted. The file now holds 24 tests over an 18-case table, so the number matches no corpus in the tree, and a later re-observation compares against a phantom baseline. | fixed | `2eb6a95a4` — The line now reads `4 of the 18 table cases` and says in place that the earlier `22` described the deleted inline corpus, so a later reader sees the correction rather than a silently different number. |
| 4 | low | src/scripts/lint_code_comments.ts:464 | The `--self-test` dispatch omits the `GATE_SELF_TEST_CHILD` recursion guard that all ten sibling adopters carry and that `runGateCli` sets for exactly this purpose (`src/scripts/_lib/gate_self_test.ts:56`). Latent today because the child argv is `--paths <file>`; any later change that forwards parent argv to the child recurses 18-way per level with nothing to stop it. The same line also precedes the `--help` branch, so `--help --self-test` runs the suite instead of printing usage. | fixed | `2eb6a95a4` — `--help` is now handled before `--self-test`, and `--self-test` returns 2 when `GATE_SELF_TEST_CHILD=1`, matching the siblings cited. A test asserts the refusal rather than trusting the branch. |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
