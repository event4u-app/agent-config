# Council Prompt — Daily-Workspace Shape (ADR-022 candidate)

## Context

`@event4u/agent-config` is a governed skill / rule / command suite that today reaches users in two ways:

1. **CLI surface** — Claude Code, Augment, Cursor, Cline, Windsurf slash commands. Engineer-native; assumes terminal fluency and an existing host-agent install.
2. **GUI installer** — a local web wizard launched by `agent-config setup` (shipped in v3.x, ADR-016 + ADR-017 + ADR-020). Browser tab on `http://127.0.0.1:<port>` driven by a local FastAPI / Python backend. Today its scope is **install + scope-pick + pack-pick + settings sync** — it does not host conversations.

Two consecutive external reviews (release `3.1.1`, May 2026) graded the package strong-A on engineering / governance / docs but called out the same structural gap: the product is *infrastructure* and the daily-use surface for non-developers (galabau owner, content creator, consultant — the three target roles named in Phase 1 recruit sessions) does not exist yet. Their day still routes through "open Claude Code, remember a slash command".

The new roadmap (`road-to-employee-product-and-external-proof.md`) commits Phase 4 to closing that gap: a **persistent daily workspace** — left rail (role + task launcher), centre pane (active conversation with the host agent), right rail (knowledge sources + memory recall + explain-trace). Local-only session state under `~/.event4u/agent-config/workspace/`. No remote sync in v1. ≤ 6 weeks of focused work for one engineer; budget assumed.

Phase 4 is the largest scope item on the roadmap and crosses into auth-adjacent territory (per-user session state, task history, local document store). Council approval is mandatory before any code lands.

## The decision (ADR-022 candidate)

> *"Which surface should host the daily workspace shell, given that (a) we already ship a local GUI installer, (b) the host agent (Claude Code / Augment / Cursor) is the engine — the workspace must shell out to it via CLI/protocol, never re-implement it, and (c) non-technical roles are the primary audience."*

The workspace MUST:

- Persist per-user session history locally (no remote sync v1).
- Surface a one-click task launcher reading `agents/roles/<role>/skills.yml` + `prompts/`.
- Display knowledge sources + explain-trace inline on every agent reply.
- Work offline (the package's audit corpus is on-disk).
- Run on macOS, Linux, Windows (the three platforms the installer already targets).

The workspace MUST NOT:

- Embed a model runtime. It always shells out to the user's chosen host agent.
- Require an account, telemetry, or remote service.
- Introduce a second installer flow — must integrate with the existing `agent-config setup` entry point.

## The options

1. **Extension to the existing GUI installer.** Reuse the FastAPI backend + the browser tab the installer already opens. The workspace becomes the post-install surface — once the user finishes the wizard, the same window reloads to the workspace. Backend stays Python; frontend stays whatever the installer uses today (HTMX / vanilla / templated HTML — to verify before deciding).
2. **Separate Electron / Tauri desktop app.** A native window installed alongside the package. Deep OS integration (global shortcut, tray icon, file-drop, native notifications). Own auto-update channel. Tauri preferred over Electron for footprint (≈ 10 MB vs ≈ 200 MB) if Rust toolchain is acceptable; Electron if the team has zero Rust appetite.
3. **Browser tab against the local installer GUI.** No new binary. Same backend as option 1, but treated as a long-running local server (`agent-config workspace`) rather than a one-shot wizard. The browser is the only chrome. Bookmarkable URL; works in any browser the user already has open.
4. **TUI-first surface with optional browser companion.** Primary surface is a Textual / Bubble Tea / Ink TUI in the terminal — matches engineer mental model, zero new install dependency. Optional browser tab for the same role-launcher + knowledge-pane data when richer UI is wanted (image previews, document rendering).

## Cross-cutting trade-offs

| Axis | Option 1 (extend installer) | Option 2 (Electron/Tauri) | Option 3 (browser tab) | Option 4 (TUI + browser) |
|---|---|---|---|---|
| **Install footprint** | Zero new — uses existing wizard runtime | New binary (~10 MB Tauri / ~200 MB Electron) | Zero new — uses existing wizard runtime | Zero new — `pip` / `npm` already in flow |
| **Offline behaviour** | Full (FastAPI bound to 127.0.0.1) | Full (bundled runtime) | Full (FastAPI bound to 127.0.0.1) | Full (terminal-native) |
| **OS integration depth** | Low (browser-bound) | High (tray, shortcut, notifications, file-drop) | Low (browser-bound) | Low / Medium (terminal-native; browser pane optional) |
| **Dev cost (one eng, weeks)** | ~3 (reuse backend, new frontend views) | ~8 (new app + auto-update + signing) | ~3 (reuse backend, new frontend views) | ~5 (TUI + optional browser shim) |
| **Non-technical fit** | Medium-high (browser is familiar) | High (native window feels like a product) | Medium-high (browser is familiar) | Low for galabau/content-creator; high for consultant |
| **Maintenance burden** | Low (single Python service) | High (signing, notarization, auto-update, 3 OS builds) | Low (single Python service) | Medium (TUI + optional browser = two surfaces) |
| **Future "looks like a product"** | Limited — chrome is browser | Strongest — own window, own brand | Limited — chrome is browser | Weakest — terminal is engineer-coded |
| **Crosses Hard-Floor surfaces** | No (existing pattern) | Yes (signing, notarization, auto-update — production-shaped) | No (existing pattern) | No |
| **Recruit-session validation cost** | Cheapest — already installed | Highest — needs working binary first | Cheapest — already installed | Cheap for consultant; useless for galabau |

## What the predecessors said

1. **ADR-014** (GUI framework choice — 2026-Q1): picked FastAPI + browser tab for the installer. Reasons: zero new runtime, cross-platform parity, offline-by-default, no native-signing overhead. Same constraints apply to the daily workspace.
2. **ADR-016** (installer architecture): the local server is already long-running for the wizard duration. Keeping it long-running for a workspace session is a small delta, not a new architecture.
3. **ADR-020** (global-only consumer scope): consumer state lives at `~/.event4u/agent-config/` — confirms the local-storage assumption the workspace needs.
4. **Roadmap Phase 1 recruit sessions** (not yet executed): the three target roles (galabau, content-creator, consultant) are non-developers. None has a terminal-first day. The TUI option is therefore audience-mismatched for two of three personas.

## Question for the council

Which option **closes the daily-use gap for non-developer roles** in **one focused build cycle** (≤ 6 weeks for one engineer) **without** crossing Hard-Floor production-shaping surfaces (code signing, notarization, auto-update channels) before the recruit sessions confirm there is real product-market fit?

Justify by naming:

- one falsifiable signal six months out that would tell us the chosen shape was wrong (e.g. *"if recruit-session participants still default to Claude Code over the workspace at the 90-day check-in"*),
- the smallest scope reduction inside the chosen option that would still validate the hypothesis (a deliberate v0 cut),
- which of the three target roles (galabau owner, content creator, consultant) the chosen shape serves *best* and which it serves *worst*,
- whether a later switch to a different option (e.g. option 1 → option 2 once adoption proves out) is reversible or whether the v1 choice locks the architecture.

The decision lands as ADR-022; the implementing contract lands as `docs/contracts/daily-workspace.md`. Both are blocking for Phase 4 Step 4 (shell implementation) — no code lands until ADR-022 is accepted.
