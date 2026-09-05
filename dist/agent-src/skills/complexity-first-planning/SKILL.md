---
name: complexity-first-planning
description: "Use when staging multi-component or uncertain work — tackle the load-bearing unknown first (risk-first decomposition), not the easy parts first."
domain: engineering
status: active
model_tier: medium
tier: senior
context_spine: [repo]
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# complexity-first-planning

Part of the Reasoning Discipline Protocol. Engage per
[`rdp-gate`](../../contexts/execution/rdp-gate.md) (skip on trivial / linear
tasks; light touch on a strong-reasoning host).

> **Provenance.** This is an **RDP derivation from general engineering discipline
> (risk-first / critical-path / pre-mortem)** — it is **not** an Anthropic-
> documented Fable behavior. Fable's "start at the top of your difficulty range"
> is about *task selection* (give the model harder tasks), not intra-task order.
> The skill stands on its own merit; it is not sold as a frontier-model transplant.

## When to use

- Staging multi-component work where the hardest/most-uncertain part is not yet proven.
- A plan whose later steps depend on an assumption that could collapse.

Do NOT use for single-step, linear, or fully-specified tasks (no load-bearing
unknown to resolve), or when the user has already fixed the sequence.

## When the agent should load this

- The user asks to "plan", "break down", or "stage" work that spans ≥2 components
  and at least one part is unproven.
- A multi-step plan is forming whose later steps assume something untested.
- Mid-task: a step just failed because an earlier, easier step baked in a wrong
  assumption — reload this and re-sequence risk-first.

## Procedure

1. **Inspect and name the unknowns.** Read the affected components first
   (start from the **repo** slot of the
   [context-spine](../../../docs/contracts/context-spine.md) when present),
   then list which carry real uncertainty (technical feasibility, an
   unverified integration, an ambiguous requirement) — analyze the existing
   system before planning any change.
2. **Assess and rank by load-bearing risk.** The load-bearing unknown is the one
   whose failure invalidates the most dependent work — not the one that is merely hard.
3. **Resolve it first.** Spike / probe / prototype the load-bearing unknown
   before building anything that depends on it. Record the result in the notes
   file (see [`notes-first-reasoning`](../../rules/notes-first-reasoning.md)):
   prediction → result → lesson.
4. **Cascade.** Once the riskiest assumption holds (or is corrected), sequence
   the dependent work. If it fails, the cheap early failure saved the rework.

## Output

A short ordered plan that leads with the load-bearing unknown + how it will be
proven, then the dependent steps. One recommendation, not a survey.

## The four plan criteria — what a reviewer fails the ordered plan on

Risk-first ordering is one of four things a plan is judged on. All four are
stated so a reviewer can **fail** a plan on them — each names what failing looks
like. This skill owns the third; the other three are stated here because a plan
reviewed on ordering alone passes while being unnecessary, insufficient, or
built on verbs that do not exist. The same four are carried in
`feature-planning` (pack `product-basic`), which is pruned under `projection.mode: scoped` and so is named rather than linked.

1. **Necessity** — every step traces to a stated problem or acceptance criterion.
   **Fails when** the plan carries work nothing asked for — a spike for an
   unknown that is not load-bearing is the version of this failure this skill
   causes.
2. **Sufficiency** — every requirement is discharged by at least one step.
   **Fails when** a requirement owns no step, or its only step has no verifiable
   outcome. Walk the requirements, not the steps.
3. **Ordering** — the load-bearing unknown is resolved before anything that
   assumes it, and no step consumes what a later step creates. **Fails when** the
   plan front-loads the easy parts, or ranks by effort instead of dependency
   blast radius (see Gotchas). This is the criterion this skill exists for.
4. **Groundedness** — every command, skill and tool the plan tells someone to run
   exists. **Fails when** the plan names a verb that is not in the index. Check
   it against [`CAPABILITIES.yaml`](../../../CAPABILITIES.yaml) at the repository
   root — the generated capability index of every shipped skill and command —
   plus the project's own script/task entry points. It is the only one of the
   four decidable without judgement, so it is never waved through.

## Do NOT

- Build the easy parts first to show progress, then discover the hard part breaks them.
- Treat "hardest" as "most code" — rank by *dependency blast radius*, not effort.
- Over-plan a strong-reasoning host (it sequences risk natively — keep it light).

## Gotchas

- **Mistaking effort for risk.** A 400-line but well-understood refactor is *low*
  load-bearing risk; a 5-line call into an unverified third-party API is *high*.
  Ranking by size instead of dependency blast radius is the classic failure.
- **"Resolved on paper".** Reasoning that the unknown "should work" is not
  resolving it — the spike must actually run / compile / return before dependent
  work starts. Record prediction → result, not prediction → assumption.
- **Spike sprawl.** The probe answers exactly one question (does the load-bearing
  assumption hold?), then stops. Turning it into the real implementation defeats
  the cheap-early-failure purpose.

## Related Skills

**WHEN to use this**

- Staging multi-component work where the hardest / most-uncertain part is unproven.
- A plan whose later steps rest on an assumption that could collapse.

**WHEN NOT to use this**

- Single-step, linear, or fully-specified work — no load-bearing unknown to
  resolve; the [`rdp-gate`](../../contexts/execution/rdp-gate.md) filters these.
- Breaking a feature into tasks in general — route to
  [`feature-planning`](../feature-planning/SKILL.md), which composes this skill.
- Recording the spike's prediction / result / lesson — that belongs in
  [`notes-first-reasoning`](../../rules/notes-first-reasoning.md).
