# Road to Setup Experience

> Redesign of the install / init / config / upgrade experience: a first-class
> `config` command, project-scoped init + configuration, packs prefill from the
> installed manifest, a consolidated wizard flow with a recommended path and a
> review-diff screen, a dark-first visual system, and a simple/advanced
> settings editor with modified-badges and reset-to-default.

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-08, 2 debate
rounds) split on four of five questions; maintainer-side synthesis locked:

- **Command surface** — hybrid A+C: new native `config` opens the settings
  hub with **global as default scope**; `--project` selects the project
  surface; inside a bridged project the GUI shows a visible scope switcher.
  `settings` stays as a compatible alias. `init --project` initializes the
  minimal consumer project surface (bridge marker + overrides + gitignore
  block — same writer as `refresh --project`).
- **Wizard IA** — keep the linear step engine (SSE apply + 2PC finish
  untouched); consolidate the step plan, add a start screen with a
  one-click recommended path, upgrade the review step, land on a
  getting-started checklist instead of a dead end.
- **Styling** — no Tailwind (explicit prior decision in `tokens.css` stands);
  rebuild the token system dark-first (surface-elevation ladder, hairline
  borders, one accent) with OS-detect + persisted theme toggle.
- **Simple/advanced** — curated shared basic-paths module as the single
  source of truth consumed by both wizard slices and the settings editor;
  search always bypasses the tier split.
- **Packs prefill** — installed packs (top-level `packs:` manifest) are
  pre-checked with an "installed" badge; unchecking is allowed but the
  review screen flags removals as destructive and requires an explicit
  confirm.

Out of scope (owned by the in-flight `feat/install-path-convergence` branch):
plugin bootstrap shim, `converge` action, surface-matrix consumers, runtime
duplicate-surface probe. This roadmap must not touch those surfaces.

## Phase 1 — CLI command surface

- [x] 1.1 Add native `config` command in `src/cli/main.ts`: boots the UI
      server on the settings hub (`initialRoute: '/settings'`, global scope
      default). Flags: `--project` (land on the project surface), `--port`,
      `--no-open`, `--ui-dist`, `--allow-headless`, `--project-root`,
      `--dry-run`. Reuses `runSettings` / `runUiServe` plumbing.
- [x] 1.2 Register `config` in `src/cli/registry.ts` (disposition `native`,
      synopsis) and add it to the `native` head-list in `main.ts`; keep
      `settings` as alias (synopsis updated to say "alias of config").
- [x] 1.3 `init --project`: in the TS shell, route `init --project [...]` to
      the project-surface writer (delegate to Bash `refresh --project`,
      forwarding remaining args) instead of the GUI/global install. Update
      `shouldInitLaunchGui` so `--project` is a CLI-mode signal. Friendly
      summary output stays the one `cmd_refresh.ts` prints.
- [x] 1.4 Update help output (`buildHelp`) + `README.md` command table +
      `docs/contracts/gui-wizard.md` for the new `config` verb and
      `init --project`. Verify: `tests/cli/registry.test.ts` +
      new unit test for the `init --project` routing decision
      (`npx vitest run tests/cli`).

## Phase 2 — Packs prefill from installed manifest

- [x] 2.1 Server: expose installed packs. Extend
      `GET /api/v1/wizard/manifest` (`src/server/routes/wizard.ts`) with
      `installedPacks: string[]` — read the top-level `packs:` list from the
      resolved layered settings (same semantics as
      `session_profiles.installed_packs`, but empty list when the key is
      absent — never "all packs" in the wizard context).
- [x] 2.2 UI: seed `selectedPacks` from `installedPacks` on discovery load
      (before role-derived seeding); role/auto-detect seeding unions on top
      and never unchecks an installed pack. New badge `installed` on pack
      tiles (alongside `auto-detected`).
- [x] 2.3 Review step: compute `packRemovals = installed − selected`; render
      a red-flagged "will be removed" block with an explicit confirm
      checkbox that gates Finish while removals are pending.
- [x] 2.4 Tests: server route test for `installedPacks` (present / absent
      `packs:` key) + UI seeding logic extracted into a pure helper with a
      unit test (`npx vitest run tests/server tests/ui`).

## Phase 3 — Wizard flow consolidation

- [x] 3.1 Consolidate the step plan in `src/ui/wizard/steps.ts`: merge
      `personality` + `identity` into one "Preferences" step; merge `cost` +
      `roadmap-quality` + `memory` into one "Budgets & cadence" step (the
      SchemaForm slice mechanism already supports multi-path steps).
      Target: extended flow ≤ 10 steps. Keep ids stable where possible;
      adjust `initialStep` constants in `main.ts` (`setup` lands on the
      first settings step) and the install-mode ContinueScreen anchor.
