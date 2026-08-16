# R2 completion review — feat-top-band-model-economy

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

- diff: `diff.patch` — the review scope (branch head 1c078dbbdfcd65074434707fa8cb61fee53fe05b, review
  artefacts excluded), scope hash `2d373a27c678d806d1d3bea5a5a2febc3f05668bef52af260ca08fde128e6e79`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/downshift-vs-cache.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-d-top-band-model-economy.md
- dist/agent-src/contexts/execution/subagent-routing.md
- dist/agent-src/contexts/subagent-configuration.md
- src/agent-src/contexts/execution/subagent-routing.md
- src/agent-src/contexts/subagent-configuration.md
- src/scripts/routing_doctor.ts

## Output format (contract §2.2)

Fill the findings table in `feat-top-band-model-economy.findings.md`:

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
**Honest-null:** 0 findings, scope 2d373a27c678d806d1d3bea5a5a2febc3f05668bef52af260ca08fde128e6e79, reviewed <YYYY-MM-DD>
```
