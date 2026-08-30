# R2 completion review — road-to-journal-host-capture-measurement

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

- diff: `diff.patch` — the review scope (branch head 2765332d1e0f6e49a145d067c757f06c3afb5e13, review
  artefacts excluded), scope hash `0f9f108ef6900dbab5a49a1ed336d919e8aba913516f2f4f29e27b9dc070b289`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/journal-host-capture-2026-08-29.md
- agents/roadmaps/archive/road-to-journal-host-capture-measurement.md
- agents/roadmaps/archive/road-to-runtime-event-journal.md
- agents/roadmaps/road-to-journal-host-capture-measurement.md
- agents/roadmaps/road-to-supervised-telemetry-collector.md
- src/scripts/_lib/host_denominator.ts
- src/scripts/measure_host_capture.ts
- tests/scripts/host_denominator.test.ts

## Output format (contract §2.2)

Fill the findings table in `road-to-journal-host-capture-measurement.findings.md`:

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
**Honest-null:** 0 findings, scope 0f9f108ef6900dbab5a49a1ed336d919e8aba913516f2f4f29e27b9dc070b289, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
