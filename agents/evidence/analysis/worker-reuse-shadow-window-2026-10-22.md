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

- `skill_set_signature` and `package_version` both come from the line's `epoch`, the bundle
  mtime. No per-worker skill signature is recorded, so an epoch change also reads as
  `workspace_changed`.
- `last_request_at` is the worker's last `subagent_stop`, and `cache_ttl` is the host default of
  300 000 ms.
- `host_resume` is true: `worker_resume` is live on claude under the agent-teams flag.
- The spawn line carries no `session_id`. Session comes from the next `subagent_start` of the same
  type within 10 s. If none is found, the spawn is `incomplete_join: session_id`.
- The observed fresh cold start is the median over the whole window, so it can use runs that came
  after the spawn.

## Sources

| Source | Lines used | Transcripts |
|---|---|---|
| Scratch bench ledger (16 sessions, `internal/bench/worker-resume`) | all | the scratch project store |
| Maintainer ledger `agent-config/agents/runtime/state/subagent-ledger` | `ts >= 2026-10-22T20:40Z` | the main project store |

## The window

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
That 64 of 64 candidates failed only on (c) is the finding. Comparing like with like (billable
context against billable context, or written against written) would change it. Neither
alternative was chosen here.

**A null window, recorded as one.** Every reuse was refused, and per 3.5 that is a valid null.

## flipReadiness

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
  --ledger-dir <main checkout>/agents/runtime/state/subagent-ledger --since 2026-10-22T20:40:00Z \
  --transcripts ~/.claude/projects/<scratch project slug> \
  --transcripts ~/.claude/projects/<main checkout slug>
```

Raw transcripts and the scratch ledger are not committed.
