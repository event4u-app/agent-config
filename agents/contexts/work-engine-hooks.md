# Work-engine hooks

> Phase 7 deliverable for [`road-to-work-engine-hooks.md`](../roadmaps/road-to-work-engine-hooks.md).
> Locks in the lifecycle hook surface that the `work_engine` exposes
> across `cli.main()` and `dispatcher.dispatch()`. Hooks are the
> structural alternative to cooperative agent rules: when the engine
> drives the turn (`/work`, `/implement-ticket`), boundary work
> (chat-history append, halt surfacing, state validation) becomes a
> property of the engine, not of agent discipline. Free-form chat
> turns stay on the cooperative path documented by
> [`chat-history-platform-hooks.md`](chat-history-platform-hooks.md).
>
> Last refreshed: 2026-05-01.

## What hooks are

A hook is a callback the engine fires at a fixed lifecycle event.
The engine owns the call site; hooks observe (and may halt) but
never replace step logic. The split is deliberate — the dispatcher
remains a linear walker over `STEP_ORDER`, and cross-cutting
concerns (telemetry, validation, persistence) plug in at the edges
without growing the dispatcher's surface.

Three guarantees the layer enforces:

- **Insertion-ordered.** Callbacks fire in registration order. No
  priorities, no implicit reorder.
- **Single emit point.** [`HookRunner.emit`](../../.agent-src.uncompressed/templates/scripts/work_engine/hooks/runner.py)
  is the only path; `dispatcher.py` and `cli.py` carry no hook
  bookkeeping.
- **Default-off.** Master switch `hooks.enabled` defaults to
  `False`. A missing settings file, a missing block, or
  `--no-hooks` on the CLI all yield an empty registry — golden
  replay is byte-stable by construction.

## Strategy taxonomy

The chat-history platform hooks document classifies external agent
platforms (Claude Code, Cursor, …) by surface. The work-engine
hook layer adds a third path that runs **inside** our own engine
regardless of platform:

- **HOOK** — platform fires a lifecycle event; the wrapper runs
  `chat_history.py append`. Crash-safe, agent-free.
- **CHECKPOINT** — agent invokes `/chat-history-checkpoint` at
  phase boundaries. Cooperative.
- **ENGINE** — the work-engine fires its own `before_*` /
  `after_*` events around `dispatch()` and registered hooks
  (see [`builtin/`](../../.agent-src.uncompressed/templates/scripts/work_engine/hooks/builtin/))
  perform the boundary work. Active only while the engine is
  running; outside that window, control falls back to the
  platform's HOOK or CHECKPOINT path.

ENGINE is what this document specifies. It does not replace HOOK
or CHECKPOINT — it complements them by structurally guaranteeing
the engine-driven slice of any session.

## Two layers, ten events

The CLI loads a `WorkState` (v1 envelope), projects it into a
legacy `DeliveryState`, runs `dispatch()`, and mirrors mutations
back. The hook surface follows that boundary:

### Dispatcher layer — operates on `DeliveryState`

| Event | Fires | Context fields |
|---|---|---|
| `before_step` | Before each `handler(state)` call | `step_name`, `delivery` |
| `after_step` | After `handler(state)` returns, before outcome branching | `step_name`, `delivery`, `result` |
| `on_halt` | When `result.outcome` is `BLOCKED` or `PARTIAL`, before return | `step_name`, `delivery`, `result` (may be `None` for hook-driven halts) |
| `on_error` | When `handler` raises (exception then re-raised) | `step_name`, `delivery`, `exception` |

### CLI layer — operates on `WorkState`

| Event | Fires | Context fields |
|---|---|---|
| `before_load` | Before `_load_or_build()` | `state_file`, `args` |
| `after_load` | After load, before delivery projection | `state_file`, `work`, `fmt`, `args` |
| `before_dispatch` | After `_to_delivery()`, before `dispatch()` | `work`, `delivery`, `set_name`, `args` |
| `after_dispatch` | After `dispatch()`, before `_sync_back()` | `work`, `delivery`, `final`, `halting`, `args` |
| `before_save` | After `_sync_back()`, before `_save()` | `work`, `delivery`, `fmt`, `args` |
| `after_save` | After `_save()`, before `_emit()` | `work`, `state_file`, `fmt`, `args` |

There is no `on_cli_error`. Argparse and IO errors return exit 2
before any state has loaded; there is no useful state to hand a
hook. Add the event when a real consumer needs it.

## Three-tier error contract

