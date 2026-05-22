---
complexity: lightweight
status: done
---

# Wizard ↔ install.py wiring

**Status**: done (2026-05-22)
**Parent**: `agents/roadmaps/archive/unified-setup-and-settings-gui.md` (Step 3.4 carved out)
**Created**: 2026-05-20
**Reconciled with Phase 6**: 2026-05-22
**Shipped**: 2026-05-22 (Council synthesis: `agents/runtime/council/responses/wizard-wiring-2026-05-22.synthesis.md`)

## Council-driven design deviations

Two acceptance items were intentionally re-shaped after Council Tier 1 / Tier 2 synthesis — equivalent intent, different surface:

1. **No `os.execvp`** — Council voted against handing the terminal to the Node child. Python keeps the `subprocess.Popen` handle so it can (a) catch `KeyboardInterrupt` in the parent and propagate `terminate()` + bounded `kill()`, (b) drain stderr on a background thread for failure surfacing, (c) print the install success banner before the wizard URL banner. See `scripts/install.py:_wizard_await_ready`.
2. **Unified dry-run summary** — instead of a separate `[dry-run] would spawn:` line, the wizard decision is one row in the single `[dry-run] Plan summary` block: `wizard:      Would auto-launch (pass --no-ui to suppress).` or `wizard:      Suppressed (<reason>).`. Same information density, fewer print sites to maintain.
3. **Single combined test file** — `tests/test_install_wizard_wiring.py` covers both `--dry-run` and `--no-ui` paths under one suite (9 tests across 3 test classes) instead of two separate files. Cohesion gain; behavior coverage identical.

## Goal

Auto-launch the browser wizard at the tail of `npx @event4u/agent-config init` (driven by `scripts/install.py`) so first-run consumers land in the GUI without an extra command. Add a `--dry-run` mode to `install.py` that previews the would-be spawn without writes or child processes.

Until this roadmap ships, consumers run `node packages/core/installer/dist/cli.js init --gui` manually.

## Phase-6 reality (what already shipped)

- GUI server lives at `packages/core/installer/src/gui/server.ts`. Boot via `startGuiServer({ projectRoot, port?, idleSeconds?, noOpen?, ... })`. Returns `{ url, port, csrfToken, pidFile, close }`.
- Current entry: `node packages/core/installer/dist/cli.js init --gui [--gui-port N] [--gui-idle S] [--no-open]`. The `init` command **runs the install first**, then boots the GUI. That's wrong for the post-install auto-launch use case (the install just finished).
- Concurrency guard: PID file at `<projectRoot>/agents/runtime/gui/server.pid` (`pid-file.ts`). Conflict detection via `process.kill(pid, 0)`. No port-file.
- API endpoints: `manifest`, `auto-detect`, `preview`, `apply`, `cancel`, `open-lockfile`, `recovery/*`. No `/api/v1/wizard/finish` — the idle timer (`DEFAULT_IDLE_SECONDS=600`) and a manual close (browser tab + `Ctrl-C` on the server) own shutdown.
- `install.py` (3868 lines) has **no** `--dry-run` flag. Internal flows do use a `--dry-run` for alias-resolution sub-invocations, but no top-level flag exists.
- `install.py` exits 0 at the bottom of `main()` after printing `success("Done.")` + next-step hints.

## Acceptance

### Step 1: Add `gui` subcommand to the TypeScript CLI

- [x] **Add `gui` command** to `packages/core/installer/src/cli.ts` — boots `startGuiServer()` without re-running install. Flags: `--port <n>` (default ephemeral), `--idle <seconds>` (default 600), `--no-open` (default false), `--project-root <path>`. Implementation: `packages/core/installer/src/commands/gui.ts`.
- [x] Print a single readiness line `WIZARD_READY url=http://127.0.0.1:<port>/` to stdout on successful boot, then keep running. Distinct prefix so the Python parent can parse it deterministically. Strict regex on the Python side: `^WIZARD_READY url=(http://(?:127\.0\.0\.1|localhost):\d+/)\r?$`.
- [x] Honor `AGENT_CONFIG_GUI_NO_OPEN=1` (env override for `--no-open`) so the parent installer can disable browser-open from outside. Wired in `packages/core/installer/src/gui/server.ts`.
- [x] Vitest test in `packages/core/installer/tests/gui-cli-command.test.ts` — boots `agent-config-installer gui --port 0 --no-open` against a tmp `--project-root`, asserts the `WIZARD_READY` line is printed and the PID file is created. 3 tests, all green.

