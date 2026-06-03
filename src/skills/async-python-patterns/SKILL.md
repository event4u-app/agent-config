---
model_tier: medium
name: async-python-patterns
description: "Use when writing Python asyncio code — picking between gather / TaskGroup / wait, structured concurrency, timeouts, cancellation, sync-bridging — decision framework only, cookbook externalized."
domain: engineering
status: active
refresh_trigger: "Python ships a new structured-concurrency primitive (post-TaskGroup), OR ≥30% of cited upstream cookbook examples become deprecated, OR the cited libraries (aiohttp, httpx, anyio, trio) cut a major version with breaking async surface changes."
sunset_criterion: "When `https://docs.python.org/3/library/asyncio.html` ships an in-tree decision framework AND consumer projects no longer cite this skill in PR reviews for two consecutive review cycles."
workspaces:
  - engineering
packs:
  - python
lifecycle: experimental
trust:
  level: professional
install:
  default: false
  removable: true
---

# async-python-patterns

Decision framework for picking the right Python asyncio primitive. **The pattern cookbook lives upstream** (links in § Provenance) — this skill is the predicate, not the recipe library. Sunset-policy compliant: the 600+ lines of language-specific cookbook stay in authoritative Python docs.

## When to use

- Designing a new async I/O-bound service (FastAPI, aiohttp, async DB client).
- Reviewing a diff that introduces `asyncio.gather`, `asyncio.create_task`, `TaskGroup`, `as_completed`, or `wait_for`.
- Mixing sync and async code (calling sync libs from async context, or vice versa).
- Diagnosing event-loop blocking, never-awaited warnings, or cancellation leaks.

Do NOT use when:

- The work is CPU-bound — async will not help; route to multiprocessing or threadpool.
- The runtime is not Python — read the host runtime's concurrency guide.
- The fix is a single missing `await` — read the upstream tutorial directly.

## Decision framework

### Step 1 — Verify async is the right tool

```
Workload is:
  I/O-bound, many concurrent waits  → async fits (network, disk, IPC).
  CPU-bound (parsing, math, crypto) → async is wrong; use ProcessPoolExecutor.
  Mixed                              → async shell + run_in_executor for CPU bursts.
  Single sequential call             → don't introduce async; sync is simpler.
```

### Step 2 — Pick the concurrency primitive

```
Run N independent coroutines, ALL must complete:
  Same trust level, exceptions cancel siblings  → asyncio.TaskGroup (3.11+; preferred).
  Pre-3.11 OR exceptions must NOT cancel peers  → asyncio.gather(*, return_exceptions=...).

Run N coroutines, react to results as they finish:
  → asyncio.as_completed (yields completed futures in finish order).

Run N coroutines, race to first success / failure:
  → asyncio.wait(..., return_when=FIRST_COMPLETED) + cancel pending.

Schedule fire-and-forget background work:
  → asyncio.create_task + keep a strong reference (else GC eats it).
  Forgetting the reference is the #1 silent-failure source.

Bound the wait time:
  → asyncio.wait_for(coro, timeout=...)  → raises TimeoutError on expiry.
  → asyncio.timeout(...) context manager (3.11+; preferred when many awaits share a deadline).

Bound concurrency (rate-limit, connection pool):
  → asyncio.Semaphore(n); acquire around the awaitable.
```

### Step 3 — Bridge sync ↔ async correctly

```
Async code calls sync, blocking, function:
  Short pure-CPU              → fine, accept the block (microseconds).
  Long, blocking, or I/O-sync → await loop.run_in_executor(None, fn, *args).
  Library has async sibling   → switch the library (httpx vs requests, aiosqlite vs sqlite3).

Sync code calls async function:
  Top-level entrypoint        → asyncio.run(coro()).
  Inside running loop         → never asyncio.run; create_task + await it.
  Test suite                  → pytest-asyncio fixture; never raw run() in tests.
```

### Step 4 — Cancellation discipline

Every long-running coroutine MUST be cancellation-safe:

- Catch `asyncio.CancelledError`, perform cleanup, **re-raise**. Swallowing it silently breaks the propagation chain.
- Use `try / finally` (or `async with`) around resource acquisition so cancellation cannot leak file handles, DB connections, locks.
- Detached `create_task` without a strong reference is undefined behavior; either store the task or use a TaskGroup.

