# R2 completion review — blockers-routed-before-they-are-filed

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

- diff: `diff.patch` — the review scope (branch head 981b285139982bcb341a599d0e98f0490e586356, review
  artefacts excluded), scope hash `469d63ed7d3350a886c39d4b00770e1ae4d5a32ba7a29ff20efebb084800e163`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/blocker-causes-2026-10-20.md
- agents/roadmaps/archive/road-to-blockers-routed-before-they-are-filed.md
- agents/roadmaps/later/road-to-skill-ecosystem-capability-queue.md
- agents/roadmaps/later/road-to-skill-ecosystem-security-and-conformance.md
- dist/agent-src/skills/roadmap-writing/SKILL.md
- dist/agent-src/templates/roadmaps.md
- src/agent-src/templates/roadmaps.md
- src/config/gate-violation-baselines.json
- src/scripts/_lib/prompt_shape.ts
- src/scripts/lint_roadmap_blockers.ts
- src/skills/roadmap-writing/SKILL.md
- tests/scripts/language_mirror_hook.test.ts
- tests/scripts/lint_roadmap_blockers.test.ts

## Output format (contract §2.2)

Fill the findings table in `blockers-routed-before-they-are-filed.findings.md`:

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
**Honest-null:** 0 findings, scope 469d63ed7d3350a886c39d4b00770e1ae4d5a32ba7a29ff20efebb084800e163, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
