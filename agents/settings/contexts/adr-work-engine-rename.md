# ADR — Universal Execution Engine: rename `implement_ticket` → `work_engine`

> **Status:** Decided · R1 Phase 3 shipped · 2026-04-28
> **Context:** [`implement-ticket-flow.md`](implement-ticket-flow.md) ·
> [`road-to-universal-execution-engine.md`](../roadmaps/road-to-universal-execution-engine.md)
> **Supersedes:** the `implement_ticket`-named runtime decision in
> [`adr-implement-ticket-runtime.md`](adr-implement-ticket-runtime.md).
> The runtime choice (Python 3.10+) is unchanged; only the module
> name and state-file shape changed.

## Decision

The orchestrator module is renamed **`implement_ticket` → `work_engine`**.

- Canonical module: `<scripts>/work_engine/` (dispatcher, directives,
  state, migration, persona policy).
- Compatibility shim: `<scripts>/implement_ticket/` re-exports the
  public surface and emits `DeprecationWarning` on import.
- State file: `.implement-ticket-state.json` → `.work-state.json`,
  with one-shot v0 → v1 auto-migration.
- CLI surface: `./agent-config implement-ticket` and the `/implement-ticket`
  slash command are **unchanged** — both stay byte-stable, gated by the
  Golden-Transcript replay harness (Phase 6).

## Why this was a real question

The original name pinned the engine to one entrypoint. R2 (prompt-driven
execution) and R3 (UI / mixed directive sets) are explicitly designed to
land on the same dispatcher with different `input.kind` envelopes. A
ticket-shaped module name would have forced every future entrypoint to
brand itself as "ticket" — or, worse, would have spawned three
near-duplicate dispatchers. The rename turns the dispatcher into a
universal substrate before R2/R3 build on top of it.

A weaker option — keep `implement_ticket/` as the module and only widen
its surface — was rejected: every R2/R3 reference would have read as if
they were ticket-bound, and external consumers reading `from
implement_ticket import dispatcher` for prompt-driven work would have to
learn that the name lies.

## Scope of the rename

| Surface | Before | After |
|---|---|---|
| Module path | `<scripts>/implement_ticket/` | `<scripts>/work_engine/` |
| Public Python imports | `from implement_ticket import …` | `from work_engine import …` |
| State filename | `.implement-ticket-state.json` | `.work-state.json` |
| State schema | implicit v0 | explicit `version: 1` envelope |
| CLI entrypoint | `./agent-config implement-ticket` | unchanged |
| Slash command | `/implement-ticket` | unchanged |
| Subcommand syntax | `implement-ticket <ticket>` | unchanged |

The CLI and slash command are part of the public contract pinned by the
Golden-Transcript freeze-guard. The Python module name is internal.

## Compatibility shim

`<scripts>/implement_ticket/__init__.py` re-exports the public surface
of `work_engine`, registers submodule aliases for legacy import paths
(`from implement_ticket.steps.plan import …`), and emits one
`DeprecationWarning` on first import:

```
implement_ticket has moved to work_engine; importing implement_ticket
is deprecated and will be removed in a future release. Update imports
to `from work_engine import …`.
```

The `./agent-config implement-ticket` CLI path bypasses the warning —
it routes through the dispatcher directly so the Golden-Transcript
contract stays clean. The warning is for **Python consumers** only.

Removal of the shim is a separate, user-driven decision. This ADR
deliberately does **not** pin a release, deprecation date, or removal
milestone — release planning is decided outside roadmaps and ADRs (see
[`scope-control`](../../.agent-src/rules/scope-control.md#git-operations--permission-gated)).

## State migration (v0 → v1)

Implemented at `<scripts>/work_engine/migration/v0_to_v1.py`. Behavior:

- Reads a v0 file (`.implement-ticket-state.json`), wraps the flat
  `ticket` payload under `input.kind="ticket"` / `input.data`, adds
  `intent`, `directive_set`, and `version: 1`.
- Writes the canonical v1 file (`.work-state.json`) next to the v0
  source.
- Renames the v0 file to `.implement-ticket-state.json.bak` for
  rollback.
- **Idempotent:** running `migrate_payload` on an already-v1 payload
  returns it unchanged.
- **Refuses to overwrite:** `migrate_file` raises if the v1 destination
  already exists, rather than silently replacing it.
- Rejects payloads with a higher version, missing tickets, or invalid
  JSON — all with structured `SchemaError`.

Importable and runnable: `python3 -m work_engine.migration.v0_to_v1
.implement-ticket-state.json`.

## Golden-Transcript contract

The rename was protected by the freeze-guard captured in Phase 1 and
enforced by the replay harness wired in Phase 6:

- 5 live transcripts (`tests/golden/baseline/GT-{1..5}/`) captured
  against the unmodified `implement_ticket/` engine **before** any
  refactor commit.
- `tests/golden/CHECKSUMS.txt` pins every baseline file by SHA-256.
- `task golden-replay` (named CI step) replays all 5 transcripts
  against the live engine on every PR.
- Strict-Verb gate: exit codes, state-file structure, halt-marker
  shape, and delivery-report headings are byte/structurally locked.
  Free-text wording in `questions` and `report` may drift.
- Refresh policy is PR-gated with explicit reviewer sign-off — see
  [`implement-ticket-flow.md`](implement-ticket-flow.md) "Replay
  protocol — Strict-Verb comparison".

The freeze-guard caught zero behavioural regressions across the
refactor window (Phases 3–6); replay stays 5/5 green on `HEAD`.

## Tradeoffs accepted

- **Two module names co-exist** while the shim lives. Mitigated by
  `check_references.py` in CI and the `DeprecationWarning` on every
  import.
- **One-time per-state-file migration** on first run. Mitigated by the
  `.bak` preservation and the idempotent migration helper.
- **Internal Python consumers** (very few — mostly tests under
  `tests/implement_ticket/`) need a search-and-replace at their own
  pace. The shim absorbs the gap.

## Non-goals

- Does **not** change the `/implement-ticket` slash command or the CLI
  invocation — both remain the public surface.
- Does **not** introduce `/do`, prompt-driven entrypoints, or UI
  directives — those land in R2 / R3.
- Does **not** pin a removal release or deprecation date for the shim.

## Consequences — unblocks

- **R2** (`road-to-prompt-driven-execution.md`) can land
  `input.kind="prompt"` and the prompt resolver inside the existing
  `work_engine` namespace without renaming.
- **R3** (`road-to-product-ui-track.md`) can fill `directives/ui/` and
  `directives/mixed/` against the universal dispatcher.
- Future entrypoints (`/do`, design-review polish loops) compose on
  top of `work_engine` directly — no third dispatcher.

## Follow-ups (not part of this ADR)

- Internal callers still importing from `implement_ticket` migrate
  opportunistically (search/replace).
- Shim removal — separate user decision when the deprecation noise on
  internal imports has been quiet for long enough; no fixed horizon.
