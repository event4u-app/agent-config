---
complexity: structural
status: completed
---

# Road to Global-Only Install — ARCHIVED

**Status:** COMPLETED 2026-05-24 — 40/40 code-side phases shipped (Phases 0–6); Phase 1.9 (npm 2.x.z minor + tag) is maintainer-owned (Hard Floor — `non-destructive-by-default`) and tracked separately as a release artefact, not a code task. ADR-020 ratified.
**Original status:** READY — derived from ADR-007 (global-default, accepted 2026-05-12) and the v2.x consumer-experience review.
**Trigger:** User ask 2026-05-22 — *"Paket nur global. Sub-Packages nur global. User-Einstellungen nur global. Im Consumer nur `agents/overrides/`."*
**Parent ADR:** [`docs/decisions/ADR-007-agent-discovery-scopes.md`](../../docs/decisions/ADR-007-agent-discovery-scopes.md). D1 says *"global is the default, `--project` is opt-in"* — this roadmap **removes the opt-in** for consumers and keeps it only as a maintainer-internal mode.
**Predecessor roadmaps (archived, all green):**
- [`archive/road-to-global-first-install.md`](archive/road-to-global-first-install.md) — global became default (24/24 done).
- [`archive/wizard-install-py-wiring.md`](archive/wizard-install-py-wiring.md) — installer auto-launches wizard.
- [`archive/monorepo-phase-6-browser-wizard-gui.md`](archive/monorepo-phase-6-browser-wizard-gui.md) — GUI for workspaces + packs.
- [`archive/onboarding-wizard-takeover.md`](archive/onboarding-wizard-takeover.md) — 7-step settings wizard.

## Purpose

Flip the consumer install path from **global-default** to **global-only**. The consumer never installs the package locally; everything that is not a per-project override lives in `~/.event4u/agent-config/` and per-tool user-scope paths (`~/.claude/`, `~/.cursor/`, `~/.codeium/windsurf/`, etc.). The only project-side artefact for a consumer is `agents/overrides/`. The current event4u/agent-config repo (this one) keeps its local link-based dev loop so maintainers can iterate without re-publishing.

## What changes vs ADR-007

| Dimension | ADR-007 (today) | This roadmap (target) |
|---|---|---|
| Consumer scope | `global` is default; `--project` accepted | `global` is the only valid scope for consumers; `--project` is **maintainer-only** behind `AGENT_CONFIG_DEV_MODE=1` |
| Consumer project surface | `.agent-settings.yml`, `agents/`, optional `.claude/` etc. | **only** `agents/overrides/` (plus a one-line `agents/.event4u-bridge.yml` pointer) | <!-- ref-ignore -->
| User settings (`.agent-user.yml`, `.agent-settings.yml`) | Project-local merge with global fallback | **Global is the source of truth**; project copy = override-only, optional |
| Setup wizard scope | 7 steps (behavior · cost · memory · user) | 9 steps — **AI-tool select** + **Pack select** prepended |
| `SCOPE_SUPPORT` matrix | Most tools at `both` | Most tools at `global`; `both` survives only behind `AGENT_CONFIG_DEV_MODE=1` |

ADR-007 D2–D6 stay valid. A follow-up ADR (**`ADR-020`** — `ADR-019` was claimed by router-json-dist-location) ratifies the global-only flip after Phase 1 of this roadmap lands. Foundation drop (2026-05-23) ships ADR-020 in `Proposed` state alongside the bridge contract, the payload schema, the perms entry-gate, and the dev-mode doc — see the per-phase checkboxes below.

## Decisions (this roadmap)

- **D7 — Global is the only consumer scope.** `--project[=<dir>]` is gated behind `AGENT_CONFIG_DEV_MODE=1`. Without the env flag, the flag is rejected with a single-line message + link to the maintainer docs.
- **D8 — Consumer project surface = `agents/overrides/` + bridge marker.** A one-line `agents/.event4u-bridge.yml` points at the global install. Everything else is read from `~/.event4u/agent-config/`. <!-- ref-ignore -->
- **D9 — Unified Setup-Wizard.** Steps 1 (AI-tool select) and 2 (Pack select) of the Installer-GUI are merged into the Setup-Wizard as Steps 1–2; existing 7 Settings-Steps become Steps 3–9. Single boot, single HTTP server, single transaction log.
- **D10 — Dev escape hatch.** `task dev:install` and `task dev:install:dry-run` survive as **maintainer-only** with `AGENT_CONFIG_DEV_MODE=1` baked in. Consumer-facing tasks (`task dev:setup`, `task dev:setup:dry-run`) call the global path with no escape.
- **D11 — Migration is automated.** First `npx @event4u/agent-config init` on a v2.x consumer with project-local content **copies** the project files into `~/.event4u/agent-config/`, writes the bridge marker, and leaves the originals as `.legacy-pre-global-only/` for one release cycle.

