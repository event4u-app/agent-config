# R2 completion review — a-question-that-survives-the-turn

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

- diff: `diff.patch` — the review scope (branch head 7fc661f148898f63944b8d4011e238a7df245d8e, review
  artefacts excluded), scope hash `6ff9891ca4d6cc5016736e87f601aa01dbb6b7a79423c893e6fdbd00929d69ae`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/decisions/concern-admissions.jsonl
- agents/evidence/analysis/standing-payload-by-host-2026-09.md
- agents/roadmaps/road-to-a-question-that-survives-the-turn.md
- docs/contracts/rule-router.md
- docs/contracts/turn-end-detector-demotion.md
- src/config/continuity-surface.json
- src/scripts/_lib/review_baseline.ts
- src/scripts/_lib/review_skipped_record.ts
- src/scripts/_lib/turn_end_refusals.ts
- src/scripts/check_reply_consistency.ts
- src/scripts/hook_manifest.json
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/concern_registry.ts
- src/scripts/hooks/end_review_nudge_hook.ts
- src/scripts/hooks/review_baseline_hook.ts
- src/scripts/hooks/turn_end_gate_hook.ts
- src/scripts/hooks_doctor.ts
- src/scripts/janitor.ts
- tests/scripts/hook_role_axis.test.ts
- tests/scripts/review_baseline_hook.test.ts
- tests/scripts/turn_end_gate_pending_decision.test.ts
- tests/scripts/turn_end_refusals.test.ts

## Output format (contract §2.2)

Fill the findings table in `a-question-that-survives-the-turn.findings.md`:

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
**Honest-null:** 0 findings, scope 6ff9891ca4d6cc5016736e87f601aa01dbb6b7a79423c893e6fdbd00929d69ae, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
