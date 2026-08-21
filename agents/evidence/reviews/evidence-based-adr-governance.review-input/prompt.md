# R2 completion review — evidence-based-adr-governance

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

- diff: `diff.patch` — the review scope (branch head 6d5731d896cf7b9ef986ea27b6e869bc15b0bee7, review
  artefacts excluded), scope hash `51af5c79d74abdbc350092f7ca922110ffd9f5a83181a42cb636f918c6661028`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/rule-backstops.yml
- Taskfile.yml
- agents/evidence/analysis/adr-evidence-census-2026-08.md
- agents/roadmaps/road-to-evidence-based-adr-governance.md
- dist/agent-src/rules/decision-revisit-gate.md
- dist/agent-src/skills/adr-create/SKILL.md
- dist/agent-src/skills/decision-record/SKILL.md
- dist/agent-src/skills/decision-review/SKILL.md
- docs/CLAIMS.md
- docs/adrs/cost/0001-hard-stop-hook.md
- docs/adrs/memory/0001-consumer-side-snapshot.md
- docs/adrs/router/0001-three-tier-routing.md
- docs/adrs/schema/0001-json-schema-frontmatter.md
- docs/adrs/smoke/0001-per-tier-smoke-scripts.md
- docs/adrs/telegraph/0001-default-off-until-bench.md
- docs/adrs/telegraph/0002-dormant-by-default-removal-authorized.md
- docs/contracts/adr-layout.md
- docs/decisions/ADR-239-evidence-based-decision-floor.md
- docs/decisions/INDEX.md
- docs/decisions/adr-evidence-sweep-2026-08.md
- docs/proof.md
- src/config/estate-count-budget.json
- src/config/gate-coverage.yml
- src/config/gate-violation-baselines.json
- src/rules/decision-revisit-gate.md
- src/scripts/_lib/adr_frontmatter.test.ts
- src/scripts/_lib/adr_frontmatter.ts
- src/scripts/_lib/envelope_grounding.ts
- src/scripts/adr/evidence_census.ts
- src/scripts/adr/regenerate_index.ts
- src/scripts/adr_cite_check.ts
- src/scripts/audit_adr_coverage.ts
- src/scripts/check_adr_frontmatter.ts
- src/scripts/lint_provenance_vocabulary.ts
- src/skills/adr-create/SKILL.md
- src/skills/decision-record/SKILL.md
- src/skills/decision-review/SKILL.md
- taskfiles/ci-fast.yml
- tests/eval/routing-matrix/decision-revisit-gate.yaml
- tests/scripts/adr_cite_check.test.ts
- tests/scripts/adr_evidence_census.test.ts
- tests/scripts/audit_adr_coverage.test.ts
- tests/scripts/check_adr_frontmatter.test.ts
- tests/scripts/envelope_grounding.test.ts
- tests/scripts/lint_provenance_vocabulary.test.ts

## Output format (contract §2.2)

Fill the findings table in `evidence-based-adr-governance.findings.md`:

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
**Honest-null:** 0 findings, scope 51af5c79d74abdbc350092f7ca922110ffd9f5a83181a42cb636f918c6661028, reviewed <YYYY-MM-DD>
```