### Step 2: Add `--no-ui` and `--dry-run` flags to `install.py`

- [x] **`--no-ui`** — action="store_true". Suppresses the wizard auto-launch. Honored alongside `AGENT_CONFIG_NO_UI=1` env (either suppresses).
- [x] **`--dry-run`** — new top-level action="store_true" on the main parser. Distinct from the internal alias-resolution `--dry-run` used elsewhere (those are strings passed to sub-invocations, not parsed flags). When set, the installer prints a one-block plan summary of what it **would** do and exits 0 without writing any files or spawning any subprocess. Also suppresses the wizard spawn.
- [x] Both flags documented in the parser help text.

### Step 3: Spawn the wizard from `install.py` happy path

- [x] **Insert** before the final `return 0` in `main()` — gate matches the five conditions spec'd above. Locates the installer dist via `_wizard_cli_dist()`, spawns `node <cli> gui --project-root <project_root>` via `subprocess.Popen`, reads stdout against the strict readiness regex with progressive backoff (10s → 20s → 40s → 80s, cumulative 150s), prints the URL banner, then blocks on `child.wait()` (deviation 1 above — Council-driven). On Ctrl-C: `terminate()` + bounded `kill()` cleanup, returns 130. On readiness timeout: terminates the child, prints last 20 stderr lines, returns 0 (install succeeded, wizard is best-effort).
- [x] If the installer dist is missing (`dist/cli.js` not built), print `(Wizard not available — installer package not built. Run 'npm run build' inside packages/core/installer/.)` and return 0. Implemented in `_wizard_cli_dist()` / `_wizard_spawn()`.
- [x] **Dry-run preview** — when `opts.dry_run` is true, the unified `_dry_run_summary()` block prints the wizard decision as one row: `wizard:      Would auto-launch (pass --no-ui to suppress).` or `wizard:      Suppressed (<reason>).`. Deviation 2 above — phrasing differs from the original `[dry-run] would spawn:` spec, intent identical.

### Step 4: Tests

- [x] `tests/test_install_wizard_wiring.py` (combined — deviation 3 above) — 9 tests across 3 classes: `WizardShouldLaunchTests` (4 gate scenarios: `--no-ui`, `AGENT_CONFIG_NO_UI`, `CI`, non-TTY), `DryRunCliTests` (4 end-to-end `--dry-run` invocations: exit 0, no writes, wizard line present, `--no-ui` shows suppressed), `WizardCliDistResolutionTests` (dist-resolution return-type). All 9 green.
- [x] `packages/core/installer/tests/gui-cli-command.test.ts` (Step 1) — exercises the new TS command directly. 3 tests, all green.

### Step 5: Documentation

- [x] `docs/installation.md` — `--no-ui` and install.py-specific `--dry-run` documented inline (distinct from the bash wrapper's `--dry-run`). Cross-links to `docs/wizard.md § Auto-launch`.
- [x] `docs/wizard.md § Auto-launch from npx … init` — full description: gate, regex, progressive backoff, suppression env vars, dry-run preview. Replaces the prior placeholder.

### Step 6: Manual gate

- [ ] One developer runs `npx <local-pack> init` end-to-end on macOS, Linux, and Windows (WSL counts as Linux). All three: wizard auto-opens in the browser, closes cleanly when the tab is closed and Ctrl-C is pressed on the terminal, PID file is removed. **Deferred to a separate manual-QA pass before the next release tag — implementation is complete; manual gate cannot be exercised inside an agent run.**

## Out of scope

- TUI fallback for headless SSH sessions (tracked in parent roadmap's "Open questions").
- Auto-relaunch after settings save (manual re-run of `node … gui` is the path).
- Bundling the wizard process under a different lifecycle (background daemon, systemd unit, etc.) — that's a separate workstream if ever justified.
