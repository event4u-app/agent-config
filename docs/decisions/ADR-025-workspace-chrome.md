---
adr: 025
status: accepted
date: 2026-05-24
decision: workspace-chrome
supersedes: —
superseded_by: —
phase: v3.x · employee-product-and-external-proof Phase 4
type: forward-looking
---

# ADR-025 — Workspace chrome — browser tab against the installer GUI

## Status

**Accepted** · 2026-05-24. Third of three sub-ADRs created by
[`ADR-022`](ADR-022-daily-workspace-decomposition.md), depends on
[`ADR-023`](ADR-023-host-agent-protocol.md) (protocol) and
[`ADR-024`](ADR-024-workspace-v0-feature-floor.md) (feature floor).
Picks the UI shape that wraps the v0 feature floor.

## Context

The original Phase 4 question framed chrome as a four-way pick:

| Option | Pitch |
|---|---|
| **(a) Extend installer GUI** | Reuse `packages/core/installer/src/gui/`, add workspace routes. Same loopback server, same CSRF gate, same browser. |
| **(b) Electron / Tauri desktop app** | Native shell, OS integration (tray icon, hotkeys, autostart). |
| **(c) Browser tab against the installer GUI** | Same as (a) on the runtime side, but framed as a standalone surface (`/workspace`) the user bookmarks. |
| **(d) TUI-first** | Terminal UI, optional browser companion. Lowest install footprint. |

The council demanded ADRs 023 and 024 land first. With those in
place: the v0 surface is three small features (launcher, JSONL log,
knowledge stub) talking to a CLI subprocess. There is no need for
OS-level integration, no native APIs to call, no real-time low-latency
rendering. The installer already ships a loopback HTTP + CSRF +
browser-launch path ([`docs/contracts/gui-wizard.md`](../contracts/gui-wizard.md)).

## Decision

Ship workspace v0 as **(c) — a browser tab against the installer
GUI**.

Concretely:

- New route group `/workspace` inside the existing
  `packages/core/installer/src/gui/server.ts` Node server (single
  process, single CSRF token, same loopback bind).
- `npx @event4u/agent-config workspace` opens the browser at the
  `/workspace` route — same launch UX as `init --gui`, different
  default landing page.
- Per-user state lives under `~/.event4u/agent-config/workspace/`
  (sessions JSONL + inbox files per ADR-024).
- The installer GUI and the workspace UI **share the same shell**
  (header, identity strip, theme) so a user installing for the
  first time sees the workspace as the natural next surface.

### Why this option

- **(c)** is the only option that reuses the proven loopback +
  CSRF + browser-launch path. Zero new infrastructure surface.
- **(a)** is functionally identical at runtime — the only delta is
  framing. The framing matters: a user-facing "workspace" needs its
  own URL and bookmark story. (c) gets that for free.
- **(b)** Electron / Tauri adds a ~150 MB install, a code-signing
  story, an autoupdate channel, and a native event loop. None of
  that is needed for the v0 floor; deferred to v1 if recruit
  sessions surface OS-integration demand.
- **(d)** TUI-first is intriguing for the developer audience but
  excludes the non-developer roles (galabau owner, content creator,
  consultant) named in Phase 1 — the audience this roadmap is for.

### Hard rule: no chrome rewrite without recruit-session signal

The chrome choice does **not** survive the recruit sessions
silently. If Phase 1 (recruit sessions) surfaces a hard "browser
tabs are wrong" signal from ≥ 2 of the 3 cohorts, this ADR is
superseded by a new ADR-027 before any further work on the chrome.
A maintainer note (not a vendor lock-in) ensures the rewrite can
happen at v0.5, not v2.

## Consequences

**Positive**

- Zero new infrastructure. Installer GUI is the substrate.
- Cross-platform for free (browser).
- One CSRF / port / bind story across installer + workspace —
  one audit surface, one threat model.

**Negative**

- No native OS hooks (tray icon, global hotkey, autostart). Users
  must manually run `npx ... workspace` to open the tab.
- Browser-tab UX has a "where did my workspace go?" failure mode
  when the tab is closed. Mitigated by a persistent bookmark and a
  reopen-on-launch flag in `.agent-settings.yml`.
- Electron / Tauri loyalists will read this as conservative; the
  v1 ADR can reopen if signal supports it.

**Reversal cost** — medium. Migrating from browser-tab to native
requires re-implementing the shell and the asset bundling pipeline,
but the underlying state model (filesystem JSONL + inbox) is shell-
agnostic.

## Open questions (post-recruit-session)

- Tray-icon / autostart story (Phase 1 + Phase 4 v0.5 — defer).
- Multi-tenant browser surface for the deployed `agent-config`
  topology (covered by [`ADR-021`](ADR-021-deployment-shape.md);
  v0 is single-user local only).

## Cross-references

- Predecessor ADRs: [`ADR-022`](ADR-022-daily-workspace-decomposition.md), [`ADR-023`](ADR-023-host-agent-protocol.md), [`ADR-024`](ADR-024-workspace-v0-feature-floor.md).
- GUI wizard substrate: [`docs/contracts/gui-wizard.md`](../contracts/gui-wizard.md).
- Installer architecture: [`ADR-016`](ADR-016-installer-architecture.md).
- Deployment shape: [`ADR-021`](ADR-021-deployment-shape.md).
