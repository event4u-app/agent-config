# R2 completion review — feat-design-system-onramp

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

- diff: `diff.patch` — the review scope (branch head 2c307f392061eb4ff24a15b1c29b7ddc5c162b71, review
  artefacts excluded), scope hash `06fd34b92fc5adbf635cb81563dcf92b0bddda312bd47da8376ba69b4e42bc66`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- CAPABILITIES.yaml
- README.md
- agents/index.md
- agents/reports/command-surface.json
- agents/reports/command-surface.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-design-system-onramp.md
- dist/agent-src/commands/analyze.md
- dist/agent-src/commands/design-system.md
- dist/agent-src/commands/design-system/capture.md
- dist/agent-src/commands/design-system/generate.md
- dist/agent-src/commands/design-system/import.md
- dist/agent-src/skills/design-system-capture/SKILL.md
- dist/agent-src/skills/design-system-capture/references/design-system-json.md
- dist/agent-src/templates/scripts/work_engine/directives/ui/design.ts
- docs/CLAIMS.md
- docs/architecture.md
- docs/catalog.md
- docs/command-flows.md
- docs/contracts/command-clusters.md
- docs/featured-skills.md
- docs/getting-started-by-role.md
- docs/getting-started.md
- src/agent-src/templates/scripts/work_engine/directives/ui/design.ts
- src/domains/analysis-workbench/analyze/command.md
- src/domains/engineering-base/design-system/capture/command.md
- src/domains/engineering-base/design-system/command.md
- src/domains/engineering-base/design-system/generate/command.md
- src/domains/engineering-base/design-system/import/command.md
- src/flows/surface-map.yaml
- src/scripts/_lib/design_system_import.ts
- src/scripts/design_system_import.ts
- src/skills/design-system-capture/SKILL.md
- src/skills/design-system-capture/references/design-system-json.md
- tests/scripts/design_system_import.test.ts
- tests/scripts/fixtures/design-system-import/README.md
- tests/scripts/fixtures/design-system-import/dembrandt.expected.json
- tests/scripts/fixtures/design-system-import/dembrandt.json
- tests/scripts/fixtures/design-system-import/dtcg.expected.json
- tests/scripts/fixtures/design-system-import/dtcg.tokens.json
- tests/scripts/fixtures/design-system-import/native.expected.json
- tests/scripts/fixtures/design-system-import/native.json

## Output format (contract §2.2)

Fill the findings table in `feat-design-system-onramp.findings.md`:

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
**Honest-null:** 0 findings, scope 06fd34b92fc5adbf635cb81563dcf92b0bddda312bd47da8376ba69b4e42bc66, reviewed <YYYY-MM-DD>
```
