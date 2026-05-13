# Zed Setup

Zed (<https://zed.dev>) reads `.rules` at the project root as
system-level instructions. The bridge drops a marker under `.zed/`
and documents the wiring; Zed itself does not auto-discover
`.zed/agent-config.md`.

## Prerequisites

- Zed editor: <https://zed.dev/download>.
- Node.js ≥ 18 for the install entrypoints.

## Install

Project scope (default):

```bash
npx @event4u/agent-config init --tools=zed
```

Global scope (cross-project, deploys the universal skill bundle to
`~/.config/zed/`):

```bash
npx @event4u/agent-config init --tools=zed --global
```

Populates (project):

- `.zed/agent-config.md` — informational marker
- `AGENTS.md`            — canonical agent self-orientation
- `.agent-settings.yml`  — per-project knobs

## How to use

- After install, append the following line to `.rules` at the
  project root (create the file if missing):

  ```
  @.augment/AGENTS.md
  ```

  Zed reads `.rules` on session start. The `@`-prefix tells Zed to
  inline the referenced file as part of the system prompt.
- Zed's Assistant panel honors the inlined rules across all
  conversation modes.
- Slash commands and skills live under `.augment/commands/` and
  `.augment/skills/`. Zed does not register them natively — invoke
  them by name in chat (e.g. *"run the create-pr command"*).

## Verification

```bash
test -f .zed/agent-config.md
test -f AGENTS.md
grep -q "@.augment/AGENTS.md" .rules
```

In Zed: open the Assistant panel and ask *"What is this repo?"* —
the answer should cite the AGENTS.md emergency triage block.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Assistant ignores rules | Confirm `.rules` exists at project root and contains `@.augment/AGENTS.md`. |
| `.rules` not auto-loaded | Restart Zed; `.rules` is read on session start. |
| Inlined skill missing | Replace `@.augment/AGENTS.md` with the specific skill path you need to inline. |

## Cross-references

- [`AGENTS.md`](../../../AGENTS.md) — canonical agent self-orientation.
- [`docs/installation.md`](../../installation.md) — install matrix index.
