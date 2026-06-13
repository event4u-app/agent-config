---
model_tier: medium
name: challenge-me
pack: product-reasoning
tier: 2
visibility: internal
description: Challenge-me orchestrator — routes to vision, with-docs
cluster: challenge-me
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "challenge me on this plan, grill me, grill me on this, grill me on this plan, grill me through this, grill me until it's clear, grill me hard, frag mich durch, dreh mich durch die Mangel, challenge against existing docs/glossary"
  trigger_context: "user has a fuzzy plan/idea/feature draft and wants it sharpened interactively rather than reconstructed in one shot — also reachable via /grill-me alias"
workspaces:
  - agent-config-maintainer
packs:
  - product-reasoning
---

# /challenge-me

Top-level orchestrator for the `/challenge-me` family. Walks a decision
tree by asking one question at a time until the agent is confident
enough to emit a copyable Markdown pitch.

> Also reachable as [`/grill-me`](grill-me.md) — thin alias, identical
> behaviour, identical sub-commands and triggers.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/challenge-me vision` | `commands/challenge-me/vision.md` | Standard variant — interrogate a fuzzy plan / idea / ticket draft to 95% confidence, emit a vision pitch |
| `/challenge-me with-docs` | `commands/challenge-me/with-docs.md` | Doc-aware variant — same flow plus session glossary against `CONTEXT.md`, load-bearing claim-vs-code verification, optional `CONTEXT.md` patch + ADR candidates in the pitch |

## When to pick which

- **`vision`** — greenfield idea, fresh ticket draft, or a plan with no
  existing project glossary / domain docs. Default for "challenge me on
  this plan".
- **`with-docs`** — the project has `CONTEXT.md`, an ADR directory
  (`docs/adr/`, `docs/decisions/`, `agents/decisions/`), or the user
  uses domain terms that may already be defined. The variant catches
  glossary conflicts and load-bearing claim-vs-code drift before pitch.

## Dispatch

1. Parse the user's argument: `/challenge-me <sub-command> [flags] [seed]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Steps` section
   verbatim with the remaining flags / seed.
4. If the sub-command is unknown or missing, print the menu and ask:

   > 1. vision — standard 95%-confidence interview, emits a copyable pitch
   > 2. with-docs — same flow, but checks the seed against `CONTEXT.md` /
   >    ADRs and emits an optional doc patch in the pitch

## Rules

- **Do NOT chain sub-commands.** One `/challenge-me <sub>` per turn.
- If the user invokes `/challenge-me` with no argument, **show the menu**
  — do not guess which sub-command they meant.
- **No file writes from either sub-command.** Both variants are
  conversational; the pitch is the only artefact, and it is copyable
  Markdown the user pastes elsewhere. `with-docs` emits its `CONTEXT.md`
  patch and ADR candidates inside the same pitch block — agent does not
  apply them itself.
- **Mirror the user's language** — sub-commands inherit the
  `language-and-tone` Iron Law for question blocks and pitch.
