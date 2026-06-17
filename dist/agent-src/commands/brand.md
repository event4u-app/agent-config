---
model_tier: inherit
name: brand
pack: brand
tier: 2
visibility: internal
cluster: brand
type: orchestrator
description: Brand-as-UX orchestrator — strategy, identity, tokens, review, voice. Routes to the brand-grounding skills that constrain the design layer.
suggestion:
  eligible: true
  trigger_description: "work on our brand, define brand strategy/identity/voice, derive brand tokens, audit brand consistency"
  trigger_context: "user wants to define or govern a brand layer (positioning, identity, tokens, voice) that constrains the UI"
workspaces:
  - small-business
packs:
  - brand
---

# /brand

Top-level orchestrator for the `/brand:*` family — brand as a first-class UX
layer that **constrains** the UI. Consulted **before**
[`design-intelligence`](../../skills/design-intelligence/SKILL.md) so brand
bounds style selection. Designer flow: discover → strategy → identity → tokens →
application → governance. Derived brand tokens are the export pack-ai-image's
brand-asset generation and the greenfield scaffold seed consume (B → A).

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/brand:strategy "<brief>"` | `commands/brand/strategy.md` | Positioning, archetype, voice, tone, messaging over the brand corpus |
| `/brand:identity "<strategy ref>"` | `commands/brand/identity.md` | Logo/colour/type/imagery direction; defines the token constraints |
| `/brand:tokens "<identity ref>"` | `commands/brand/tokens.md` | Derive a DTCG `.tokens.json` source of truth → CSS vars + Tailwind |
| `/brand:review "<artifact>"` | `commands/brand/review.md` | Audit emitted UI/copy/assets against active brand tokens + voice |
| `/brand:voice "<brand ref>"` | `commands/brand/voice.md` | Define the voice-and-tone profile the consistency gate checks copy against |

## Dispatch

1. Parse `/brand <sub-command> [args]`. Sub-command = first token; match against
   the table's exact names only.
2. Look up the sub-command and execute its file verbatim with the remaining args.
3. Unknown / missing sub-command → print the table and ask which stage to run.

## Rules

- **Do NOT commit, push, or open a PR** — subcommands never do this.
- **Do NOT chain subcommands.** One `/brand <sub>` per turn.
- **Consumer brand tokens are the source of truth.** Corpus only fills gaps; a
  value not traceable to a brand token or voice rule is off-brand (per
  [`brand-consistency`](../rules/brand-consistency.md)).
- **Edit `src/` only.** Generated mirrors regenerate.

## See also

- [`brand-strategy`](../../skills/brand-strategy/SKILL.md) · [`brand-identity`](../../skills/brand-identity/SKILL.md) · [`brand-to-tokens`](../../skills/brand-to-tokens/SKILL.md) · [`brand-audit`](../../skills/brand-audit/SKILL.md) · [`voice-and-tone-design`](../../skills/voice-and-tone-design/SKILL.md) — the skills these commands invoke.
- [`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md) — `brand` cluster registration.
