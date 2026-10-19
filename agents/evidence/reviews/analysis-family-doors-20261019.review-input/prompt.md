# R2 completion review — analysis-family-doors-20261019

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

- diff: `diff.patch` — the review scope (branch head 7966b85d42137e2977ab9326446cbbdea931aedb, review
  artefacts excluded), scope hash `927b6995a0d3d525085e7c85a0d4e41bdaaeaab651dc96580533a515d3e9f371`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- CAPABILITIES.yaml
- README.md
- agents/index.md
- agents/roadmaps/road-to-an-analysis-family-that-deepens-itself.md
- dist/agent-src/commands/analyze.md
- dist/agent-src/commands/analyze/and-optimize.md
- dist/agent-src/commands/analyze/inbox.md
- dist/agent-src/commands/analyze/pr.md
- dist/agent-src/commands/evals/analyze.json
- dist/agent-src/commands/optimize.md
- dist/agent-src/commands/optimize/deep.md
- docs/CLAIMS.md
- docs/architecture.md
- docs/catalog.md
- docs/command-flows.md
- docs/contracts/command-clusters.md
- docs/featured-skills.md
- docs/getting-started-by-role.md
- docs/getting-started.md
- site/src/content/docs/agent-commands/clusters.md
- site/src/content/docs/agent-commands/key-commands.md
- site/src/content/docs/agent-commands/overview.md
- site/src/content/docs/architecture/overview.md
- site/src/content/docs/getting-started/introduction.md
- src/agent-src/commands/evals/analyze.json
- src/domains/analysis-workbench/README.md
- src/domains/analysis-workbench/analyze/and-optimize/command.md
- src/domains/analysis-workbench/analyze/and-optimize/evals/triggers.json
- src/domains/analysis-workbench/analyze/command.md
- src/domains/analysis-workbench/analyze/inbox/command.md
- src/domains/analysis-workbench/analyze/inbox/evals/triggers.json
- src/domains/analysis-workbench/analyze/pr/command.md
- src/domains/analysis-workbench/analyze/pr/evals/triggers.json
- src/domains/analysis-workbench/pack.yaml
- src/domains/meta/README.md
- src/domains/meta/optimize/command.md
- src/domains/meta/optimize/deep/command.md
- src/domains/meta/optimize/deep/evals/triggers.json
- src/domains/meta/pack.yaml
- src/flows/surface-map.yaml
- src/scripts/analysis_anchors.ts
- src/scripts/analysis_and_optimize.ts
- src/scripts/analysis_inbox_final.ts
- src/scripts/analysis_pr_optimize.ts
- src/scripts/analysis_pr_review.ts
- tests/scripts/analysis_and_optimize.test.ts
- tests/scripts/analysis_inbox_final.test.ts
- tests/scripts/analysis_pr_optimize.test.ts
- tests/scripts/analysis_pr_review.test.ts
- tests/scripts/analyze_pr_limits.test.ts
- tests/scripts/analyze_router_routes.test.ts
- tests/scripts/optimize_deep_limits.test.ts

## Output format (contract §2.2)

Fill the findings table in `analysis-family-doors-20261019.findings.md`:

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
**Honest-null:** 0 findings, scope 927b6995a0d3d525085e7c85a0d4e41bdaaeaab651dc96580533a515d3e9f371, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