- [x] 3.2 Start screen (install mode, step 0): "Recommended setup" primary
      card (pre-select detected tools + installed/detected packs + template
      defaults, jump straight to Review) vs "Customize" (walk the steps).
      States exactly what it will do.
- [x] 3.3 Review upgrade: one summary surface listing settings diff
      (existing `/api/v1/settings/diff`), selected tools, pack
      additions/removals (flagged), each row deep-linking back to its step.
- [x] 3.4 Finish → getting-started checklist screen (replaces the dead-end
      banner): next actions (open your editor, run `agent-config doctor`,
      `agent-config config`, docs link) with copyable commands.
- [x] 3.5 Verify: wizard state-machine unit tests still green + new step-plan
      tests (`npx vitest run tests/ui tests/server`), `npm run build:ui`.

## Phase 4 — Visual system v2 (dark-first, token CSS)

- [x] 4.1 `tokens.css` v2: dark-first palette (near-black canvas, surface
      elevation ladder, hairline borders, single accent, semantic colours),
      light theme as the pair; typography scale (Inter-stack + mono for
      config values); motion tokens unchanged (respect reduced-motion).
- [x] 4.2 Theme runtime: OS-detect via `prefers-color-scheme`, persisted
      override (localStorage), toggle in the top nav; `data-theme` set on
      `<html>` before first paint (inline snippet in `index.html`).
- [x] 4.3 Restyle `app.css`: top nav, step cards, pack/tool tiles, badges,
      buttons, inputs, progress rail, review rows, banners — consistent
      radius/spacing ladder; no new dependencies.
- [x] 4.4 Verify: `npm run build:ui` green; manual smoke via
      `agent-config ui:serve --dry-run --no-open` + Playwright-less HTTP
      check of `/` (served bundle) if no UI test harness exists.

## Phase 5 — Settings editor: simple/advanced + hub

- [x] 5.1 Shared tier module `src/ui/settings/basicPaths.ts` (or
      `src/shared/` if server needs it): curated list of basic dotted paths
      grouped by category; wizard step slices reference it where they
      overlap; everything else renders as advanced.
- [x] 5.2 Re-route `#/settings` to a real settings hub (stop redirecting
      into the wizard): category rail from the schema top-level groups,
      basic fields visible, per-section "Show N advanced settings"
      disclosure, search box that matches across ALL tiers.
- [x] 5.3 Modified-state affordances: left-edge indicator when value ≠
      template default, `@modified` filter chip, per-setting reset-to-default
      action (writes the template default back into the form state).
- [x] 5.4 Scope indicator: when the server reports project-scope
      availability, show which layer a value comes from (default / global /
      project) as a subtle source label. <!-- stretch; defer if the layered
      provenance is not cheaply available from GET /api/v1/settings -->
- [x] 5.5 Verify: settings layered read/write tests stay green + new tests
      for tier module and reset logic (`npx vitest run tests/server tests/ui`).

## Phase 6 — Docs, upgrade polish, closure

- [x] 6.1 `cmd_upgrade.ts` summary + `doctor` hints: mention
      `agent-config config` as the settings entry point where `settings`
      was named.
- [x] 6.2 Docs sweep: `README.md`, `docs/getting-started.md`,
      `docs/contracts/gui-wizard.md`, `docs/contracts/settings-api.md` —
      new command surface, wizard flow, theme, simple/advanced model.
- [x] 6.3 Full targeted verification: `npx vitest run tests/cli tests/server
      tests/ui`, `npm run build:ui`, `npm run build:cli`, TypeScript
      `tsc --noEmit` for the touched tsconfig projects.

## Acceptance criteria

- `agent-config config` opens the settings hub (global default);
  `agent-config config --project` opens the project surface; both are
  registered natively and covered by the registry symmetry test.
- `agent-config init --project` writes the minimal project surface without
  opening the GUI and without touching the global install.
- Re-running the wizard pre-checks previously installed packs; removals are
  impossible to trigger silently.
- The wizard extended flow has ≤ 10 steps, a recommended one-click path, a
  diff-based review, and a getting-started checklist.
- The GUI ships dark-first with an OS-detect + persisted theme toggle; no new
  runtime or build dependencies were added.
- The settings editor exposes basic settings by default, advanced behind
  per-section disclosure, search across all tiers, modified indicators, and
  per-setting reset-to-default.
