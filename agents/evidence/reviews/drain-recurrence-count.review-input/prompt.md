# R2 completion review — drain-recurrence-count

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

- diff: `diff.patch` — the review scope (branch head cccba14f21524d20dca1493f27e89ec0fa2157a9, review
  artefacts excluded), scope hash `28a16d28d1523b47d261fa302a01927453fdd99aee6a3feb13a7bf2cf5b7c612`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/adr-evidence-census-2026-08.md
- agents/evidence/analysis/held-object-arrival-counter-rate.md
- agents/roadmaps/archive/road-to-a-recurrence-count-that-survives-the-round.md
- agents/roadmaps/later/road-to-worker-generation-recycling.md
- agents/roadmaps/road-to-a-recurrence-count-that-survives-the-round.md
- agents/roadmaps/stubs/road-to-consumer-capability-share.md
- agents/roadmaps/stubs/road-to-live-trigger-eval.md
- agents/roadmaps/stubs/road-to-runtime-orchestration-substrate.md
- agents/roadmaps/stubs/road-to-subagent-return-gate.md
- agents/roadmaps/stubs/the-14-21-0-ledger-is-ingestible.md
- docs/decisions/ADR-134-launch-decision-dated-defer.md
- src/scripts/check_held_object_arrivals.ts
- src/scripts/report_held_object_arrivals.ts
- tests/scripts/held_object_arrivals.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-recurrence-count.findings.md`:

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
**Honest-null:** 0 findings, scope 28a16d28d1523b47d261fa302a01927453fdd99aee6a3feb13a7bf2cf5b7c612, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
