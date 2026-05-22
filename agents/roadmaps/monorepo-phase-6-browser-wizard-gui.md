---
complexity: lightweight
status: ready
---

# Monorepo Phase 6 — Browser Wizard GUI (Optional)

> Sixth and final monorepo roadmap. Built on top of Phase 3's TS
> installer and Phase 2's discovery manifest. **Optional by design**
> — the CLI/TUI/agent-mode flow shipped in Phase 3 is the canonical
> install path. The browser wizard is a thin local-only viewer that
> wraps the same agent-mode protocol over HTTP for non-technical
> users who want a visual picker.

## Goal

`npx @event4u/agent-config init --gui` boots a local Node HTTP
server bound to `127.0.0.1`, opens the default browser, and walks
the user through workspace + pack selection with auto-detect hints,
trust banners, and a final summary. On submit, the server invokes
the existing installer in non-interactive mode with the chosen
flags. No cloud calls, no telemetry by default, no auth.

## Prerequisites

- [ ] Phase 3 (TS installer) shipped and stable for at least one
      release cycle
- [ ] Phase 5 (trust) shipped so the wizard can render the
      advisory-pack confirm prompts correctly
- [ ] `dist/discovery/discovery-manifest.json` published with the
      release artefact

## Acceptance criteria

- [ ] `npx @event4u/agent-config init --gui` launches a local
      server on a free 127.0.0.1 port, opens the browser, completes
      an install without the user ever touching a terminal
- [ ] Wizard reads `dist/discovery/discovery-manifest.json` only;
      no other data source
- [ ] Wizard auto-detects `composer.json`, `package.json`,
      `pyproject.toml` and pre-checks suggested packs
- [ ] Server shuts down cleanly after the install completes or the
      user closes the tab; no zombie processes
- [ ] Wizard works offline (no CDN dependencies; assets bundled)
- [ ] All trust banners from Phase 5 render in the GUI exactly as
      they render in the TUI/CLI

## Non-goals

- **Not** a hosted SaaS — local-only, no telemetry, no analytics
- **Not** a marketplace browser — only the packs from the local
  manifest are listed
- **Not** a runtime control panel — the wizard exits after install
- **Not** required — every operation remains achievable via CLI

## Phase 1 — Server skeleton

- [ ] `packages/core/installer/src/gui/server.ts` boots a small
      Node HTTP server (no Express; stdlib `http`); single static
      asset dir + 3 JSON endpoints
- [ ] Endpoints: `GET /api/manifest`, `POST /api/preview`,
      `POST /api/apply`; all backed by the existing installer code
- [ ] Server picks a free port, prints the URL, opens the browser
      via `open` package (cross-platform)
- [ ] Auto-shutdown after `/api/apply` returns success or after 10
      minutes of inactivity

## Phase 2 — Frontend (vanilla, no framework lock-in)

- [ ] `packages/core/installer/src/gui/web/` ships HTML + vanilla
      TypeScript + minimal CSS (no React/Vue/Svelte); compile to a
      single bundled `index.html` via `esbuild`
- [ ] Three screens: workspace picker, pack picker (filtered by
      workspaces), summary + confirm
- [ ] Auto-detect hints come from a `GET /api/auto-detect` call the
      server runs against the consumer CWD
- [ ] Trust banners render as inline warnings on the pack picker;
      advisory packs require an in-page checkbox before next

## Phase 3 — Apply flow

- [ ] `POST /api/apply` calls the installer in non-interactive mode
      with the chosen workspaces + packs + accepted advisories
- [ ] Frontend streams server-sent events for progress;
      shows per-file write log inline
- [ ] On success: summary screen with "Open lockfile" button (opens
      `agents/agent-config.lock.yml` in the OS default editor)
- [ ] On failure: structured error display with retry option

## Phase 4 — Security & ergonomics

- [ ] Server binds 127.0.0.1 only; rejects requests with a
      non-loopback `Origin` header
- [ ] **Host header allowlist** (`127.0.0.1:<port>`, `localhost:<port>`)
      to mitigate DNS-rebinding via form POST that omits `Origin`
- [ ] CSRF token issued on `GET /` and required on every POST
- [ ] No external network calls; CSP `default-src 'self'`
- [ ] `--gui-port=<n>` flag for users who need a fixed port
- [ ] `--no-open` flag for headless servers / SSH tunnel users
- [ ] **Ephemeral port** (`listen(0)`) by default; PID file at
      `<projectRoot>/agents/runtime/gui/server.pid` for stale-process
      cleanup
- [ ] **Transaction log + cancel.** Every planned write appended to
      `<projectRoot>/agents/runtime/gui/install-<ts>.log`;
      `POST /api/cancel` flushes the log and closes the SSE stream;
      next `--gui` boot offers to roll back from the most recent log
- [ ] Idle-timeout key is **last HTTP request timestamp**, not
      last-SSE-event; 10 min default, configurable via `--gui-idle=<n>`
- [ ] Headless graceful degradation: if `open` fails / no DISPLAY,
      print the URL and keep the server alive

## Phase 5 — Distribution & docs

- [ ] GUI assets shipped inside the npm tarball; no separate
      download
- [ ] Tarball size budget: GUI assets under
      `packages/core/installer/src/gui/` (compiled + inlined) add
      ≤ 200 KB; discovery-manifest is out of scope
- [ ] `docs/contracts/gui-wizard.md` documents the architecture, the
      bridge contract, the host+origin allowlist, the rollback log
      shape, and the local-only invariant
- [ ] README quick-start: "non-developers — run
      `npx @event4u/agent-config init --gui`"

## Quality gates

```bash
task installer-test                  # vitest covers GUI handlers
task installer-gui-e2e               # Playwright against the local server
task lint-installer-protocol         # GUI uses the same JSON contract
# remote CI runs the full pipeline; local full runs are skipped
```

## Failure modes guarded against

- **Remote exploitation.** Server bound to 127.0.0.1, origin check,
  **Host header allowlist**, CSRF token, CSP.
- **DNS rebinding.** Origin allowlist alone is insufficient — form POST
  without `Origin` is rejected by the Host header check.
- **Mid-install crash.** Transaction log + `POST /api/cancel` + boot-time
  rollback offer leave no half-written installs behind.
- **Zombie processes.** Ephemeral `listen(0)` port + PID file +
  last-request-timestamp idle timeout. Stale PID files are detected and
  cleaned at next boot.
- **Hidden state.** GUI is stateless past the install; closing the
  tab shuts down the server.
- **Hosted-SaaS scope creep.** Documented non-goal; no auth, no
  account model, no telemetry, no remote endpoints.
- **Browser dependency for CI.** GUI is opt-in; every operation is
  still scriptable via Phase 3's CLI flags.
- **Headless / no-DISPLAY env.** `open` failure prints the URL and keeps
  the server alive; CLI parity is the documented fallback.

## Downstream

This is the terminal phase of the monorepo migration. After ship,
the system matches the AI Council's strategic target: complex inside,
simple outside. Non-technical users get the browser wizard. Power
users keep the CLI. Agents keep the structured JSON protocol. CI
keeps the flag-driven non-interactive mode. All four paths consume
the same discovery manifest and write the same lockfile.
