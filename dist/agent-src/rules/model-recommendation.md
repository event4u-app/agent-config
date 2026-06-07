---
type: "auto"
tier: "2a"
description: "Starting a task, switching type, or invoking a skill/command that declares a model_tier — switch (Claude) or suggest (any agent) the right capability tier"
triggers:
  - phrase: "switch task"
  - phrase: "new task"
  - phrase: "which model"
  - keyword: "model_tier"
load_context:
  - ../contexts/model-recommendations.md
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Model Recommendation

**Iron Law.** When a skill or command carries a `model_tier` (a vendor-neutral
capability band), route the turn to **that agent's best model in that band** —
automatically where the surface supports a per-turn override, as a single
suggestion where it does not. Never recommend another vendor's model. Never
double-ask, never front-load the question.

## Source of truth — the capability tier

Each skill/command declares `model_tier: lite | medium | high | inherit`
(ADR-035) — a band, not a model. `inherit` = "no opinion, keep the session
model". The task→tier heuristics live in
[`contexts/model-recommendations.md`](../contexts/model-recommendations.md) —
cite them, don't restate. The **only** tier→model mapping the package maintains
is the Claude generator's (`high→opus`, `medium→sonnet`, `lite→haiku`); every
other agent resolves the band to its own line-up.

## Surface-aware behaviour

Read `model.auto_switch` from `.agent-settings.yml` (`auto | suggest | off`,
default `suggest`) live, then:

- **Claude Code / Desktop (native per-turn `model:` override).** When
  `auto_switch: auto`, the rendered skill's native `model:` (mapped from the
  tier by the generator) already performed the switch — **do NOT ask, do NOT
  re-state it**. When `suggest`, no native key was emitted; surface the
  one-question suggestion below using the skill's `model_tier`.
- **Any surface without a per-turn override (Augment, etc.).** When
  `auto_switch` is `auto` or `suggest`, surface **one** suggestion (per
  [`ask-when-uncertain`](ask-when-uncertain.md)) naming the **tier** — the user
  maps it to their agent's model. Do NOT name a specific vendor model; the
  package keeps no per-vendor table. Never auto-act where the surface can't.
- **`auto_switch: off`.** Inert. No native key, no suggestion.

## The suggestion (non-auto surfaces)

Ask **last** — after context / domain clarification, never before the task is
understood. Name the tier, not a vendor model:

```
> 💡 This skill recommends the **{model_tier}** capability tier for {task type}.
>
> 1. Switch to your **{model_tier}**-tier model — continue
> 2. Stay on the current model
```

(Tier → your model: `high` = your strongest reasoning model, `medium` = your
balanced daily model, `lite` = your fastest/cheapest.) On "switched" → accept,
continue. On "stay" → accept, no pushback; don't re-ask until the task type
changes.

## Preserved flows (re-pointed at tiers)

- **Downgrade reminder.** After a `high`-tier task (architecture / refactoring /
  root-cause found), remind the user that the implementation phase is cheaper on
  the **`medium`** tier — using the next skill's `model_tier` as the target.
  Full flow: [`contexts/model-recommendations.md` § Downgrade reminder](../contexts/model-recommendations.md).
- **Gemini warning.** Detected model `gemini` → surface the not-recommended
  warning once, then accept the user's choice. Flow:
  [`contexts/model-recommendations.md` § Gemini warning](../contexts/model-recommendations.md).

## No standing-selection fight

A user's explicit `/model` choice is standing; the native per-turn `model:`
override reverts on the next prompt, so the rule never overrides a standing
selection beyond the current turn. With the default `suggest`, no native key is
emitted at all — the user's `/model` is never silently overridden.
