---
stability: beta
keep-beta-until: 2026-08-18
quality_cadence: per_phase
council_mode: per_phase
complexity: structural
---

# Onboarding wizard takeover — retire `/onboard`, add `--dry-run`

> **Status:** open · **Owner:** package maintainer · **Created:** 2026-05-20
>
> Completes the TypeScript-first pivot for first-run setup. The
> browser wizard (`agent-config setup`) is now the canonical surface;
> the chat-side `/onboard` skill, its bridge contract, and the
> `onboard:finish` subcommand are removed. A new `--dry-run` mode lets
> maintainers run the wizard against the package's own repo (or any
> sandbox) without persisting changes — answers are validated and
> the would-be diff is surfaced, but no file is written.
>
> Parent context: `unified-setup-and-settings-gui.md` (merged 2026-05-19)
> and `wizard-install-py-wiring.md` (sibling, open).

## Goal

One canonical setup surface (TypeScript / Preact wizard) plus a
safe maintainer mode (`--dry-run`) for package-level testing. Zero
chat-driven onboarding code paths remain.

## Acceptance criteria

1. **`/onboard` chat skill is gone.** `.agent-src.uncompressed/commands/onboard.md`
   deleted; `.agent-src/` and `.augment/` regenerate without it.
2. **`onboard:finish` CLI subcommand removed.** No registry entry, no
   handler file, no references from `agent-config.ts`.
3. **Bridge contract removed.** `docs/contracts/onboard-skill-wizard-bridge.md`
   and the IPC skeleton `src/server/skillBridge.ts` deleted; the wizard
   route survives untouched (`POST /api/v1/wizard/finish`).
4. **Onboarding-gate rule pivots.** `routes_to: command:onboard` →
   shell command `agent-config setup`; body rewritten to instruct the
   developer to launch the browser wizard.
5. **`--dry-run` mode lands** for `agent-config setup`, `ui:serve`, and
   `settings`. When active: no `.agent-settings.yml`, `.agent-user.md`,
   or wizard-state file is mutated; the UI surfaces a banner; `/finish`
   returns the preview payload instead of committing.
6. **`task ci` is green** including new dry-run tests.
7. **README still ≤ 750 lines.** Existing cap respected.

## Dry-run state contract

Captured per council 2026-05-20:

- Dry-run is a **single-process flag**. `buildServer({ dryRun: true })`
  flips a server-wide boolean; there is no per-session toggling.
- **Reads are real, writes are no-ops.** Dry-run executes every
  read-only validation (settings parse, user-md gray-matter, template
  merge, schema check) against real on-disk files. The preview the
  client receives is therefore byte-equivalent to what a real run
  would commit.
- **Wizard state**: in dry-run, `POST /api/v1/wizard/state` writes to
  a per-server in-memory `Map<symbol, WizardState>` keyed by a fixed
  symbol (single browser-wizard tab per server is the only supported
  pattern; the CLI launches a fresh server per invocation, so no
  cross-session leakage is possible).
- **Existing wizard-state on disk** is read once at boot in dry-run so
  the maintainer can preview an in-progress flow; subsequent writes
  stay in memory.
- **2PC replay is skipped** in dry-run — the boot-time
  `replayPendingCommits` call is conditional on `dryRun !== true`.

## Phase 1 — Dry-run mode

- [x] **1.1** Add `dryRun: boolean` option to `createApp()` in
  `src/server/app.ts`; thread it through `wizardRoute`, settings
  `PUT`, and user-md `PUT`. Skip `replayPendingCommits` when dry-run.
- [x] **1.2** In dry-run, `POST /api/v1/wizard/finish` skips
  `commitMulti`, returns `{ ok: true, dryRun: true, preview: { settingsYaml, userMd } }`
  where `settingsYaml` is the rendered would-be `.agent-settings.yml`
  body (post-merge) so the maintainer sees the actual diff target.
- [x] **1.3** In dry-run, `POST /api/v1/wizard/state` writes to an
  in-memory Map; `GET` reads from the Map first, falls back to disk
  on miss. No disk write.
