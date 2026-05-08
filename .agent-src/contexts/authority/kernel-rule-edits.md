# Kernel-Rule Edits — Slow-Rollout Guarantee

Loaded by [`scope-control`](../../rules/scope-control.md). Codifies the
soak-time guarantee for edits to always-loaded (kernel) rules under
`.agent-src.uncompressed/rules/`.

**Size budget:** ≤ 1,500 chars.

## The guarantee

Each kernel-rule edit ships in **its own PR**, with **≥ 24 h between
merges** of consecutive kernel-rule PRs. Autonomous mandate, roadmap
authorization, and standing "just keep going" directives **do not lift
this** — it is a behaviour-soak guarantee, not a governance preference.

The 24 h window exists so that a regression introduced by the first
edit (a rule that stops firing, an Iron Law that loses rhetorical
weight, a trigger that swallows a sibling rule's domain) surfaces in
real interactions before the second edit lands and confounds the
diagnosis.

## Trigger

A PR is a "kernel-rule edit" iff it modifies any file in
`.agent-src.uncompressed/rules/` that is in the locked kernel set
(see [`docs/contracts/kernel-membership.md`](../../../docs/contracts/kernel-membership.md)).

The CI guard (Phase 4.2 of `road-to-always-budget-relief.md`) fails
any PR that touches **> 1** kernel rule in the same diff. Override is
a single PR label: `bundled-always-rules-acknowledged` — the maintainer
records why the bundle is necessary in the PR body.

## Out of scope

- Auto-tier rules. Auto rules load on demand; the soak rationale does
  not apply with the same force.
- Context files cited by kernel rules. Context edits are reversible
  cheaply and do not change rule firing surface.
- Whitespace / typo / link fixes inside a single kernel rule. Same-rule
  cosmetic edits are not subject to the 24 h window — they ship as a
  normal PR.

## Source

- Roadmap Phase 4: [`agents/roadmaps/road-to-always-budget-relief.md`](../../../agents/roadmaps/road-to-always-budget-relief.md) § Phase 4.
- Lesson: PR #36 (2026-05-04) compressed the rollout schedule under
  autonomous mandate; the slow-rollout note was deferred until this
  ADR pass.
