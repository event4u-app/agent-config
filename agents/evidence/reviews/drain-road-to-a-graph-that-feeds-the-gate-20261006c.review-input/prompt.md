# R2 completion review — drain-road-to-a-graph-that-feeds-the-gate-20261006c

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

- diff: `diff.patch` — the review scope (branch head e3f13d33b218e7ef3e350866545377111e377336, review
  artefacts excluded), scope hash `7cfa800838afd997e909fd325c9efd2545f149c07eade3270dbe3e0c18b8ff6d`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/graph-feeder-latency-2026-Q4.md
- agents/roadmaps/road-to-a-graph-that-feeds-the-gate.md
- package-lock.json
- src/scripts/_lib/graph_feeder_record.ts
- src/scripts/bench_graph_feeder_latency.ts
- tests/scripts/bench_graph_feeder_latency.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-road-to-a-graph-that-feeds-the-gate-20261006c.findings.md`:

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
**Honest-null:** 0 findings, scope 7cfa800838afd997e909fd325c9efd2545f149c07eade3270dbe3e0c18b8ff6d, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.

## Caller instructions as delivered to this reviewer (verbatim)

Recorded because the review that fills the findings table ran on these
instructions, not on the dispatcher text above alone. They name the prior round's
artefact and ask for each of its rows to be re-verified; they state no expected
outcome.

> You are an independent reviewer in the repo event4u/agent-config. Review PR #2239 (branch `drain/road-to-a-graph-that-feeds-the-gate-20261006c`) at its current head.
>
> Scope: the whole diff of the PR against its merge base with origin/main. Report defects in correctness, test sensitivity, documentation claims vs. measured evidence, and repo conventions (see CLAUDE.md). For each finding: file:line, concrete failure scenario, severity.
>
> The branch has a completion-review artefact at `agents/evidence/reviews/drain-road-to-a-graph-that-feeds-the-gate-20261006c.findings.md` with open rows from the previous round. Use the repo's own R2 tooling (`src/scripts/dispatch_r2_reviewer.ts` and the completion-review contract it references) to record a genuine review for the current head, including the review prompt, following the contract's procedure for a new round. For each previous row, verify against the code whether it is resolved and set its status from your own verification only. Add new findings as new rows.
>
> You may commit ONLY the review artefact changes (pathspec, `docs(review): ...`, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`) and push to that branch. Do NOT change code, do NOT merge.
>
> Final report (English, concise): head SHA reviewed, per-row verdicts, new findings, whether committed and pushed, and the R2 gate state.