Defined in
[`exceptions.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/hooks/exceptions.py)
and enforced by `HookRunner.emit`:

| Class | Semantics | Runner action |
|---|---|---|
| `HookError` | Non-fatal — hook implementation failed, work continues | Caught, `warnings.warn(...)`, next callback fires |
| `HookHalt` | Fatal-controlled — hook demands a clean stop (e.g. chat-history `turn-check` foreign session) | Caught, **returned** to caller; CLI converts to readable surface + exit 2; dispatcher converts to `Outcome.BLOCKED` |
| any other `Exception` | Fatal-uncontrolled — bug in the hook | Re-raised verbatim, dispatch unwinds |

`HookHalt` carries `reason` (machine-readable code, never shown to
the user) and `surface` (pre-formatted numbered options per the
`user-interaction` rule, rendered verbatim).

`on_halt` and `on_error` are observe-only by contract: a
`HookHalt` raised from inside `on_halt` would create a
halt-of-a-halt loop; the runner returns it but the dispatcher
deliberately ignores it — the surface is already populated.

## Halt branch table (CLI layer)

Every CLI-layer halt yields exit code `2`. State persistence
depends on **where** the halt fires:

| Halt fires at | State file written? | Exit |
|---|---|---|
| `before_load` / `after_load` / `before_dispatch` / `after_dispatch` / `before_save` | No — `_save()` not yet reached | 2 |
| `after_save` | Yes — `_save()` already ran; surface is rendered, exit still 2 | 2 |

The single source for the surface is
[`cli._emit_halt`](../../.agent-src.uncompressed/templates/scripts/work_engine/cli.py).
Format: each line of `halt.surface` to stderr verbatim; if
empty, fall back to `halt: <reason>`.

## Built-in hooks

Eight hooks ship under
[`hooks/builtin/`](../../.agent-src.uncompressed/templates/scripts/work_engine/hooks/builtin/).
Each exposes a `register(registry)` method so the registry stays
the single source of truth for event → callback wiring. None mutate
engine state; failures surface as `HookError` (non-fatal).

| Hook | Layer | Registers on | Purpose |
|---|---|---|---|
| `TraceHook` | Both | every event | One stderr line per event for debugging dispatch flow |
| `HaltSurfaceAuditHook` | Dispatcher | `on_halt` | Defense-in-depth: every halt must carry a non-empty surface |
| `StateShapeValidationHook` | CLI | `after_load`, `before_save` | Re-runs the schema validator; catches drift between memory and disk |
| `DirectiveSetGuardHook` | CLI | `before_dispatch` | Verifies `set_name` matches the input envelope's intent |
| `ChatHistoryTurnCheckHook` | CLI | `before_load` | Runs `chat_history.py turn-check`; halts on `foreign` / `returning` |
| `ChatHistoryAppendHook` | Dispatcher | `after_step` | Appends one phase entry per successful step at the configured cadence |
| `ChatHistoryHaltAppendHook` | Both | `on_halt`, `after_dispatch` | Appends a halt entry so the log reflects user-visible boundaries |
| `ChatHistoryHeartbeatHook` | CLI | `after_save` | Emits the chat-history heartbeat so the marker reflects fresh counts |

## Configuration

The `hooks:` block in `.agent-settings.yml` controls registration.
Schema (defaults shown):

```yaml
hooks:
  enabled: false               # master switch — false → empty registry
  trace: false                 # TraceHook (noisy, off by default)
  halt_surface_audit: true
  state_shape_validation: true
  directive_set_guard: true
  chat_history:
    enabled: true              # AND-gated with global chat_history.enabled
    # script: scripts/chat_history.py  # optional override
```

Loaded by
[`hooks/settings.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/hooks/settings.py)
into a frozen `HookSettings`. Defaults are permissive: a missing
file or missing block returns `enabled=False`. Malformed YAML is
treated as missing (silent degrade) rather than crashing the CLI.

The chat-history block is **double-gated**: the per-hook
`hooks.chat_history.enabled` AND the global `chat_history.enabled`
must both be `true` for the four chat-history hooks to register.
Either off → cooperative CHECKPOINT path takes over for that
session.

CLI flags:

- `--no-hooks` — force an empty registry regardless of settings.
  The escape hatch every golden-replay test harness uses.
- `--hooks-config PATH` — override the settings file path. Used by
  fixtures and tests to inject a known configuration.

## Registration model

```python
runner = HookRunner(_build_hook_registry(args))
final, halting = dispatch(delivery, steps, hooks=runner)
```

One registry per `cli.main()` invocation. The same `HookRunner`
threads through `dispatch(hooks=runner)` so dispatcher events and
CLI events share the registered callback set.

`HookRegistry.register(event, callback)` is additive; multiple
callbacks for the same event are allowed and fire in registration
order. `HookRegistry.for_event(event)` returns a tuple — empty when
nothing is registered, which `HookRunner.emit` short-circuits so
the hot path stays branch-light.

`dispatch(state, steps, hooks=None)` keeps existing call sites
working: when `hooks` is `None` the dispatcher falls back to a
shared `_NOOP_RUNNER` (empty registry) so hook bookkeeping stays
uniform without per-emit `if hooks is None` branches.

## Open questions (tracked, not blocking)

1. **Hook ordering across consumers.** P1 ships insertion-order
   only. If a real ordering need surfaces (e.g. trace must fire
   before mutation hooks), add a priority field as a follow-up —
   do not pre-build it.
2. **Async hooks.** Every callback is synchronous today. A future
   telemetry sink that warrants `async def` would need a runner
   variant; defer until a concrete consumer asks for it.
3. **Hookable scripts beyond the engine.** `scripts/compress.py`,
   `scripts/install.py`, and the linters could host the same
   primitives. Deferred until the engine has hardened the API and
   a real consumer requests it; no roadmap entry yet.
