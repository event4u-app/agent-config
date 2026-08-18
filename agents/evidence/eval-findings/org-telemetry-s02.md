<!-- evidence-type: analysis -->

# Spike s02 — what a session-end outbound flush costs the session

**Date:** 2026-08-18
**Roadmap:** [road-to-org-telemetry.md](../../roadmaps/road-to-org-telemetry.md) Phase 0
**Tree:** `851568b5c` (branch base `origin/main`)
**Host stamp:** Claude Code 2.1.234 · node v25.9.0 · macOS, loopback stub
**Pre-registered threshold:** "added latency at or below one second at p95,
silent on failure, no session block. Failure moves transport to a detached spool
process with session end only enqueuing."

## Verdict — the inline flush FAILS its own bar; the roadmap's named fallback PASSES

An inline flush is free when the sink answers and free when the sink is *closed*.
It costs the entire timeout when the sink accepts the connection and never
answers — the shape a real outage takes — and that is the case that misses the
bar. The detached spool the step already names as the fallback removes the
coupling entirely.

| Scenario | p50 | p95 | max | p95 ≤ 1000 ms |
|---|---:|---:|---:|---|
| A healthy stub (204) | 0.2 ms | **0.4 ms** | 0.9 ms | PASS |
| B connection refused (port closed) | 0.1 ms | **0.3 ms** | 0.9 ms | PASS |
| C blackhole (accepts, never answers) | 1001.3 ms | **1002.0 ms** | 1002.7 ms | **FAIL** |
| D detached spool, same blackhole | 1.3 ms | **20.5 ms** | 46.9 ms | PASS |

n=100 per scenario. A first run at n=50 read A 0.5 / B 0.6 / C 1003.0 / D 8.8 ms
at p95 — the ordering and every verdict are identical across both runs, so the C
failure is not a boundary flap.

**Silent on failure:** 100 of 100 failures across B and C were classified and
swallowed, never rethrown. Two distinct classes surfaced, `unreachable` and
`timeout`, which is the minimum a spool needs to decide between retry and drop.

## Why C is the case that decides the design

C exceeds the bar by 2 ms, and that invites a bar-fitting reading: set the
timeout to 950 ms and C reports ~952 ms and "passes". That would be fitting the
number, not the engineering. The substance is the ratio, and it is not marginal:

- A healthy sink costs **0.4 ms** at p95.
- An unresponsive sink costs **1002 ms** at p95 — about **2,500×** more, on
  **every session end**, for as long as the outage lasts.
- The same outage costs **20.5 ms** through the spool.

An inline flush therefore couples session-end cost to sink health. "No session
block" is not a latency budget one can shave into compliance; it is a structural
property, and only D has it.

Note also what B establishes: a *down* sink is cheap, because the kernel refuses
the connection in microseconds. The expensive failure is the one that looks
alive — an overloaded ingest, a hung proxy, a DNS black hole, a laptop that
suspended mid-request. Testing only "sink down" would have produced a PASS and
shipped the wrong transport.

## Method

`spike2_latency.mjs`, scratch-only, four scenarios against loopback:

- **A** `http.createServer` answering `204` after draining the request.
- **B** a port bound to read its number, then closed — nothing listens.
- **C** `net.createServer` that accepts the socket and never writes.
- **D** append the batch to a local queue file, `spawn` a detached sender with
  `stdio: 'ignore'` + `unref()`, return immediately.

The measured quantity is the **added in-process cost** a session-end hook would
pay: node startup is excluded on purpose, because the existing hook already pays
it and the bar is about the delta. Payload is one representative Class-A batch —
20 records carrying usage class, skill, host, package version, user hash, session
hash, timestamp — 4,400 bytes. Transport is `fetch` with
`AbortSignal.timeout(1000)`. The fetch stack is warmed once before A so first-call
cost does not land in the measured window.

## Consequence for the roadmap

- Phase 0 step 2: **closed, FAIL — and the failure is informative, not a blocker.**
  The step pre-registered exactly this branch, and it fires.
- Phase 2 step 1 already defers to this result in its own text ("as a batched
  outbound call **per the second spike's result**"), so no correction to that
  step is needed — it resolves to: session end **enqueues only**, a detached
  sender flushes, and local retention carries what did not go out.
- The spool's own cost is now measured rather than assumed: 20.5 ms p95 against a
  dead sink, dominated by process spawn. That is the number Phase 2 must not
  regress.
- Two things this spike did **not** measure, and Phase 2 must: whether a detached
  child survives host teardown of the session process group, and what the queue
  file's growth bound is when the sink is down for days. Both are transport
  properties, neither is a latency property.

## Reproduction

```bash
SPIKE2_N=100 node spike2_latency.mjs   # scratch-only; script inlined below
```

The script is deliberately not committed — Phase 0's rollback is "spikes are
scratch-only; nothing ships". Its four scenarios are specified in § Method in
enough detail to rebuild, and the transport it exercises is eight lines of
`fetch` with a timeout.
