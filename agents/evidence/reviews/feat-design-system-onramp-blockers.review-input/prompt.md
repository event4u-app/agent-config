# R2 completion review — feat-design-system-onramp-blockers

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

- diff: `diff.patch` — the review scope (branch head 2a969a0c4835e9a4db031d01e70ebcb5e0bb051d, review
  artefacts excluded), scope hash `20ab2467c1fc50349d9abc032922ef0ea1a5e3ab4b60b06dc7122832ad7d0d25`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/design-system-blockers-council.md
- agents/roadmaps-progress.md
- agents/roadmaps/archive/road-to-august-program.md
- agents/roadmaps/archive/road-to-design-system-onramp.md
- agents/roadmaps/road-to-design-system-onramp.md
- agents/roadmaps/road-to-source-first-frontend.md
- dist/agent-src/skills/corpus-grounding/scripts/decision_engine.ts
- dist/agent-src/skills/corpus-grounding/scripts/ground.ts
- dist/agent-src/skills/design-intelligence/ATTRIBUTION.md
- dist/agent-src/skills/design-intelligence/data/manifest.json
- dist/agent-src/skills/design-intelligence/data/motion.csv
- docs/THIRD-PARTY-NOTICES.md
- provenance/borrows.jsonl
- src/config/pack-size-budget.json
- src/scripts/external_sources_denylist.json
- src/skills/corpus-grounding/scripts/decision_engine.ts
- src/skills/corpus-grounding/scripts/ground.ts
- src/skills/design-intelligence/ATTRIBUTION.md
- src/skills/design-intelligence/data/manifest.json
- src/skills/design-intelligence/data/motion.csv
- tests/scripts/skills_corpus_grounding_dials.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-design-system-onramp-blockers.findings.md`:

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
**Honest-null:** 0 findings, scope 20ab2467c1fc50349d9abc032922ef0ea1a5e3ab4b60b06dc7122832ad7d0d25, reviewed <YYYY-MM-DD>
```
