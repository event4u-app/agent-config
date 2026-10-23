<!-- evidence-type: analysis -->

# Worker-reuse shadow window — reconstructed, 2026-10-22

> **Filed for** `road-to-a-cold-start-paid-once` step 3.5 on `feat/subagent-system-2583-rest`.
> **Window: `manufactured`** (owner decision O6) plus the maintainer's real ledger since
> recording started. Host: Claude Code **2.1.308** (from the transcripts' `version` field), print
> mode, subscription login, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Basis of every verdict:
> **`reconstructed`** (council 2026-10-22, decision 1, 2/2 option a).

## How the verdicts were produced

The shadow hook records only the precondition and the join keys. `worker_reuse_shadow_report`
(`--ledger-dir`, `--transcripts`, `--since`) rebuilds each spawn's verdict at report time: for
every `spawn_guard_shadow` spawn line with an `agent_type`, every worker of the same session with
a `subagent_named` line and a `subagent_stop` before the spawn, not open at the spawn, becomes a
`WorkerState`, and `decideWorkerReuse` runs through `shadowReuseVerdict` (most recently stopped
first). A join missing any input is `incomplete_join` with the field named and is excluded from
the window, never counted as `fresh`.

Approximations, stated because the verdicts depend on them:

- `package_version` comes from the line's `epoch`, the bundle mtime. An epoch change is reported
  once, as `epoch_changed` (the decision function's `policy_epoch_changed`). No per-worker skill
  signature is recorded, so `skill_set_signature` is not compared and `workspace_changed`
  reflects worktree and head only. (Until 2026-10-23 both fields took the epoch, so one change
  counted as two reasons. No spawn in this window had an epoch change.)
- `last_request_at` is the worker's last `subagent_stop`, and `cache_ttl` is the host default of
  300 000 ms.
- `host_resume` is true: `worker_resume` is live on claude under the agent-teams flag.
- The spawn line carries no `session_id`. Session comes from the next `subagent_start` of the same
  type within 10 s. If none is found, the spawn is `incomplete_join: session_id`.
- The observed fresh cold start is the median over the whole window, so it can use runs that came
  after the spawn.
- A worker's `transcript_tokens` is its last call before the spawn, read from the last streamed
  record per message id.
- A session with register lines before `--since`, or a named worker whose `subagent_start` is not
  in view, reads as `worker_register_unrecorded`, never `no_candidate`. Only a worker that could
  be resumed (same `agent_type`, `reuse: continuity`) can make a join incomplete. All timestamps
  are compared as instants.

## Sources

| Source | Lines used | Transcripts |
|---|---|---|
| Scratch bench ledger (16 sessions, `internal/bench/worker-resume`) | all | the scratch project store |
| Maintainer ledger `agent-config/agents/runtime/state/subagent-ledger` | `2026-10-22T20:40Z <= ts <= 21:38Z` | the main project store |

## Re-run after the review fixes (2026-10-23)

An independent review on 2026-10-23 found four defects in the reconstruction. They are fixed in
`worker_reuse_shadow_report` with tests seen red first: (2) an unrelated worker's missing data
voided the whole spawn; (3) a register cut by `--since` read as `no_candidate`; (4) transcript
dedup kept the first streamed record, undercounting the last call's output; (5) timestamps were
compared as strings. The report was re-run over the same ledger and transcript roots with the
same `--since`. A new `--until 2026-10-22T21:38:00Z` was added, the time the filed window was
written: the maintainer ledger is live, and without a cutoff 18 spawn lines appended after
21:45Z would have joined the window (10 `general-purpose`, 8 without `agent_type`).

**Nothing moved.** All 89 spawns get the same verdict and the same reasons as before. Fix 2 did
not apply: every incomplete join is a spawn-side gap (`agent_type`, `session_id`). Fix 3 did not
apply: no session in the window had register lines before `--since`. Fix 4 changed the median
worker transcript from 7 066 to 7 065 tokens. Fix 5 changed no ordering because every line
carries a UTC `Z` timestamp.

## The window — primary reading

| Measure | Value |
|---|---|
| `Agent` spawn lines | 89 |
| Complete joins (in the window) | 81 |
| Incomplete joins | 8: 6 maintainer lines written by an older installed bundle (no `agent_type`, `cwd_key`, `head`, `epoch`) and 2 `general-purpose` spawns with no matching start (`session_id`) |
| `would_resume` | **0** |
| Refusals | `transcript_over_cold_start` 64 · `no_candidate` 17 |
| Observed fresh cold start, `ac-researcher` | 863.5 tokens (median first-call written-or-uncached, 80 fresh runs) |
| Worker transcript at stop (median) | 7 066 tokens; first call 5 646, 84 % of it cache-read |
| Span | 0.018 days |

**Positive control.** The fixture positive control yields `would_resume`
(`tests/scripts/worker_reuse_shadow_report.test.ts`). The real data yields none, for one reason
only: condition (c) compares a worker's whole transcript (about 7 k tokens) with the fresh cold
start measured as written-or-uncached tokens. A fresh spawn of a definition whose prefix is
already in the prompt cache writes about 860 tokens, so every warm candidate fails (c), the case
reuse is meant for included. This is a property of the condition as specified, not missing data.
That 64 of 64 candidates failed only on (c) is the finding. The like-for-like comparison is
reported below as a secondary reading; in this window it does not change the count.

**A null window, recorded as one.** Every reuse was refused, and per 3.5 that is a valid null.

**What the primary reading says, and what it does not.** This is the as-implemented policy
result: 0/81 eligible. It does not establish that reuse was more expensive or worse than a fresh
start. (Council 2026-10-23, both seats agreed on this wording.)

## Secondary reading `c_like_for_like`

> secondary — pre-registered 2026-10-23 after the primary window; computed over the same window
> for information only; a decision on (c) waits for a later window not used to choose it

The council of 2026-10-23 split 1:1 in each of two rounds on condition (c). The default applied
was option (d): (c) stays unchanged in the shipped decision function, and the report computes a
second reading beside the primary one. In this reading (c) is `transcript_tokens <` the median
first-call **total** input (input + cache_creation + cache_read) of fresh runs of the
definition. Everything else is as in the decision function. This reading is never merged into
the primary series.

| Measure | Value |
|---|---|
| Threshold, `ac-researcher` | 5 496 tokens (median first-call total input, fresh runs) |
| Complete joins | 81 (same 8 incomplete) |
| `would_resume` | **0** |
| Refusals | `transcript_over_cold_start` 64 · `no_candidate` 17 |
| Smallest candidate transcript | 6 575 tokens, above the threshold |

Comparing like with like still admits no worker. A worker that has done one task carries its
first call (about 5.5 k) plus that task's own turns, so it is above the median first call of a
fresh run.

## flipReadiness (primary reading)

`ready: false`. Missing: `failure_observed` (0 would-resume), `false_positive_rate_measured`,
`economics_measured`, `window_met` (81 calls, 0.02 days; the bar is ≥ 100 calls or 14 days).

- **False-positive rate: null.** A false positive is a would-resume that should have been fresh.
  With 0 would-resume there is nothing to grade, so the rate is not measurable from this data.
- **Economics: null.** Cost avoided needs a would-resume to price. The bench measures what a
  resume saves when it happens, in `warm-worker-claims-2026-10-22.md` (relief ratio 0.17). It
  does not measure what this guard would avoid, because the guard admitted none.

## Reproduce

```
./scripts-run src/scripts/worker_reuse_shadow_report \
  --ledger-dir <scratch>/proj/agents/runtime/state/subagent-ledger \
  --ledger-dir <main checkout>/agents/runtime/state/subagent-ledger \
  --since 2026-10-22T20:40:00Z --until 2026-10-22T21:38:00Z \
  --transcripts ~/.claude/projects/<scratch project slug> \
  --transcripts ~/.claude/projects/<main checkout slug>
```

The output carries the primary `summary` and `flip`, and `secondary_c_like_for_like` with its
own label, threshold and summary. Raw transcripts and the scratch ledger are not committed.

## Extended reading — the window without `--until` (2026-10-23)

The filed window above stops at 21:38Z, when it was written. The same command without `--until`
also counts the spawns recorded afterwards in the maintainer ledger: twelve read-only review
agents over this branch's diff and the fix agents that followed — organic work, not part of the
manufactured bench, labelled here only so the two are not pooled silently.

| | value |
|---|---|
| spawn lines since 20:40Z | **107** |
| complete joins | 85 |
| incomplete joins | 22 — `session_id` 22 (parallel background spawns of one type inside the 10 s join window cannot be told apart), `agent_type` 14, stamps 11 (lines written before the main checkout's hook bundle was rebuilt with this branch) |
| `would_resume` (primary, as implemented) | **0** — `transcript_over_cold_start` 64, `no_candidate` 21 |
| `would_resume` (secondary `c_like_for_like`) | 0 |
| `flipReadiness` | not ready — `failure_observed`, `false_positive_rate_measured`, `economics_measured`, `window_met` (85 complete calls over 0.02 days) |

Step 3.5 asked for at least 100 `Agent` calls; 107 were recorded. The reading is a valid null for
the policy as implemented, and the step closes on it.
