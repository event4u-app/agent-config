# R2 completion review — dispatch-safety-do-not-touch

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

- diff: `diff.patch` — the review scope (branch head 0bc79b09bae0c025ea54920616c195667e0c76a2, review
  artefacts excluded), scope hash `685536f5a1f98e533d1b0751b65bc0a489bee5f675b22eb151e9fedf7146c576`
- roadmap under review: `roadmap.md` — NO acceptance criteria could be EXTRACTED from it, in either recognised form (an `## Acceptance criteria` heading, or inline `- **AC-n:**` bullets), so `acceptance-criteria.md` is empty. Two different things produce that result and the dispatcher cannot tell them apart: the roadmap declares none, or it declares them in a shape the extractor does not recognise. Open `roadmap.md`, decide which, and report a finding if the criteria are there.

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/archive/INDEX.md
- agents/roadmaps/archive/index.json
- agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-dispatch-safety.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b-dispatch-safety.md
- agents/roadmaps/road-to-subagent-lifecycle-integrity.md
- agents/settings/contexts/do-not-touch-guard-disposition.md
- src/scripts/_lib/subagent_capsule.ts
- tests/scripts/session_recycle.test.ts

## Output format (contract §2.2)

Fill the findings table in `dispatch-safety-do-not-touch.findings.md`:

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
**Honest-null:** 0 findings, scope 685536f5a1f98e533d1b0751b65bc0a489bee5f675b22eb151e9fedf7146c576, reviewed <YYYY-MM-DD>
```
