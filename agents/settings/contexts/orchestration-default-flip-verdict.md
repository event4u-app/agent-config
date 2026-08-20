# Orchestration default-flip — verdict history

> **Current state (2026-07-09): the shipped default is `on`** on subagent-capable
> hosts. The 2026-06-26 "keep `ask`" decision below is preserved **verbatim** for
> the record — it is superseded by the re-evaluation in
> [§ Superseding decision (2026-07-09)](#superseding-decision-2026-07-09--flip-to-on-on-bounded-downside-re-evaluation)
> at the end of this file (ADR-117).
>
> A third evidence pass ran on 2026-08-20 and changed nothing: see
> [§ Evidence pass (2026-08-20)](#evidence-pass-2026-08-20--no-usable-evidence-the-default-is-unexamined-not-confirmed).
> It records a measured null — the `on` default is neither confirmed on evidence
> nor demoted.

**Decision (2026-06-26).** The shipped default `subagents.auto` stays **`ask`**.
It is NOT flipped to `on`. The flip is re-gated on accumulated real-world
`orchestration-telemetry`, not a synthetic headless benchmark.

This is the honest-null branch the gate (`orchestration-benchmark-gate`,
`gateVerdict`/`resolveShippedDefault`) was built to allow — reached because a
credible benchmark is **not producible in the current harness**, not because a
benchmark ran and lost.

## Method + evidence (auditable)

The flip requires a net token-or-time win at held quality on delegable tasks,
measured orchestrated-vs-single-agent. Verified at HEAD:

- **No delegable-task corpus** exists (`ab-tracka`, `ab-trackb-v2`,
  `router-coverage`, `rtk`, `telegraph` — none is multi-part/parallelizable).
- **No bench arm toggles `subagents.auto`.**
- **The harness does not execute model-emitted `Task`/`Agent` tool calls.**
  `bench_ab_v2_run.ts::run_one_recursive` (the closest thing, ADR-106's D₂ arm)
  is a *scripted* loop: it re-invokes `claude --print` (`run_live`) and uses the
  deterministic v2 scorer as the critic. It does **not** spawn/execute subagents.
  The bench scores file changes from headless single-shot prints.

So measuring **realized** orchestrated value would require building an
agent-tool-execution harness — effectively a runtime — which contradicts the
package's no-runtime identity. A cheaper **decision-propensity** proxy (does
`auto: on` make the model *emit* more `Task` calls, at estimated cost) measures
the wrong layer for a global default change — the same category error a prior
routing-precision benchmark fell into. Neither is a sound basis to flip a
shipped default that affects every capable host.

## AI-council convergence (inline per `no-roadmap-references`)

Council (claude-sonnet-4-5 + gpt-4o, 2026-06-26, 2 rounds): the orchestration
*decision* is observable headlessly, BUT a credible *value* measurement is not —
**explicitly contingent** on whether the recursive arm executes real `Agent`
tool calls. It does not (verified: scripted re-call loop), so the build-the-bench
case collapses by its own stated falsifier, and telemetry is the right instrument
for the gate. Telemetry's opt-in selection bias is acknowledged but it measures
**realized** value from the actual `ask`-mode population — the right signal for a
default change, and unbiased toward the propensity-vs-value confound.

## What would justify flipping to `on` later

Accumulated `orchestration-telemetry` from real `ask`-mode delegations showing a
net token-or-time win at held quality on a meaningful sample — fed through the
existing `gateVerdict`. Until then, `ask` is correct: `on` is the destination,
reached by realized evidence, never assumed.

## Superseding decision (2026-07-09) — flip to `on` on bounded-downside re-evaluation

**Decision (2026-07-09).** The shipped default `subagents.auto` is flipped to
**`on`** on subagent-capable hosts (`off` elsewhere). This supersedes the
2026-06-26 "keep `ask`" decision above. Recorded in ADR-117.

**Why revisited (not relitigation).** Per `decision-revisit-gate`, the
2026-06-26 verdict was settled-under-conditions, and three conditions changed:

1. **New mechanism.** The 2026-06-26 branch answered a *quality* question. The
   open question here is *cost*: on reasoning-mass ≪ execution-mass slices,
   cost-routing to a cheaper tier is a large token saving the quality-null never
   addressed.
2. **Cost-routing already shipped.** `road-to-cost-aware-model-routing`
   (2026-07-08) landed `inferSliceTier` — delegable slices already run on the
   cheapest capable tier. The system is **not** cost-blind; only the shipped
   default was conservative. This structurally bounds the downside of `on`.
3. **The deadlock.** The 2026-06-26 re-gate ("flip on realized telemetry") was
   self-locking: telemetry needs `on`, `on` was withheld pending telemetry.

**Basis — honest.** This is a **bounded-downside** decision, NOT a passed
benchmark. A rigorous paired bench:ab remains non-producible here (no runtime
executing model `Task`/`Agent` calls). The evidence is:

- **Directional probe (N=2, real).** Two live read-only-fan-out delegations this
  session consumed ~70k and ~86k Sonnet tokens on genuinely-occurring work;
  inline-Opus counterfactual ≈ same token mass at ~5× the rate → ~80% saving per
  task, outputs verified usable. Small N, single task-type, arithmetic
  counterfactual — directional, not rigorous.
- **Bounded downside.** `on` auto-dispatches only structurally-signalled,
  cost-routed, verified slices — it cannot delegate unstructured, tiny, or
  frontier-priced work. Anthropic's "reversible ≠ costless" catastrophe
  (deep council 2026-07-08) assumed a cost-blind system; the real system is
  cost-routed, so the worst case is far smaller.
- **Reversible + monitored.** `resolveShippedDefault()` is now the demotion gate:
  a measured telemetry regression flips the default back to `ask`.

**AI-council (inline per `no-roadmap-references`).** Deep council
(claude-sonnet-4-5 + gpt-4o, 2026-07-08, 4 rounds): split — Anthropic argued
validate-before-flip (strongest single argument), gpt-4o argued bounded
incremental rollout suffices. The flip follows gpt-4o's path, strengthened by
the post-council finding that the classifier is cost-routed (which defuses
Anthropic's core catastrophe premise).

**revisit-if / demotion trigger.** Accumulated real-world orchestration
telemetry showing a net token-or-time *loss* or a quality regression on the
delegable subset → demote to `ask` via `gateVerdict`/`resolveShippedDefault`.

## Evidence pass (2026-08-20) — no usable evidence; the default is unexamined, not confirmed

**Outcome: neither branch fires.** The default `on` is **not** confirmed on
measured evidence, and the demotion trigger below is **not** met. This is the
third entry in this file's history (after 2026-06-26 "keep `ask`" and 2026-07-09
"flip to `on`"); the two intermediate readings on 2026-08-10 and 2026-08-17 were
recorded in the roadmap blocker rather than here.

**What was measured.** `agents/runtime/state/audit/` (gitignored host state), read
2026-08-20:

- `2026-08.jsonl` — 591 lines, **582 orchestration rows**; `2026-07.jsonl` — 1.
- `first_pass_success`, `escalated`, `task_class`, `dispatch_mode`: non-null on
  **0 of 582**. The entire held-quality corpus is the single July line.
- `token_delta`: `0` with `token_delta_provenance: estimated` on **582 of 582**.
- `dispatch_tokens`: numeric on **40 of 582**, all dated 2026-08-09 to
  2026-08-13 — none since. `wall_clock_ms` numeric on 582 but `> 0` on only
  those same 40.
- `spawn_count >= 2`: **0 of 582**. Across 582 recorded dispatches this corpus has
  never produced a fan-out.
- `orchestration_savings_report`: `dispatches: 582 (total spawns: 584)`, net
  `token_delta 1087078` — tokens **added**, entirely from the one July line;
  `first_pass_success_rate: n/a (n=1)`, `escalation_rate: n/a (n=1)`,
  `measured share: 0%`, `MODELED cost reduction: n/a`.

**Why neither branch fires.** `gateVerdict` is a pure function of
`{net_win, quality_held}` and the corpus supplies neither: no measured net (all
provenance `estimated`) and no quality signal (`first_pass_success` null on all
582). The demotion trigger stated below requires *a measured net loss or a
quality regression*; an **unmeasurable** corpus is neither. Reading the
`measured share: 0%` aggregate as a loss would be quoting a single July line as a
population.

**Why more usage will not change this.** The quality columns are not derivable
from any hook payload by construction — `first_pass_success` and `escalated` are
defined over the parent's *subsequent* rework and re-dispatch, which have not
happened at task completion. Cost and latency already arrive on a **sync**
completion (`orchestration_record_hook.ts:193-199`, hence the 40 numeric rows);
background dispatches carry no usage fields at that slot. So volume produces more
`null`, not more evidence. The observability work is transferred to a stub
carrying its own re-entry probes.

**Standing state.** ADR-117's `on` default continues to rest on the 2026-07-09
bounded-downside basis, unchanged and un-upgraded. It stands **by decision** —
this pass is on the record — rather than by default going unexamined.

## See also

- `auto-orchestration-activation` — the `subagents.auto` key.
- `orchestration-telemetry` — the realized-value signal the flip is re-gated on.
- ADR-105 — automatic subagent orchestration.
