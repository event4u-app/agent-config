# CodeBuddy Setup

CodeBuddy (Tencent's AI coding assistant) reads the Anthropic-shaped
markdown skill bundle from its user-scope anchor `~/.codebuddy/`.
The package deploys via the universal skill convention; project-scope
bridge is not yet wired (Phase 2.4 anchor).

## Prerequisites

- CodeBuddy extension / CLI.
- Node.js ≥ 18 for the install entrypoints.

## Install

Global only (canonical scope):

```bash
npx @event4u/agent-config init --tools=codebuddy --global
```

Populates:

- `~/.codebuddy/skills/`   — Anthropic-shaped skill bundle
- `~/.codebuddy/rules/`    — kernel + tier-1/2 rules
- `~/.codebuddy/personas/` — review-lens personas

(Project-scope `--tools=codebuddy` is rejected with exit code 1 —
CodeBuddy has no documented project-discovery convention yet.)

## How to use

- CodeBuddy reads the skill bundle from `~/.codebuddy/skills/` on
  every session — no manual action required.
- Slash commands (`/work`, `/implement-ticket`, `/commit`,
  `/create-pr`, …) ship inside the skill bundle as named skills.
  Invoke them by name in chat.
- For repository-aware work, open the project root in CodeBuddy
  so the agent can locate `AGENTS.md` and the project's own
  `agents/` overlay.

## Verification

```bash
test -d ~/.codebuddy/skills
test -d ~/.codebuddy/rules
```

In CodeBuddy: open the chat panel and ask *"What is this repo?"*
— the answer should cite the AGENTS.md emergency triage block
when the workspace is open.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=codebuddy --global --force`. |
| `--tools=codebuddy` rejected | Add `--global` (CodeBuddy has global-only scope). |
| AGENTS.md not picked up | Open the project root in CodeBuddy; the agent reads `AGENTS.md` from the workspace. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
