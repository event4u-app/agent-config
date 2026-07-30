# Orchestration Benchmark & Demotion Gate (Phase 6 → telemetry-demotion)

Originally the falsification gate the auto-orchestration roadmap was built
around: the shipped default for `subagents.auto` would flip toward `on` only
when a real benchmark proved a net win at held quality.

**As of 2026-07-09 the shipped default IS `on`** on subagent-capable hosts
(ADR-117; [`orchestration-default-flip-verdict`](../../../../agents/settings/contexts/orchestration-default-flip-verdict.md)
§ 2026-07-09). It was flipped on a **bounded-downside re-evaluation**, not a
passed benchmark: a rigorous paired bench:ab is not producible in this harness
(no runtime that executes model `Task`/`Agent` calls), and the win-validation
was deadlocked (telemetry needs `on`, `on` was gated on telemetry). The
re-evaluation broke the deadlock by showing the downside of `on` is
structurally small — delegable slices are cost-routed to the cheapest capable
tier, classification fires only on real structural signals, every return is
verified — so `on` gathers the realized telemetry responsibly. This gate now
governs **demotion**: a measured regression flips the default back to `ask`.

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

## Default state + demotion — host-gated

The shipped default for `subagents.auto` is `on` on hosts whose capability
manifest reports `subagent_spawn: true` (`off` elsewhere) — set directly in
`src/config/agent-settings.template.yml`. `resolveShippedDefault()` remains the
host-gated resolver and now serves **demotion**: fed a `fail` verdict from
accumulated real-world orchestration telemetry, it resolves back to `ask`
(conservative). A `pass` verdict keeps `on`. The demotion path is a one-line
edit, host-gated by the manifest at runtime.

The 2026-07-09 flip is the reconciliation of the user's "default on" goal with
the council's "prove-first": rather than wait on a benchmark that cannot be
produced here, `on` ships because its downside is bounded and reversible, and
realized telemetry is now free to accrue and drive demotion if it regresses.

## Reproducibility

The benchmark report (arms, task set, metrics, verdict) is reproducible from
the pinned `bench:ab` scenario + the gate helper, so the default-flip decision
is auditable rather than asserted.

## Reference implementation

[`src/scripts/_lib/orchestration_gate.ts`](../../../../src/scripts/_lib/orchestration_gate.ts)
(`gateVerdict`, `resolveShippedDefault`), covered by
[`tests/scripts/_lib_orchestration_gate.test.ts`](../../../../tests/scripts/_lib_orchestration_gate.test.ts).

## Related

- ADR-118 (`docs/decisions/ADR-118-loop-engineering-boundaries.md`) — demotion stays a manual human edit by decision; never automated (disposition #1).
- [`auto-orchestration-activation`](auto-orchestration-activation.md) — the `subagents.auto` key this gate sets the default for.
- [`host-capability-manifest`](host-capability-manifest.md) — `subagent_spawn` gates the flip.
- [`orchestration-telemetry`](orchestration-telemetry.md) — the per-dispatch metrics the benchmark aggregates.
