---
title: Architecture Overview
description: How agent-config is built — the artifact types, the authoring-time scope line, and what it deliberately is not.
---

agent-config is a **content + governance layer**, not an agent runtime. The
agent loop, the model dispatcher, and tool orchestration all stay with the host
tool; agent-config supplies the *artifacts* and the *discipline* those tools
read.

## The artifact types

Current counts are in the [catalog](/agent-config/catalog/).

| Artifact | Role |
|---|---|
| **Skills** | Intent-matched capabilities and executable procedures |
| **Rules** | Always-active behaviour constraints, auto-loaded per conversation |
| **Commands** | Slash-command orchestrators that compose skills + gates |
| **Guidelines** | Reference conventions, read on demand |
| **Personas** | Review lenses dispatched during code/design review |

Skills use the `SKILL.md` format with package-specific top-level frontmatter
keys, validated against this package's own schema. Rules
split into an always-on **kernel** and trigger-activated tiers — see
[Kernel & Router](/agent-config/architecture/kernel-and-router/).

## What stays with the host

- **The agent loop, the model and tool orchestration** stay with the host tool.
- **No separate state database** — settings, memory and roadmaps are files in
  the user's home folder or the repository.
- **No self-rewriting memory** — every learned change is human-reviewed.

Every public claim about these properties is
[machine-checked](/agent-config/proof/).

## Next

- [Kernel & Router](/agent-config/architecture/kernel-and-router/)
- [Source of Truth](/agent-config/architecture/source-of-truth/)
- [Trust & Safety](/agent-config/architecture/trust-and-safety/)
