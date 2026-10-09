# R2 completion review — pack-boundary-suggests-edge

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

- diff: `diff.patch` — the review scope (branch head e6029108fec76033a3a0dc3511922125ed07a739, review
  artefacts excluded), scope hash `714cf7e6e36116324e57553476953dbfadf80989f72e32704717fc457f70cd21`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/pack-boundary-link-classification-2026-10-09.md
- agents/roadmaps/archive/road-to-gates-a-pull-request-can-hear.md
- agents/roadmaps/road-to-gates-a-pull-request-can-hear.md
- dist/agent-src/skills/corpus-grounding/ATTRIBUTION.md
- dist/agent-src/skills/corpus-grounding/SKILL.md
- dist/agent-src/skills/tailwind-engineer/SKILL.md
- docs/contracts/capability-packs.md
- src/config/discovery/packs.yml
- src/config/gate-coverage.yml
- src/config/gate-violation-baselines.json
- src/domains/engineering-base/pack.yaml
- src/packs/finance-basic/pack.yaml
- src/scripts/lint_pack_boundaries.ts
- src/scripts/lint_rule_skill_pack_reach.ts
- src/skills/corpus-grounding/ATTRIBUTION.md
- src/skills/corpus-grounding/SKILL.md
- src/skills/tailwind-engineer/SKILL.md
- tests/scripts/lint_pack_boundaries_base_narrow.test.ts

## Output format (contract §2.2)

Fill the findings table in `pack-boundary-suggests-edge.findings.md`:

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
**Honest-null:** 0 findings, scope 714cf7e6e36116324e57553476953dbfadf80989f72e32704717fc457f70cd21, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
