---
stability: beta
keep-beta-until: 2026-08-19
---

# GUI wizard — local browser installer

> Companion to the agent-mode protocol
> ([`installer-agent-mode.md`](installer-agent-mode.md)) and the
> trust-and-safety layer ([`trust-and-safety.md`](trust-and-safety.md)).
> The wizard is a thin HTTP wrapper: it is a **selection front-end**, and
> every real write goes through the single installer
> `scripts/install.py --apply-payload` (D12 / ADR-020). It is **optional by
> design** — the CLI is the canonical entry point; the wizard exists for
> non-technical users who want a visual picker.

## Source of truth

The GUI is a Fastify server (`src/server/`) serving a Preact SPA
(`src/ui/`), booted by the `install` / `setup` / `ui:serve` CLI
subcommands. The legacy `packages/core/installer/src/gui/*` tree was
retired; the single real installer is `scripts/install.py`.

- Server app + security hooks: [`src/server/app.ts`](../../src/server/app.ts) (Host allow-list, Origin allow-list, CSRF token — `onRequest` hooks)
- Wizard routes (incl. the real-apply bridge): [`src/server/routes/wizard.ts`](../../src/server/routes/wizard.ts)
- Read-only install routes (detect / plan-preview / recovery / legacy-v3): [`src/server/routes/install.ts`](../../src/server/routes/install.ts)
- Atomic / 2PC writes: [`src/server/io/atomicWrite.ts`](../../src/server/io/atomicWrite.ts), [`atomicMultiWrite.ts`](../../src/server/io/atomicMultiWrite.ts)
- SPA: [`src/ui/`](../../src/ui/) (entry `src/ui/pages/WizardPage.tsx`)
- CLI boot + `WIZARD_READY` contract: [`src/cli/commands/uiServe.ts`](../../src/cli/commands/uiServe.ts)
- The single installer (all real writes): [`scripts/install.py`](../../src/scripts/install.py)
- Tests: [`tests/server/`](../../tests/server/) + [`tests/e2e/`](../../tests/e2e/)

## Local-only invariant

The server **must** bind to `127.0.0.1` and reject any request whose
`Host` header is not in `{ "127.0.0.1:<port>", "localhost:<port>" }`.
`Origin` is additionally checked on every POST. No CDN, no analytics,
no cross-origin asset, no remote endpoint — CSP
`default-src 'self'` is set on every response.

## Boot sequence

```
agent-config install   (or `setup`, or `init` when the GUI is usable)
  │
  ├─► pick a free loopback port; mint a per-server bearer/CSRF token
  ├─► Fastify listen({ host: '127.0.0.1', port })
  ├─► print `WIZARD_READY <url>` on stdout (url carries `?token=…` + `#/…`)
  ├─► open the OS browser at <url>   (skipped with --no-open / headless)
  └─► serve until the user finishes (Finish → install) or Ctrl-C
