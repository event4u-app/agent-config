---
title: Architecture Overview
description: agent-config as a content + governance layer — the four artifact types, zero runtime, and what it deliberately is not.
---

agent-config is a **content + governance layer**, not an agent runtime. The
agent loop, the model dispatcher, and tool orchestration all stay with the host
tool; agent-config supplies the *artifacts* and the *discipline* those tools
read.

## The four artifact types (+ personas)

| Artifact | Count | Role |
|---|---|---|
| **Skills** | 278 | Intent-matched capabilities and executable procedures |
| **Rules** | 105 | Always-active behaviour constraints, auto-loaded per conversation |
| **Commands** | 190 | Slash-command orchestrators that compose skills + gates |
| **Guidelines** | 101 | Reference conventions, read on demand |
| **Personas** | 29 (+5 advisors) | Review lenses dispatched during code/design review |

Skills carry YAML frontmatter and follow the Agent Skills open standard. Rules
split into an always-on **kernel** and trigger-activated tiers — see
[Kernel & Router](/agent-config/architecture/kernel-and-router/).

## Authoring-time vs runtime

The scope line is **authoring-time (in scope) vs runtime (out of scope)**: code
that runs during prompt construction or on an explicit user command — assembling
context for the agent to review — belongs; code that executes autonomously
during agent operation does not.

## What it deliberately is *not*

- **No background daemon** — the host runs the loop.
- **No separate state database.**
- **No self-rewriting memory** — every learned change is human-reviewed.
- **No auto-build pipeline.**

Capability without a process to babysit — and every such claim is
[machine-checked](/agent-config/proof/).

## Next

- [Kernel & Router](/agent-config/architecture/kernel-and-router/)
- [Source of Truth](/agent-config/architecture/source-of-truth/)
- [Trust & Safety](/agent-config/architecture/trust-and-safety/)