### Step 5 — Don't block the event loop

A single blocking call (sync I/O, time.sleep, CPU-heavy parse, large JSON load) freezes every coroutine. Audit every leaf function under `async def`:

- Sleep → `await asyncio.sleep`, never `time.sleep`.
- HTTP → `httpx.AsyncClient` / `aiohttp`, never `requests`.
- DB → `asyncpg` / `aiosqlite` / `motor`, never the sync driver.
- File → `aiofiles` for hot-paths, or `run_in_executor` for one-shots.

## Procedure: Apply to a new async feature

1. Inspect the existing call graph and identify each `await` site, sync↔async boundary, and any blocking leaf calls before touching code.
2. Run Step 1; reject if work is CPU-bound.
3. Sketch the call graph; tag each `await` site with its primitive (Step 2).
4. Mark every sync↔async boundary; pick the bridge per Step 3.
5. For each long-running coroutine, write the cancel-safety contract (Step 4).
6. Grep the leaf calls for blocking sins (Step 5); replace or push to executor.
7. Hand the sketch to a reviewer **before** coding; cite this skill.

## Output format

1. Call-graph table: coroutine · concurrency primitive · timeout · cancel-safety note.
2. Sync↔async boundary list: site · bridge · justification.
3. Blocking-call audit: leaf function · status (async / executor / accepted-block + reason).
4. Cancel-safety contract for each background task.

## Gotcha

- "It works in my REPL" — `asyncio.run` inside an already-running loop (Jupyter, FastAPI startup) raises `RuntimeError`. Use `await` directly or `nest_asyncio` (last resort).
- `asyncio.gather` swallows the second exception silently; use `return_exceptions=True` and inspect, or use `TaskGroup` (cancels all on first error, surfaces the group).
- `create_task` results that nobody awaits look fine until the program exits and Python prints `Task was destroyed but it is pending!`. Always `await` or use a TaskGroup.
- `wait_for` on a non-cancellation-safe coroutine leaks resources; the timeout cancels the task but cleanup never runs.
- Libraries that "support async" via thread pools (e.g. `requests-async`) often re-block the loop under load; verify with the cited upstream library docs, not the README.

## Do NOT

- Do NOT call `asyncio.run` from a running loop.
- Do NOT swallow `CancelledError` without re-raising.
- Do NOT call sync blocking I/O from async paths without `run_in_executor`.
- Do NOT spawn `create_task` without storing the reference (or using TaskGroup).
- Do NOT inline the asyncio cookbook into this skill — externalize per Sunset Policy.

## Auto-trigger keywords

- asyncio
- async / await
- gather / TaskGroup / wait_for
- event loop blocking
- cancellation
- sync to async bridge

## Provenance

- Adopted from: `Microck/ordinary-claude-skills@8f5c83174f7aa683b4ddc7433150471983b93131:skills_all/async-python-patterns/SKILL.md` (MIT, © 2025 Microck) — **Sunset Policy applied**: 694-line cookbook source reduced to a ~140-line decision framework; pattern catalogues externalized to upstream docs below.
- Externalized cookbook:
  - asyncio core: https://docs.python.org/3/library/asyncio.html · https://docs.python.org/3/library/asyncio-task.html
  - TaskGroup (3.11+): https://docs.python.org/3/library/asyncio-task.html#task-groups
  - Structured concurrency: https://anyio.readthedocs.io · https://trio.readthedocs.io
  - Async HTTP: https://www.python-httpx.org/async/ · https://docs.aiohttp.org/en/stable/
  - Async DB: https://magicstack.github.io/asyncpg/ · https://aiosqlite.omnilib.dev/
- Cross-linked: [`error-handling-patterns`](../error-handling-patterns/SKILL.md), [`mcp-builder`](../mcp-builder/SKILL.md), [`api-design`](../api-design/SKILL.md), [`performance`](../performance/SKILL.md).
- Provenance registry: `agents/settings/contexts/skills-provenance.yml` (entry: `async-python-patterns`).
- Iron-Law floor: `verify-before-complete`, `skill-quality`, `non-destructive-by-default`.
