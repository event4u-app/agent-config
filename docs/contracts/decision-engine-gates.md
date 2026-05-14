# Decision-engine gates (v1)

**Status:** beta — landed 2026-05-14 via `road-to-productization.md` Phase 2.
**Owners:** `work_engine` maintainers.
**Scope:** the optional `decision_engine:` block in `.agent-settings.yml`.

## Purpose

Cross the package from **observable** (Level-5) to **controllable**
(Level-6). The engine has scored confidence-bands, risk-classes, and
memory-hits since Phase 4 of `road-to-decision-trace`; this contract
turns those signals into refusal gates the user opts into.

Absent block = unchanged behaviour. Enforcement is opt-in only; the
engine never silently halts on a signal the user did not configure.

## Schema

All keys optional. Unknown keys are rejected hard by
`scripts/validate_decision_engine.py` and by
`work_engine.scoring.decision_engine.parse`.

| Key                    | Type            | Default | Notes |
|------------------------|-----------------|---------|-------|
| `surface_traces`       | bool            | `false` | Mirrored to `DecisionTraceHook`. Predates the gates; lives here so the block has one schema. |
| `min_confidence`       | enum            | `off`   | `low` \| `medium` \| `high` \| `off`. Phase=Plan floor. |
| `block_on_risk`        | enum            | `off`   | `low` \| `medium` \| `high` \| `off`. Phase=Implement ceiling. |
| `require_memory_hits`  | bool            | `false` | Phase=Refine demands `memory_hits >= 1`. |
| `on_block`             | enum            | `stop`  | `stop` \| `ask` \| `warn`. Action when a gate fires. |
| `ask_timeout_seconds`  | int (>= 0)      | `30`    | Non-TTY wait before applying `on_block_fallback`. |
| `on_block_fallback`    | enum            | `stop`  | `stop` \| `warn`. Resolution after `ask_timeout`. |

## Gate-to-phase mapping

Each gate fires on exactly one phase. The dispatcher emits gate
decisions on `AFTER_STEP` for that phase only.

| Gate                  | Phase     | Signal compared             | Fires when                          |
|-----------------------|-----------|-----------------------------|-------------------------------------|
| `min_confidence`      | Plan      | `confidence_band`           | actual < floor                      |
| `require_memory_hits` | Refine    | `state.memory.hits`         | hits < 1                            |
| `block_on_risk`       | Implement | `risk_class`                | actual >= ceiling                   |

`low` < `medium` < `high` for both confidence and risk. `off` disables
the gate.

## Conflict matrix

Only one gate fires per phase, so cross-phase conflicts are impossible
by construction. Within a phase, **only the highest-impact gate
applies**; downstream gates are evaluated against the same phase but
skipped if a higher-priority gate already fired.

Priority (highest → lowest):

1. `block_on_risk` (Implement)
2. `require_memory_hits` (Refine)
3. `min_confidence` (Plan)

This priority surfaces only when a future schema adds gates that
overlap on the same phase; today each gate owns a unique phase and the
priority is documentary. The order is locked so future additions
inherit the contract.

### Worked examples

| Config                                                                                | Phase     | confidence | risk     | hits | Outcome                          |
|---------------------------------------------------------------------------------------|-----------|------------|----------|------|----------------------------------|
| `min_confidence: medium`                                                              | Plan      | `low`      | -        | -    | `min_confidence` fires, action=stop |
| `min_confidence: medium`                                                              | Plan      | `high`     | -        | -    | no fire — band at/above floor    |
| `block_on_risk: medium`                                                               | Implement | -          | `high`   | -    | `block_on_risk` fires, action=stop |
| `block_on_risk: high`                                                                 | Implement | -          | `medium` | -    | no fire — below ceiling          |
| `require_memory_hits: true`                                                           | Refine    | -          | -        | 0    | `require_memory_hits` fires      |
| `require_memory_hits: true`                                                           | Refine    | -          | -        | 2    | no fire                          |
| `min_confidence: high, block_on_risk: low, require_memory_hits: true` (all on)        | Plan      | `low`      | `low`    | 0    | `min_confidence` fires (Plan-owning gate) — Refine/Implement gates inert this phase |

## Non-TTY timeout protocol

`on_block=ask` is interactive. In a non-interactive context the
engine cannot block waiting for keystrokes that will never arrive.
Detection follows two signals (either disables interactivity):

- environment variable `CI` set to `1`, `true`, `yes` (case-insensitive)
- `sys.stdin.isatty()` or `sys.stdout.isatty()` returns false

When non-interactive, `on_block=ask` collapses to action `ask_timeout`.
The consumer (CLI / dispatcher) is expected to:

1. wait `ask_timeout_seconds` for a stdin response;
2. apply `on_block_fallback` (`stop` or `warn`) when the timeout
   elapses or stdin is closed;
3. surface `block_reason=ask_timeout` on the decision trace so the
   reason is replay-visible.

Default fallback is `stop` (fail-safe). Flip to `warn` only when CI
explicitly wants advisory gates.

## Rollback

The block is config-only. Remove the `decision_engine:` block and
the engine reverts to observe-only behaviour — no migration, no DB
state, no schema lock. Per-key removal also works (each key has a
safe default).

## Test surface

Coverage lives in `tests/work_engine/scoring/test_decision_engine.py`:

- schema parser: defaults, unknown-key rejection, bad-type rejection;
- gate evaluation: per-phase, per-signal, conflict isolation;
- TTY detection: env-var detection, fallback to `ask_timeout`;
- action resolution: `stop` / `warn` short-circuit interactivity.

Wiring tests (dispatcher + hook) live in
`tests/work_engine/test_decision_gate_hook.py`.