- [x] **1.4** In dry-run, `PUT /api/v1/settings` and `PUT /api/v1/user-md`
  validate + render the merged body and return it under `preview`,
  status 200, **no `Last-Modified` bump** so a subsequent real run
  starts from the same baseline.
- [x] **1.5** UI: render a persistent `DRY RUN — nothing will be
  written` banner when `GET /api/v1/ping` returns `dryRun: true`.
  Banner is part of `App.tsx` so it shows on both `/#/wizard` and
  `/#/settings`.
- [x] **1.6** CLI: `--dry-run` on `agent-config setup`, `ui:serve`,
  and `settings`. Passes through to `createApp({ dryRun: true })`.
  Server log line on boot: `dry-run mode: no files will be written`.
- [x] **1.7** Tests: Fastify-inject test per route asserting (a) no
  disk write on dry-run finish, (b) preview body is non-empty, (c)
  ping reports `dryRun: true`. One CLI test that `agent-config setup
  --dry-run` boots and exits cleanly.
- [x] **1.8** Verify Phase 1 before deleting anything in Phase 2:
  `task test` green; `agent-config setup --dry-run` smoke-tested
  manually against this repo's own `.agent-settings.yml`.

## Phase 2 — Legacy `/onboard` removal

- [x] **2.1** Inventory every reference to `/onboard`, `onboard.md`,
  `~/.claude/skills/onboard`, and `onboard:finish` across `src/`,
  `tests/`, `docs/`, `.agent-src.uncompressed/`. Capture in a session
  note for verification at phase close.
- [x] **2.2** Delete `.agent-src.uncompressed/commands/onboard.md`.
- [x] **2.3** Delete `src/cli/commands/onboardFinish.ts` and remove
  the registry entry plus the `.command('onboard:finish')` block in
  `src/cli/agent-config.ts`. Update the `native` allow-list.
- [x] **2.4** Delete `src/server/skillBridge.ts` (the IPC discovery
  helper) and the `--headless` flag wiring in `src/cli/commands/uiServe.ts`
  if it had no other consumer.
- [x] **2.5** Delete `docs/contracts/onboard-skill-wizard-bridge.md`
  and `tests/server/onboardFinish_parity.test.ts`.
- [x] **2.6** Sweep comment / doc references — rewrite or drop.
  Targets: `src/ui/wizard/steps.ts`, `src/ui/pages/WizardPage.tsx`,
  `src/ui/api.ts`, `src/server/routes/wizard.ts`,
  `src/server/schemas/settings.ts` (the `onboarded` description).

## Phase 3 — Onboarding-gate pivot

- [x] **3.1** Rewrite `.agent-src.uncompressed/rules/onboarding-gate.md`:
  drop the `routes_to: command:onboard` line; body instructs the
  developer to run `agent-config setup` in their terminal; cloud
  surfaces stay inert (no settings file → rule doesn't fire).
- [x] **3.2** Update template / consumer documentation that points to
  `/onboard` — README quickstart, `docs/wizard.md`, `docs/customization.md`.

## Phase 4 — Verification

- [x] **4.1** `task sync` regenerates `.agent-src/` and `.augment/`
  without the legacy command.
- [x] **4.2** `task generate-tools` regenerates `.claude/`, `.cursor/`,
  `.clinerules/`, `.windsurfrules`.
- [x] **4.3** `task lint-roadmap-complexity` + `task check-index` green; `task lint-readme-budget` confirms README ≤ 750 lines.

## Phase 5 — PR

- [x] **5.1** Commit in logical chunks via `/commit`.
- [x] **5.2** Open PR `feat/onboarding-wizard-takeover` → `main`,
  ready for review. Fix CI red until green.

## Council notes

Per-phase council pass enabled (`council_mode: per_phase`). HIGH /
MEDIUM findings get a follow-up step; LOW findings get a comment in
the phase log only.

## Non-goals

- Wizard re-skinning, new questions, or schema additions.
- `scripts/install.py` wiring (sibling roadmap `wizard-install-py-wiring.md`).
- Mode-switching between "real" and "dry-run" without restart — a
  fresh CLI invocation is the boundary.
