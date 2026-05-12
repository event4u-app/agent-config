# Warp Setup

Warp (the AI terminal, <https://www.warp.dev>) reads the
Anthropic-shaped markdown skill bundle from its user-scope anchor
`~/.warp/`. The package deploys via the universal skill convention;
project-scope bridge is not yet wired (Phase 2.4 anchor).

## Prerequisites

- Warp terminal: <https://www.warp.dev/download>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Global only (canonical scope):

```bash
npx @event4u/agent-config init --tools=warp --global
```

Populates:

- `~/.warp/skills/`   — Anthropic-shaped skill bundle
- `~/.warp/rules/`    — kernel + tier-1/2 rules
- `~/.warp/personas/` — review-lens personas

(Project-scope `--tools=warp` is rejected with exit code 1 — Warp
has no documented project-discovery convention yet.)

## How to use

- Warp's **Agent Mode** reads the skill bundle from `~/.warp/skills/`
  on every session — no manual action required.
- Slash commands (`/work`, `/implement-ticket`, `/commit`,
  `/create-pr`, …) ship inside the skill bundle as named skills.
  Invoke them by name in the Warp AI prompt.
- For repository-aware work, `cd` into the project root before
  invoking Agent Mode so the agent can locate `AGENTS.md` and the
  project's own `agents/` overlay.

## Verification

```bash
test -d ~/.warp/skills
test -d ~/.warp/rules
```

In Warp: open Agent Mode and ask *"What is this repo?"* — the
answer should cite the AGENTS.md emergency triage block when the
working directory is inside the project.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=warp --global --force`. |
| `--tools=warp` rejected | Add `--global` (Warp has global-only scope). |
| AGENTS.md not picked up | `cd` into the project root before invoking Agent Mode. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
