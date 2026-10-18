# R2 completion review — type-with-a-witness-phase4

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

- diff: `diff.patch` — the review scope (branch head 0b3f1546cabcfb48c0d00c724fde1ed8d0734142, review
  artefacts excluded), scope hash `593804976a8e1d6ebed04a2bb5d5fce2cca03515cedba1efb946a0a0197f3285`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- CAPABILITIES.yaml
- README.md
- agents/decisions/skill-admissions.jsonl
- agents/evidence/analysis/delivery-set-measurement-2026-08-31.json
- agents/evidence/analysis/routing-body-signal-verdict.json
- agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md
- agents/index.md
- agents/roadmaps/road-to-type-with-a-witness.md
- agents/settings/contexts/structural/file-ownership-matrix.md
- dist/agent-src/rules/context-hygiene.md
- dist/agent-src/rules/roadmap-ci-steps-policy.md
- dist/agent-src/rules/token-budget-discipline.md
- dist/agent-src/skills/brand-identity/SKILL.md
- dist/agent-src/skills/design-system-capture/references/design-system-json.md
- dist/agent-src/skills/logo-generation/SKILL.md
- dist/agent-src/skills/svg-authoring/SKILL.md
- dist/agent-src/skills/type-design/SKILL.md
- dist/agent-src/skills/type-design/evals/triggers.json
- dist/agent-src/skills/type-design/references/font-spec.md
- dist/agent-src/skills/type-design/references/gates.md
- dist/agent-src/skills/type-design/references/toolchain.md
- dist/agent-src/skills/typography-system/SKILL.md
- docs/CLAIMS.md
- docs/architecture.md
- docs/catalog.md
- docs/contracts/file-ownership-matrix.json
- docs/featured-skills.md
- docs/getting-started-by-role.md
- docs/governance-advantage.md
- docs/proof.md
- docs/skills-catalog.md
- llms.txt
- site/src/content/docs/architecture/overview.md
- site/src/content/docs/getting-started/introduction.md
- src/config/routing-coverage-seed.json
- src/config/skill-body-budget.json
- src/domains/meta/pack.yaml
- src/rules/context-hygiene.md
- src/rules/roadmap-ci-steps-policy.md
- src/rules/token-budget-discipline.md
- src/skills/brand-identity/SKILL.md
- src/skills/design-system-capture/references/design-system-json.md
- src/skills/logo-generation/SKILL.md
- src/skills/svg-authoring/SKILL.md
- src/skills/type-design/SKILL.md
- src/skills/type-design/evals/triggers.json
- src/skills/type-design/references/font-spec.md
- src/skills/type-design/references/gates.md
- src/skills/type-design/references/toolchain.md
- src/skills/typography-system/SKILL.md
- tests/scripts/check_routing_coverage.test.ts
- tests/scripts/install_rule_links.test.ts
- tests/scripts/routing_signal_measurement.test.ts

## Output format (contract §2.2)

Fill the findings table in `type-with-a-witness-phase4.findings.md`:

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
**Honest-null:** 0 findings, scope 593804976a8e1d6ebed04a2bb5d5fce2cca03515cedba1efb946a0a0197f3285, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