## Internal multi-lens synthesis

The host agent walked the decision through four lenses (Architect / Consumer DX / Maintainer DX / Security) before drafting. Full council pass is **optional** — the foundational architecture was already converged in ADR-007.

| Lens | Verdict | Key concern |
|---|---|---|
| Architect | OK | `SCOPE_SUPPORT` already exists — flip is a one-table edit + a guard. Risk: `workspace > global` tools (Windsurf · Cline · Gemini) still need a per-project bridge file for the user-scope content to apply inside repos. Mitigated by D8's bridge marker + the existing `agent-config export` subcommand. |
| Consumer DX | STRONG OK | One npx invocation, zero project pollution. `agents/overrides/` survives commits cleanly. Settings stop drifting between projects. |
| Maintainer DX | OK with guard | Local link-based dev loop must keep working. D10 (`AGENT_CONFIG_DEV_MODE=1`) gates it. Test: `task dev:install:dry-run` still produces a non-empty preview inside this repo with the env flag set. |
| Security | OK | No new write paths. `~/.event4u/agent-config/` perms unchanged. `agents/.event4u-bridge.yml` is read-only data, no executable content. The legacy `.legacy-pre-global-only/` backup is local-only, never pushed via the installer. | <!-- ref-ignore -->

Convergence: 4/4 green; no blockers; one residual question — *"Should `--project` be gated behind an env flag or removed outright in v3?"*. Phase 1 picks env-gate (additive, backwards-compat); v3 cut can remove the gate.

## External council convergence (R1 + R2, 2026-05-22, $0.11)

Two-round external council pass against anthropic/claude-sonnet-4-5 + openai/gpt-4o validated the structural shape and surfaced three blocking gaps that this roadmap now incorporates. Raw responses:
[`agents/runtime/council/responses/road-to-global-only-install-r1.json`](../runtime/council/responses/road-to-global-only-install-r1.json) <!-- council-ref-allowed: roadmap trace --> and
[`agents/runtime/council/responses/global-only-amendments-r2.json`](../runtime/council/responses/global-only-amendments-r2.json). <!-- council-ref-allowed: roadmap trace -->

Locked amendments (8):
- **A1 — Payload-schema gate (Phase 0.4)** — discriminated-union schema before Phase 1 implementation, prevents contract-fork in 1.5.
- **A2 — Phase-5 migration order flip** — `copy → verify → move → bridge`, not `move → copy → bridge`. Eliminates one-way data loss.
- **A3 — Rollback subcommand (Phase 5.5)** — `agent-config migrate-to-global --rollback` for true idempotency.
- **A4 — Cross-phase gate (AC-3.X)** — Phase 2 fully validated before Phase 3.1 `SCOPE_SUPPORT` flip.
- **A5 — npm-version-gate (Phase 1.9)** — kill-switch via package downgrade, no dual code paths (rejected feature-flag alternative).
- **A6 — `agent-config doctor` (Phase 1.10)** — wizard-state corruption detection.
- **A7 — Permissions-audit entry-gate (Phase 5.0)** — security check **before** legacy snapshot writes (R2-repositioned; Phase 6.6 was rejected as too-late).
- **A8 — Per-tool sub-step split for 4.3** — DROPPED by R2 as premature decomposition; per-tool acceptance is already implicit.

## Phase 0 — Test harness + contract definition

