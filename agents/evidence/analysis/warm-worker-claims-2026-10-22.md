<!-- evidence-type: analysis -->

# Warm-worker claims — one manufactured run, 2026-10-22

> **Produced on** `feat/subagent-system-2583-rest` for `road-to-a-cold-start-paid-once` 6.2,
> against the four claims pre-registered in `docs/CLAIMS.md` (6.1, 2026-10-16). **Window:
> `manufactured`** (owner decision O6). The work is real (a citation audit of four roadmaps) and
> the run was built to compare arms. Host: Claude Code **2.1.308** (transcript `version`), print
> mode, head `sonnet`, worker `ac-researcher` (the real body and tools from
> `src/subagents/ac-researcher.md`) on `haiku`, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`,
> read-only tools, no permission bypass. Total reported cost: $2.15 for 16 sessions.

## What ran

- **Tasks** (`internal/bench/worker-resume/tasks.ts`). The tasks come from every backticked
  `path:line` citation in `road-to-a-cold-start-paid-once`, `road-to-a-tier-the-dispatch-carries`,
  `road-to-free-hands-a-paid-head-checks` and `road-to-one-detector-and-the-senders-we-own`. Each
  task reads "Read `<path>` line N; reply with that line's text only". The pool holds 70 tasks;
  4 citations land on blank lines and are left out. Session k draws 9 tasks with seed 1000+k, and
  both arms of session k get the same 9 (a paired design).
- **FRESH arm.** 8 sessions × 9 tasks. Each task is a new named synchronous spawn, `r1` to `r9`.
- **REUSE arm.** 8 sessions × 9 tasks. Task 1 spawns `r`; tasks 2 to 9 re-task `r` by
  `SendMessage`, back to back inside the 5-minute TTL.
- **Order.** Sessions ran one at a time, and the arm that went first alternated per k so cache
  carry-over favours neither arm.
- **Scoring** (`score.ts`). An answer passes on an exact match with the line after trimming
  whitespace. The orchestrator prints the answers and the harness scores them. A planted wrong
  answer is rejected (`tests/scripts/worker_resume_score.test.ts`, shown red against a
  presence-only scorer first).
- **Completed.** 16 of 16 sessions: 144 tasks, 80 fresh spawns and 64 resumes. There were no
  errors, refusals or rate limits.

## Readings

| Claim | Sample | Value | Bar | Verdict |
|---|---|---|---|---|
| `warm-worker-cold-start-relief` | 64 resumed runs in 8 sessions; 80 fresh runs (72 in the FRESH arm) | resumed median first-call written-or-uncached **147** vs fresh **863.5**, ratio **0.170** (FRESH-arm-only fresh median 864) | ≤ 0.20 with ≥ 30 resumes in ≥ 5 sessions | **backed** (manufactured window) |
| `resume-non-inferiority` | 64 resumed tasks (REUSE tasks 2–9) · 72 fresh tasks (FRESH arm) | 98.4 % vs 87.5 %, difference **+10.9 pp** | ≥ −5 pp with ≥ 30 each | **backed** (manufactured window) |
| `fresh-spawns-per-drain` | 8 sessions per arm | 9 fresh spawns per session (FRESH) vs 1 (REUSE) | direction only | **backed** (direction: a fall). The cut is in spawns, not requests |
| `rate-limit-stops-per-drain` | 16 sessions | 0 host `quota-parked` markers, 0 ledger `agent_error` lines, 0 failed sessions | direction only, before vs after Phases 3–4 | **underpowered / null**. 0 was expected at this load, and no before/after pair exists |

Caveats that limit each reading:

- **Relief scale.** In both arms the definition's prefix is already cached across spawns: 84 %
  of a leg's first call is cache-read. So the fresh "cold start" here is about 860 written
  tokens, not the 242 891 of the corpus baseline. The ratio holds against a warm fresh spawn,
  which is the harder comparison, but the absolute saving is small, about 700 tokens per task.
- **Non-inferiority.** The FRESH misses (9 of 72) are reading errors: wrong line, a dropped
  `# `, an off-by-one. The REUSE arm had 1 miss in 64. The design is paired and the tasks are
  deterministic, but this is a single run of one task class.
- **Fresh spawns.** By construction a resume still costs a request, so this claim never stands in
  for `rate-limit-stops-per-drain`.
- **Rate-limit revisit condition.** Revisit after a real drain run with Phases 3–4 live, same
  operator and host band, compared with one from before. Or revisit as soon as any `StopFailure
  (rate_limit)` marker appears in a drain.

None of these are owner-run drains. They are dated readings for 6.2 on a manufactured window, and
`docs/CLAIMS.md` statuses are not changed by this file.

## The guard did not agree with the economics

The same ledger, reconstructed (`worker-reuse-shadow-window-2026-10-22.md`), gives **0
would-resume**. All 64 candidate workers fail condition (c): their whole transcript, about 7 k
tokens, exceeds the fresh cold start measured as written-or-uncached, about 860. The resumes the
guard refused were cheaper than a fresh spawn by the claim's own metric. As written, condition
(c) compares unlike quantities when the prefix is warm.

## Stale citations (byproduct)

Of the cited lines, 70 resolved and 4 hit blank lines. Citations given as a bare name were
resolved to the one tracked non-projection file with that suffix. One citation points past the
end of its file, and eight bare names match more than one tracked file:

| Roadmap | Citation | Finding |
|---|---|---|
| road-to-one-detector-and-the-senders-we-own | `src/cli/python/workspace_secrets.ts:57` | **stale**: the file has 7 lines |
| road-to-a-cold-start-paid-once | `SKILL.md:52`, `:110`, `:119` (×2), `:123` | ambiguous bare name, not resolvable |
| road-to-a-cold-start-paid-once | `settings.ts:371` | ambiguous bare name |
| road-to-a-tier-the-dispatch-carries | `ac-worker.md:7`, `production-validator.md:13` | ambiguous bare name |

A citation that resolves can still point at a line that has since moved. That is not detectable
without the author's intent, and this list does not count it.

## Reproduce

```
npx tsx internal/bench/worker-resume/run.ts --scratch <dir> --sessions 8
npx tsx internal/bench/worker-resume/analyze.ts --scratch <dir> --transcripts ~/.claude/projects/<scratch project slug>
```
