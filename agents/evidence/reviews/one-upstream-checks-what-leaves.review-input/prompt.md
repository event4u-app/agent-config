# R2 completion review — one-upstream-checks-what-leaves

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

- diff: `diff.patch` — the review scope (branch head 0ff2524ea3ae543b0e89244832c486159795f96f, review
  artefacts excluded), scope hash `8bf2d0b5a82ceeee342a3321f065cfb98c3b5453dd3dc93b4311f7f05e604c58`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- .path-leak-allow
- agents/evidence/analysis/delivery-set-measurement-2026-08-31.json
- agents/evidence/analysis/routing-body-signal-verdict.json
- agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md
- agents/index.md
- agents/roadmaps/later/road-to-surface-consolidation.md
- agents/roadmaps/road-to-one-upstream-that-checks-what-leaves.md
- dist/agent-src/commands/memory.md
- dist/agent-src/commands/memory/learn-low-impact.md
- dist/agent-src/commands/upstream-contribute.md
- dist/agent-src/guidelines/agent-infra/self-improvement-pipeline.md
- dist/agent-src/rules/low-impact-corpus-privacy-floor.md
- dist/agent-src/skills/context-authoring/SKILL.md
- dist/agent-src/skills/context-authoring/evals/triggers.json
- dist/agent-src/skills/learning-to-rule-or-skill/SKILL.md
- dist/agent-src/skills/learning-to-rule-or-skill/evals/triggers.json
- dist/agent-src/skills/upstream-contribute/SKILL.md
- dist/agent-src/skills/upstream-contribute/evals/triggers.json
- dist/agent-src/templates/agents/proposal.example.md
- docs/catalog.md
- docs/command-flows.md
- docs/contracts/command-clusters.md
- docs/guidelines/agent-infra/self-improvement-pipeline.md
- src/agent-src/templates/agents/proposal.example.md
- src/config/routing-coverage-seed.json
- src/domains/meta/memory/command.md
- src/domains/meta/memory/learn-low-impact/command.md
- src/domains/meta/pack.yaml
- src/domains/meta/upstream-contribute/command.md
- src/packs/core/pack.yaml
- src/packs/memory/README.md
- src/packs/memory/pack.yaml
- src/rules/low-impact-corpus-privacy-floor.md
- src/scripts/ai_council/learn_low_impact_preview.ts
- src/scripts/self_repair_cli.ts
- src/scripts/trigger_eval_grandfather.json
- src/skills/context-authoring/SKILL.md
- src/skills/context-authoring/evals/triggers.json
- src/skills/learning-to-rule-or-skill/SKILL.md
- src/skills/learning-to-rule-or-skill/evals/triggers.json
- src/skills/upstream-contribute/SKILL.md
- src/skills/upstream-contribute/evals/triggers.json
- tests/scripts/ai_council/learn_low_impact_preview.test.ts
- tests/scripts/routing_signal_measurement.test.ts
- tests/scripts/self_repair_release.test.ts

## Output format (contract §2.2)

Fill the findings table in `one-upstream-checks-what-leaves.findings.md`:

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
**Honest-null:** 0 findings, scope 8bf2d0b5a82ceeee342a3321f065cfb98c3b5453dd3dc93b4311f7f05e604c58, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
