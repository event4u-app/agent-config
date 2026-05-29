---
type: "manual"
tier: "3"
description: "Writing or reviewing code — check relevant guideline before writing or reviewing code"
alwaysApply: false
load_context:
  - contexts/communication/rules-auto/guidelines-mechanics.md
triggers:
  - intent: "writing code"
  - intent: "reviewing code"
  - keyword: "convention"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Guidelines

Coding guidelines live under `docs/guidelines/` organized by language. **Always check the relevant guideline** before writing or reviewing code.

## How guidelines work

- **Guidelines** = detailed coding conventions (reference material, read on demand).
- **Rules** = always-active behavior constraints (auto-loaded every conversation).
- **Skills** = agent capabilities and workflows (matched by topic).

Guidelines are the "how to write code" docs. Rules enforce critical subsets automatically. Skills reference guidelines when performing related tasks.

## Index — see mechanics

The full file index (PHP, PHP patterns, E2E, agent-infra) plus the guidelines-vs-skills boundary and the "adding new guidelines" template live in [`contexts/communication/rules-auto/guidelines-mechanics.md`](../contexts/communication/rules-auto/guidelines-mechanics.md). The rule above is the obligation surface; the mechanics file is the catalog.
