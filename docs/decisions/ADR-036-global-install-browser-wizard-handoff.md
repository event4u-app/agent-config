---
adr: 036
status: accepted
date: 2026-06-01
decision: global-install-browser-wizard-handoff
supersedes: —
superseded_by: —
phase: v5.x · install-UX consistency
type: forward-looking
---

# ADR-036 — Global install hands off to the browser wizard (zero terminal prompts)

## Status

**Accepted** · 2026-06-01. Implements the install-UX half of
[`road-to-self-update-and-global-hook-resolution`](../../agents/roadmaps/road-to-self-update-and-global-hook-resolution.md)
(Phase 6). Builds on [`ADR-020`](ADR-020-global-only-consumer-scope.md)
(global-only consumer scope) and reuses the wizard contract from
[`gui-wizard`](../contracts/gui-wizard.md).

## Context

`npx @event4u/agent-config init` is the canonical first-time install
(README Quickstart) and `agent-config upgrade` is the self-update path
(ADR-020 update-lag fix). Both reach the global install through
`scripts/install --global` → `install.py` `install_global()`. Field use
surfaced four defects that made the global path drop into terminal
interaction instead of the browser wizard the project path already used:

1. **Terminal tool-picker.** `scripts/install`'s `prompt_tools()` fired
   on every interactive run, pre-empting the wizard and — via
   `TOOLS_EXPLICIT` — suppressing it (`_wizard_should_launch` treats an
   explicit `--tools=` as "headless").
2. **No wizard on `--global`.** `install_global()` returned before the
   `_wizard_should_launch` / `_wizard_spawn` block; only the project
   path launched the GUI.
3. **Browser never opened.** `_wizard_await_ready` **printed** the
   `WIZARD_READY` URL but never opened it (the child is spawned with
   `--no-open` so the Python parent owns the open — it only printed).
4. **Wrong identity + ADR-020 leak.** Spawning the wizard with
   `--project-root <detect_root>` forced project write-root, so the
   wizard read neither nor wrote the **global**
   `~/.event4u/agent-config/settings/.agent-user.yml` (the saved
   identity → name/language pre-fill defaulted to the OS account, e.g.
   `mathiasberg`, instead of the saved `Matze`/`de`), and global content
   would land in the project tree — an ADR-020 violation.

## Decision

On the interactive global-install path (`agent-config init` / `global` /
`upgrade` / `refresh --global`), the install is **zero-terminal-interaction
and hands off to the browser wizard**:

- `scripts/install` skips `prompt_tools()` when the wizard will launch
  (TTY · not `CI` · not `AGENT_CONFIG_NO_UI`) — the wizard is the single
  tool-selection surface.
- `install.py` launches the wizard after `install_global()` (parity with
  the project path), gated by the single source of truth
  `_wizard_should_launch`.
- The wizard is spawned **without** `--project-root` so `resolveWriteRoot`
  picks the **global** write root — the saved `.agent-user.yml` drives the
  identity pre-fill, and no global content is written into the project
  tree (reinforces ADR-020).
- `_wizard_await_ready` opens the browser (`webbrowser.open`) after
  printing the URL; the printed URL remains the headless fallback.
- On the wizard-handoff path the run is non-interactive: foreign-file
  conflicts auto-resolve to overwrite and the legacy migration runs
  without the `[Y/n]` gate — no `--force`, no prompts. The wizard is the
  settings + package surface that recreates fresh config.

The terminal picker, conflict prompt, and migrate prompt remain the
behaviour on **headless** paths (no TTY · `CI` · `--no-ui` ·
explicit `--tools=`), where no wizard launches.

## Consequences

**Positive.**
- "Run the command, it installs, then the wizard opens for packages +
  settings" — the contract holds for `init` and `upgrade` alike.
- A returning user's name/language pre-fill from the saved identity, not
  the OS account.
- Global content never leaks into the project tree on the wizard path.

**Negative / trade-offs.**
- Auto-overwrite + auto-migrate on the wizard path remove the per-file
  confirmation. Scoped to the wizard-handoff path on paths agent-config
  owns (ADR-020 global root); headless paths keep the prompts.
- The browser-open + zero-prompt flow cannot be asserted in headless CI;
  the welcome-step identity pre-fill (`Matze`/`de` from the global
  write root) is covered by a Playwright drive.

## Alternatives considered

- **`npx` fallback inside the PostToolUse hook.** Rejected by the
  2026-05-30 council (per-tool-call network + version drift) and again
  2026-06-01; orthogonal to install UX. Hooks resolve the global binary.
- **Keep the terminal prompts, document `--force`.** Rejected — the
  maintainer's explicit contract is zero terminal interaction with a
  browser handoff.

## References

- [`ADR-020`](ADR-020-global-only-consumer-scope.md) — global-only consumer scope.
- [`gui-wizard`](../contracts/gui-wizard.md) — wizard apply contract.
- [`road-to-self-update-and-global-hook-resolution`](../../agents/roadmaps/road-to-self-update-and-global-hook-resolution.md) — companion roadmap.
