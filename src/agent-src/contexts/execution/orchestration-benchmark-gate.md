# Orchestration Benchmark & Default-Flip Gate (Phase 6)

The falsification gate the whole auto-orchestration roadmap is built around.
Reaching the user's "default `on`" is a **measured milestone**, not an
assumption: the shipped default for `subagents.auto` flips toward `on` only
when a real benchmark proves a net win at held quality.

## Measurement — pin the method

Measure orchestrated vs. single-agent on a representative delegable-task set
using the existing `bench:ab` value harness. Pin the comparison method:

- **Paired** — the same task set runs both arms (single-agent, auto-orchestrated).
- **Activation-aware** — the orchestration layer is toggled per arm via
  `subagents.enabled` / `subagents.auto`, not a global confound.
- **Metrics** — token delta, wall-clock, and an outcome-quality score (held at
  or above the single-agent baseline).

The measurement is an **empirical run with live API spend on a task corpus** —
it is authorised and run out of band, not produced by this package's code. This
context defines the gate; it does not fake the result.

## Pass gate (defined up front)

```
GATE PASSES  ⇔  net token-OR-time win on the delegable-task subset
              AND output quality held at/above the single-agent baseline.
HONEST-NULL EXIT: no win, or quality regressed → KEEP the conservative default.
```

`gateVerdict()` encodes pass = `net_win && quality_held`.

## Default flip — one line, host-gated

On a **passing** gate, the shipped default for `subagents.auto` becomes `on`
**only** on hosts whose capability manifest reports `subagent_spawn: true`
(`off` elsewhere). `resolveShippedDefault()` encodes this. The flip itself is a
one-line edit to the `subagents.auto` default in
`src/config/agent-settings.template.yml` — no code change, host-gated by the
manifest at runtime.

Until the gate passes, the shipped default stays `ask` (conservative). This is
the reconciliation of the user's "default on" goal with the council's
"prove-first": `on` is the destination, reached by evidence, not assumed.

## Reproducibility

The benchmark report (arms, task set, metrics, verdict) is reproducible from
the pinned `bench:ab` scenario + the gate helper, so the default-flip decision
is auditable rather than asserted.

## Reference implementation

[`src/scripts/_lib/orchestration_gate.ts`](../../../../src/scripts/_lib/orchestration_gate.ts)
(`gateVerdict`, `resolveShippedDefault`), covered by
[`tests/scripts/_lib_orchestration_gate.test.ts`](../../../../tests/scripts/_lib_orchestration_gate.test.ts).

## Related

- [`auto-orchestration-activation`](auto-orchestration-activation.md) — the `subagents.auto` key this gate sets the default for.
- [`host-capability-manifest`](host-capability-manifest.md) — `subagent_spawn` gates the flip.
- [`orchestration-telemetry`](orchestration-telemetry.md) — the per-dispatch metrics the benchmark aggregates.
