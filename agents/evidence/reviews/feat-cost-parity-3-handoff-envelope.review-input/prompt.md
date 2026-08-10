# R2 completion review — feat-cost-parity-3-handoff-envelope

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

- diff: `diff.patch` — the review scope (branch head f36d9c4cb368e30d7e9c075ba9f6624de730b6a8, review
  artefacts excluded), scope hash `52a19ebb6fcb9246be58183cde4ce68cdf54d2e6d8ea6b4d09ca2d1082ac2159`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/handoff-substantive-threshold.md
- agents/roadmaps-progress.md
- agents/roadmaps/archive/road-to-cost-parity-3-handoff-envelope.md
- agents/roadmaps/road-to-cost-parity-0-program.md
- agents/roadmaps/road-to-cost-parity-3-handoff-envelope.md
- src/scripts/_cli/cmd_session_recycle.ts
- src/scripts/_cli/handoff_generate.ts
- src/scripts/_cli/handoff_sessions.ts
- src/scripts/_lib/envelope_grounding.ts
- src/scripts/_lib/session_eol.ts
- src/scripts/_lib/subagent_capsule.ts
- src/scripts/handoff_context_hook.ts
- src/scripts/hooks/session_eol_hook.ts
- tests/scripts/_lib_checkpoint_schema.test.ts
- tests/scripts/envelope_drift_roundtrip.test.ts
- tests/scripts/envelope_grounding.test.ts
- tests/scripts/handoff_context_hook.test.ts
- tests/scripts/handoff_sessions.test.ts
- tests/scripts/recycle_envelope_consumer.test.ts
- tests/scripts/recycle_roundtrip.test.ts
- tests/scripts/session_recycle.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-cost-parity-3-handoff-envelope.findings.md`:

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
**Honest-null:** 0 findings, scope 52a19ebb6fcb9246be58183cde4ce68cdf54d2e6d8ea6b4d09ca2d1082ac2159, reviewed <YYYY-MM-DD>
```
