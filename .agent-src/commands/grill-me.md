---
name: grill-me
tier: 2
description: Alias for /challenge-me — interactive grill-style interview that sharpens a fuzzy plan/idea into a copyable Markdown pitch
cluster: challenge-me
type: orchestrator
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "grill me, grill me on this, grill me on this plan, grill me through this, grill me on the idea, grill me until it's clear, grill me hard"
  trigger_context: "user has a fuzzy plan/idea/feature draft and wants it sharpened interactively rather than reconstructed in one shot"
---

# /grill-me

Alias for [`/challenge-me`](challenge-me.md). Identical behaviour,
sub-commands (`vision`, `with-docs`), and in-interview triggers
(`!pitch`, `!roadmap`, `!ai`).

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/grill-me vision` | `commands/challenge-me/vision.md` | 95%-confidence interview, emits a vision pitch |
| `/grill-me with-docs` | `commands/challenge-me/with-docs.md` | Same flow plus glossary + claim-vs-code check vs `CONTEXT.md` / ADRs |

## Dispatch

1. Parse: `/grill-me <sub-command> [flags] [seed]`.
2. Load [`commands/challenge-me.md`](challenge-me.md) and follow its
   `## Dispatch` verbatim with the same sub-command + flags + seed.
3. Unknown / missing sub-command → print menu from `challenge-me.md`.

## Rules

- Thin alias — all behaviour, triggers, cost-gate, file-write rules
  live in [`challenge-me.md`](challenge-me.md) and the routed sub-commands.
  Do not duplicate them here; edit them there.
- Suggestion engine surfaces this for free-form "grill me" prompts;
  `/grill-me` is the direct invocation path.
