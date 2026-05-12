# Antigravity Setup

Antigravity (Google's agentic IDE) reads the Anthropic-shaped
markdown skill bundle from its user-scope anchor `~/.agents/`. The
package deploys via the universal skill convention; project-scope
bridge is not yet wired (Phase 2.4 anchor).

## Prerequisites

- Antigravity IDE.
- Node.js ≥ 18 for the install entrypoints.

## Install

Global only (canonical scope):

```bash
npx @event4u/agent-config init --tools=antigravity --global
```

Populates:

- `~/.agents/skills/`   — Anthropic-shaped skill bundle
- `~/.agents/rules/`    — kernel + tier-1/2 rules
- `~/.agents/personas/` — review-lens personas

(Project-scope `--tools=antigravity` is rejected with exit code 1
— Antigravity has no documented project-discovery convention yet.)

## How to use

- Antigravity reads the skill bundle from `~/.agents/skills/` on
  every session — no manual action required.
- Slash commands (`/work`, `/implement-ticket`, `/commit`,
  `/create-pr`, …) ship inside the skill bundle as named skills.
  Invoke them by name in chat.
- Antigravity ships an agent-orchestration surface; point it at
  the project root so the agent can locate `AGENTS.md` and the
  project's own `agents/` overlay.

## Verification

```bash
test -d ~/.agents/skills
test -d ~/.agents/rules
```

In Antigravity: ask *"What is this repo?"* — the answer should
cite the AGENTS.md emergency triage block when the workspace is
open.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=antigravity --global --force`. |
| `--tools=antigravity` rejected | Add `--global` (Antigravity has global-only scope). |
| `~/.agents/` collides with another tool | The anchor is shared by convention; coexists with other agents that use the same path. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
