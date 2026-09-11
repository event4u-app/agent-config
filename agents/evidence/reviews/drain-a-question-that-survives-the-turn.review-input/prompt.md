# R2 completion review — drain-a-question-that-survives-the-turn

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

- diff: `diff.patch` — the review scope (branch head 5bbcafaa8e84aa3f3cd212aa3ea2e2652d757629, review
  artefacts excluded), scope hash `b6619f1c7270e4b4858689429eff26a0dff02ab2cf87063e0c533ca8c6f75b07`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/archive/road-to-a-question-that-survives-the-turn.md
- agents/roadmaps/road-to-a-question-that-survives-the-turn.md
- dist/agent-src/rules/user-interaction.md
- src/domains/meta/pack.yaml
- src/rules/user-interaction.md
- src/scripts/hooks/turn_end_gate_hook.ts
- src/scripts/measure_turn_end_gate.ts
- tests/scripts/measure_turn_end_gate.test.ts
- tests/scripts/turn_end_gate_pending_decision.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-a-question-that-survives-the-turn.findings.md`:

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
**Honest-null:** 0 findings, scope b6619f1c7270e4b4858689429eff26a0dff02ab2cf87063e0c533ca8c6f75b07, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
