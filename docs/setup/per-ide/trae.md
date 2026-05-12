# Trae Setup

Trae (ByteDance's AI IDE, <https://trae.ai>) reads the Anthropic-shaped
markdown skill bundle from its user-scope anchor `~/.trae/`. The
package deploys via the universal skill convention; project-scope
bridge is not yet wired (Phase 2.4 anchor).

## Prerequisites

- Trae IDE: <https://trae.ai>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Global only (canonical scope):

```bash
npx @event4u/agent-config init --tools=trae --global
```

Populates:

- `~/.trae/skills/`   — Anthropic-shaped skill bundle
- `~/.trae/rules/`    — kernel + tier-1/2 rules
- `~/.trae/personas/` — review-lens personas

(Project-scope `--tools=trae` is rejected with exit code 1 — Trae
has no documented project-discovery convention yet.)

## How to use

- Trae reads the skill bundle from `~/.trae/skills/` on every
  session — no manual action required.
- Slash commands (`/work`, `/implement-ticket`, `/commit`,
  `/create-pr`, …) ship inside the skill bundle as named skills.
  Invoke them by name in chat.
- Trae exposes **Chat** and **Builder** modes; both surfaces read
  the same skill bundle. Builder is the closest match for the
  package's `/implement-ticket` flow.

## Verification

```bash
test -d ~/.trae/skills
test -d ~/.trae/rules
```

In Trae: open the Chat panel and ask *"What is this repo?"* — the
answer should cite the AGENTS.md emergency triage block when the
workspace is open.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Skills not listed | Re-run `npx @event4u/agent-config init --tools=trae --global --force`. |
| `--tools=trae` rejected | Add `--global` (Trae has global-only scope). |
| Builder ignores rules | Reload the Trae workspace; the bundle is indexed on session start. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
