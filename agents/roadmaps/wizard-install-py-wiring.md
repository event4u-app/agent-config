---
complexity: lightweight
status: draft
---

# Wizard ↔ install.py wiring

**Status**: draft
**Parent**: `agents/roadmaps/archive/unified-setup-and-settings-gui.md` (Step 3.4 carved out)
**Created**: 2026-05-20

## Goal

Auto-launch the unified setup wizard at the tail of `npx @event4u/agent-config init` so first-run consumers land in the GUI without an extra command. Until this roadmap ships, consumers run `agent-config ui:serve --open` manually after `init`.

## Why carved out from the parent roadmap

`scripts/install.py` is 3868 lines covering alias resolution, hook bridges, dry-run flows, smoke tests, and lock-file management. Threading a child-process spawn + TTY/CI detection + port-file handshake through that surface is a self-contained workstream with its own test matrix and its own failure modes (sub-shell PID leaks on Windows, port collisions on shared CI runners, race between installer exit and wizard server boot). Shipping the GUI first keeps the blast radius of either change tight.

## Acceptance

### Step 1: Installer hook

- [ ] **Edit `scripts/install.py`** — at the end of the existing happy path, **if** all of:
  - `os.environ.get('AGENT_CONFIG_NO_UI')` is unset / falsy
  - `sys.stdout.isatty()` is true
  - `--no-ui` was not passed
  - `--dry-run` was not passed

  …then pick a free port, write it to `<projectRoot>/.agent-config/wizard.port` (mode 0600), print `Setup wizard: http://127.0.0.1:<port>/#/wizard` and exec `node dist/cli/agent-config.js ui:serve --port <port>` as a child process. Otherwise print `Settings unchanged. Run 'agent-config settings' any time to edit.`.
- [ ] **Add flag** `--no-ui` to the installer's arg parser; document under `docs/installation.md`.
- [ ] On wizard finish (`POST /api/v1/wizard/finish` success), the Fastify server unlinks `<projectRoot>/.agent-config/wizard.port`.

### Step 2: Tests

- [ ] `tests/cli/install.wizard.test.ts` — runs `python3 scripts/install.py --dry-run --launch-wizard`, asserts the printed URL contains `/#/wizard`.
- [ ] `tests/cli/install.no-ui.test.ts` — runs `python3 scripts/install.py --dry-run --no-ui`, asserts no URL is printed and no child server is spawned.
- [ ] `tests/server/wizardPortHandshake.test.ts` — server boots with `WIZARD_PORT_FILE=<tmp>`, finish-route deletes the file on success.

### Step 3: Documentation

- [ ] `docs/installation.md` — document `--no-ui`, `AGENT_CONFIG_NO_UI`, and the port-file handshake.
- [ ] `docs/wizard.md` — add an "Auto-launched from `npx … init`" subsection.

### Step 4: Manual gate

- [ ] One developer runs `npx <local-pack> init` end-to-end on macOS, Linux, and Windows (WSL counts as Linux). All three terminate cleanly when the wizard finishes; none leak the child process.

## Out of scope

- TUI fallback for headless SSH sessions (tracked in parent roadmap's "Open questions").
- Auto-relaunch after settings save (the manual `agent-config settings` is the path).
