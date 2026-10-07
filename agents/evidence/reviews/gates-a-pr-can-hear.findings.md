# Findings: gates-a-pr-can-hear
<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: f70c8296e8b412d73fbbf56268b5bd5c17e05ac64ea8d3defec4c448e448339a | diff: d209e6024cdff4f8e389dee068f26868b6459900 | reviewer: r2-fresh-subagent-gates-a-pr-can-hear | prompt_hash: b79094cb9f1364913ac12e7a8c24af009061e37247b338888aae3070148527ae -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-gates-a-pr-can-hear"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-07 -->

<!-- context-manifest: v1
inputs:
  diff_sha: d209e6024cdff4f8e389dee068f26868b6459900
  scope_hash: f70c8296e8b412d73fbbf56268b5bd5c17e05ac64ea8d3defec4c448e448339a
  roadmap: agents/roadmaps/road-to-gates-a-pull-request-can-hear.md
  roadmap_hash: ce13385134698cd1382ff2b40429e42631588ae984b113b6f2a09e3c38f01a7d
  ac_hash: 6f256b2e51cee25dcd209c07134a317616d41b5809410cc31157cecd9b32e9e0
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-07T01:00:11Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | package-lock.json:1767 | This was round-1 finding 2 and it is still unaddressed. The lockfile bumps `@modelcontextprotocol/sdk` from 1.30.0 to 1.32.1, a shipped runtime dependency. `package.json:130` is unchanged (`^1.30.0`), and no roadmap step, decision, AC or ratification surface covers the bump. It looks like `npm install` drift landing in a governance PR, which means a runtime dependency changes without review. Revert the hunk, or split it into its own PR. | open | |
| 2 | low | .github/workflows/gate-canary.yml:70 | Round-1 finding 1 is only partly addressed. `fetch-depth: 0` removes the shallow-history cause, but `run_canary` (check_gate_coverage.ts:866-874) still takes no unplanted control reading. Any non-zero exit is recorded as `red` ("caught the planted defect"). In this new runner environment (`npm ci` only, no build step) a gate that fails for an environmental reason, such as a missing build artefact or tool, is still logged as caught. The monthly ledger can then say "every gate went red" over a dead gate. An unplanted baseline run per gate, which must exit 0 before the planted run counts, would close this. | open | |
| 3 | low | agents/evidence/ratifications/drain-road-to-gates-a-pull-request-can-hear-20261007.md:38 | The ratification says no "required-check list ... changed", and its § What would have changed the verdict names "a required-check change". But the branch does change the contract's required-check list: `ENFORCED_CHECKS` in `src/scripts/print_required_checks.ts`, three PR-shape arrays, and `branch-protection-policy.md`. The ratification's "What was reviewed" list also omits `print_required_checks.ts`, `report_required_checks_drift.ts` and `package-lock.json`. The ruleset itself is untouched, so this is probably a correction rather than an expansion. As written, though, the record states something the diff contradicts, and it never shows that those surfaces were reviewed. Either say "ruleset unchanged; contract list corrected to match it" and list the missing surfaces, or re-scope the claim. | open | |
| 4 | low | tests/scripts/audit_user_type_axis_no_write.test.ts:47 | The fixture repo is created with `git init` and committed with only `user.email` and `user.name` overridden. The temp repo therefore inherits the developer's global git config. On a machine with `commit.gpgsign=true`, or a global `core.hooksPath` or commit hook, the `beforeAll` commits fail or prompt, and the AC-3 test reds for reasons unrelated to the audit. Also pass `-c commit.gpgsign=false -c core.hooksPath=/dev/null`, or set `GIT_CONFIG_GLOBAL=/dev/null` in the spawn env. | open | |
