# R2 completion review — road-to-deferral-carry-guard

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

- diff: `diff.patch` — the review scope (branch head bd3f1e6b3e0a4f50319d342ae7071865c3685acc, review
  artefacts excluded), scope hash `bb11b8382ede49e22f5af2a651ed5067ea4fbc7ce19281278091523b84855be6`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/rule-backstops.yml
- Taskfile.yml
- agents/roadmaps/archive/road-to-deferral-carry-guard.md
- agents/roadmaps/road-to-council-topology-evidence-followups.md
- agents/roadmaps/stubs/road-to-carrier-transition-vocabulary.md
- agents/roadmaps/stubs/road-to-deferral-carry-guard.md
- dist/agent-src/scripts/update_roadmap_progress.ts
- src/agent-src/scripts/update_roadmap_progress.ts
- src/config/gate-coverage.yml
- src/config/gate-violation-baselines.json
- src/scripts/check_estate_count.ts
- src/scripts/check_roadmap_trackable.ts
- src/scripts/lint_carrier_integrity.ts
- src/scripts/lint_plan_risk_register.ts
- taskfiles/ci-fast.yml
- tests/scripts/lint_carrier_integrity.test.ts

## Output format (contract §2.2)

Fill the findings table in `road-to-deferral-carry-guard.findings.md`:

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
**Honest-null:** 0 findings, scope bb11b8382ede49e22f5af2a651ed5067ea4fbc7ce19281278091523b84855be6, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
