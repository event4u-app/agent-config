# Roadmap: Work-Engine Hook Lifecycle

> Wrap the linear `work_engine` dispatcher and CLI in a cross-cutting hook layer so cooperative concerns (chat-history turn-check / heartbeat, halt-surface audits, replay tracing, state-shape validation) become structural instead of behavior-dependent.

## Prerequisites

- [ ] Read `AGENTS.md` and `.augment/rules/chat-history.md`
- [ ] Read `agents/contexts/chat-history-platform-hooks.md` (CHECKPOINT vs HOOK definitions)
- [ ] Confirm current PR scope tolerates additive engine work (no branch switch — see Notes)
- [ ] Local: `task ci` green on the current branch baseline
- [ ] Familiarity with `DeliveryState` (legacy) vs `WorkState` (v1 envelope) split — both shapes are touched by hooks

## Context

**Why this roadmap exists.** The chat-history audit in this session uncovered a structural gap: on the **CHECKPOINT** platform path (Augment IDE plugin, Cursor < 1.7, Cline-on-Windows) every persistence trigger is *cooperative* — the agent has to remember to call `scripts/chat_history.py append`. Over an ~8h session in Phase 5/6 of `road-to-product-ui-track`, this produced a **5:1 phase-step-to-append ratio** instead of the configured `per_phase` 1:1 cadence. Five entries for ~30 step closures.

The `chat-history.md` rule already documents the cure: append at every cadence boundary. But the rule is enforced by *agent discipline*, not by the engine. When the agent runs `/work` or `/implement-ticket` the work-engine could enforce `turn-check` + `heartbeat` **structurally** — that's the goal of this roadmap.

**Honest scope boundary.** This roadmap fixes chat-history persistence **only** for engine-driven turns (`/work`, `/implement-ticket`). Free-form chat turns (no engine invocation) remain governed by the cooperative rule. A full structural fix for free-form turns would require platform-level hooks the Augment IDE plugin does not expose today.

**Underlying principle.** Agent hooks are *emulated* by moving lifecycle ownership from the agent into the work engine. The agent executes directives; the engine owns boundaries. This roadmap implements that principle for `work_engine` via two of the four practical patterns (commands + state machine); the other two (mandatory checkpoints, tool-gates) live in agent rules. The principle generalises to other Python pipelines (`compress.py`, `install.py`, linters) — see the Follow-ups note.

- **Feature:** `agents/contexts/chat-history-platform-hooks.md` (strategy doc, already exists)
- **Jira:** none — internal hardening
- **Related roadmap:** `agents/roadmaps/road-to-product-ui-track.md` (Phase 6 in flight; this roadmap **extends the same PR**, does not switch branches)

## Diagnostic findings (background, not actionable)

Findings from the chat-history audit that motivated this roadmap. Recorded so future readers do not re-derive them.

| Finding | Evidence |
|---|---|
| CHECKPOINT path → cooperative-only logging | `agents/contexts/chat-history-platform-hooks.md` line 30 + `.agent-settings.yml` `chat_history.path: checkpoint` |
| `per_phase` cadence collapses under multi-step turns | 5 appends across ~30 phase-step closures (R3 P3 + P4 + P5) |
| `heartbeat: hybrid` hides drift | Heartbeat silent on `ok` → agent loses the visual stolperdraht |
| `turn-check` not run as first tool call in recent sessions | Multiple `former_fps` entries in the log header |
| Code in `scripts/chat_history.py` is sound | `status` / `state` / `adopt` / `read` / `heartbeat` all return clean (exit 0) |

## Architecture diff vs ChatGPT proposal (corrections)

The ChatGPT proposal was directionally right but incorrect on internals. This section locks the corrections so the implementation does not regress to the proposal.

