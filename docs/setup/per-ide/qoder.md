# Qoder Setup

Qoder (<https://qoder.com>) reads the Anthropic-shaped markdown
skill bundle from its user-scope anchor `~/.qoder/`. The package
deploys via the universal skill convention; project-scope bridge
is not yet wired (Phase 2.4 anchor).

## Prerequisites

- Qoder IDE: <https://qoder.com>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Global only (canonical scope):

```bash
npx @event4u/agent-config init --tools=qoder --global
```

Populates:

- `~/.qoder/skills/`   — Anthropic-shaped skill bundle
- `~/.qoder/rules/`    — kernel + tier-1/2 rules
- `~/.qoder/personas/` — review-lens personas

(Project-scope `--tools=qoder` is rejected with exit code 1 —
Qoder has no documented project-discovery convention yet.)

## How to use

- Qoder reads the skill bundle from `~/.qoder/skills/` on every
  session — no manual action required.
- Slash commands (`/work`, `/implement-ticket`, `/commit`,
  `/create-pr`, …) ship inside the skill bundle as named skills.
  Invoke them by name in chat.
- For repository-aware work, point Qoder at the project root so
  the agent can locate `AGENTS.md` and the project's own
  `agents/` overlay.

## Verification

```bash
test -d ~/.qoder/skills
test -d ~/.qoder/rules
```

In Qoder: open the chat panel and ask *"What is this repo?"* —
the answer should cite the AGENTS.md emergency triage block when
the workspace is open.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=qoder --global --force`. |
| `--tools=qoder` rejected | Add `--global` (Qoder has global-only scope). |
| AGENTS.md not picked up | Open the project root in Qoder; the agent reads `AGENTS.md` from the workspace. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
