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

- diff: `diff.patch` — the review scope (branch head b6107dd95c93c32c0c349d83584f23d2c38436d4, review
  artefacts excluded), scope hash `49a6c2fdc733f9d2ef0bc99a5897adb39ec03432f3c07ce564564afa5e78fb2f`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- CHANGELOG.md
- agents/evidence/analysis/adr-evidence-census-2026-08.md
- agents/evidence/ratifications/git-convention-review-findings.md
- agents/roadmaps/archive/road-to-a-git-convention-that-reaches-every-checkout.md
- agents/roadmaps/archive/road-to-a-rebase-that-leaves-a-way-back.md
- agents/roadmaps/archive/road-to-one-owner-for-the-ticket-and-the-subject.md
- dist/agent-src/commands/commit.md
- dist/agent-src/commands/commit/in-chunks.md
- dist/agent-src/commands/fix/ci.md
- dist/agent-src/commands/fix/commit-messages.md
- dist/agent-src/commands/pr/create.md
- dist/agent-src/commands/roadmap/next.md
- dist/agent-src/commands/roadmap/process-full.md
- dist/agent-src/skills/conventional-commits-writing/SKILL.md
- dist/agent-src/skills/git-workflow/SKILL.md
- dist/agent-src/skills/git-workflow/references/branch-update.md
- dist/agent-src/skills/git-workflow/references/commit-subject.md
- dist/agent-src/skills/merge-conflicts/SKILL.md
- dist/install/install.mjs
- docs/contracts/settings-api.md
- docs/contracts/settings-classes.md
- docs/decisions/ADR-283-git-convention-carrier.md
- src/cli/registry.ts
- src/domains/engineering-base/fix/ci/command.md
- src/domains/engineering-base/fix/commit-messages/command.md
- src/domains/git/commit/command.md
- src/domains/git/commit/in-chunks/command.md
- src/domains/git/pack.yaml
- src/domains/git/pr/create/command.md
- src/domains/meta/pack.yaml
- src/domains/product-basic/roadmap/next/command.md
- src/domains/product-basic/roadmap/process-full/command.md
- src/scripts/_cli/cmd_git_convention.ts
- src/scripts/_dispatch.bash
- src/scripts/_lib/agent_settings.ts
- src/scripts/_lib/git_base_ref.ts
- src/scripts/_lib/git_convention.ts
- src/scripts/_lib/git_convention_carrier.ts
- src/scripts/_lib/git_convention_grammar.ts
- src/scripts/_lib/git_convention_measure.ts
- src/scripts/check_branch_freshness.ts
- src/scripts/check_generator_sync.ts
- src/scripts/generate_git_convention_grammar.ts
- src/scripts/hooks/block_config_weakening.ts
- src/scripts/install-hooks.sh
- src/scripts/sync_pr_branch.ts
- src/server/app.ts
- src/server/gitKeysGate.ts
- src/server/routes/settings.ts
- src/server/routes/wizard.ts
- src/skills/conventional-commits-writing/SKILL.md
- src/skills/git-workflow/SKILL.md
- src/skills/git-workflow/references/branch-update.md
- src/skills/git-workflow/references/commit-subject.md
- src/skills/merge-conflicts/SKILL.md
- taskfiles/dev.yml
- tests/_lib/rebase_sequence.ts
- tests/scripts/_cli/cmd_git_convention.test.ts
- tests/scripts/_cli/cmd_git_convention_branch_absent.test.ts
- tests/scripts/_cli/cmd_git_convention_commitlint.test.ts
- tests/scripts/_cli/cmd_git_convention_family_ticketless.test.ts
- tests/scripts/_cli/cmd_git_convention_init.test.ts
- tests/scripts/_cli/cmd_git_convention_measure.test.ts
- tests/scripts/_cli/cmd_git_convention_measure_window.test.ts
- tests/scripts/_cli/cmd_git_convention_stdin.test.ts
- tests/scripts/_cli/cmd_git_convention_subject.test.ts
- tests/scripts/_cli/cmd_git_convention_yaml_name.test.ts
- tests/scripts/_lib/git_convention_grammar.test.ts
- tests/scripts/_lib/git_convention_measure.test.ts
- tests/scripts/_lib/git_convention_unquoted_pattern.test.ts
- tests/scripts/branch_convergence.test.ts
- tests/scripts/check_branch_freshness.test.ts
- tests/scripts/check_branch_freshness_local_remedy.test.ts
- tests/scripts/commit_card_staged.test.ts
- tests/scripts/empty_base_usage.test.ts
- tests/scripts/generate_git_convention_grammar.test.ts
- tests/scripts/git_base_ref.test.ts
- tests/scripts/git_base_ref_dash.test.ts
- tests/scripts/git_convention_bundled_defaults.test.ts
- tests/scripts/git_convention_committed_carrier.test.ts
- tests/scripts/hooks/block_config_weakening.test.ts
- tests/scripts/prepush_base_freshness.test.ts
- tests/scripts/push_ready_pr_base.test.ts
- tests/scripts/rebase_equivalence.test.ts
- tests/scripts/rebase_lease_race.test.ts
- tests/scripts/sync_pr_branch_base_count.test.ts
- tests/scripts/sync_pr_branch_fetch_and_merge_state.test.ts
- tests/scripts/sync_pr_branch_fork_base.test.ts
- tests/scripts/sync_pr_branch_merge_refused.test.ts
- tests/scripts/sync_pr_branch_policy_race.test.ts
- tests/scripts/sync_pr_branch_single_branch_stale.test.ts
- tests/server/git_keys_write_route.test.ts
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
**Honest-null:** 0 findings, scope 49a6c2fdc733f9d2ef0bc99a5897adb39ec03432f3c07ce564564afa5e78fb2f, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
