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

- diff: `diff.patch` — the review scope (branch head 8da6bdf4941c33745455e7c042cdee91457897e2, review
  artefacts excluded), scope hash `e58f6d41c888941fc19ca319ba7beecd17f3ed08ea9d8165203780fbc2965b19`
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
**Honest-null:** 0 findings, scope e58f6d41c888941fc19ca319ba7beecd17f3ed08ea9d8165203780fbc2965b19, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.

## Caller instructions as delivered to this reviewer (verbatim)

Recorded because the review that fills the findings table ran on these
instructions, not on the dispatcher text above alone. They name the prior round
and ask for each of its rows to be re-verified; they state no expected outcome.

> You are an independent reviewer in the repo event4u/agent-config. Review PR #2239 (branch `drain/road-to-a-graph-that-feeds-the-gate-20261006c`) at its current head.
>
> Scope: the whole diff of the PR against its merge base with origin/main (`gh pr diff 2239`, or `git diff origin/main...<head>` after fetching the branch). Report defects you find in correctness, test sensitivity, documentation claims vs. measured evidence, and repo conventions (see CLAUDE.md). For each finding: file:line, the concrete failure scenario, severity.
>
> The branch has a completion-review artefact at `agents/evidence/reviews/drain-road-to-a-graph-that-feeds-the-gate-20261006c.findings.md`. Use the repo's own R2 tooling to record your review properly for the current head (look at `src/scripts/dispatch_r2_reviewer.ts` and the completion-review contract it references to learn the expected artefact shape and how a genuine review is recorded, including recording the review prompt). Each previous finding row: verify against the code whether the fix actually holds and set its status from your own verification. Add new findings as new rows.
>
> You may commit ONLY the review artefact changes (pathspec, Conventional Commit `docs(review): ...`, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`) and push to that branch. Do NOT change any code, do NOT merge.
>
> Final report (English, concise): head SHA reviewed, per-finding verdicts, new findings, whether the artefact was committed and pushed.