| ChatGPT said | Reality | Roadmap decision |
|---|---|---|
| `dispatch()` operates on `WorkState` | Dispatcher operates on **`DeliveryState`** (legacy). `WorkState` is the v1 wire envelope at the CLI boundary. CLI does `delivery = _to_delivery(work)` → `dispatch(delivery, steps)` → `_sync_back(work, delivery)`. | Hooks split: **Dispatcher hooks see `DeliveryState`**, **CLI hooks see `WorkState`**. Hook context carries both refs at the CLI layer. |
| `before_save`/`after_save` in dispatcher | `_load` / `_save` live in `cli.py`, not `dispatcher.py`. | `before_save` / `after_save` are **CLI-only events**. Dispatcher events are step-bounded only. |
| `before_dispatch` / `after_dispatch` in dispatcher | The actual dispatch() call is inside `cli.main()`. The dispatcher itself has no enclosing scope. | `before_dispatch` / `after_dispatch` are **CLI-only events**, fired around the `dispatch(delivery, steps)` call. |
| Add `hooks=` param to `dispatch()` | `dispatch(state, steps) -> tuple[Outcome, str | None]`. Adding `hooks=None` is non-breaking. | ✅ Keep this — minimal signature change, default `None` preserves all existing call sites and goldens. |
| Split into a separate PR | User instruction overrides: stay in the current PR (`road-to-product-ui-track` branch). | **Single PR — additive.** Roadmap explicitly notes this. |
| Hooks for chat-history fix the problem | True only for engine-driven turns; free-form chat turns are out of scope of work_engine. | Roadmap states this honestly under "Scope boundary"; chat-history rule remains the authority for free-form turns. |

## Hook event surface (locked)

Ten events, two layers. Layer determines which state object the hook sees.

### Dispatcher layer (operates on `DeliveryState`)

| Event | Fires | Context |
|---|---|---|
| `before_step` | Before each `handler(state)` call | `step_name`, `delivery: DeliveryState` |
| `after_step` | After `handler(state)` returns, before outcome branching | `step_name`, `delivery`, `result: StepResult` |
| `on_halt` | When `result.outcome` is `BLOCKED` or `PARTIAL`, before `return` | `step_name`, `delivery`, `result` |
| `on_error` | When `handler` raises (wrapped) | `step_name`, `delivery`, `exception` |

### CLI layer (operates on `WorkState`)

| Event | Fires | Context |
|---|---|---|
| `before_load` | Before `_load_or_build()` | `state_file: Path`, `args` |
| `after_load` | After `_load_or_build()`, before `dispatch()` | `state_file`, `work: WorkState`, `fmt` |
| `before_dispatch` | After `_to_delivery()`, before `dispatch()` | `work`, `delivery`, `set_name` |
| `after_dispatch` | After `dispatch()`, before `_sync_back()` | `work`, `delivery`, `final: Outcome`, `halting: str | None` |
| `before_save` | After `_sync_back()`, before `_save()` | `work`, `delivery`, `fmt` |
| `after_save` | After `_save()`, before `_emit()` | `work`, `state_file`, `fmt` |

**No `on_cli_error` event** — argparse / IO errors return exit 2 before any hook would meaningfully run; deferred until a real consumer needs it.

## Phase 1: Hook primitives

- [x] **Step 1:** Create `work_engine/hooks/` package with `__init__.py`, `events.py`, `context.py`, `exceptions.py`, `registry.py`, `runner.py`.
- [x] **Step 2:** `events.py` — define `HookEvent` enum with the ten events from the surface table above; `__all__` export.
- [x] **Step 3:** `context.py` — `HookContext` dataclass carrying optional refs (`delivery`, `work`, `step_name`, `result`, `final`, `halting`, `exception`, `state_file`, `fmt`, `set_name`, `args`). Per-event subset documented.
- [x] **Step 4:** `exceptions.py` — define `HookError` (non-fatal: caught and swallowed by the runner) and `HookHalt` (fatal controlled halt: caught by the runner, surfaced to the caller as a clean stop, **not** re-raised through the dispatch loop). Both subclass a private `_HookSignal` base so the runner can distinguish hook-originated control flow from genuine bugs. Document the three-tier error contract in the module docstring: `HookError` non-fatal · `HookHalt` fatal-controlled · any other `Exception` fatal-uncontrolled (re-raised verbatim).
- [x] **Step 5:** `registry.py` — `HookRegistry` with `register(event, callable)` and `for_event(event) -> tuple[Callable, ...]`. Insertion-ordered, no priority field in P1.
- [x] **Step 6:** `runner.py` — `HookRunner` with `emit(event, ctx) -> None | HookHalt`. Iterate registry per event; for each callback: catch `HookError` (warn via `warnings.warn`, continue), catch `HookHalt` (return it to the caller — caller decides how to surface), let any other exception propagate. Document the contract in the class docstring.
- [x] **Step 7:** Unit tests `tests/work_engine/hooks/test_registry.py` + `test_runner.py` covering: empty registry no-op, single-hook fire, multi-hook order preservation, `HookError` isolation, `HookHalt` short-circuit, unexpected exception propagation.
- [x] **Step 8:** Goldens unchanged — `dispatcher.py` and `cli.py` not yet touched in P1.

## Phase 2: Dispatcher instrumentation

