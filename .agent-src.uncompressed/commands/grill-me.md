---
name: grill-me
description: Alias for /challenge-me — interactive grill-style interview that sharpens a fuzzy plan/idea into a copyable Markdown pitch
cluster: challenge-me
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "grill me, grill me on this, grill me on this plan, grill me through this, grill me on the idea, grill me until it's clear, grill me hard"
  trigger_context: "user has a fuzzy plan/idea/feature draft and wants it sharpened interactively rather than reconstructed in one shot"
---

# /grill-me

Alias for [`/challenge-me`](challenge-me.md). Identical behaviour,
identical sub-commands (`vision`, `with-docs`), identical in-interview
triggers (`!pitch`, `!roadmap`, `!ai`). Provided so users who think of
the workflow as "grill me" rather than "challenge me" land on the same
dispatcher without a second hop.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/grill-me vision` | `commands/challenge-me/vision.md` | Standard variant — interrogate to 95 % confidence, emit a vision pitch |
| `/grill-me with-docs` | `commands/challenge-me/with-docs.md` | Doc-aware variant — same flow plus glossary + claim-vs-code verification against `CONTEXT.md` / ADRs |

## Dispatch

1. Parse the user's argument: `/grill-me <sub-command> [flags] [seed]`.
2. Load [`commands/challenge-me.md`](challenge-me.md) and follow its
   `## Dispatch` section verbatim with the same sub-command + flags + seed.
3. If the sub-command is unknown or missing, print the menu from
   `challenge-me.md` (do not guess).

## Rules

- This file is a **thin alias** — all behaviour, in-interview triggers,
  cost-gate semantics, and file-write rules live in
  [`commands/challenge-me.md`](challenge-me.md) and the routed
  sub-command files. Do not duplicate them here; edit them there.
- The suggestion engine surfaces this command for free-form "grill me"
  prompts; the slash form `/grill-me` is the direct invocation path.
