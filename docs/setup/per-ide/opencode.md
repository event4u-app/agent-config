# OpenCode Setup

OpenCode (<https://opencode.ai>) reads the Anthropic-shaped markdown
skill bundle from its user-scope anchor `~/.opencode/`. The package
deploys via the universal skill convention; project-scope bridge
is not yet wired (Phase 2.4 anchor).

## Prerequisites

- OpenCode CLI / IDE: <https://opencode.ai>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Global only (canonical scope):

```bash
npx @event4u/agent-config init --tools=opencode --global
```

Populates:

- `~/.opencode/skills/`   — Anthropic-shaped skill bundle
- `~/.opencode/rules/`    — kernel + tier-1/2 rules
- `~/.opencode/personas/` — review-lens personas

(Project-scope `--tools=opencode` is rejected with exit code 1 —
OpenCode has no documented project-discovery convention yet.)

## How to use

- OpenCode reads the skill bundle from `~/.opencode/skills/` on
  every session — no manual action required.
- Slash commands (`/work`, `/implement-ticket`, `/commit`,
  `/create-pr`, …) ship inside the skill bundle as named skills.
  Invoke them by name in chat.
- For repository-aware work, run OpenCode from the project root
  so the agent can locate `AGENTS.md` and the project's own
  `agents/` overlay.

## Verification

```bash
test -d ~/.opencode/skills
test -d ~/.opencode/rules
```

In OpenCode: ask *"What is this repo?"* — the answer should cite
the AGENTS.md emergency triage block when the workspace is open.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=opencode --global --force`. |
| `--tools=opencode` rejected | Add `--global` (OpenCode has global-only scope). |
| AGENTS.md not picked up | Run OpenCode from the project root; the agent reads `AGENTS.md` from the workspace. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
