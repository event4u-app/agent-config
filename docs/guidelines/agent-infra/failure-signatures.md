# Failure signatures — symptom → likely cause → first check

A file-first lookup the [`systematic-debugging`](../../../src/skills/systematic-debugging/SKILL.md)
skill reads when a failure shows a recognisable signature. It does **not**
replace the 6-phase loop — it shortcuts **Phase 2 (Isolate)** by pointing at the
*first* check for a known shape, so you stop guessing and start with the highest-
probability cause.

> File-first by design (council 2026-06-15): kept as a reference table the skill
> reads, **not** hardcoded into the skill body — so it grows without bloating the
> always-loaded skill and stays one edit away from current.

## Lookup

| Signature (what you see) | Likely cause | First check |
|---|---|---|
| **Tool/agent loop** — same tool called >2× with near-identical args, no progress | Missing stop condition; reading without acting; ambiguous state | Stop. State the hypothesis in one line. Act or ask — do not re-read. (`context-hygiene` 15/25 rule) |
| **HTTP 429 / "rate limit" / "quota"** | Too-frequent calls; shared quota; missing backoff | Inspect response headers (`Retry-After`, `X-RateLimit-*`); add exponential backoff; check if a loop is firing the calls |
| **`ECONNREFUSED` / connection refused** | Service not up; wrong host/port; container not started | Is the service running? (`docker compose ps`, health endpoint); is the port right? (`lsof -i :PORT`); is it bound to `127.0.0.1` vs `0.0.0.0`? |
| **`ENOENT` / "no such file or directory"** | Wrong cwd; path relative vs absolute; file not generated yet | Print the *resolved absolute* path; check cwd; confirm a prior step actually wrote the file |
| **Timeout / hang** | Blocking I/O; deadlock; awaiting a condition that never holds | What is it waiting on? Add a log right before the blocking call; bound the wait; check for a missing `await`/`return` |
| **`OOM` / killed (137) / heap out of memory** | Unbounded collection; loading all rows; leak in a loop | What grows per iteration? Stream/paginate instead of loading all; check `--max-old-space-size` only after finding the growth |
| **`EACCES` / permission denied** | Wrong file mode; running as wrong user; read-only mount | `ls -l` the target; check the process user; is the path a read-only volume? |
| **Flaky test (passes alone, fails in suite)** | Shared state; order dependence; real clock/random; unawaited async | Run the test in isolation vs in suite; look for shared fixtures, global state, `Date.now()`/random, missing `await` |
| **Works locally, fails in CI** | Env/config drift; missing service; absent secret; path/case sensitivity | Diff env (`printenv`); is the service/secret present in CI? Linux is case-sensitive — check filename casing |
| **Intermittent / "sometimes"** | Race; timing; network; non-deterministic order | Reproduce with condition-based waiting, not fixed sleeps (`systematic-debugging` § Condition-based waiting); log timestamps |

## How to use

1. Match the symptom to a signature above.
2. Run the **first check** — it is the highest-probability isolation step, not a fix.
3. If it confirms the cause → fix + add a regression test. If not → fall back to
   the full `systematic-debugging` loop from Phase 1.

No signature matches → this table earned nothing; debug from first principles.
