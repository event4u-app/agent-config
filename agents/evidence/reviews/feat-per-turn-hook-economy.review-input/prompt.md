# R2 completion review — feat-per-turn-hook-economy

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

- diff: `diff.patch` — the review scope (branch head 28866865cf23faab04e3c64e29bf06f5feef72ff, review
  artefacts excluded), scope hash `5461cd483a0d274787f9804e7c18ae801b78d604a5dc79b87f9a13339bcf07fa`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-cost-parity-1-rule-payload-diet.md
- agents/roadmaps/road-to-per-turn-hook-economy.md
- docs/contracts/hook-architecture-v1.md
- src/config/hook-latency-budget.json
- src/scripts/_lib/stdin.ts
- src/scripts/bench_hook_latency.ts
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/dispatch_hook.ts
- src/scripts/hooks/end_review_nudge_hook.ts
- src/scripts/hooks/hook_stdin.ts
- src/scripts/roadmap_progress_hook.ts
- tests/scripts/bench_hook_latency_composite.test.ts
- tests/scripts/end_review_nudge_hook.test.ts
- tests/scripts/hooks/dispatch_envelope_isolation.test.ts
- tests/scripts/hooks/dispatch_large_payload_guard.test.ts
- tests/scripts/hooks/roadmap_progress_hook.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-per-turn-hook-economy.findings.md`:

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
**Honest-null:** 0 findings, scope 5461cd483a0d274787f9804e7c18ae801b78d604a5dc79b87f9a13339bcf07fa, reviewed <YYYY-MM-DD>
```