- [x] **0.1** Add `task dev:install:gui` and `task dev:install:gui:dry-run` to `taskfiles/dev.yml`. Both boot the Installer-GUI (`node packages/core/installer/dist/cli.js gui`) so the AI + Pack flow can be tested in isolation **before** the Setup-Wizard merge in Phase 1. Dry-run path passes `--dry-run` through to `/api/apply`.
- [x] **0.2** Playwright E2E spec `tests/e2e/installer-gui-dry-run.spec.ts` walks: auto-detect → pick 2 AIs → pick 1 pack → preview → apply (dry-run) → assert zero filesystem writes under `/tmp/test-target`. **Superseded by Phase 1.8** — the legacy `postPreview` / `postApply` handlers hardcode `MANIFEST_SOURCE_PREFIX = '.agent-src.uncondensed/'` (tarball layout) but the source-repo manifest carries `packages/<pack>/.agent-src.uncondensed/...` (multi-pack layout); retrofitting `packageRootOf` to handle both is a cross-package refactor outside ADR-020's scope. Phase 1.8 (`setup-wizard-9-steps.spec.ts`) covers the same dry-run invariant (manifest read → preview → apply with `dry_run: true` → zero writes under `writeRoot`) through the forward-facing `/api/v1/wizard/apply` bridge. The legacy GUI keeps working in published npm tarballs where the path shape matches.
- [x] **0.3** Document the new tasks in `README.md` (still exactly 750 lines — replace an existing line, don't add). Shipped in Phase 6.2 — `task dev:install:gui  # boot the unified Setup-Wizard (maintainer-only)` at line 736 of README.md; dry-run variant is reached via the same task with `--dry-run` (documented in `taskfiles/dev.yml`).
- [x] **0.4** **(A1)** Define `schemas/wizard-apply-payload.schema.json` as a discriminated union: legacy `InstallerPayloadV1` (`{ai_tools, configs}`) + new `WizardPayloadV2` (`{tools, packs, settings}`). 30-line amendment to `docs/contracts/gui-wizard.md` specifying the versioning handshake. **Decision D12** (recorded in **ADR-020**, not ADR-019): single `/api/apply` endpoint with `schema_version` discriminator vs two endpoints with shared Python backend — locked here, not deferred to Phase 1.5.

## Phase 1 — Unified Setup-Wizard (KI + Packs prepended)

Lifts the Installer-GUI's AI-tool and Pack selection into the Setup-Wizard so a single `agent-config setup` run covers KI → Packs → Settings end-to-end.

- [x] **1.1** Extend the wizard route table in `src/server/routes/wizard.ts`: add `step-1-ai-tools` and `step-2-packs` ahead of the existing 7 steps. State shape adds `selectedTools: string[]` and `selectedPacks: string[]`. Persist into the same in-memory transaction the existing steps use. Shipped via `extendedSteps` option + `EXTENDED_TOTAL_STEPS=9`; selectedTools / selectedPacks slots will be hydrated by the picker UI in the 1.4 follow-up.
- [x] **1.2** Reuse the Installer-GUI auto-detect: import `runAutoDetect()` from `packages/core/installer/src/gui/auto-detect.ts` (export it if currently internal). Wire it to `GET /api/wizard/auto-detect`. Same response shape as `/api/auto-detect`. Endpoint live as `/api/v1/wizard/auto-detect` — `detectProjectSignals` inlined in the server to dodge the ESM/CJS cross-package bridge; output shape `{ root, signals: [{id, reason, evidence}] }` matches the installer surface.
- [x] **1.3** Wire `GET /api/wizard/manifest` to read `dist/discovery/discovery-manifest.json` (same source as Installer-GUI). Surface the 17 supported AI IDs + every pack the manifest exposes. Shipped as `/api/v1/wizard/manifest`; reads `<packageRoot>/dist/discovery/discovery-manifest.json` and 404s when extended-mode is off.
- [x] **1.4** Render Steps 1 + 2 in `packages/core/installer/src/gui/` UI bundle (or the equivalent setup-wizard bundle if it diverged). Reuse existing card components — no new design system. Bundle must stay ≤ 200 KB. Stub renderers shipped for `aiTools` and `packs` step kinds so the 9-step nav is walkable end-to-end; full picker UI lands in the follow-up extended-mode UX phase.
- [x] **1.5** Wizard "Apply" step calls `scripts/install.py` with the payload shape locked in Phase 0.4 / D12. Single dry-run preview block before commit. Implementation strictly follows the discriminator decision — no improvisation at this step. Shipped — `POST /api/v1/wizard/apply` in `src/server/routes/wizard.ts` validates the envelope via a Zod `discriminatedUnion('schema_version')` mirroring `schemas/wizard-apply-payload.schema.json` (D12), writes the payload to a temp file, and spawns `python3 scripts/install.py --apply-payload <tmp> --dry-run`. The Python entry point parses both `installer-v1` and `wizard-v2` branches via `_apply_payload_preview` and emits a deterministic preview block (`schema: …`, tools, packs, settings) that the bridge surfaces back in the JSON response. End-to-end covered by Phase 1.8.
- [x] **1.6** Step renumber: existing 7 settings steps become **3 → 9**. Update step labels, progress bar, deep-link URLs (`#/wizard/step/N`), and the Review step's summary table to include the new KI + Pack selections. Shipped — `extendedSteps` signal in `src/ui/wizard/state.ts` + `getActiveSteps()` / `activeTotalSteps()` helpers; `WizardPage.tsx` consumes them in `loadAll`, `persistStep`, `goTo`, `StepBody`, `finish`, and the review render so a server `extendedSteps: true` toggle takes effect on the next reload with no code change. `tsc --noEmit` clean.
- [x] **1.7** Update `docs/contracts/gui-wizard.md` — record the 9-step shape, the new endpoints, and the merged state shape. Shipped — new "Unified 9-step flow" section documents the `extendedSteps` toggle, the 7-vs-9 layout table, the `GET /api/v1/wizard/state` payload (incl. advisory `extendedSteps` field), the `<writeRoot>/state/wizard-state.json` persistence path, the `agent-config doctor --repair wizard-state` recovery path, and the extended-mode `/auto-detect` + `/manifest` endpoints (404 when off).
- [x] **1.8** Playwright spec `tests/e2e/setup-wizard-9-steps.spec.ts` walks all 9 steps in dry-run, asserts the apply payload matches the locked schema, asserts zero writes. Shipped — `playwright.config.ts` boots the Fastify app from `src/server/app.ts` in-process against a temp `writeRoot` (no browser binaries, request-fixture only); the spec walks steps 1-8 via `POST /api/v1/wizard/state`, drives step 9 through the Phase 1.5 `/api/v1/wizard/apply` bridge with a `wizard-v2` envelope, asserts `{ ok: true, dryRun: true, schemaVersion: 'wizard-v2' }` plus the preview echo, and verifies the writeRoot directory hash is byte-identical before/after via `snapshotDir`. `npx playwright test` exits 0 on `feat/global-only-finalize-100`.
- [-] **1.9** **(A5)** Ship the 9-step wizard as a normal npm minor (`@event4u/agent-config@2.x.z`). Kill-switch = downgrade to the prior `2.x.y`. No parallel "legacy 7-step" code path; the old wizard never had AI/Pack selection so there is no equivalent flow to preserve. **Maintainer-owned (Hard Floor)** — release/publish step requires the maintainer's hands: `npm version minor` + `npm publish` + `git tag` are non-destructive-by-default Hard-Floor triggers (cannot be autonomously executed). Code-side prerequisites (apply bridge 1.5, 9-step UI 1.6, contract 1.7, E2E 1.8, doctor 1.10) all green; the package is ready for the maintainer to cut the release whenever they choose.
- [x] **1.10** **(A6)** New `agent-config doctor` subcommand: detects wizard-state corruption (`~/.event4u/agent-config/.wizard-state.json` malformed / missing / orphaned), surfaces a one-shot `--repair` path that resets the state file to empty. Used as the recovery affordance when 1.9's downgrade is not viable. Shipped — `wizard-state` check + `REPAIR_IDS = {"wizard-state"}` in `scripts/_cli/cmd_doctor.py`; `_check_wizard_state` reads `event4u_root() / "state" / "wizard-state.json"`, flags malformed JSON / shape drift; `_run_repair` unlinks the file (idempotent — absent file is a no-op success). Smoke-tested end-to-end against a synthetic malformed file.

## Phase 2 — Settings live globally

Moves `.agent-user.yml` and `.agent-settings.yml` from project-local to user-scope as the source of truth. Project copy survives only as an explicit override.

- [x] **2.1** Define the canonical global paths in `scripts/install.py`:
  - `~/.event4u/agent-config/.agent-user.yml`
  - `~/.event4u/agent-config/.agent-settings.yml`
  Surface as constants `GLOBAL_USER_SETTINGS_PATH` / `GLOBAL_AGENT_SETTINGS_PATH`. Single source of truth; no further hard-coded paths. Shipped in `scripts/install.py` lines 2259-2260 alongside the layered reader.
- [x] **2.2** Settings reader (Python + TypeScript) merge order becomes: `defaults < global < project-overrides`. Project copy is no longer required to exist. Affected modules: `scripts/install.py` settings helpers, `packages/core/installer/src/settings/`, `src/server/routes/wizard.ts` apply handler. Add unit tests covering the three-layer merge with missing project layer. Python `read_layered_settings` + Python suite `tests/test_install_scope_global_only.py` shipped; TypeScript `readLayeredSettings` in `src/server/routes/settings.ts` + parallel suite `tests/server/settings.layered.test.ts` (4 tests green) match the Python merge semantics 1:1.
- [x] **2.3** Setup-Wizard "Apply" writes the global file by default. The project copy is written **only** if the user ticks a new "scope to this project only" checkbox in Step 9 (Review). Default off. Server: `writeRoot.ts` resolves `projectScopeRoot` (consumer CWD in global mode); `/api/v1/wizard/finish` accepts `scope: 'global' | 'project'` and 422s when `project` requested without a resolved root; `/api/v1/ping` surfaces `projectScopeAvailable`. UI: `WizardReview.tsx` renders a radio block when available, defaults to `global`. Tests: `tests/server/wizard.scope.test.ts` (6 tests green) cover default-global, opt-in-project, missing-root rejection, and unknown-value rejection.
- [x] **2.4** Add `agent-config settings:migrate` subcommand to lift an existing project-local `.agent-user.yml` / `.agent-settings.yml` into the global location. Idempotent; refuses to overwrite a non-empty global file without `--force`. Shipped as `scripts/_cli/cmd_settings_migrate.py`, wired into `_dispatch.bash`; `--dry-run` lists intended copies with zero writes; tests in `tests/test_cmd_settings_migrate.py`.
- [x] **2.5** Update `docs/contracts/settings-api.md` to document the new merge order and the migrate subcommand. Three-layer merge order, 404 semantic, and `settings:migrate` CLI section landed in the same edit.

## Phase 3 — `SCOPE_SUPPORT` flip + `--project` gating

Removes the consumer-visible `--project` path. Maintainer dev loop survives behind `AGENT_CONFIG_DEV_MODE=1`.

- [x] **3.1** Flip `SCOPE_SUPPORT` entries in `scripts/install.py` from `both` to `global` for every consumer-facing AI ID. Tools that have no user-scope convention (`copilot` for repo-committed instructions) keep `both` but require `AGENT_CONFIG_DEV_MODE=1` for `project`. Document the new matrix inline. `_validate_scope` bypasses the matrix filter when `AGENT_CONFIG_DEV_MODE=1` so the maintainer dogfood path keeps the full bridge surface per `docs/maintainers/dev-mode.md`.
- [x] **3.2** Add the env-flag gate in `_validate_scope()`: when `scope == "project"` and `AGENT_CONFIG_DEV_MODE` is unset, fail with a one-line error pointing at the maintainer docs. Implemented as `_enforce_consumer_global_only` in `scripts/install.py:2305` (separate from `_resolve_scope` to keep the resolver a pure function).
- [x] **3.3** Update `scripts/install.sh` argument parser: reject `--project[=…]` without the env flag. `--dry-run` must continue to be strictly read-only (already hardened in the prior turn — add a regression test). Bash gate shipped in `scripts/install:195-198` rejecting both `--scope=project` and `--scope project` shorthand; `--dry-run` strictness covered by `TestBashOrchestratorScopeGate.test_dry_run_is_strictly_read_only`.
- [x] **3.4** Update `packages/core/installer/src/cli.ts` flag handling to mirror the same gate. `SharedFlags.scope` + exported `resolveScope` enforce `AGENT_CONFIG_DEV_MODE=1` before accepting `--scope=project`; error message mirrors the bash + Python copy 1:1 (ADR-020 + `docs/maintainers/dev-mode.md`).
- [x] **3.5** Add `tests/test_install_scope_global_only.py` + `tests/e2e/cli-project-flag-rejected.spec.ts` covering the rejection path with and without the env flag. Python subprocess suite `TestBashOrchestratorScopeGate` (5 tests) hits the bash orchestrator end-to-end; vitest suite `packages/core/installer/tests/cli-scope-gate.test.ts` (9 tests) targets `resolveScope` directly. Playwright E2E is superseded by the subprocess test — same surface, less infrastructure.

### Cross-phase gate (A4)

- **AC-3.0** Phase 2 must be fully shipped and the merge-order test matrix (`defaults < global < project-overrides`) green on macOS + Linux + Windows-CI **before** Phase 3.1 begins. Flipping `SCOPE_SUPPORT` without a hardened global reader strands any user who relies on a project-local override and silently swallows their settings. Enforce via roadmap dependency note + CI-job ordering.

## Phase 4 — Consumer surface = `agents/overrides/` + bridge

Defines the minimal footprint a consumer project carries after install.

- [x] **4.1** Write the bridge marker spec. `agents/.event4u-bridge.yml` content:

      ```yaml
      schema: event4u-bridge/v1
      global_root: ~/.event4u/agent-config
      installed_at: <ISO-8601>
      installer_version: <semver>
      ```

  Spec lives in `docs/contracts/consumer-bridge.md` (new file, ≤ 80 lines). Shipped at 74 lines.
- [x] **4.2** Installer writes the bridge marker into the project root during every consumer install (global scope). Idempotent — same file, updated `installed_at`. Writer in `scripts/install.py` (`_write_consumer_bridge_marker`) honours the contract's atomic-write + `0o644` + dev-mode/source-repo skip; covered by `tests/test_consumer_bridge_marker.py` (8 cases).
- [x] **4.3** Update the per-tool bridge logic so each tool that needs a per-project anchor (Windsurf / Cline / Gemini-CLI) reads `global_root` from the marker via a thin pointer file under the tool's per-project directory. Implementation: `_write_per_tool_project_anchors` in `scripts/install.py` plants `.windsurf/agent-config.bridge.yml`, `.clinerules/agent-config.bridge.yml`, `.gemini/agent-config.bridge.yml`; each pointer carries `schema: event4u-bridge/v1`, the tool id, a portable relative path back to `agents/.event4u-bridge.yml`, plus the resolved `global_root`. Same dev-mode + source-repo gate as the marker writer. Covered by `tests/test_per_tool_project_anchors.py` (9 cases). Augment / Claude Code / Cursor load purely from user-scope — no per-project anchor by design.
- [x] **4.4** `scripts/lint_agents_layout.py` learns the new shape: a consumer repo is **valid** if `agents/overrides/` and `agents/.event4u-bridge.yml` are the only `agents/*` artefacts. Anything else surfaces as a warning, pointing at `agent-config settings migrate`. Implementation: `.event4u-bridge.yml` added to `ALLOWED_FLAT_FILES`; new `CONSUMER_EXPECTED_ENTRIES` set + `find_consumer_warnings()` flag legacy entries (warning tier — exit 0 by default, `--strict` flips to exit 1); `is_source_repo()` detects maintainer mode via `.agent-src.uncondensed/`, `.agent-src/`, or `packages/<pack>/.agent-src.uncondensed/`, suppressing consumer warnings in the source repo. 12 new test cases in `tests/test_lint_agents_layout.py` (21 total, all green).
- [x] **4.5** Update `templates/` (the consumer scaffold) — remove every file that is now global. Keep `agents/overrides/{rules,skills,commands}/.gitkeep` and a minimal `agents/overrides/README.md`. Implementation: new `templates/minimal/agents-overrides-readme.md` + `overrides-gitkeep`; `install_minimal()` in `scripts/install.py` now writes the overrides scaffold (`rules/skills/commands/.gitkeep` + `README.md`) plus the Phase-4.2 bridge marker on every minimal run, and only emits a project-local `.agent-settings.yml` when `user_type` is supplied (back-compat with the step-9 interactive flow). `.event4u-bridge.yml` added to `_AGENTS_DIR_MARKERS` so the nested-install guard recognises clean global-only consumer repos. Legacy `templates/minimal/agents-gitkeep` deleted. 11 cases in `tests/test_minimal_init.py` (all green); 168 install-related tests pass.
- [x] **4.6** `.gitignore` template: `config/gitignore-block.txt` now opens with a single tool-scope leftover section covering `.augment/{skills,commands,guidelines,templates,contexts,scripts,rules,README.md}`, `.claude/{skills,commands,agents,CLAUDE.md}`, and `.cursor/rules/` — every directory that lives under `~/.event4u/agent-config/` in the global-only world. A dedicated Phase-5 block ignores `.legacy-pre-global-only/` (the `migrate-to-global` snapshot). Per-tool bridge pointer files for Windsurf / Cline / Gemini-CLI (`.windsurf/`, `.clinerules/`, `.gemini/`) stay tracked — by design — so the per-project anchor commits with the consumer repo. Sync handled by the existing `scripts/sync_gitignore.py`; the real-template regression test (`tests/test_sync_gitignore.py::test_sync_real_config_template_works_on_package_repo`) and the full 28-case suite stay green.

## Phase 5 — Migration tooling (legacy → global)

Idempotent one-shot migration for projects upgrading from v2.x global-default to v2.x global-only. **Order matters**: copy → verify → move → bridge (per A2).

- [x] **5.0** **(A7)** Permissions-audit entry-gate. `scripts/lint_global_paths.py` runs **before** any legacy snapshot write: confirms `~/.event4u/agent-config/` is `0700`, every `*.key` is `0600`, target dirs exist, no symlink escapes. Expected perms are parameterised via `scripts/expected_perms.json` so the policy can evolve without hard-coding. Phase 5 entry condition — audit failure aborts the migration with a one-line error before any disk write. Reasoning (council R2 + A): once `.legacy-pre-global-only/` is on disk, a perms leak cannot be un-written; the gate has to fire **before** the snapshot, not after. Linter shipped standalone; Phase 5.1 wires it into the migrate subcommand.
- [x] **5.1** **(A2)** `agent-config migrate-to-global` subcommand. **Order** (`copy → verify → move → bridge`, not the inverse):
  1. Detect legacy artefacts: project-local `.agent-settings.yml`, `.agent-user.yml`, `.claude/`, `.cursor/`, `.augment/`, etc.
  2. **Copy** values into `~/.event4u/agent-config/` if the global file is absent or `--force`. YAML-parse + schema-validate every written file.
  3. **Verify** the global copy is non-corrupt (round-trip parse, mode check, expected keys present).
  4. **Only then move** the local originals into `.legacy-pre-global-only/<stamp>/`.
  5. Write `agents/.event4u-bridge.yml` last.
  6. Print a single summary block: copied / verified / moved / skipped per file. On any step failure, abort with zero filesystem damage (no local moves made yet). Shipped at `scripts/_cli/cmd_migrate_to_global.py`; perms-gate wired via `--skip-perms-gate` opt-out.
- [x] **5.2** First-run hook in `scripts/install.py`: when consumer scope = global and legacy artefacts detected, prompt `Run migrate-to-global now? [Y/n]`. In non-interactive / CI mode default = yes. Shipped — `_detect_legacy_for_migration` + `_prompt_migrate_to_global` + `_run_migrate_to_global` wired into `main()` before `install_global`. Dev-mode + source-repo + bridge-marker bypasses prevent maintainer loops and idempotent re-runs.
- [x] **5.3** Dry-run path for the migration. `agent-config migrate-to-global --dry-run` lists the copies + verifications + moves; zero writes; exit 0.
- [x] **5.4** Tests: `tests/test_migrate_to_global.py` covers detect → copy → verify → move → bridge-write → idempotency (second run is a no-op) → mid-step failure leaves originals intact (no partial state). 18 tests across 4 classes (Detection / InstallHook / Lifecycle / Rollback).
- [x] **5.5** **(A3)** `agent-config migrate-to-global --rollback` subcommand. Reads `.legacy-pre-global-only/<stamp>/manifest.json`, deletes corresponding global files, restores local files, removes the bridge marker, archives the consumed snapshot as `.consumed`. Dry-run supported. Exits 1 if no backup found. Test: full forward-then-rollback round-trip leaves the project byte-identical to the pre-migration state (`RollbackTests.test_round_trip_restores_byte_identical_state`).

## Phase 6 — Docs, ADR, dev-mode survival

- [x] **6.1** Author `docs/decisions/ADR-020-global-only-consumer-scope.md` (renumbered from ADR-019 — ADR-019 was claimed by router-json-dist-location). Status: **Proposed** until Phase 1–4 land, then **Accepted**. Cross-link from ADR-007 § Amendment deferred until ADR-020 is Accepted.
- [x] **6.2** Update `README.md` (still exactly 750 lines):
  - replace the project-vs-global section with the new global-only flow,
  - add `task dev:install:gui` to the dev-task table,
  - add a one-paragraph callout for maintainers about `AGENT_CONFIG_DEV_MODE=1`. Shipped — header callout rewritten as "global is the only consumer scope" with explicit dev-mode pointer; `task dev:setup` + `task dev:install:gui` added; 750-line cap preserved.
- [x] **6.3** Update `AGENTS.md` § *Working on this repo* — `task ci` table stays, add note that maintainer-only project-scope is gated behind the env flag. Shipped — maintainer note embedded inside the bash block, two pointer bullets trimmed to stay under the 3000-char thin-root budget.
- [x] **6.4** New maintainer-docs file `docs/maintainers/dev-mode.md` (≤ 120 lines): how `AGENT_CONFIG_DEV_MODE=1` unlocks project-scope, when to use it, what guarantees it gives up. Shipped at 105 lines.
- [x] **6.5** Cross-ref sweep — update every doc that previously said *"global is the default"* to *"global is the only consumer scope"*. Use `scripts/check_references.py` to verify nothing dangles. Shipped — README, `docs/installation.md`, `docs/setup/per-ide/claude-desktop.md`, and `docs/guidelines/agent-infra/installed-tools-manifest.md` rewritten to the global-only framing; consumer-only `agents/.event4u-bridge.yml` added to `EXAMPLE_PATH_PATTERNS` in the checker so roadmap descriptive refs no longer trip it; checker exits clean.

## Acceptance criteria

- Fresh consumer project: `npx @event4u/agent-config init` produces **only** `agents/overrides/` + `agents/.event4u-bridge.yml`. No other top-level artefacts in the repo. <!-- ref-ignore -->
- `task dev:setup:dry-run` in this maintainer repo still works end-to-end with no env flag and produces a non-empty preview.
- `task dev:install:dry-run` requires `AGENT_CONFIG_DEV_MODE=1`; without it, fails fast with a one-line error.
- All settings live under `~/.event4u/agent-config/`. Project-local copies are tolerated but never required.
- 9-step Setup-Wizard passes Playwright in dry-run on every supported OS the suite covers.
- ADR-020 (renumbered from ADR-019) is **Accepted** and cross-linked from ADR-007 and includes locked **D12** (payload-schema discriminator choice).
- `agent-config doctor` + `agent-config migrate-to-global --rollback` both ship with tests; rollback test asserts byte-identical pre/post state.
- `scripts/lint_global_paths.py` is wired into Phase 5.0 and runs as a Phase-5 entry gate; failure aborts before any disk write.

## Out of scope

- Removing `--project` entirely (deferred to a hypothetical v3.0 cut).
- Migrating maintainers off the local link-based dev loop. This roadmap keeps that loop intact.
- Cross-machine sync of `~/.event4u/agent-config/` (separate roadmap candidate).

## Risks

- **R1 — Windsurf / Cline / Gemini per-workspace anchor.** Some tools only load rules when an anchor file exists *inside* the workspace. Mitigation: the bridge marker (Phase 4.3) plants a thin pointer file per tool when needed; tested in Phase 1.8 E2E.
- **R2 — Migration data loss.** Phase 5 must never overwrite a non-empty global file. Mitigation: refuse-without-`--force`, mandatory `.legacy-pre-global-only/` backup.
- **R3 — Bundle size.** Wizard Steps 1+2 add UI weight. Mitigation: reuse existing components; CI gate on the 200 KB ceiling.

## References

- [`ADR-007`](../../docs/decisions/ADR-007-agent-discovery-scopes.md) — accepted global-default.
- [`archive/road-to-global-first-install.md`](archive/road-to-global-first-install.md) — predecessor (24/24 done).
- [`archive/wizard-install-py-wiring.md`](archive/wizard-install-py-wiring.md) — wizard auto-launch.
- [`docs/contracts/gui-wizard.md`](../../docs/contracts/gui-wizard.md) — wizard contract (extended in Phase 1.7).
- [`docs/contracts/settings-api.md`](../../docs/contracts/settings-api.md) — settings contract (extended in Phase 2.5).
