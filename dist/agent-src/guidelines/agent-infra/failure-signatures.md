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

| ID | Signature (what you see) | Likely cause | First check |
|---|---|---|---|
| `tool-loop` | **Tool/agent loop** — same tool called >2× with near-identical args, no progress | Missing stop condition; reading without acting; ambiguous state | Stop. State the hypothesis in one line. Act or ask — do not re-read. (`context-hygiene` 15/25 rule) |
| `rate-limited` | **HTTP 429 / "rate limit" / "quota"** | Too-frequent calls; shared quota; missing backoff | Inspect response headers (`Retry-After`, `X-RateLimit-*`); add exponential backoff; check if a loop is firing the calls |
| `connection-refused` | **`ECONNREFUSED` / connection refused** | Service not up; wrong host/port; container not started | Is the service running? (`docker compose ps`, health endpoint); is the port right? (`lsof -i :PORT`); is it bound to `127.0.0.1` vs `0.0.0.0`? |
| `path-not-found` | **`ENOENT` / "no such file or directory"** | Wrong cwd; path relative vs absolute; file not generated yet | Print the *resolved absolute* path; check cwd; confirm a prior step actually wrote the file |
| `hang` | **Timeout / hang** | Blocking I/O; deadlock; awaiting a condition that never holds | What is it waiting on? Add a log right before the blocking call; bound the wait; check for a missing `await`/`return` |
| `out-of-memory` | **`OOM` / killed (137) / heap out of memory** | Unbounded collection; loading all rows; leak in a loop | What grows per iteration? Stream/paginate instead of loading all; check `--max-old-space-size` only after finding the growth |
| `permission-denied` | **`EACCES` / permission denied** | Wrong file mode; running as wrong user; read-only mount | `ls -l` the target; check the process user; is the path a read-only volume? |
| `order-dependent-test` | **Flaky test (passes alone, fails in suite)** | Shared state; order dependence; real clock/random; unawaited async | Run the test in isolation vs in suite; look for shared fixtures, global state, `Date.now()`/random, missing `await` |
| `local-ci-drift` | **Works locally, fails in CI** | Env/config drift; missing service; absent secret; path/case sensitivity | Diff env (`printenv`); is the service/secret present in CI? Linux is case-sensitive — check filename casing |
| `race` | **Intermittent / "sometimes"** | Race; timing; network; non-deterministic order | Reproduce with condition-based waiting, not fixed sleeps (`systematic-debugging` § Condition-based waiting); log timestamps |
| `stale-capability-claim` | **Budget exhausted plus repeated attempts at a tool that is not available** | A capability the session claimed for itself instead of resolving — the council, a hook slot, a subagent primitive, an MCP server assumed present | Ask the live verb, not the tree: `agent-config hooks:status` for slot bindings, `agent-config routing:doctor` for per-field capability **provenance** (`registry` / `live-probe` / `default`), `agent-config council:status` for council availability. A `false` from `default` records that nobody answered, not that the host cannot |

### Naming convention for IDs

An id is a short kebab handle so a signature can be **cited by name** — the
first column was prose, so nothing could reference a row.

One rule governs new ids: **where a row's signature is a stable string the
tooling already prints, the id is that string verbatim** rather than a kebab
synonym. `skill_linter.ts` emits a closed set of `Issue` codes —
`missing_section`, `missing_conditional_section`, `invalid_execution_handler` —
and a row about one of those is looked up by the code the reader just saw in the
output. No current row is of that class; the convention is stated for the next
one, so the table does not accumulate two names for the same failure.

## Discrimination drills

A row's "first check" is only worth following if the documented signature is what
actually appears. Each drill breaks the named layer and asserts the documented
symptom — run it once when you doubt a row, or when adding one. They are text a
human runs; nothing here is a CI gate.

| ID | Drill — break this, expect that |
|---|---|
| `tool-loop` | Ask for a fact that is genuinely absent from the tree (a config key nothing defines). Expect repeated searches with shrinking variation and no edit — that shape, not an error message, is the signature. |
| `rate-limited` | Fire the provider's own rate limit with a tight loop against a cheap endpoint. Expect `429` **plus** `Retry-After`; a `429` with no such header is a different failure (a gateway, not the API). |
| `connection-refused` | Stop the service and call it (`docker compose stop <svc>`). Expect `ECONNREFUSED` immediately. If it hangs instead, the host resolves but nothing listens — that is `hang`, not this row. |
| `path-not-found` | Run a path-taking script from a different cwd. Expect `ENOENT` naming a path that is *almost* right — the near-miss is the tell that the path is relative, not missing. |
| `hang` | `await` a promise nothing resolves. Expect no output and no exit, distinguishable from `race` by being 100% reproducible. |
| `out-of-memory` | Accumulate rows in an array inside a loop over a large fixture. Expect the heap message and exit 137 — and note that the reported line is where allocation failed, not where the growth is. |
| `permission-denied` | `chmod 000` a fixture and read it. Expect `EACCES`, not `ENOENT` — confusing the two sends you looking for a missing file that is right there. |
| `order-dependent-test` | Add a module-level mutable to two tests in one file. Expect green alone, red in suite. Reversing the file order should move the failure — if it does not, the cause is shared *external* state, not order. |
| `local-ci-drift` | Rename a fixture's casing (`Foo.ts` → `foo.ts`) and import the old name. Expect green on macOS, red on Linux CI. The generalisation: anything the local filesystem is lenient about. |
| `race` | Replace a condition-based wait with a fixed `sleep` shorter than the operation. Expect intermittent failure whose rate moves with machine load — load-sensitivity is what separates this from `order-dependent-test`. |
| `stale-capability-claim` | Assert a capability without asking for it, then compare against the live verb. `agent-config routing:doctor` prints provenance per field; a field whose provenance is `default` was never established by anything — which is exactly the state a confident self-claim is indistinguishable from. |

## How to use

1. Match the symptom to a signature above.
2. Run the **first check** — it is the highest-probability isolation step, not a fix.
3. If it confirms the cause → fix + add a regression test. If not → fall back to
   the full `systematic-debugging` loop from Phase 1.

No signature matches → this table earned nothing; debug from first principles.