```

`init` is the consumer entry point and the install **front-end**: the TS CLI
(`src/cli/initRouting.ts → shouldInitLaunchGui`) opens the browser wizard
directly (via `runUiServe`, install mode) whenever it can actually be used —
interactive TTY, a display, and no CLI-mode flag. There is no CLI tool-picker
in that path; the wizard collects the tool/pack/settings selection and its
Finish drives the **whole** install through `POST /api/v1/wizard/apply` →
`scripts/install.py --apply-payload` (one installer).

`init` falls back to the non-interactive bash CLI install (`scripts/install` →
`install.py`) — and never boots the GUI — when any of these hold: `CI` set,
`AGENT_CONFIG_NO_UI` set, stdin/stdout not a TTY, a headless host (SSH / Linux
without `DISPLAY`), or a CLI-mode flag (`--no-ui` / `--tools` / `--ai` /
`--yes` / `--quiet` / `--dry-run` / `--minimal` / `--settings-only` /
`--list-tools`). `install.py`'s own tail-launch (`_wizard_spawn`, matching the
`WIZARD_READY <url>` handshake) remains for direct `python3 install.py` runs.

### `WIZARD_READY` stdout contract

The server emits exactly one line on stdout when it has bound:

```
WIZARD_READY http://127.0.0.1:<port>/?token=<token>#/<route>
```

The supervisor matches `^WIZARD_READY (http://(127.0.0.1|localhost):\d+/\S*)$`
(no `url=` prefix; the query/hash are part of the captured URL). The line is
unconditional so headless CI can detect "Fastify bound" without polling the
port.

## Endpoints

Versioned under `/api/v1/`. Selected routes:

| Method | Path                          | Purpose                                                                 |
|--------|-------------------------------|-------------------------------------------------------------------------|
| GET    | `/`                           | SPA shell (token passed via the `?token=` query)                        |
| GET    | `/api/v1/wizard/state`        | Resumable partial wizard state                                          |
| POST   | `/api/v1/wizard/state`        | Persist state between steps                                             |
| GET    | `/api/v1/wizard/manifest`     | Locked discovery-manifest (extended mode)                               |
| GET    | `/api/v1/wizard/auto-detect`  | Project-signal evidence for the `ai-tools` step (extended mode)         |
| GET    | `/api/v1/wizard/detect-tools` | Native AI-tool presence (home/app/`$PATH`) for Step-1 pre-select + badge |
| GET    | `/api/v1/wizard/detect-rtk`   | rtk presence + per-OS install hint (Editor-and-tooling step)            |
| GET    | `/api/v1/wizard/ai-council`   | AI-council scalar subset + provider key presence (extended mode)        |
| POST   | `/api/v1/wizard/ai-council`   | Comment-preserving scalar merge into `.ai-council.yml`                  |
| POST   | `/api/v1/wizard/finish`       | 2PC commit of settings + user-identity                                  |
| POST   | `/api/v1/shutdown`            | Browser-close shutdown beacon (`navigator.sendBeacon` target; real-serve only) |
| POST   | `/api/v1/wizard/apply`        | **Single real-apply route.** `dry_run:true` → buffered plan preview; otherwise SSE-streams `scripts/install.py --apply-payload` |
| GET    | `/api/v1/install/detect`      | Scope + project shape + tool presence                                   |
| POST   | `/api/v1/install/plan`        | Plan preview (per-tool file counts + conflicts) for the Review step     |
| GET    | `/api/v1/install/recovery`    | Interrupted-run recovery state                                          |
| GET    | `/api/v1/install/legacy-v3`   | v3-install detection (backup screen)                                    |

The TypeScript apply engine and its `POST /api/v1/install/apply` SSE route
were removed (road-to-single-install-source-of-truth § Phase 3). All real
writes now flow through `POST /api/v1/wizard/apply` → `scripts/install.py`.

Every request passes three `onRequest` hooks in
[`src/server/app.ts`](../../src/server/app.ts): a `Host`-header allow-list,
an `Origin` allow-list (browser-issued requests), and a per-server bearer
token (`Authorization: Bearer <token>`, minted at boot, surfaced in the
`?token=` URL). A bad token / Host / Origin returns `403`.

### Browser-lifecycle shutdown

In real-serve (`runUiServe`), the server stops itself when the browser that
drives it goes away — the local process should not outlive its only client:

- The SPA ([`src/ui/serverLifecycle.ts`](../../src/ui/serverLifecycle.ts))
  heartbeats `GET /api/v1/ping` every 30s while the tab is visible and the
  user has interacted within the last 30 min. On `pagehide` (window/tab
  close) it fires `navigator.sendBeacon('/api/v1/shutdown?token=…')` (the
  token rides as a query param because `sendBeacon` cannot set headers); and
  once the user has been idle for 30 min it fires the same beacon instead of
  a ping, so the server stops even with the tab still open.
- The server (`createApp` `idleShutdown` option, passed only by `runUiServe`)
  exits on that beacon, and — as a backstop for crashes where neither beacon
  is delivered — via an idle timer that **arms only after the first authed
  request** (so headless / `--allow-headless` manual-connect servers are
  never killed before the operator attaches) and fires after 30 min of
  silence.

On boot, `runUiServe` records `{pid, port, url}` to
`~/.event4u/agent-config/local-server.json`
([`src/server/serverInfo.ts`](../../src/server/serverInfo.ts)) and removes it
on graceful exit. A fresh `agent-config init` (via `scripts/install.py`
`_kill_stale_wizard_server`) reads that record, terminates a still-running
prior instance, and starts a new server — so init always lands on step 1.

`createApp` is inert (no watchdog, no `/api/v1/shutdown` route) unless
`idleShutdown` is supplied, so the in-process test harness
([`tests/server/helpers.ts`](../../tests/server/helpers.ts)) is unaffected.

## Real apply — single source of truth

`POST /api/v1/wizard/apply` is the only write path:

- `dry_run: true` → spawns `install.py --apply-payload <tmp> --dry-run` and
  returns the buffered plan-summary text (used by the Review preview).
- otherwise → spawns `install.py --apply-payload <tmp>` (real apply) and
  **streams** the installer's NDJSON stdout
  (`{type:"file",…}` / `{type:"done"|"error"}`) mapped to the SSE frames the
  SPA consumes. The child is killed if the client disconnects
  (abort-on-disconnect, Finding #24). The installer owns its own
  transactional state (the user-scope lockfile + project manifest), so the
  GUI does not maintain a parallel transaction log.

## SSE event framing

Each real-apply event is `data: <json>\n\n`. Frames:

```jsonc
{ "type": "progress", "file": "<tool>", "status": "deployed", "written": 1, "total": 3 }
{ "type": "done", "summary": { "written": 3, "total": 3 } }
{ "type": "error", "code": "<code>", "message": "<reason>", "recoverable": false }
```

The browser stops reading on `done` / `error`; the server ends the stream.

## Security failure modes covered

- **Remote exploitation** — loopback bind, Host allow-list, Origin
  allow-list, per-server bearer token.
- **DNS rebinding** — Host header check covers POSTs that omit `Origin`.
- **Mid-install crash** — `scripts/install.py` owns the user-scope
  lockfile + project manifest; the recovery routes
  (`/api/v1/install/recovery`) surface an interrupted run on next boot.

## Non-goals (documented contract)

- Not a hosted SaaS — no auth account model, no telemetry.
- Not a parallel installer — the GUI is a selection front-end; every
  real write goes through `scripts/install.py --apply-payload`.
- Not a CI surface — `--no-open` headless boots are supported for smoke
  tests, but the canonical CI path is the flag-driven non-interactive CLI.

## Apply payload — versioning handshake (road-to-global-only-install Phase 0.4 · D12)

`POST /api/v1/wizard/apply` accepts a discriminated-union body keyed on
`schema_version`. The full JSON Schema lives at
[`internal/schemas/wizard-apply-payload.schema.json`](../../internal/schemas/wizard-apply-payload.schema.json).

| `schema_version` | Variant | Shape |
|---|---|---|
| `"installer-v1"` | `InstallerPayloadV1` | `{ ai_tools[], configs{}, dry_run? }` — legacy Installer-GUI, AI tools only. |
| `"wizard-v2"` | `WizardPayloadV2` | `{ tools[], packs[], settings{}, scope_to_project_only?, dry_run? }` — unified 9-step wizard. |

**D12 (locked).** Single apply endpoint with a `schema_version`
discriminator — **not** two endpoints with a shared Python backend.
Reasoning: one bind, one token, one installer; the
Python `scripts/install.py` payload-router branches on
`schema_version` before any disk write. The dual-endpoint variant was
considered and rejected for doubling the surface with no gain.

`schema_version` is **required**. Servers MUST reject any body that
lacks it (HTTP 4xx, single-line error pointing at the schema). The
real-apply path is now wired end-to-end
(road-to-single-install-source-of-truth § Phases 1–2): `install.py`
translates the payload into the canonical install and streams NDJSON
progress back to the GUI.

## Unified 9-step flow (road-to-global-only-install § Phase 1.6)

The maintainer-facing wizard at `src/server/routes/wizard.ts` switches
between two step layouts based on the server-side `extendedSteps`
flag (default `false` for v2.x users; flipped to `true` by the
`agent-config setup` CLI when the npm-version kill-switch is in
effect):

| `extendedSteps` | Steps | Layout |
|---|---|---|
| `false` | 9 | `welcome → editor → personality → cost → roadmap-quality → memory → ai-council → user-md → review` |
| `true`  | 13 | `welcome → ai-tools → roles → packs → editor → personality → cost → roadmap-quality → memory → ai-council → user-md → modules → review` |

The project-specific `modules` step (writes `.agent-project-settings.yml`, not
the global `.agent-settings.yml`) sits at the **end** of the extended flow,
just before `review` — global/user settings come first, the project step
comes last. Because it is no longer part of the install-only lead,
`setup` mode now walks it too (the lead it skips is `ai-tools → roles →
packs`).

The `welcome` step (Step 1, both modes) collects **name + language** up front —
pulled out of the user-md step so the agent knows who it's talking to before
anything else. Name pre-fills from the OS account (`GET /api/v1/ping`
`systemUser`) when empty; language pre-fills from the browser locale
(`navigator.language`) when no `.agent-user.yml` exists yet. In install mode
the user-md step hides its name + language fields (collected here); setup mode
skips the welcome step (it lands on the first settings step) and keeps those
fields in the user-md form.

The `roles` step presents the discovery **workspaces** as the *area*
(Engineering, Product, Finance, Founder, GTM, Ops, …; the maintainer workspace
is hidden) — each tile shows the area label, then advisory `example_roles`
(e.g. Engineering → "Developer, CTO"; Finance → "CFO") and the description. The
selected workspace ids become `.agent-user.yml` `role[]` (the example roles are
UI hints, not the stored value) and recommend each domain's `default_packs` on
the packs step. In install mode the user-md
step therefore hides its role field (collected here instead); setup mode keeps
the role field since it skips the roles step.

The `ai-council` step (road-to-wizard-ux-improvements § Phase 8) configures the
wizard-controlled scalar subset of `.ai-council.yml` (enable, per-member
enable + low-impact, global transport mode, debate rounds, cost budget, the
non-locked `decision_resolution` classes) via `GET`/`POST /api/v1/wizard/ai-council`;
the file is written with comment-preserving `replaceScalar` edits.

The step shapes themselves are declared in
[`src/ui/wizard/steps.ts`](../../src/ui/wizard/steps.ts) — the always-first
`welcome` step plus the four extended-only lead steps (`ai-tools`, `roles`,
`packs`, `modules`) carry no `paths` and use dedicated renderers in
`WizardPage.tsx`.
`getWizardSteps({ extended })` is the single resolver; the UI consumes the
active list via `getActiveSteps()` / `activeTotalSteps()` so a server toggle
takes effect on the next reload without a code change.

### AI-tools / roles / packs selection rules (Steps 2-4)

- **AI-tools pre-selection.** `detect-tools` returns `tools` (installed on the
  machine) and `configured` (the user's prior selection, persisted to
  `~/.event4u/agent-config/wizard-tools.json` on each real apply). On a repeat
  run the wizard pre-selects exactly the `configured` tools; only on a genuine
  first run (no prior selection) does it fall back to pre-selecting every
  installed tool.
- **Roles → packs recommendation.** Each selected role contributes its
  workspace `default_packs`; the union pre-selects packs on Step 3 (plus
  auto-detected project packs). The recommendation stops clobbering the
  selection once the user manually edits a pack. Each pack tile also badges
  the workspace(s) it belongs to (from the pack's `workspaces`), highlighting
  the badges that match a role the user picked on Step 2.
- **Step 2 framework persistence.** A language tile (`cluster`, e.g. PHP)
  gates its framework children in the UI but never destroys their stored
  selection. Turning a language off disables — but keeps checked — its
  children, so a PHP off→on round-trip restores the exact Laravel-on /
  Symfony-off choice. `resolveSelectedPacks()` filters disabled children at
  submit time, so a remembered-but-gated framework is not installed.
- **No-autodetect packs.** Some packs are never pre-selected from project
  signals (`python` — a non-engineer may have python installed but not need
  it). The pack stays available to tick manually.
- **Empty-selection gate.** The AI-tools, roles, and packs steps each block
  Next until at least one effective selection exists (≥ 1 tool, ≥ 1 role, and
  ≥ 1 installable pack respectively).

### `GET /api/v1/wizard/state` payload

```jsonc
{
  "step": 0,
  "totalSteps": 9,
  "partial": {},
  "startedAt": null,
  "extendedSteps": true
}
```

`extendedSteps` is **advisory** — older server bundles MAY omit it,
and the UI treats `undefined` as `false`. `totalSteps` reflects the
flow that was active when the partial was written, which the UI uses
for resume continuity; the active step set is otherwise derived from
the current `extendedSteps` flag.

### State persistence + recovery

Per-session state is written to `<writeRoot>/state/wizard-state.json`
(under the global config root, typically
`~/.event4u/agent-config/state/wizard-state.json`). If the file
becomes malformed — partial JSON write, orphaned session from a
previous npm version, manual edit gone wrong — the recovery path is:

```
agent-config doctor --repair wizard-state
```

The repair unlinks the file (idempotent; absent files are a no-op
success). The next `agent-config setup` boots from step 1 with a
fresh `startedAt`. A matching `wizard-state` health check is part of
the standard `agent-config doctor` run and surfaces malformed JSON or
schema-shape drift before the next setup attempt.

### Extended-mode endpoints

`extendedSteps: true` activates two additional read-only endpoints:

| Method | Path                          | Purpose |
|--------|-------------------------------|---------|
| GET    | `/api/v1/wizard/auto-detect`  | Project-signal evidence (composer / package / pyproject / artisan / next.config) for the `ai-tools` step. 404 when extended-mode is off. |
| GET    | `/api/v1/wizard/manifest`     | Locked discovery-manifest (ADR-015) so the `packs` step can render supported AI IDs + every pack the manifest exposes. 404 when extended-mode is off. |

