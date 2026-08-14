---
model_tier: medium
name: design-system-capture
pack: engineering-base
visibility: internal
cluster: design-system
sub: capture
skills: [existing-ui-audit, design-system-capture]
description: Inventory this repo's own components and tokens and emit them in the design-system.json shape, so the import path is identical to an external extraction.
argument-hint: "[path]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - engineering
packs:
  - frontend-design
---

# /design-system:capture

Run [`existing-ui-audit`](../../skills/existing-ui-audit/SKILL.md) over the
current repo and emit its inventory as a `design-system.json` artifact — the
same shape an external extraction tool produces, so the import path is identical
either way. Args: optional `[path]` to narrow the scan.

Two sources, one shape: use this for **this** repo, and
[`/design-system:import`](../import/command.md) for a site or repo you do not
own.

## Then hand it over

Pass the emitted artifact to [`design-system-capture`](../../skills/design-system-capture/SKILL.md)'s
import step, which confirms it per field into `DESIGN.md`.

## Rules

- **Set `source` honestly** — `kind: dir`, `ref` = the scanned path,
  `captured_at` = now. An artifact with no provenance is rejected downstream.
- **Observation is not a token.** Anything the audit *noticed* rather than
  *decided* belongs under `_meta`, per the contract's field rules.
- **The audit's own grouping is not the contract's shape.** Map it deliberately;
  do not rename the audit's output keys and call it done.
