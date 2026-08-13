---
model_tier: high
name: design-system-generate
pack: engineering-base
tier: 2
visibility: internal
cluster: design-system
sub: generate
skills: [corpus-grounding, design-intelligence, design-system-capture]
description: Ground a design system in the curated design corpus from a product or industry brief, then optionally persist it as MASTER.md or seed DESIGN.md.
argument-hint: "<product / industry / keywords>"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - engineering
packs:
  - frontend-design
---

# /design-system:generate

Run the grounded one-shot over the curated corpus and print the full
recommendation. Args: `"<product / industry / keywords>"`.

```bash
npx tsx node_modules/@event4u/agent-config/src/skills/corpus-grounding/scripts/ground.ts \
    ground "<query>" \
    --manifest node_modules/@event4u/agent-config/src/skills/design-intelligence/data/manifest.json
```

Add `--persist <dir> --project-name <name>` to write
`design-system/<slug>/MASTER.md`, and `--page <name>` for a page-override stub
alongside it. The engine is read-only without `--persist`.

## After the recommendation

Offer both destinations, and let the human pick — they are different artifacts,
not two spellings of one:

- **`MASTER.md` + page overrides** (`--persist`) — the interchange format, good
  for handing a system to another tool or to a designer.
- **`DESIGN.md`** via [`design-system-capture`](../../skills/design-system-capture/SKILL.md)
  — this package's canonical design memory, the file every later design task
  reads. Seed it when the system is for *this* repo's own work.

## Rules

- **Generated output is a proposal.** A provided artifact, registered brand
  tokens, and a confirmed `DESIGN.md` outrank it — never overwrite a confirmed
  decision with a generated default.
- **Never persist silently.** `--persist` is the human's choice, and `DESIGN.md`
  is seeded per field, not written wholesale.
