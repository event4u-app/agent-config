# R2 completion review — behavior-vocabulary-close-round18

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

- diff: `diff.patch` — the review scope (branch head 67df0f09d13dfe9e8c7aca3d25e72cf4fc8bda6f, review
  artefacts excluded), scope hash `941c0418b41dfd2ba5c94dcf2d3deea4c6a23a414febf8d1845891cc507ab728`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/delivery-set-measurement-2026-08-31.json
- agents/evidence/analysis/routing-body-signal-verdict.json
- agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md
- agents/roadmaps/road-to-behavior-vocabulary-and-runner-truth.md
- agents/roadmaps/road-to-upstream-advisory-bump.md
- dist/agent-src/commands/tests/create.md
- dist/agent-src/commands/tests/execute.md
- dist/agent-src/contexts/execution/toolchain-resolver.md
- dist/agent-src/skills/test-case-discovery/SKILL.md
- dist/agent-src/skills/test-case-discovery/evals/triggers.json
- dist/agent-src/templates/scripts/work_engine/stack/runner.ts
- src/agent-src/contexts/execution/toolchain-resolver.md
- src/agent-src/templates/scripts/work_engine/stack/runner.ts
- src/domains/engineering-base/tests/create/command.md
- src/domains/engineering-base/tests/execute/command.md
- src/domains/meta/pack.yaml
- src/skills/test-case-discovery/SKILL.md
- src/skills/test-case-discovery/evals/triggers.json
- tests/scripts/work_engine/stack_runner.test.ts

## Output format (contract §2.2)

Fill the findings table in `behavior-vocabulary-close-round18.findings.md`:

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
**Honest-null:** 0 findings, scope 941c0418b41dfd2ba5c94dcf2d3deea4c6a23a414febf8d1845891cc507ab728, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
