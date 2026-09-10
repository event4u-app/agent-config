# R2 completion review — loss-class-reachability

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

- diff: `diff.patch` — the review scope (branch head 0a9837ab444a4067866ac05bae2f24535063520c, review
  artefacts excluded), scope hash `379b069250ee3dd70a9de39c36862e6ff22c4feb0e56b4b1f06db9f011985252`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- docs/contracts/loss-classes.md
- src/config/gate-coverage.yml
- src/scripts/_lib/loss_class.ts
- src/scripts/_lib/self_repair.ts
- src/scripts/_lib/session_index_trust.ts
- src/scripts/ai_council/redact_low_impact_entry.ts
- src/scripts/check_loss_class_declared.ts
- src/scripts/hot_context_hook.ts
- src/scripts/memory_lookup.ts
- src/scripts/session_memory_index.ts
- tests/scripts/_lib/loss_class.test.ts

## Output format (contract §2.2)

Fill the findings table in `loss-class-reachability.findings.md`:

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
**Honest-null:** 0 findings, scope 379b069250ee3dd70a9de39c36862e6ff22c4feb0e56b4b1f06db9f011985252, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
