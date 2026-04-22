# ADR — `/implement-ticket` runtime: Python

> **Status:** Decided · Phase 0 spike closed · 2026-04-22
> **Context:** [`implement-ticket-flow.md`](implement-ticket-flow.md) ·
> [`road-to-implement-ticket.md`](../roadmaps/road-to-implement-ticket.md)
> **Supersedes:** the `Runtime: TBD` placeholder in `implement-ticket-flow.md`.

## Decision

The `/implement-ticket` orchestrator ships on **Python 3.10+** (stdlib + `pyyaml`).

Bash is rejected as the runtime. It stays only where it already lives —
the install driver, compression helper, and test runner — not the
delivery flow.

## Why this was a real question

The repo already ships a Bash install + compression toolchain. A
shell-native dispatcher would have reused the existing muscle memory and
avoided adding Python as a delivery-runtime dependency. The spike
existed to verify whether Bash could still carry the 8-step linear flow
once real orchestration needs showed up (structured state, blocked/partial
outcomes, metrics, tests). Result: not well.

## Spike scope

Both prototypes implement the same shape from
`implement-ticket-flow.md`:

- 8 linear steps (refine → memory → analyze → plan → implement → test →
  verify → report)
- `DeliveryState` as the only thing shared between steps
- Three terminal outcomes: `success`, `blocked`, `partial`
- Metrics JSON line per run (Q38 decision)
- Identical fixtures: one clean ticket, one ambiguous ticket that must
  block at `refine` with three numbered questions

Sources: `spike/implement-ticket/{bash,python}/` (throwaway, branch-only).

## Evidence (measured, not asserted)

### Wall-clock mean (20 runs, 3 warmup, macOS ARM)

| Scenario | Bash | Python | Winner |
|---|---|---|---|
| Clean, all 8 steps | 104 ms | 36 ms | **Python 2.9×** |
| Blocked at step 1  |  60 ms | 35 ms | **Python 1.7×** |

Source: `spike/implement-ticket/bench-results.txt` ·
harness: `spike/implement-ticket/bench.sh`.

Bash cost is dominated by per-step fork/exec (`yq`, `jq`, `perl`, step
script). Every step added extends the Bash gap. Python keeps the whole
dispatch in-process; step count is effectively free.

### Test-writability

| | pytest (Python) | shell asserts (Bash) |
|---|---|---|
| Lines to cover 3 scenarios | 59 | 72 |
| Assert target | typed `state.outcomes`, `state.questions` | stdout string-contains |
| Suite runtime | 0.01 s | ~2.5 s (15 subprocess launches) |
| Test isolation | in-process `dispatch(state)` | fork per assertion |
| IDE affordances | autocomplete, types, stack traces | grep only |

### Error-propagation ergonomics

- **Python:** outcomes flow through typed `StepResult`/`Outcome`
  enums. One `dispatch()` return tuple covers success/blocked/partial.
  Zero string parsing.
- **Bash:** outcomes are encoded in exit codes (0/10/20), propagated
  through `set +e` dances per step, mirrored into a JSON file with
  `jq --arg` round-trips. Every step handler re-reads/rewrites the
  state file. Brittle.

### Source size

Roughly equal (Bash 203 / Python 207 lines), but the Bash total is spread
across 9 files with per-file shebang + `set -euo pipefail` boilerplate;
Python is 3 files with shared types.

## Tradeoffs we accept

- **New hard dependency on Python 3.10+ and `pyyaml`.** Mitigated: Python 3
  is already a build/test dependency of this repo (linters, compression,
  `update_counts.py`). `pyyaml` is already pinned in `pyproject.toml` /
  `requirements-*.txt`. Zero new install surface for contributors.
- **We lose the "just-shell" story.** The install script stays Bash. The
  delivery runtime being Python is a deliberate split: install is
  side-effecting system work, delivery is structured data transformation.
- **Python per-invocation boot is ~35 ms.** Accepted — it's flat, not
  proportional to step count, and well below the user-perception floor.

## Non-goals of this decision

- Does not bless Python for every future spike — each flow decides
  on its own evidence.
- Does not commit to a specific framework (click, typer, bare argparse);
  that is chosen during Phase 1 and kept minimal.
- Does not move the compression/install scripts off Bash.

## Consequences — unblocks

- Phase 1 of `road-to-implement-ticket.md` can start: wire real step
  handlers onto the dispatcher shape spiked here.
- `implement-ticket-flow.md` will have its `Runtime: TBD` line replaced
  with `Runtime: Python 3.10+` when Phase 1 lands.
- Metrics contract (Q38, JSON lines under `agents/logs/implement-ticket/`)
  is already demonstrated by both prototypes.

## Follow-ups (not part of this ADR)

- Promote the spike directory's `bench.sh` into a `task bench-implement-ticket`
  target once real handlers exist, so later optimisation has a baseline.
- Decide CLI framework during Phase 1 (defer — argparse is enough for
  the orchestrator skeleton).
