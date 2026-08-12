# R2 completion review — frontend-skill-application

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

- diff: `diff.patch` — the review scope (branch head 0035602301b6f9dbc04aa5a4e6a25c1ffe5f8394, review
  artefacts excluded), scope hash `1457b38f7704c8326cf6d5d9cb8b0bc4ae46b0a99e6fe6ca0d331a4067d1c508`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- Taskfile.yml
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-frontend-skill-application.md
- agents/settings/contexts/skill-catalogue-baseline.md
- dist/agent-src/rules/design-review-after-ui-write.md
- dist/agent-src/rules/ui-audit-gate.md
- dist/agent-src/skills/fe-design/SKILL.md
- dist/agent-src/skills/fe-design/evals/triggers.json
- dist/agent-src/skills/subagent-orchestration/prompts/README.md
- dist/install/install.mjs
- src/config/agent-settings.template.yml
- src/domains/engineering-base/README.md
- src/rules/design-review-after-ui-write.md
- src/rules/ui-audit-gate.md
- src/scripts/_lib/hook_settings.ts
- src/scripts/_lib/ui_surface.ts
- src/scripts/capture_skill_catalogue.ts
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/concern_registry.ts
- src/scripts/hooks/design_slop_hook.ts
- src/scripts/hooks/ui_route_nudge_hook.ts
- src/scripts/lint_rule_skill_pack_reach.ts
- src/server/schemas/settings.ts
- src/skills/fe-design/SKILL.md
- src/skills/fe-design/evals/triggers.json
- src/skills/subagent-orchestration/prompts/README.md
- taskfiles/ci-fast.yml
- tests/scripts/catalogue_capture.test.ts
- tests/scripts/fe_design_triggers.test.ts
- tests/scripts/pack_reach.test.ts
- tests/scripts/ui_dispatch_brief.test.ts
- tests/scripts/ui_route_nudge.test.ts
- tests/scripts/ui_rule_triggers.test.ts
- tests/scripts/ui_turn_definition.test.ts

## Output format (contract §2.2)

Fill the findings table in `frontend-skill-application.findings.md`:

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
**Honest-null:** 0 findings, scope 1457b38f7704c8326cf6d5d9cb8b0bc4ae46b0a99e6fe6ca0d331a4067d1c508, reviewed <YYYY-MM-DD>
```
