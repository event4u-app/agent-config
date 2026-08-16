# R2 completion review — feat-runtime-skill-routing

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

- diff: `diff.patch` — the review scope (branch head 43054b8e663d771e29dd102a41bbc639dfe194a7, review
  artefacts excluded), scope hash `1289b029558dead88b0287ccb811407e884c2bc45e318038b9e3dd858fead765`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- README.md
- agents/evidence/analysis/scoped-projection-host-delivery.md
- agents/index.md
- agents/reports/originality.json
- agents/reports/originality.md
- agents/roadmaps-progress.md
- agents/roadmaps/archive/road-to-inbox-harvest-2026-08-d-runtime-skill-routing.md
- agents/roadmaps/archive/road-to-inbox-harvest-2026-08-d-scheduled-deprecation.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-d-runtime-skill-routing.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-d-scheduled-deprecation.md
- dist/agent-src/rules/missing-skill-recovery.md
- dist/agent-src/skills/authz-review/SKILL.md
- dist/agent-src/skills/merge-conflicts/SKILL.md
- dist/agent-src/skills/systematic-debugging/SKILL.md
- dist/agent-src/skills/threat-modeling/SKILL.md
- dist/install/install.mjs
- dist/router.json
- docs/CLAIMS.md
- docs/architecture.md
- docs/catalog.md
- docs/contracts/mcp-tool-inventory.md
- docs/getting-started-by-role.md
- docs/getting-started.md
- docs/governance-advantage.md
- docs/proof.md
- src/config/hook-token-budget.json
- src/domains/meta/README.md
- src/domains/meta/pack.yaml
- src/rules/missing-skill-recovery.md
- src/scripts/_lib/skill_catalogue.ts
- src/scripts/capture_skill_catalogue.ts
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/concern_registry.ts
- src/scripts/hooks/skill_route_hook.ts
- src/scripts/mcp_server/consumer_tool_catalog.json
- src/scripts/mcp_server/tool_catalog_source.ts
- src/scripts/mcp_server/tools.ts
- src/scripts/schemas/skill.schema.json
- src/scripts/trigger_coverage.ts
- src/skills/authz-review/SKILL.md
- src/skills/merge-conflicts/SKILL.md
- src/skills/systematic-debugging/SKILL.md
- src/skills/threat-modeling/SKILL.md
- tests/hooks/skill_route_hook.test.ts
- tests/scripts/hook_role_axis.test.ts
- tests/scripts/mcp_server_tools.test.ts
- tests/scripts/report_skill_activation.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-runtime-skill-routing.findings.md`:

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
**Honest-null:** 0 findings, scope 1289b029558dead88b0287ccb811407e884c2bc45e318038b9e3dd858fead765, reviewed <YYYY-MM-DD>
```
