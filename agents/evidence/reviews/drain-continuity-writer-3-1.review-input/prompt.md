# R2 completion review — drain-continuity-writer-3-1

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

- diff: `diff.patch` — the review scope (branch head 1f8e05166d22c5c67da69b568daba27bba54a459, review
  artefacts excluded), scope hash `ffe5473d7c8226c1d651f5b659dae89a02ad9633fc3ebe0d142146a7adb9b4fd`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/road-to-continuity-writer-activation.md
- src/config/continuity-surface.json
- src/scripts/_lib/session_index_trust.ts
- src/scripts/hot_context_hook.ts
- src/scripts/session_memory_index.ts
- tests/hooks/session_index_trust_e2e.test.ts
- tests/scripts/session_index_trust.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-continuity-writer-3-1.findings.md`:

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
**Honest-null:** 0 findings, scope ffe5473d7c8226c1d651f5b659dae89a02ad9633fc3ebe0d142146a7adb9b4fd, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