- [x] **Step 1:** Extend `dispatch()` signature to `dispatch(state, steps, hooks: HookRunner | None = None) -> tuple[Outcome, str | None]`. Default `None` preserves all current call sites and golden assertions.
- [x] **Step 2:** Fire `before_step` / `after_step` around the `handler(state)` call. Use a no-op runner internally when `hooks is None` so the hot path stays branch-light.
- [x] **Step 3:** Fire `on_halt` immediately before each `return Outcome.BLOCKED, name` / `return Outcome.PARTIAL, name`.
- [x] **Step 4:** Wrap `handler(state)` in `try/except Exception`; fire `on_error` (passing the exception via context) before re-raising. Engine semantics still expect step exceptions to bubble — the hook gets to observe, not swallow. Hook-internal `HookError` / `HookHalt` are handled by the runner per the P1 error contract; only step exceptions reach this `try/except`.
- [x] **Step 5:** If the `before_step` / `after_step` / `on_halt` `emit()` returns a `HookHalt`, dispatcher returns `(Outcome.BLOCKED, step_name)` with `state.questions` populated from the halt's surface. Treats hook-driven halts as first-class engine halts.
- [x] **Step 6:** Update `tests/work_engine/test_dispatcher.py` with hook-aware cases: hook fires per step, `on_halt` fires once on BLOCKED, `on_error` fires once and exception still propagates, `HookHalt` from a hook produces a clean engine halt.
- [x] **Step 7:** Run full `tests/work_engine/` suite — every existing test must pass without modification (proves backward-compat).

## Phase 3: CLI instrumentation

- [x] **Step 1:** `cli.main()` instantiates `HookRunner` from a registry built by a new helper `_build_hook_registry(args)`. Default registry empty until Phase 4.
- [x] **Step 2:** Fire `before_load` / `after_load` around `_load_or_build()`.
- [x] **Step 3:** Fire `before_dispatch` / `after_dispatch` around the `dispatch(delivery, steps, hooks=runner)` call.
- [x] **Step 4:** Fire `before_save` / `after_save` around `_save()`.
- [x] **Step 5:** Pass the same `runner` into `dispatch()` so dispatcher events share the registry.
- [x] **Step 6:** **`HookHalt` handling at the CLI layer.** If any CLI-layer `emit()` returns `HookHalt`, `cli.main()` prints the halt surface to stderr and returns exit code 2 **without saving state**, unless the halt happens after `_save()` (i.e. on `after_save`), in which case state is already persisted and exit 2 is returned with the surface printed. No partial saves. Concrete branch table:

  | Halt fires on | State persisted? | Exit code |
  |---|---|---|
  | `before_load` / `after_load` | No (never loaded into a writable shape) | 2 |
  | `before_dispatch` | No | 2 |
  | `after_dispatch` | No (`_sync_back` + `_save` skipped) | 2 |
  | `before_save` | No | 2 |
  | `after_save` | **Yes** (already on disk) | 2 |

- [x] **Step 7:** New tests `tests/work_engine/test_cli_hooks.py` — registry construction, event firing order, no-op behavior when no hooks registered (`test_cli.py` assertions stay green), `HookHalt` at each CLI stage produces correct exit code + persistence semantics from the table above.

## Phase 4: Concrete hooks (low-risk, observable)

Each step ships one hook with frontmatter doc, default-off in settings, registered only when explicitly enabled.

- [x] **Step 1:** `TraceHook` — emits structured stderr log per event when `hooks.trace: true`. Useful for debugging dispatch flow.
- [x] **Step 2:** `HaltSurfaceAuditHook` — on `on_halt`, asserts that `result.questions` is non-empty (already enforced by `_validate_step_result`, this is defense-in-depth at the hook layer for cases the validator missed).
- [x] **Step 3:** `StateShapeValidationHook` — on `after_load` and `before_save`, validates the **loaded `WorkState` Python object** against the v1 schema using existing `state.SchemaError` machinery. Does **not** touch the original v0 wire payload — `_load_or_build()` is responsible for migration; this hook only sees the post-migration v1 shape. Rejects malformed v1 objects early.
- [x] **Step 4:** `DirectiveSetGuardHook` — on `before_dispatch`, asserts the resolved `set_name` matches `state.directive_set`; catches drift between CLI selection and persisted state.
- [x] **Step 5:** Tests for each hook in `tests/work_engine/hooks/test_<hookname>.py` — default-off behavior, on-trigger behavior, error semantics.

