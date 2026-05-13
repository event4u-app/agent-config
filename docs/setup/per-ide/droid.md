# Droid (Factory) Setup

Droid (Factory AI's coding agent, <https://factory.ai>) reads the
Anthropic-shaped markdown skill bundle from its user-scope anchor
`~/.factory/`. The package deploys via the universal skill
convention; project-scope bridge is not yet wired (Phase 2.4
anchor).

## Prerequisites

- Factory CLI / extension: <https://factory.ai>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Global only (canonical scope):

```bash
npx @event4u/agent-config init --tools=droid --global
```

Populates:

- `~/.factory/skills/`   — Anthropic-shaped skill bundle
- `~/.factory/rules/`    — kernel + tier-1/2 rules
- `~/.factory/personas/` — review-lens personas

(Project-scope `--tools=droid` is rejected with exit code 1 —
Droid has no documented project-discovery convention yet.)

## How to use

- Droid reads the skill bundle from `~/.factory/skills/` on every
  session — no manual action required.
- Slash commands (`/work`, `/implement-ticket`, `/commit`,
  `/create-pr`, …) ship inside the skill bundle as named skills.
  Invoke them by name in chat.
- Factory ships **Droids** (named agent profiles); each Droid
  honors the same skill bundle. Pick the Droid that matches the
  task profile (e.g. *Code Droid* for implementation, *Review
  Droid* for PR review).

## Verification

```bash
test -d ~/.factory/skills
test -d ~/.factory/rules
```

In Factory: spawn a Droid and ask *"What is this repo?"* — the
answer should cite the AGENTS.md emergency triage block when the
workspace is open.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=droid --global --force`. |
| `--tools=droid` rejected | Add `--global` (Droid has global-only scope). |
| Droid profile ignores rules | All Factory Droids read the same `~/.factory/skills/` bundle; verify the anchor exists. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
