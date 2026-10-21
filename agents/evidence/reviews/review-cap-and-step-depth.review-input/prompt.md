# R2 completion review — review-cap-and-step-depth

You are a FRESH reviewer subagent. You have no implementation context and
you must not acquire any (blind-review pattern, plan-review-gates.md §5).

## Review mode

Senior-engineer review of the branch diff. Search grid — hunt for:

- errors
- inconsistent logic
- inefficiencies
- bug-producing patterns

## Severity

Severity binds to correctness and to the requirements the change states
(the roadmap step, its acceptance criteria):

- `critical` / `high` — wrong behaviour, a broken or missing check, a data
  or security exposure, or a stated requirement not met.
- `medium` — a defect that misleads a reader or fails under a condition the
  change itself names.
- `low` — style, naming, formatting or wording that changes no behaviour,
  including in record prose (roadmaps, evidence, decision records, comments).

A false statement in record prose — a wrong figure, path or status — is not
style: it keeps the severity of what it breaks, which is high when a gate,
a command or the next step acts on it and medium when nothing does.

## Rules

- Review only — write no code, fix nothing.
- Tool allowlist (contract §5): branch-scoped `git diff` + reads of
  branch-touched files only; no `git log` beyond the branch, no repo-wide
  grep, no reads of `agents/runtime/` or session artifacts.

## Inputs

- diff: `diff.patch` — the review scope (branch head 39a28e6ce83cbfc77ed98ab12fe2df55fca330ce, review
  artefacts excluded), scope hash `e806d9de6eb1dfc7c78b342b2b2d3f46baa1a0d8d35a4f394116d23c95e5e771`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/change-class-last-100-prs-2026-10-21.md
- agents/evidence/analysis/depth-shadow-retrospective-2026-10-21.md
- agents/evidence/analysis/review-severity-by-round-2026-10-21.md
- agents/roadmaps/road-to-a-review-that-ends.md
- agents/roadmaps/road-to-a-step-that-costs-what-it-changes.md
- dist/agent-src/commands/pr/create.md
- dist/agent-src/commands/pr/merge.md
- dist/agent-src/commands/roadmap/process-full.md
- dist/agent-src/contexts/execution/pr-create-branches-content.md
- dist/agent-src/contexts/execution/pr-create-branches-freshness.md
- dist/agent-src/contexts/execution/pr-merge-queue.md
- dist/agent-src/contexts/execution/pr-merge-sync.md
- dist/agent-src/contexts/execution/process-full-all.md
- dist/agent-src/contexts/execution/process-full-delivery.md
- dist/agent-src/contexts/execution/roadmap-execution-contract-branches.md
- dist/agent-src/contexts/execution/roadmap-execution-contract.md
- dist/agent-src/contexts/execution/roadmap-process-loop-close.md
- dist/agent-src/contexts/execution/roadmap-process-loop-prescan.md
- dist/agent-src/contexts/execution/roadmap-process-loop-run.md
- dist/agent-src/contexts/execution/roadmap-process-loop-set.md
- dist/agent-src/contexts/execution/roadmap-process-loop.md
- dist/agent-src/templates/roadmaps.md
- docs/contracts/plan-review-gates.md
- src/agent-src/contexts/execution/pr-create-branches-content.md
- src/agent-src/contexts/execution/pr-create-branches-freshness.md
- src/agent-src/contexts/execution/pr-merge-queue.md
- src/agent-src/contexts/execution/pr-merge-sync.md
- src/agent-src/contexts/execution/process-full-all.md
- src/agent-src/contexts/execution/process-full-delivery.md
- src/agent-src/contexts/execution/roadmap-execution-contract-branches.md
- src/agent-src/contexts/execution/roadmap-execution-contract.md
- src/agent-src/contexts/execution/roadmap-process-loop-close.md
- src/agent-src/contexts/execution/roadmap-process-loop-prescan.md
- src/agent-src/contexts/execution/roadmap-process-loop-run.md
- src/agent-src/contexts/execution/roadmap-process-loop-set.md
- src/agent-src/contexts/execution/roadmap-process-loop.md
- src/agent-src/templates/roadmaps.md
- src/config/gate-violation-baselines.json
- src/config/procedure-core-budget.json
- src/config/roadmap-step-size-baseline.json
- src/config/step-depth-table.json
- src/config/turnaround-budget.json
- src/domains/git/pack.yaml
- src/domains/git/pr/create/command.md
- src/domains/git/pr/merge/command.md
- src/domains/meta/pack.yaml
- src/domains/product-basic/roadmap/process-full/command.md
- src/scripts/_lib/roadmap_step_size.ts
- src/scripts/_lib/step_anatomy.ts
- src/scripts/check_completion_review.ts
- src/scripts/dispatch_r2_reviewer.ts
- src/scripts/lint_roadmap_complexity.ts
- src/scripts/probe_depth_shadow.ts
- src/scripts/probe_turnaround.ts
- src/scripts/step_receipt.ts
- tests/_lib/procedure_text.ts
- tests/e2e/adversarial-verification-fixtures.test.ts
- tests/scripts/check_completion_review.test.ts
- tests/scripts/ci_settle_cli.test.ts
- tests/scripts/dispatch_r2_reviewer.test.ts
- tests/scripts/pr_merge_danger_gate_command.test.ts
- tests/scripts/probe_depth_shadow.test.ts
- tests/scripts/procedure_core_budget.test.ts
- tests/scripts/process_full_lane_brief.test.ts
- tests/scripts/roadmap_step_size.test.ts
- tests/scripts/step_anatomy.test.ts
- tests/scripts/step_receipt.test.ts

## Output format (contract §2.2)

Fill the findings table in `review-cap-and-step-depth.findings.md`:

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
**Honest-null:** 0 findings, scope e806d9de6eb1dfc7c78b342b2b2d3f46baa1a0d8d35a4f394116d23c95e5e771, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