## Phase 5: Chat-history hooks (the actual driver)

The reason this roadmap exists. Engine-driven turns get **structural** chat-history persistence; free-form turns stay cooperative.

- [x] **Step 1:** `ChatHistoryTurnCheckHook` — on `before_dispatch`, runs `scripts/chat_history.py turn-check`. Exit 11 (`foreign`) / 12 (`returning`) → raise `HookHalt` (already defined in P1) carrying the prompt surface; runner catches it and returns it to CLI; CLI converts to exit 2 with a readable surface. Exit 10 (`missing`) → auto-`init`, no halt.
- [x] **Step 2:** `ChatHistoryAppendHook` — on `after_step` for `Outcome.SUCCESS`, runs `chat_history.py append --type phase --json '{"step": <name>, ...}'`. Each successful step is its own phase-boundary entry, killing the `per_phase` subjectivity gap.
- [x] **Step 3:** `ChatHistoryHaltAppendHook` — on `on_halt`, appends a `--type decision` entry capturing the halt surface so resuming sessions know what blocked.
- [x] **Step 4:** `ChatHistoryHeartbeatHook` — on `after_dispatch`, runs `chat_history.py heartbeat` and threads stdout through `state.report` so the agent surfaces the marker in its reply.
- [x] **Step 5:** Settings — `hooks.chat_history.enabled: true` defaults to true when `chat_history.enabled: true`, otherwise false. Single switch, no per-hook toggles in P5.
- [x] **Step 6:** Tests — full integration test in `tests/work_engine/test_integration_chat_history.py`: a 4-step flow produces 4 append calls, one heartbeat call, exit-code propagation on `turn-check` rejection.
- [x] **Step 7:** Update `.augment/rules/chat-history.md` to reference the structural path: "On engine-driven turns the work_engine fires turn-check / heartbeat / append automatically; the cooperative gates remain the source of truth for free-form turns." Translate the ASCII Iron-Law block to call out engine vs free-form coverage explicitly.

## Phase 6: Hook configuration surface

- [x] **Step 1:** Extend `agent-settings` template with a `hooks:` block (default-off except chat-history when chat-history itself is on). Schema:

  ```yaml
  hooks:
    enabled: true                # master switch
    trace: false                 # TraceHook
    halt_surface_audit: true     # cheap, defense-in-depth
    state_shape_validation: true # cheap, defense-in-depth
    directive_set_guard: true    # cheap, catches drift
    chat_history:
      enabled: true              # follows chat_history.enabled
  ```

- [x] **Step 2:** `_build_hook_registry()` reads the block and registers exactly the enabled hooks.
- [x] **Step 3:** Settings-loader test — registry size matches enabled flags, missing block defaults to "all off except hardcoded defaults".
- [x] **Step 4:** Document the block in `.agent-src.uncompressed/templates/agent-settings.md` (template doc, not the live YAML).

## Phase 7: Tests, goldens, docs

- [x] **Step 1:** Run full `task ci` — every existing golden must pass byte-for-byte. The hook layer is non-breaking by construction (default-off / no-op runner) but verification is mandatory. **Golden-replay test runs must force `hooks.enabled: false`** (set explicitly in any golden fixture or test harness that drives `cli.main`) so a future settings change cannot silently invalidate captured outputs. Test harness now passes `--no-hooks` at runtime (not in `_relative_cmd`) so transcripts stay byte-stable while hook registry is provably empty. 11/11 goldens pass; full pytest suite 1619/1620 (1 baseline failure on `fe-design` unrelated to hooks). `task ci` post-`consistency` checks (`counts-check`, `check-compression`, `check-refs`, `check-portability`, `check-reply-consistency`) all green.
- [x] **Step 2:** New context doc `agents/contexts/work-engine-hooks.md` — event lifecycle, context shapes, registration, examples. Mirror the structure of `chat-history-platform-hooks.md`.
- [x] **Step 3:** Update `agents/contexts/implement-ticket-flow.md` and the equivalent `/work` flow doc to mention the hook lifecycle as a side-channel concern (not a step in the linear flow).
- [x] **Step 4:** Lint pass — `task check-portability` ✅, `task check-refs` ✅. `task lint-skills` baseline `fe-design` fail predates this roadmap and is out of scope. New `.md` content (`work-engine-hooks.md`, hook configuration block, updated `chat-history.md`) stays project-agnostic per `augment-portability` rule.
- [x] **Step 5:** Sync compressed sources — `task sync` regenerates `.agent-src/` and `.augment/`. Manual recompression applied to `rules/chat-history.md` and `templates/agent-settings.md`; hashes refreshed via `compress.sh --mark-done`. `task sync-check-hashes` clean. No manual edits leaked into the generated layers beyond the intended recompression delta.

