# Spawn bursts and council seat launches, before any reuse

<!-- evidence-type: analysis -->

> **Produced on** `main` @ `37d68ce64`, 2026-10-16, for steps 1.2 and 1.3 of
> `road-to-a-cold-start-paid-once`. Everything here comes from the ledger and
> artefacts that already existed. Nothing new was captured. Host at reading
> time: Claude Code 2.1.301.
>
> **One maintainer machine.** The ledger (`agents/runtime/state/subagent-ledger/`)
> and the council artefacts (`agents/runtime/council/responses/`) are gitignored
> and local. A fresh checkout has neither, so a re-run there finds an empty
> corpus, which is not a zero.

## Window

| Field | Value |
|---|---|
| Ledger window | 2026-08-13T13:24:52Z to 2026-10-16T11:16:15Z |
| Ledger lines read | 48,441 |
| `subagent_start` lines | 2,178 (0 unidentified, 27 without a `session_id`) |
| `subagent_stop` lines | 44,322 |
| `subagent_reaped` lines | 154 |
| `spawn_guard_shadow` lines | 1,787 |
| Sessions with at least one start | 180 |

**The stop count is 20 times the start count.** The stop handler fires on more
host events than a dispatch's own end, so a stop is not a returned dispatch.
Nothing below counts stops.

## Step 1.2 — bursts per session

Per-session figures come from `subagent_start` lines only. `spawn_guard_shadow`
lines carry no `session_id`, so they cannot be split by session. They appear
only in the window-wide row at the end.

| Per session | median | p90 | max |
|---|---|---|---|
| Starts in the window | 6 | 27 | 150 |
| Most starts in any 10 s | 2 | 3 | 7 |
| Most starts in any 60 s | 3 | 5 | 10 |
| Highest `concurrent_open` on a start line | 5.5 | 17 | 30 |

| Window-wide, `spawn_guard_shadow` | value |
|---|---|
| `concurrent_open`, median / p90 / max | 4 / 14 / 29 |
| Lines at `concurrent_open >= 4` | 1,022 of 1,787 |
| Lines at `concurrent_open >= 8` | 530 of 1,787 |

**Bound on the overlap figures.** `concurrent_open` counts open records, and a
record whose stop never arrived stays open until the 24-hour reaper removes it
(154 reaped in the window). So the overlap rows are an upper bound on true
concurrency, not a measurement of it. The burst rows count start timestamps and
have no such bias.

**What the reading says.** A typical session starts two subagents within ten
seconds and three within a minute. The p90 session starts five within a minute,
and the worst session starts ten. In short windows, bursts are small compared
with the open counts the guard sees. So the open counts are not explained by
short bursts; whether they are dispatches that stay open or records whose stop
never arrived, this data cannot tell, because both read as open until the
reaper. (Corrected 2026-10-22, release finding `f4e315c3fb4e`: this read "most
of the pressure comes from dispatches that stay open", a cause the upper bound
above does not support.)

## Ledger re-starts — a pointer for step 1.4, not an observation

Of 1,749 refs with a start, 192 have more than one `subagent_start`. A second
start for the same ref is what a resumed run looks like to the ledger.

`cache_realization_report` was run over the same host's transcripts (14-day
window, `--ledger-dir` pointed at this ledger) after the leg-into-runs split
landed:

| | value |
|---|---|
| Legs | 438 |
| Fresh first call, median written-or-uncached | 182,728 tokens |
| Legs with a ledger start | 414 |
| Runs | 645 |
| Resumed runs (ordinal >= 2) | 207 |
| Resumed first call, median written-or-uncached | 282,799 tokens |

In this corpus, a resumed run's first call wrote **more** than a fresh spawn's,
not less. A resume that replays a transcript after the cache expired does
exactly that. This reading does not meet the observation protocol: it names no
single session, does not show the resume was addressed by name, and does not
split resumes by the gap since the last request. So it fills no `worker_resume`
row, and it gives no verdict on `warm-worker-cold-start-relief`. The claim was
written into `docs/CLAIMS.md` before this report was run, and its sample rules
are unchanged. The reading belongs here so step 1.4 starts from it, not from an
assumption that resumes are warm.

## Step 1.3 — council seats as their own population

Each council round launches a fresh seat per member, so a seat launch is a cold
start of its own. It is measured apart from subagent legs.

| | value |
|---|---|
| Response artefacts read | 733 |
| Non-error seat launches | 1,437 (anthropic 717, openai 720) |
| Anthropic council seat launches carrying a `session_id` | 38 |
| Of those, joined to a host transcript by `session_id` | 4 |
| Window of the joined council seat launches | 2026-09-21 to 2026-10-06 |
| First-call written-or-uncached, median (min / max) | 102,612 (99,657 / 105,673) |
| First-call cache-read share, median | 4.1 % |

**The council seat baseline is thin.** It rests on four launches. The council
artefacts record `input_tokens` and cache fields per response, but for CLI
seats those fields cover the seat's final exchange, not its first call. So the
only first-call figure comes from joining to the host transcript, and 34 of the
38 sessions with an id no longer have a transcript on disk. The second
provider's seats have no transcript this tree can read. Read the median as a
scale, about 100k tokens per council seat launch with almost nothing cached. It
is not a figure to subtract from. Phase 5 should take a fresh, larger reading
before any comparison.

## Re-running

The burst and council seat rows came from a one-off reading that was not
committed. The method: parse every `*.jsonl` in the ledger directory; group
`subagent_start` lines by `session_id`; for each session, slide a 10 s and a
60 s window over the start timestamps and take the maximum count. Take the
maximum `concurrent_open` over the session's start lines. For council seats,
walk `responses/**/*.json`, keep non-error responses, and for anthropic ones
with `metadata.session_id` open `~/.claude/projects/*/<session_id>.jsonl` and
read the first record that carries `message.usage`. The cold-start and run rows
come from
`./scripts-run src/scripts/cache_realization_report --format text --ledger-dir <ledger>`.
A re-run on a later date reads a different window, because the transcript
window moves with file mtimes and the ledger grows.
