# R2 completion review — drain-graph-feeds-the-gate-20261001

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

- diff: `diff.patch` — the review scope (branch head a326584de011e0b9326e776ee6dfd158052bead7, review
  artefacts excluded), scope hash `0ccde20491a00cc207fc9f876caea30bc5e4d77f2f2dc3a81f6ac081c20fa7ad`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/graph-feeder-recall-2026-Q4.md
- agents/evidence/ratifications/drain-graph-feeds-the-gate.md
- agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md
- dist/agent-src/contexts/execution/auto-dispatch-classification.md
- dist/agent-src/skills/code-intelligence/SKILL.md
- docs/contracts/mcp-tool-inventory.md
- src/agent-src/contexts/execution/auto-dispatch-classification.md
- src/config/agent-settings.template.yml
- src/config/evaluator-budgets.json
- src/scripts/_lib/graph_feeder_record.ts
- src/scripts/code_graph/detect.ts
- src/scripts/code_graph/query.ts
- src/scripts/hook_manifest.json
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/code_graph_context_hook.ts
- src/scripts/hooks/turn_end_gate_hook.ts
- src/scripts/mcp_server/consumer_tool_catalog.json
- src/scripts/mcp_server/graph_tools.ts
- src/skills/code-intelligence/SKILL.md
- tests/scripts/code_graph.test.ts
- tests/scripts/code_graph_context_hook.test.ts
- tests/scripts/graph_feeder_record.test.ts
- tests/scripts/hooks/dispatch_hook.test.ts
- tests/scripts/mcp_graph_tools.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-graph-feeds-the-gate-20261001.findings.md`:

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
**Honest-null:** 0 findings, scope 0ccde20491a00cc207fc9f876caea30bc5e4d77f2f2dc3a81f6ac081c20fa7ad, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