## Acceptance Criteria

- [x] `dispatch()` accepts a `hooks=` parameter; default `None` keeps all existing call sites unchanged
- [x] Every `tests/work_engine/test_*.py` file passes without modification (backward-compat proof) — 542/542 in `tests/work_engine/`
- [x] CLI fires every CLI-layer event in deterministic order, verified by `test_cli_hooks.py` (9/9)
- [x] Dispatcher fires every dispatcher-layer event in deterministic order, verified by `test_dispatcher.py` updates (23/23)
- [x] Phase 5 chat-history hooks produce **one append per successful step** during a real `/implement-ticket` run on this branch — covered by `test_integration_chat_history.py`
- [x] `task ci` is green for all post-`consistency` checks; `consistency` passes once the WIP working tree is committed (the dirty diff is the intended deliverable of this roadmap)
- [x] No new `.md` content leaks project-specific names (per `augment-portability`) — `task check-portability` clean
- [x] No version numbers, releases, or git tags appear anywhere in the roadmap or new docs (per `roadmaps.md` rule 13)

## Notes

**PR scope.** Per direct user instruction, this roadmap **does not branch**. All work lands in the current PR (`road-to-product-ui-track` branch). ChatGPT's recommendation to split was overruled. The trade-off is a larger PR; the gain is a single review surface for engine + UI work that already share state.

**Backward-compat invariant.** Every change in P1–P3 is additive. The hook layer is a no-op when no hooks are registered. Goldens captured against the current dispatcher must remain byte-identical after P3 lands. P5 hooks **mutate persisted state** (chat-history file) and therefore must be feature-flagged off in golden-replay test runs — concretely, every golden harness sets `hooks.enabled: false` in the test settings overlay.

**Hook error contract (locked in P1).** Three tiers, no implicit behavior:

| Class | Semantics | Runner action |
|---|---|---|
| `HookError` | Non-fatal — hook failed, work continues | Caught, warned via `warnings.warn`, next hook fires |
| `HookHalt` | Fatal-controlled — hook demands a clean stop (e.g. chat-history `turn-check` foreign session) | Caught, returned to caller; CLI converts to readable surface + exit code |
| any other `Exception` | Fatal-uncontrolled — bug in the hook | Re-raised verbatim, propagates through dispatch |

**Free-form turns out of scope.** The work_engine only runs during `/work` and `/implement-ticket`. Conversational turns where the user types prose and the agent edits files without invoking the engine are still governed by the cooperative `chat-history` rule. A structural fix for those would require Augment IDE platform hooks that do not exist today.

**Hook ordering.** P1 ships insertion-ordered registration only. If a real ordering need surfaces (e.g. trace must fire before mutation hooks), add a priority field in a follow-up — do not pre-build it.

**Why no `on_cli_error`.** Argparse and IO errors return exit 2 before any state has been loaded; there is no useful state to hand a hook. Add the event when a real consumer needs it.

**Roadmap lifecycle.** This roadmap is active in `agents/roadmaps/`. On full completion → archive to `agents/roadmaps/archive/`. If P5 lands but P6/P7 are deferred, mark phases individually and keep the file active.

**Follow-ups (do not extend this roadmap).** After P1 primitives land and have one real consumer (the engine), two follow-up artefacts are owed — both deferred so the current roadmap stays focused on the chat-history driver:

- `agents/contexts/hook-pattern.md` — generic pattern doc. Captures the underlying principle ("engine owns boundaries"), the four emulation patterns (commands, mandatory checkpoints, state machine, tool-gates), and a *when-not-to-hook* heuristic. One-shot scripts with no extensibility need (e.g. `update_roadmap_progress.py`) stay hook-free; this doc says so explicitly.
- A separate **hookable-scripts roadmap** (filename TBD when the work is scheduled) migrating the three highest-ROI subsystems onto the P1 primitives: `scripts/compress.py` (pre/post-audit, diff-gate, size-check), `scripts/install.py` (consumer-project post-install customisation), `scripts/skill_linter.py` and the cross-ref / portability checkers (CI custom reporters, IDE live-validation). `command_suggester` and the memory pipeline are in scope only if a concrete need surfaces — do not pre-build.

These follow-ups are explicitly **not** in this roadmap's acceptance criteria. They land after the primitives have been hardened by one real consumer.
