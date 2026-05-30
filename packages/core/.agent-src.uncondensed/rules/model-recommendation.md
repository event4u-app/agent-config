---
type: "auto"
tier: "2a"
description: "Starting a task, switching type, or invoking a skill/command that declares a recommended_model — switch (Claude) or suggest (Augment) the right model"
triggers:
  - phrase: "switch task"
  - phrase: "new task"
  - phrase: "which model"
  - keyword: "recommended_model"
load_context:
  - ../contexts/model-recommendations.md
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Model Recommendation

**Iron Law.** When a skill or command carries a `recommended_model`, route the
turn to that model — automatically where the surface supports a per-turn
override, as a single suggestion where it does not. Never double-ask, never
front-load the question.

## Source of truth — the per-skill field

Each skill/command declares `recommended_model: opus | sonnet | gpt | inherit`
(ADR-034). `inherit` means "no opinion, keep the session model". The task→model
heuristics that seeded those tags live in
[`contexts/model-recommendations.md`](../contexts/model-recommendations.md) —
cite them, don't restate.

## Surface-aware behaviour

Read `model.auto_switch` from `.agent-settings.yml` (`auto | suggest | off`,
default `suggest`) live, then:

- **Claude Code / Desktop (native per-turn `model:` override).** When
  `auto_switch: auto`, the rendered skill's native `model:` frontmatter already
  performed the switch for this turn — **do NOT ask, do NOT re-state it**. When
  `suggest`, no native key was emitted; surface the one-question suggestion
  below using the skill's `recommended_model`.
- **Augment and any surface without per-turn override.** There is no native
  switch. When `auto_switch` is `auto` or `suggest`, surface **one** switch
  suggestion (per [`ask-when-uncertain`](ask-when-uncertain.md)) using the
  skill's `recommended_model`. Never auto-act — Augment cannot.
- **`auto_switch: off`.** Inert. No native key is emitted and no suggestion is
  surfaced.

`gpt`-tagged artefacts never auto-switch on Claude (no Claude tier) — they
surface as a suggestion on every surface.

## The suggestion (non-auto surfaces)

Ask **last** — after context / domain clarification, never before the task is
understood. One question:

```
> 💡 This skill recommends **{recommended_model}** for {task type}.
>
> 1. Switch to {recommended_model} — continue
> 2. Stay on the current model
```

On "switched" → accept, continue, no follow-up. On "stay" → accept, no
pushback; do not re-ask until the task type changes.

## Preserved flows (re-pointed at the per-skill field)

- **Downgrade reminder.** After an opus-level task (architecture / refactoring /
  root-cause found), remind the user that the implementation phase is cheaper on
  `sonnet` — using the next skill's `recommended_model` as the target. Full flow:
  [`contexts/model-recommendations.md` § Downgrade reminder](../contexts/model-recommendations.md).
- **Gemini warning.** Detected model `gemini` → surface the not-recommended
  warning once, then accept the user's choice. Flow:
  [`contexts/model-recommendations.md` § Gemini warning](../contexts/model-recommendations.md).

## No standing-selection fight

A user's explicit `/model` choice is standing; the native per-turn `model:`
override reverts on the next prompt, so the rule never overrides a standing
selection beyond the current turn. With the default `suggest`, no native key is
emitted at all — the user's `/model` is never silently overridden.
