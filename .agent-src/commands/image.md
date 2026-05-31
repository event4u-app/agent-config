---
model_tier: inherit
name: image
tier: 2
cluster: image
description: Character-image fidelity orchestrator — analyse, create, and verify a character image against its canon. Routes to analyse, create, verify.
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "analyse a character image against a canon, generate a character image to spec, verify a render's fidelity, character-image accuracy"
  trigger_context: "user supplies a character image or character id and wants analysis, generation, or canon-fidelity verification"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /image

Top-level orchestrator for the `/image:*` family — character-image
**fidelity** work: analyse an image down to the smallest mole, generate one
to spec, verify a candidate against its **Canon Spec**. Schema, rubric, and
the create→analyse→regenerate loop: [`canon-spec.md`](../../skills/image-analyser/canon-spec.md).
Generation is a paid surface: every live provider call is **dry-run /
refuse-and-surface by default** and needs explicit per-turn confirmation per
[`provider-lifecycle-discipline`](../rules/provider-lifecycle-discipline.md).

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/image:analyse <path-or-url> [character-id]` | `commands/image/analyse.md` | Extract a full per-feature spec from an image; diff against a canon, flag drift down to the smallest mole |
| `/image:create <character-id> "<scene>"` | `commands/image/create.md` | Assemble a max-fidelity, anchors-first generation prompt from a Canon Spec; governance- + provider-gated |
| `/image:verify <path-or-url> <character-id>` | `commands/image/verify.md` | Loop-verify a candidate render against its canon; emit the gate verdict + remaining diff |

## Dispatch

1. Parse `/image <sub-command> [args]`. Sub-command = first token; match
   against the table's exact names only. A token that is a **file path or
   URL** (contains `/`, `.`, or a known image extension — e.g. `img_2.png`,
   `shots/veikko.jpg`) is NOT a sub-command: it is the image argument for
   `analyse` / `verify`. Never treat `img_2.png` as the `analyse`
   sub-command. On this ambiguity → ask rather than best-guess.
2. Look up the sub-command and execute its file verbatim with the remaining args.
3. Unknown / missing sub-command → print the table and ask:

   > 1. analyse — extract + diff an image against a canon
   > 2. create — generate a character image to spec
   > 3. verify — loop-verify a render's fidelity

## Rules

- **Do NOT commit, push, or open a PR** — subcommands never do this.
- **Do NOT chain subcommands.** One `/image <sub>` per turn.
- **Generation is a paid, gated surface.** `create` never fires a live
  provider call without surfacing the provider tier and an explicit
  per-turn confirmation; mirrors
  [`non-destructive-by-default`](../rules/non-destructive-by-default.md)
  and [`provider-lifecycle-discipline`](../rules/provider-lifecycle-discipline.md).
- **Governance first.** A real-person likeness routes through
  [`media-governance-routing`](../rules/media-governance-routing.md)
  before any prompt is emitted.
- **Edit `.agent-src.uncondensed/` only.** Generated mirrors regenerate.

## See also

- [`image-analyser`](../../skills/image-analyser/SKILL.md) · [`image-creator`](../../skills/image-creator/SKILL.md) — the skills these commands invoke.
- [`canon-spec.md`](../../skills/image-analyser/canon-spec.md) — schema, fidelity rubric, fidelity loop.
- [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md) — `image` cluster registration.
