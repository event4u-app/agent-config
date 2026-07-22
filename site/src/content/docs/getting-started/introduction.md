---
title: Introduction
description: What agent-config is — a content + governance layer for AI coding agents, compiled into 7+ host formats with zero runtime daemon.
---

**agent-config is a content + governance layer for AI coding agents** — a
curated library of skills, rules, commands, guidelines and personas, distributed
on npm as `@event4u/agent-config` and projected into each host tool's native
config format. It follows the [Agent Skills](https://agentskills.io) open
standard and compiles into **7+ host agents** (Claude Code, Cursor, Augment,
Cline, Windsurf, Gemini CLI, GitHub Copilot, and more).

Think of it as a portable playbook and style guide those tools read — **not** a
replacement for them. You bring your own AI provider; agent-config brings the
depth and the discipline.

## What's inside

| Artifact | Count | What it is |
|---|---|---|
| **Skills** | 278 | On-demand expertise and executable procedures, matched to a task by intent |
| **Rules** | 105 | Always-active behaviour constraints auto-loaded every conversation |
| **Commands** | 190 | Slash-command workflow orchestrators (`/commit`, `/create-pr`, `/work`, …) |
| **Guidelines** | 101 | Reference conventions read on demand |
| **Personas** | 29 | Review lenses dispatched during code/design review |
| **Advisors** | 5 | Specialist advisory lenses |

A capability **router** loads the right skill on intent rather than dumping the
whole library into context. See [Architecture](/agent-config/architecture/overview/)
for the full mental model.

## What it deliberately is *not*

A content + governance layer, **not a runtime**:

- **No background daemon** — the host tool runs the agent loop.
- **No separate state database** and **no self-rewriting memory** — every
  learned change is human-reviewed.
- **No auto-build pipeline** — the same layer stays portable across tools.

"Zero runtime daemon" is itself a machine-checked claim. Every public capability
or number binds to resolvable evidence — [verify it yourself](/agent-config/proof/).

## Honest provenance

The skills, rules and personas are distilled from real production work on
TypeScript and PHP codebases. The governance mechanics are stack-agnostic, but
the domain heuristics are richest where they were forged — treat coverage on
other stacks as promising, not proven.

## Next

- [Installation](/agent-config/getting-started/installation/) — the three
  install paths and the host-tool matrix.
- [Quick Start](/agent-config/getting-started/quick-start/) — the 30-second wedge.
