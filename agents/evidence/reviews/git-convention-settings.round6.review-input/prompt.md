# R2 completion review — git-convention-settings

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

- diff: `diff.patch` — the review scope (branch head e9aa97d7d68308564da4a6c3dff146daa83dd7d9, review
  artefacts excluded), scope hash `444d92f6ee7ab4c5ae1e83c3dea64387b27356bf36f3825fd110a39b61338ada`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- CHANGELOG.md
- dist/agent-src/commands/commit.md
- dist/agent-src/commands/commit/in-chunks.md
- dist/agent-src/commands/fix/ci.md
- dist/agent-src/commands/fix/commit-messages.md
- dist/agent-src/commands/pr/create.md
- dist/agent-src/commands/pr/create/description-only.md
- dist/agent-src/commands/pr/merge.md
- dist/agent-src/commands/prepare-for-review.md
- dist/agent-src/commands/review/changes.md
- dist/agent-src/commands/roadmap/next.md
- dist/agent-src/commands/worktree/create.md
- dist/agent-src/guidelines/php/git.md
- dist/agent-src/rules/commit-conventions.md
- dist/agent-src/skills/conventional-commits-writing/SKILL.md
- dist/agent-src/skills/git-workflow/SKILL.md
- dist/agent-src/skills/git-workflow/references/branch-update.md
- dist/agent-src/skills/jira-integration/SKILL.md
- dist/agent-src/skills/merge-conflicts/SKILL.md
- docs/contracts/settings-classes.md
- docs/guidelines/php/git.md
- docs/settings-reference.md
- src/config/agent-settings.template.yml
- src/domains/engineering-base/fix/ci/command.md
- src/domains/engineering-base/fix/commit-messages/command.md
- src/domains/engineering-base/pack.yaml
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
- src/domains/product-basic/roadmap/next/command.md
- src/rules/commit-conventions.md
- src/scripts/schemas/agent-settings.schema.json
- src/scripts/sync_pr_branch.ts
- src/server/schemas/settings.ts
- src/skills/conventional-commits-writing/SKILL.md
- src/skills/git-workflow/SKILL.md
- src/skills/git-workflow/references/branch-update.md
- src/skills/jira-integration/SKILL.md
- src/skills/merge-conflicts/SKILL.md
- tests/scripts/sync_pr_branch.test.ts

## Output format (contract §2.2)

Fill the findings table in `git-convention-settings.findings.md`:

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
**Honest-null:** 0 findings, scope 444d92f6ee7ab4c5ae1e83c3dea64387b27356bf36f3825fd110a39b61338ada, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
