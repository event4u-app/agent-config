---
model_tier: inherit
name: design-system
pack: engineering-base
tier: 2
visibility: internal
cluster: design-system
type: orchestrator
description: Design-system onramp — generate one from the corpus, import an extractor's output, or capture the current repo's. Three doors onto machinery that already ships.
argument-hint: "[generate|import|capture] [args]"
suggestion:
  eligible: true
  trigger_description: "generate a design system, import extracted design tokens, capture this repo's design system, seed DESIGN.md from a site"
  trigger_context: "user explicitly wants a design system produced, imported, or captured — never suggested for ordinary UI work"
workspaces:
  - engineering
packs:
  - frontend-design
---

# /design-system

Three doors onto machinery this package already ships and nothing could reach.
The grounded generator, its `MASTER.md` persistence, the `design-system.json`
import contract, and the current-repo inventory all existed before this cluster;
what was missing was a way in. So every sub-command below is an entry point, not
a new subsystem.

**Optional means invoked or not invoked.** This cluster adds no settings key, no
always-on rule, and no auto-trigger. It is suggestion-eligible only when a
design-system question is explicit, and otherwise silent.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/design-system:generate "<product / industry / keywords>"` | `commands/design-system/generate.md` | Ground a design system in the curated corpus; optionally persist `MASTER.md` + page overrides, or seed `DESIGN.md` |
| `/design-system:import <file>` | `commands/design-system/import.md` | Run an extractor's output through the three-lane adapter, then the per-field confirmation import |
| `/design-system:capture` | `commands/design-system/capture.md` | Inventory *this* repo's components and tokens and emit the same `design-system.json` shape |

## Dispatch

1. Parse `/design-system <sub-command> [args]`. Sub-command = first token; match
   against the table's exact names only.
2. Look up the sub-command and execute its file verbatim with the remaining args.
3. Unknown / missing sub-command → print the table and ask which door to take.

## Rules

- **Do NOT commit, push, or open a PR** — subcommands never do this.
- **Do NOT chain subcommands.** One `/design-system <sub>` per turn.
- **Generated and imported output is a proposal.** A provided artifact,
  registered brand tokens, and a confirmed `DESIGN.md` all outrank it; a value
  that conflicts with a registered brand token is flagged, never auto-applied
  (per [`brand-source-of-truth`](../rules/brand-source-of-truth.md)).
- **No crawler, browser runtime, or font-bundler is shipped.** Extraction tools
  are user-installed and user-connected; this package's share is the adapter,
  the instructions, and the validation.
- **Edit `src/` only.** Generated mirrors regenerate.

## See also

- [`design-system-capture`](../../skills/design-system-capture/SKILL.md) — owns `DESIGN.md` and the per-field-confirmation import.
- [`corpus-grounding`](../../skills/corpus-grounding/SKILL.md) · [`design-intelligence`](../../skills/design-intelligence/SKILL.md) — the grounded generator behind `:generate`.
- [`existing-ui-audit`](../../skills/existing-ui-audit/SKILL.md) — the current-repo inventory behind `:capture`.
- [`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md) — `design-system` cluster registration.
