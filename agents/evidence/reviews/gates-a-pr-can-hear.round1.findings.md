# Findings: gates-a-pr-can-hear
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: d4314ead5c765ad6426ef738e1b4dc986c663f56ec6695f83405114d239c05c3 | diff: cdae2c7770367863635359ca61b48068c3b16f49 | reviewer: r2-fresh-subagent-gates-a-pr-can-hear | prompt_hash: c11fe5b5f5a706025a65aac57863591f8544305be47a685a89aa5b77b97a7af8 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-gates-a-pr-can-hear"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: cdae2c7770367863635359ca61b48068c3b16f49
  scope_hash: d4314ead5c765ad6426ef738e1b4dc986c663f56ec6695f83405114d239c05c3
  roadmap: agents/roadmaps/road-to-gates-a-pull-request-can-hear.md
  roadmap_hash: ce13385134698cd1382ff2b40429e42631588ae984b113b6f2a09e3c38f01a7d
  ac_hash: 6f256b2e51cee25dcd209c07134a317616d41b5809410cc31157cecd9b32e9e0
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T00:52:33Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | .github/workflows/gate-canary.yml:112 | The new scheduled caller runs `check_gate_coverage --canary` in an environment unlike the operator runs the recipes were proven in: a shallow `actions/checkout` (default fetch-depth 1, no build, Node only). `run_canary` (check_gate_coverage.ts ~L850-870) takes no unplanted control reading. It classifies any non-zero exit as `red` ("caught the planted defect"), so a gate that fails for environmental reasons (a missing base ref or history, for example `check_estate_count`'s `origin/main` ladder, or an unbuilt payload) reads as caught in the ledger. The monthly ledger can then report "every gate went red" while a gate is actually dead. Either add an unplanted baseline run per gate, or match the runner to the operator environment (`fetch-depth: 0`, a build step). | open | |
| 2 | medium | package-lock.json:1767 | Unrelated runtime-dependency bump: `@modelcontextprotocol/sdk` goes from 1.30.0 to 1.32.1 in the lockfile, with no `package.json` change and no roadmap step, decision or AC that covers it. It looks like incidental `npm install` drift landing in a governance PR. The ratification enumerates the reviewed surfaces and never mentions it, so a shipped runtime dependency changes unreviewed. Revert it, or split it into its own PR. | open | |
| 3 | low | taskfiles/ci-fast.yml:1041 | `lint-workflow-security` now passes `--strict {{.QUIET_FLAG}}`. Under `--quiet`, `lint_workflow_security` prints nothing at all: the finding list and the summary are both inside `if (!args.quiet)`, yet it still returns 1 on a HIGH. A local quiet `task ci` therefore fails this task with exit 1 and no diagnostic naming the workflow or rule. | open | |
| 4 | low | src/scripts/lint_pack_boundaries.ts:803 | The `--self-test` cases marked `reject` pass on any non-zero exit (`runSelfTest`: `exit !== 0`), but the gate-coverage `no_canary_reason` (gate-coverage.yml, lint_pack_boundaries row) claims specific exits: cross-pack and unresolved-pack exit 1, empty corpus exits 2. A fixture-mode crash or a dead-scope exit 2 on the cross-pack fixture would still count as a correct rejection. The accept cases mitigate this only partly. That self-test is the sole discrimination proof the row relies on, and per the ratification no workflow runs it. | open | |
| 5 | low | src/scripts/lint_pack_boundaries.ts:134 | `LINT_PACK_BOUNDARIES_ROOT` is read at module load on the production CLI path, not only in self-test children. An inherited value silently redirects the CI gate to another root and, through `_paths_overridden()`, disables the baseline ratchet. Nothing in the output says the root was overridden. Consider gating the env read on `GATE_SELF_TEST_CHILD`, or printing the effective root when it is overridden. | open | |
| 6 | low | src/scripts/report_required_checks_drift.ts:92 | `readLiveRuleset` calls `gh api repos/{repo}/rulesets` without `--paginate`, so it sees only the first page (30). With more rulesets, a present `main protection` reads as "no ruleset named" (exit 2). `requiredContexts` also reads only the first `required_status_checks` rule it finds. | open | | <!-- ref-ignore -->
| 7 | low | .github/workflows/gate-canary.yml:120 | The upload step runs `if: always()` with `if-no-files-found: error`. When install or checkout fails before the canary step sets its output, `steps.canary.outputs.ledger` is empty, and the upload adds a second, misleading failure on top of the real one. | open | |
