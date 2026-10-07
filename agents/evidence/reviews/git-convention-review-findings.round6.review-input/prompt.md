# R2 completion review — git-convention-review-findings

You are a FRESH reviewer subagent. You have no implementation context and
you must not acquire any (blind-review pattern, plan-review-gates.md §5).

## Review mode

Senior-engineer review of the branch diff. Search grid — hunt for:

- errors
- inconsistent logic
- inefficiencies
- bug-producing patterns

## Rules

- Review only — write no code, fix nothing.
- Tool allowlist (contract §5): branch-scoped `git diff` + reads of
  branch-touched files only; no `git log` beyond the branch, no repo-wide
  grep, no reads of `agents/runtime/` or session artifacts.

## Inputs

- diff: `diff.patch` — the review scope (branch head 7ff3ec484e36008a3c8164181886495b08ad1dd0, review
  artefacts excluded), scope hash `4f40f0192f3389cc5b0497da1356ceada2998791afc4c65a1ac9dc7c20862380`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- CHANGELOG.md
- agents/decisions/rule-migrations/commit-conventions.yml
- agents/evidence/analysis/adr-evidence-census-2026-08.md
- agents/evidence/analysis/delivery-set-measurement-2026-08-31.json
- agents/evidence/analysis/rebase-lease-push-conformance-count.md
- agents/evidence/analysis/routing-body-signal-verdict.json
- agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md
- agents/evidence/council/git-convention-carrier-2026-10.md
- agents/evidence/council/git-convention-target-resolution-2026-10.md
- agents/evidence/council/rebase-cited-commits-2026-10.md
- agents/evidence/ratifications/git-convention-review-findings.md
- agents/evidence/ratifications/git-convention-roadmaps.md
- agents/roadmaps/archive/road-to-a-git-convention-that-reaches-every-checkout.md
- agents/roadmaps/archive/road-to-a-rebase-that-leaves-a-way-back.md
- agents/roadmaps/archive/road-to-one-owner-for-the-ticket-and-the-subject.md
- dist/agent-src/commands/bug/investigate.md
- dist/agent-src/commands/commit.md
- dist/agent-src/commands/commit/in-chunks.md
- dist/agent-src/commands/estimate-ticket.md
- dist/agent-src/commands/feature/explore.md
- dist/agent-src/commands/feature/plan.md
- dist/agent-src/commands/fix/ci.md
- dist/agent-src/commands/fix/commit-messages.md
- dist/agent-src/commands/implement-ticket.md
- dist/agent-src/commands/pr/create.md
- dist/agent-src/commands/pr/create/description-only.md
- dist/agent-src/commands/pr/merge.md
- dist/agent-src/commands/prepare-for-review.md
- dist/agent-src/commands/refine-ticket.md
- dist/agent-src/commands/review/changes.md
- dist/agent-src/commands/roadmap/next.md
- dist/agent-src/commands/roadmap/process-full.md
- dist/agent-src/commands/worktree/create.md
- dist/agent-src/contexts/execution/roadmap-process-loop.md
- dist/agent-src/guidelines/agent-infra/layered-settings.md
- dist/agent-src/guidelines/php/git.md
- dist/agent-src/rules/commit-conventions.md
- dist/agent-src/skills/bug-analyzer/SKILL.md
- dist/agent-src/skills/conventional-commits-writing/SKILL.md
- dist/agent-src/skills/conventional-commits-writing/evals/triggers.json
- dist/agent-src/skills/git-workflow/SKILL.md
- dist/agent-src/skills/git-workflow/references/branch-update.md
- dist/agent-src/skills/git-workflow/references/commit-subject.md
- dist/agent-src/skills/jira-integration/SKILL.md
- dist/agent-src/skills/jira-integration/evals/triggers.json
- dist/agent-src/skills/merge-conflicts/SKILL.md
- dist/agent-src/skills/merge-conflicts/evals/triggers.json
- dist/agent-src/skills/refine-ticket/SKILL.md
- dist/agent-src/skills/using-git-worktrees/SKILL.md
- dist/agent-src/skills/using-git-worktrees/evals/triggers.json
- dist/install/install.mjs
- docs/contracts/plan-review-gates.md
- docs/contracts/settings-api.md
- docs/contracts/settings-classes.md
- docs/decisions/ADR-283-git-convention-carrier.md
- docs/decisions/INDEX.md
- docs/distribution/consumer-matrix.md
- docs/guidelines/agent-infra/layered-settings.md
- docs/guidelines/php/git.md
- docs/settings-reference.md
- src/agent-src/contexts/execution/roadmap-process-loop.md
- src/cli/registry.ts
- src/config/agent-settings.template.yml
- src/config/evaluator-budgets.json
- src/config/routing-coverage-seed.json
- src/domains/engineering-base/bug/investigate/command.md
- src/domains/engineering-base/feature/explore/command.md
- src/domains/engineering-base/feature/plan/command.md
- src/domains/engineering-base/fix/ci/command.md
- src/domains/engineering-base/fix/commit-messages/command.md
- src/domains/engineering-base/implement-ticket/command.md
- src/domains/engineering-base/prepare-for-review/command.md
- src/domains/engineering-base/review/changes/command.md
- src/domains/engineering-base/worktree/create/command.md
- src/domains/git/commit/command.md
- src/domains/git/commit/in-chunks/command.md
- src/domains/git/pack.yaml
- src/domains/git/pr/create/command.md
- src/domains/git/pr/create/description-only/command.md
- src/domains/git/pr/merge/command.md
- src/domains/meta/pack.yaml
- src/domains/product-basic/estimate-ticket/command.md
- src/domains/product-basic/refine-ticket/command.md
- src/domains/product-basic/roadmap/next/command.md
- src/domains/product-basic/roadmap/process-full/command.md
- src/rules/commit-conventions.md
- src/scripts/_cli/cmd_git_convention.ts
- src/scripts/_cli/cmd_settings_check.ts
- src/scripts/_cli/cmd_settings_get.ts
- src/scripts/_dispatch.bash
- src/scripts/_lib/agent_settings.ts
- src/scripts/_lib/git_base_ref.ts
- src/scripts/_lib/git_convention.ts
- src/scripts/_lib/git_convention_carrier.ts
- src/scripts/_lib/git_convention_grammar.ts
- src/scripts/_lib/git_convention_measure.ts
- src/scripts/check_branch_freshness.ts
- src/scripts/check_generator_sync.ts
- src/scripts/consumer_matrix.ts
- src/scripts/generate_git_convention_grammar.ts
- src/scripts/hooks/block_config_weakening.ts
- src/scripts/install-hooks.sh
- src/scripts/schemas/agent-settings.schema.json
- src/scripts/sync_pr_branch.ts
- src/scripts/trigger_eval_grandfather.json
- src/server/app.ts
- src/server/gitKeysGate.ts
- src/server/routes/settings.ts
- src/server/routes/wizard.ts
- src/server/schemas/settings.ts
- src/skills/bug-analyzer/SKILL.md
- src/skills/conventional-commits-writing/SKILL.md
- src/skills/conventional-commits-writing/evals/triggers.json
- src/skills/git-workflow/SKILL.md
- src/skills/git-workflow/references/branch-update.md
- src/skills/git-workflow/references/commit-subject.md
- src/skills/jira-integration/SKILL.md
- src/skills/jira-integration/evals/triggers.json
- src/skills/merge-conflicts/SKILL.md
- src/skills/merge-conflicts/evals/triggers.json
- src/skills/refine-ticket/SKILL.md
- src/skills/using-git-worktrees/SKILL.md
- src/skills/using-git-worktrees/evals/triggers.json
- taskfiles/dev.yml
- tests/_lib/completion_review_rebase.ts
- tests/_lib/rebase_sequence.ts
- tests/scripts/_cli/cmd_git_convention.test.ts
- tests/scripts/_cli/cmd_git_convention_measure.test.ts
- tests/scripts/_cli/cmd_git_convention_stdin.test.ts
- tests/scripts/_cli/cmd_git_convention_subject.test.ts
- tests/scripts/_cli/cmd_settings_check.test.ts
- tests/scripts/_cli/cmd_settings_get_user_global_drop.test.ts
- tests/scripts/_git_convention_repo.ts
- tests/scripts/_lib/git_convention_grammar.test.ts
- tests/scripts/_lib/git_convention_measure.test.ts
- tests/scripts/_lib/git_convention_pattern.test.ts
- tests/scripts/_lib/git_convention_reader.test.ts
- tests/scripts/_lib/git_convention_ticket_keys.test.ts
- tests/scripts/_lib/git_convention_unquoted_pattern.test.ts
- tests/scripts/branch_convergence.test.ts
- tests/scripts/check_branch_freshness.test.ts
- tests/scripts/check_branch_freshness_local_remedy.test.ts
- tests/scripts/check_branch_freshness_remedy.test.ts
- tests/scripts/check_completion_review_after_rebase.test.ts
- tests/scripts/check_completion_review_rebase_remedy.test.ts
- tests/scripts/conformance_scan_paired_lease_push.test.ts
- tests/scripts/consumer_matrix_git_convention.test.ts
- tests/scripts/empty_base_usage.test.ts
- tests/scripts/generate_git_convention_grammar.test.ts
- tests/scripts/git_base_ref.test.ts
- tests/scripts/git_convention_bundled_defaults.test.ts
- tests/scripts/git_convention_carrier.test.ts
- tests/scripts/git_convention_carrier_fetch_timeout.test.ts
- tests/scripts/git_convention_committed_carrier.test.ts
- tests/scripts/git_convention_pr_scoped_base.test.ts
- tests/scripts/hooks/block_config_weakening.test.ts
- tests/scripts/prepush_base_freshness.test.ts
- tests/scripts/push_ready_pr_base.test.ts
- tests/scripts/rebase_equivalence.test.ts
- tests/scripts/rebase_lease_race.test.ts
- tests/scripts/routing_signal_measurement.test.ts
- tests/scripts/sync_pr_branch.test.ts
- tests/scripts/sync_pr_branch_base_count.test.ts
- tests/scripts/sync_pr_branch_behind_refusal.test.ts
- tests/scripts/sync_pr_branch_exit_contract.test.ts
- tests/scripts/sync_pr_branch_internal_error.test.ts
- tests/scripts/sync_pr_branch_policy_race.test.ts
- tests/scripts/sync_pr_branch_target_behind_default.test.ts
- tests/server/git_keys_write_route.test.ts
- tests/server/helpers.ts
- tests/server/wizard.gitKeys.test.ts

## Output format (contract §2.2)

Fill the findings table in `git-convention-review-findings.findings.md`:

```markdown
| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/x.ts:42 | ... | open | |
```

- Severity ∈ {`critical`, `high`, `medium`, `low`}, rows sorted descending
  by severity (ties keep authoring order).
- Initial status of every finding: `open`.
- A row is LIVE wherever it appears — a code fence around it changes
  nothing. If you quote the template as an illustration, its Status cell
  must be exactly `example`, or the gate reads it as a real finding.
- 0 findings → replace the table with exactly this honest-null line
  (contract §2.3):

```markdown
**Honest-null:** 0 findings, scope 4f40f0192f3389cc5b0497da1356ceada2998791afc4c65a1ac9dc7c20862380, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
