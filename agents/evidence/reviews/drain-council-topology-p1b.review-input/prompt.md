# R2 completion review — drain-council-topology-p1b

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

- diff: `diff.patch` — the review scope (branch head afd81fe73a22d806efaac9b0fc377f7b6ad6a703, review
  artefacts excluded), scope hash `421c02fddbf42e8b0c612dfdfeada67f837707e1b17cb29373a9396516aca19d`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/road-to-inbox-harvest-2026-08-e-council-topology-evidence.md
- docs/contracts/ai-council-config.md
- src/config/gate-violation-baselines.json
- src/scripts/_lib/council_settings_block.ts
- src/scripts/ai_council/config.ts
- src/scripts/ai_council/consensus.ts
- src/scripts/ai_council/consensus_round.ts
- src/scripts/ai_council/inline_findings.ts
- src/scripts/ai_council/orchestrator.ts
- src/scripts/ai_council/orchestrator_results.ts
- src/scripts/ai_council/prompts.ts
- src/scripts/council_cli.ts
- tests/scripts/ai_council/inline_findings.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-council-topology-p1b.findings.md`:

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
**Honest-null:** 0 findings, scope 421c02fddbf42e8b0c612dfdfeada67f837707e1b17cb29373a9396516aca19d, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
