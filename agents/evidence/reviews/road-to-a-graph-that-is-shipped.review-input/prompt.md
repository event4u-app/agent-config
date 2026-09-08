# R2 completion review — road-to-a-graph-that-is-shipped

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

- diff: `diff.patch` — the review scope (branch head 971681741def028ab7957563409d0026f7f0366e, review
  artefacts excluded), scope hash `51b691e30a5f55099ed5c8a3572df14ef9aebf9e5ba3823ab06530ce8dc451c9`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/index.md
- agents/roadmaps/road-to-a-graph-that-is-shipped.md
- dist/agent-src/skills/code-intelligence/SKILL.md
- docs/CLAIMS.md
- docs/catalog.md
- docs/contracts/mcp-tool-inventory.md
- docs/proof.md
- internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-08.json
- internal/bench/reports/code-graph-vs-grep-inrepo-v2-rerun-2026-09-08.md
- src/cli/registry.ts
- src/config/gate-violation-baselines.json
- src/domains/meta/README.md
- src/scripts/_lib/regression_neighbourhood.ts
- src/scripts/build_mcp_catalog.ts
- src/scripts/code_graph/build.ts
- src/scripts/code_graph/cli.ts
- src/scripts/code_graph/detect.ts
- src/scripts/code_graph/query.ts
- src/scripts/code_graph/sqlite_store.ts
- src/scripts/code_graph/types.ts
- src/scripts/code_graph/validate.ts
- src/scripts/code_graph/verbs.ts
- src/scripts/hooks/code_graph_context_hook.ts
- src/scripts/mcp_server/consumer_tool_catalog.json
- src/scripts/mcp_server/graph_tools.ts
- src/scripts/mcp_server/path_util.ts
- src/scripts/mcp_server/tool_catalog_source.ts
- src/scripts/mcp_server/tools.ts
- src/skills/code-intelligence/SKILL.md
- tests/scripts/build_mcp_catalog.test.ts
- tests/scripts/code_graph_gate_verbs.test.ts
- tests/scripts/mcp_graph_tools.test.ts
- tests/scripts/mcp_lite_tools.test.ts
- tests/scripts/mcp_server_tools.test.ts
- tests/scripts/regression_neighbourhood.test.ts

## Output format (contract §2.2)

Fill the findings table in `road-to-a-graph-that-is-shipped.findings.md`:

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
**Honest-null:** 0 findings, scope 51b691e30a5f55099ed5c8a3572df14ef9aebf9e5ba3823ab06530ce8dc451c9, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
