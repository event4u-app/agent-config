# R2 completion review — worktree-feat-turn-end-gate-always-on

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

- diff: `diff.patch` — the review scope (branch head 3aec031b160a8bc676053be370b2fddfbeab250c, review
  artefacts excluded), scope hash `81d8780324a3e9885db6a2d205834f6115a0599f3deccda0cf32ba66abeb56ef`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-skill-ecosystem-executable-payloads.md
- dist/agent-src/skills/adr-create/SKILL.md
- dist/agent-src/skills/check-refs/SKILL.md
- dist/agent-src/skills/lint-skills/SKILL.md
- dist/agent-src/skills/md-language-check/SKILL.md
- src/scripts/_lib/untrusted_content.test.ts
- src/scripts/_lib/untrusted_content.ts
- src/scripts/schemas/skill.schema.json
- src/scripts/skill_linter.ts
- src/skills/adr-create/SKILL.md
- src/skills/check-refs/SKILL.md
- src/skills/lint-skills/SKILL.md
- src/skills/md-language-check/SKILL.md
- tests/scripts/skill_linter.test.ts

## Output format (contract §2.2)

Fill the findings table in `worktree-feat-turn-end-gate-always-on.findings.md`:

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
**Honest-null:** 0 findings, scope 81d8780324a3e9885db6a2d205834f6115a0599f3deccda0cf32ba66abeb56ef, reviewed <YYYY-MM-DD>
```
