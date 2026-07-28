---
title: Packs & Workspaces
description: How packs and workspaces scope the projected artifact surface, and the discovery frontmatter that drives them.
---

A **pack** is an opt-in capability bundle — technically a frontmatter *tag* on
artifacts, not a directory. A **workspace** groups related packs. Install is
**pack-scoped**: only your active packs are written, not the whole library.

```yaml
# .agent-settings.yml
projection:
  mode: legacy-all            # default: project everything
  rule_packs: []              # opt-in packs when mode: scoped (ADR-040)
```

## The vocabularies

- Workspaces: [`src/config/discovery/workspaces.yml`](https://github.com/event4u-app/agent-config/blob/main/src/config/discovery/workspaces.yml)
  (9 workspaces — engineering, product, finance, founder, gtm, ops, …).
- Packs: [`src/config/discovery/packs.yml`](https://github.com/event4u-app/agent-config/blob/main/src/config/discovery/packs.yml)
  (21 packs — e.g. `engineering-base`, `git`, `php`, `laravel`, `symfony`,
  `finance-basic`, `founder-strategy`).

## Discovery frontmatter

Every non-kernel artifact carries five discovery keys: `workspaces:`, `packs:`,
`lifecycle:`, `trust:`, `install:`. A build step
(`scripts/build_discovery_manifest`) walks the source, validates the
frontmatter, and writes `dist/discovery/discovery-manifest.json`. Consumers pick
packs at install time; the resulting `.agent-settings.yml` records the opted-in
set.

## Projection modes

- `legacy-all` (default) — every tool tree gets the full surface.
- `scoped` (ADR-040, opt-in) — the projector writes only
  `profile.packs ∪ runtime.active_packs`, expanded over the `requires`
  dependency graph.

For the full contract, see
[`capability-packs.md`](https://github.com/event4u-app/agent-config/blob/main/docs/contracts/capability-packs.md).
