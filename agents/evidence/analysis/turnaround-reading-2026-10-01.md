<!-- evidence-type: analysis -->

# Turnaround reading against the 2026-08-30 baseline — 2026-10-01

The reading the archive owed. `road-to-agent-turnaround` measured the four
figures once, `road-to-turnaround-followups` re-read one of them, and the
re-measurement was then transferred twice and closed `[-]` in the archive without
a reading. This is that reading.

## Invocation

```
./scripts-run src/scripts/probe_turnaround \
    --store ~/.claude/projects/-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config \
    --limit 10 --against-baseline
```

`--store` is not optional here and the reason is the same one the previous
reading recorded: the probe defaults to `defaultStore(process.cwd())`, this
reading was taken from a worktree under `.claude/worktrees/`, and that directory
mangles to a slug naming no transcript store. The bare command would measure zero
sessions and exit 1 on `empty_corpus: "fail"`, correctly. The store named is the
one the baseline and the 2026-08-30 re-read both measured; a delta against a
different corpus is not a delta.

## Corpus

| | |
|---|---|
| Window | the 10 most recently modified sessions in this package's transcript store, excluding the measuring session, read 2026-10-01 ~12:40Z |
| Sessions | 10 — `1a6ee55b`, `0ae74690`, `56925eaa`, `02de70d7`, `31e4bc24`, `32038c21`, `97f38eee`, `5413debc`, `1379e684`, `1e95a767` |
| Session mtimes | 2026-09-29 09:47 through 2026-10-01 12:39, local time |
| Excluded | 1 — the measuring session `726708e6`, dropped by `CLAUDE_CODE_SESSION_ID`, which the host exported |
| User requests | 108 |
| API calls | 2,956 |
| Tool calls | 3,132 |
| Tool-using requests | 2,822 |

**The step's precondition is met this time, and that is worth stating because
last time it was not.** The step asked for sessions after 2026-08-30; the oldest
session in this window is 2026-09-29, so all ten qualify. The 2026-08-30 re-read
recorded as its principal finding that at most one of its ten sessions could have
received the change it was measuring. That caveat does not apply here.

## The four figures

| Figure | Baseline 2026-08-30 | Re-read 2026-08-30 | This reading | Gated direction |
|---|---:|---:|---:|---|
| API calls per user request | 72.67 | 93.74 | **27.37** | reported only, not compared |
| Mean tool-call batch size | 1.01 | 1.01 | **1.11** | UP is the improvement |
| Blocking share (>60 s) | 0.6202 | 0.6641 | **0.8908** | DOWN |
| First-call context floor, max | 230,705 | 226,528 | **244,518** | DOWN |

Gate verdict: **exit 1**, on `blocking_share` and `context_floor_max`.

## What each movement is, and is not

**Mean batch size, 1.01 → 1.11. The first non-null movement on the serial
measure, and the one the step was written for.** The distribution, recomputed
independently and reproducing the probe's 2,822 tool-using requests exactly:

| Blocks in one request | Requests |
|---:|---:|
| 1 | 2,580 |
| 2 | 200 |
| 3 | 33 |
| 4 | 3 |
| 5 | 2 |
| 6 | 2 |
| 8 | 1 |
| 11 | 1 |

242 of 2,822 requests carried more than one tool-use block — 8.6 %, against 26 of
3,237 (0.80 %) in the 2026-08-30 re-read. The source analysis that started all
this reported 1.00 across 3,212 tool-using messages, with not one message
carrying two tool calls.

**No attribution is drawn, and the risk register said so in advance.** A delta
over a window that includes delivery changes cannot attribute the movement to one
cause. Between the two readings this package changed its batching obligation, its
delivery sets, its hook carriers and its orchestration defaults, and the window
is an mtime window containing whatever sessions happened to run. What this
reading establishes is that fully serial is not a floor with a mechanism behind
it — which the 2026-08-30 re-read already suspected from 27 multi-block requests
and could not show at scale. Why the number moved is not in this measurement.

**Calls per request, 72.67 → 27.37. Evidence of nothing, exactly as the
baseline's own `directions` field predicts.** The movement is the denominator
again: API calls are comparable (3,052 → 2,956) while user requests rose 42 →
108. The baseline records that this metric is sensitive to session shape and that
a movement tracking `user_requests` is no evidence at all. This window contains
many short interactive sessions where the previous ones contained long autonomous
runs. The figure is recorded, not read.

**Blocking share, 0.6202 → 0.8908. A regression in the gated direction, and the
largest single movement here.** 252 calls over 60 seconds account for 1,266 of
1,422 minutes of tool time. It is not this step's metric, it is one local
mtime-window reading, and raising a baseline needs its own reason in its own
change — so the baseline is **deliberately not re-based**. The direction is
recorded for whoever owns that number next. One mechanism worth naming as a
hypothesis rather than a finding: this window contains parallel worktree drain
runs, where a session waits on CI settles and on subagent returns, both of which
are minutes-long blocking tool calls by construction.

**Context floor max, 230,705 → 244,518. A regression in the gated direction.**
Also **deliberately not re-based**, and for the symmetric reason to the previous
reading's: that one found the floor below baseline and declined to tighten the
ratchet on a single local reading; this one finds it above and declines to loosen
it on the same ground.

## What this reading does not do

It changes no baseline, closes no gate, and recommends no mechanism. Two of the
four figures are regressions in their gated direction and both are left standing
against the recorded baseline, so the next reader meets the same refusal rather
than a quietly moved line.
