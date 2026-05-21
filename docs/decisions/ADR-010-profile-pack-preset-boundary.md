---
adr: 010
status: proposed
date: 2026-05-16
decision: profile-pack-preset-boundary
supersedes: —
superseded_by: —
phase: v2.x · step-15 Phase 1 prerequisite
---

# ADR-010 — Profile / Pack / Preset Boundary

## Status

**Proposed** · 2026-05-16 · pending Phase 1 of
[`agents/roadmaps/step-15-product-refinement.md`](../../agents/roadmaps/step-15-product-refinement.md).
Council v3 action #2 (`agents/runtime/council/responses/2026-05-16-step-15-product-refinement-v3.json`): <!-- council-ref-allowed: ADR decision-trace to originating council response -->
**"Profile / Pack / Preset boundary is undefined; Phase 2 will duplicate
Phase 1 abstractions"**. Promoted from Phase 2 to Phase 1 prerequisite —
the profile loader (Phase 1 item 1) cannot ship without the boundary.

## Context

Step-15 introduces three new configuration concepts:

- **Profile** — Phase 1 item 1: `profile.id` ∈ {`founder`, `developer`,
  `content_creator`, `agency`, `finance`, `ops`}.
- **Preset** — Phase 1 item 4: `preset.id` ∈ {`fast`, `balanced`,
  `strict`} bundling 12+ governance knobs (cost caps, confidence band,
  block-on-risk, …).
- **Pack** — Phase 2 item 7: workflow bundles (`founder-mvp`,
  `content-engine`, `agency-delivery`) of `(profile + preset +
  command-set + skill-allowlist)`.

A pre-existing fourth concept is in play:

- **`cost_profile`** — current setting in `.agent-settings.yml`, values
  `minimal` / `balanced` / `full` / `custom`. Owns **rule-tier loading**
  (kernel · kernel + tier-1 · kernel + tier-1 + tier-2). Contract:
  [`docs/contracts/cost-profile-defaults.md`](../contracts/cost-profile-defaults.md).

Without a written boundary, three failure modes are predictable:

1. The preset loader re-implements rule-tier gating (overlap with
   `cost_profile`).
2. Packs ship duplicate `profile` + `preset` defaults that drift from
   the canonical source.
3. Three teams add knobs to three places, and a user picking
   `developer + strict + founder-mvp` discovers contradicting values
   at runtime.

## Decision

Four orthogonal axes, four owners, one resolution chain.

| Axis | Answers | Owns | Identity key |
|---|---|---|---|
| **Profile** | *Who is the user?* (audience taxonomy) | Default skill/command surface; README entry-paragraph; persona pre-selection | `profile.id` |
| **Preset** | *How cautious is this run?* (risk + cost + autonomy budget) | The 12+ governance knobs (per-call $ ceiling, confidence band, block-on-risk, autonomy default, council escalation, …) | `preset.id` |
| **Pack** | *What bundle of skills + commands?* (workflow recipe) | A frozen `(profile, preset, allow_skills, allow_commands)` 4-tuple; nothing more | `pack.id` |
| **Cost Profile** | *How many rules load?* (token budget) | Rule-tier loading at session start (kernel · +tier-1 · +tier-2) | `cost_profile` |

### Resolution chain (read order, last writer wins)

```
pack  →  profile  →  preset  →  cost_profile  →  user/env/runtime overrides
```

- A **pack** declares defaults for `profile`, `preset`, and the
  skill / command allowlists. It cannot set `cost_profile` (that
  axis belongs to the rule-tier loader and is governed separately).
- A **profile** declares defaults for `preset`, audience-specific
  README pointer, persona pre-selection. It cannot set any preset
  knob directly — only `preset.id`.
- A **preset** owns the 12+ knobs. No other axis writes them.
- A **cost_profile** owns rule-tier loading. No other axis writes it.
- The user's `.agent-settings.yml`, environment variables, and
  runtime CLI flags override every axis above them.

### Non-overlap rules (Iron Law)

```
A KNOB BELONGS TO EXACTLY ONE AXIS.
DUPLICATION ACROSS AXES IS A CONTRACT VIOLATION.
```

- A pack **may not** override a preset knob; it overrides `preset.id`.
- A profile **may not** override a preset knob; it overrides `preset.id`.
- A preset **may not** override `cost_profile`; the user does that.
- The CI `task lint-config-schema` (added in Phase 1) hard-fails on a
  pack/profile YAML that names any preset-owned knob.

## Consequences

### Positive

- Phase 1 ships the profile loader against a fixed surface (`profile.id`
  → audience + `preset.id` + persona). No 12-knob inheritance ambiguity.
- Phase 1 item 4 (Config Presets) owns the knobs alone. The "Cost
  Enforcement" section in [`config-presets.md`](../contracts/config-presets.md)
  has a single home.
- Phase 2 item 7 (Workflow Packs) is a 4-tuple, not a re-implementation
  of profile + preset. Pack YAML stays under 30 lines.
- `cost_profile` keeps its single-axis charter; this ADR explicitly
  refuses to fold it into the preset layer.

### Negative

- One more concept on the install screen (`profile` + `preset` + `pack`
  + `cost_profile` = four axes). Mitigated by: the wizard (Phase 1 item
  2) only asks for **profile** + **stack** + **risk appetite** and
  derives the rest. Packs are opt-in; `cost_profile` keeps its
  `balanced` default.
- A skill-allowlist conflict between a pack and a runtime CLI flag is
  resolved by "runtime wins". Users on a pack who shadow-disable a
  skill will not see it again until the override is removed.

### Neutral

- This ADR records the boundary; it does **not** specify the seed
  values for any axis. Profile IDs live in
  [`docs/contracts/profile-system.md`](../contracts/profile-system.md)
  (Phase 1 item 1). Preset knobs live in
  [`docs/contracts/config-presets.md`](../contracts/config-presets.md)
  (Phase 1 item 4). Pack shape lives in `docs/contracts/workflow-packs.md`
  (Phase 2 item 7).

## See also

- [`docs/contracts/cost-profile-defaults.md`](../contracts/cost-profile-defaults.md) — the existing `cost_profile` contract this ADR explicitly does **not** touch.
- [`agents/roadmaps/step-15-product-refinement.md`](../../agents/roadmaps/step-15-product-refinement.md) — Phase 1 items 1, 4 and Phase 2 item 7.
- [`agents/runtime/council/responses/2026-05-16-step-15-product-refinement-v3.json`](../../agents/runtime/council/responses/2026-05-16-step-15-product-refinement-v3.json) — Council v3 action #2 (origin). <!-- council-ref-allowed: ADR decision-trace to originating council response -->
