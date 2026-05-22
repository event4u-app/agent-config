---
complexity: structural
status: ready
---

# Road to Global-Only Install

**Status:** READY — derived from ADR-007 (global-default, accepted 2026-05-12) and the v2.x consumer-experience review.
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
| Consumer project surface | `.agent-settings.yml`, `agents/`, optional `.claude/` etc. | **only** `agents/overrides/` (plus a one-line `agents/.event4u-bridge.yml` pointer) |
| User settings (`.agent-user.yml`, `.agent-settings.yml`) | Project-local merge with global fallback | **Global is the source of truth**; project copy = override-only, optional |
| Setup wizard scope | 7 steps (behavior · cost · memory · user) | 9 steps — **AI-tool select** + **Pack select** prepended |
| `SCOPE_SUPPORT` matrix | Most tools at `both` | Most tools at `global`; `both` survives only behind `AGENT_CONFIG_DEV_MODE=1` |

ADR-007 D2–D6 stay valid. A follow-up ADR (`ADR-019` candidate) ratifies the global-only flip after Phase 1 of this roadmap lands.

## Decisions (this roadmap)

- **D7 — Global is the only consumer scope.** `--project[=<dir>]` is gated behind `AGENT_CONFIG_DEV_MODE=1`. Without the env flag, the flag is rejected with a single-line message + link to the maintainer docs.
- **D8 — Consumer project surface = `agents/overrides/` + bridge marker.** A one-line `agents/.event4u-bridge.yml` points at the global install. Everything else is read from `~/.event4u/agent-config/`.
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
| Security | OK | No new write paths. `~/.event4u/agent-config/` perms unchanged. `agents/.event4u-bridge.yml` is read-only data, no executable content. The legacy `.legacy-pre-global-only/` backup is local-only, never pushed via the installer. |

Convergence: 4/4 green; no blockers; one residual question — *"Should `--project` be gated behind an env flag or removed outright in v3?"*. Phase 1 picks env-gate (additive, backwards-compat); v3 cut can remove the gate.

## External council convergence (R1 + R2, 2026-05-22, $0.11)

Two-round external council pass against anthropic/claude-sonnet-4-5 + openai/gpt-4o validated the structural shape and surfaced three blocking gaps that this roadmap now incorporates. Raw responses: <!-- council-ref-allowed: roadmap trace -->
[`agents/runtime/council/responses/road-to-global-only-install-r1.json`](../runtime/council/responses/road-to-global-only-install-r1.json) and
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

- [ ] **0.1** Add `task dev:install:gui` and `task dev:install:gui:dry-run` to `taskfiles/dev.yml`. Both boot the Installer-GUI (`node packages/core/installer/dist/cli.js gui`) so the AI + Pack flow can be tested in isolation **before** the Setup-Wizard merge in Phase 1. Dry-run path passes `--dry-run` through to `/api/apply`.
- [ ] **0.2** Playwright E2E spec `tests/e2e/installer-gui-dry-run.spec.ts` walks: auto-detect → pick 2 AIs → pick 1 pack → preview → apply (dry-run) → assert zero filesystem writes under `/tmp/test-target`.
- [ ] **0.3** Document the new tasks in `README.md` (still exactly 750 lines — replace an existing line, don't add).
- [ ] **0.4** **(A1)** Define `schemas/wizard-apply-payload.schema.json` as a discriminated union: legacy `InstallerPayloadV1` (`{ai_tools, configs}`) + new `WizardPayloadV2` (`{tools, packs, settings}`). 30-line amendment to `docs/contracts/gui-wizard.md` specifying the versioning handshake. **Decision D12** (recorded in the eventual ADR-019): single `/api/apply` endpoint with `schema_version` discriminator vs two endpoints with shared Python backend — must be locked here, not deferred to Phase 1.5.

## Phase 1 — Unified Setup-Wizard (KI + Packs prepended)

Lifts the Installer-GUI's AI-tool and Pack selection into the Setup-Wizard so a single `agent-config setup` run covers KI → Packs → Settings end-to-end.

- [ ] **1.1** Extend the wizard route table in `src/server/routes/wizard.ts`: add `step-1-ai-tools` and `step-2-packs` ahead of the existing 7 steps. State shape adds `selectedTools: string[]` and `selectedPacks: string[]`. Persist into the same in-memory transaction the existing steps use.
- [ ] **1.2** Reuse the Installer-GUI auto-detect: import `runAutoDetect()` from `packages/core/installer/src/gui/auto-detect.ts` (export it if currently internal). Wire it to `GET /api/wizard/auto-detect`. Same response shape as `/api/auto-detect`.
- [ ] **1.3** Wire `GET /api/wizard/manifest` to read `dist/discovery/discovery-manifest.json` (same source as Installer-GUI). Surface the 17 supported AI IDs + every pack the manifest exposes.
- [ ] **1.4** Render Steps 1 + 2 in `packages/core/installer/src/gui/` UI bundle (or the equivalent setup-wizard bundle if it diverged). Reuse existing card components — no new design system. Bundle must stay ≤ 200 KB.
- [ ] **1.5** Wizard "Apply" step calls `scripts/install.py` with the payload shape locked in Phase 0.4 / D12. Single dry-run preview block before commit. Implementation strictly follows the discriminator decision — no improvisation at this step.
- [ ] **1.6** Step renumber: existing 7 settings steps become **3 → 9**. Update step labels, progress bar, deep-link URLs (`#/wizard/step/N`), and the Review step's summary table to include the new KI + Pack selections.
- [ ] **1.7** Update `docs/contracts/gui-wizard.md` — record the 9-step shape, the new endpoints, and the merged state shape.
- [ ] **1.8** Playwright spec `tests/e2e/setup-wizard-9-steps.spec.ts` walks all 9 steps in dry-run, asserts the apply payload matches the locked schema, asserts zero writes.
- [ ] **1.9** **(A5)** Ship the 9-step wizard as a normal npm minor (`@event4u/agent-config@2.x.z`). Kill-switch = downgrade to the prior `2.x.y`. No parallel "legacy 7-step" code path; the old wizard never had AI/Pack selection so there is no equivalent flow to preserve.
- [ ] **1.10** **(A6)** New `agent-config doctor` subcommand: detects wizard-state corruption (`~/.event4u/agent-config/.wizard-state.json` malformed / missing / orphaned), surfaces a one-shot `--repair` path that resets the state file to empty. Used as the recovery affordance when 1.9's downgrade is not viable.

## Phase 2 — Settings live globally

Moves `.agent-user.yml` and `.agent-settings.yml` from project-local to user-scope as the source of truth. Project copy survives only as an explicit override.

- [ ] **2.1** Define the canonical global paths in `scripts/install.py`:
  - `~/.event4u/agent-config/.agent-user.yml`
  - `~/.event4u/agent-config/.agent-settings.yml`
  Surface as constants `GLOBAL_USER_SETTINGS_PATH` / `GLOBAL_AGENT_SETTINGS_PATH`. Single source of truth; no further hard-coded paths.
- [ ] **2.2** Settings reader (Python + TypeScript) merge order becomes: `defaults < global < project-overrides`. Project copy is no longer required to exist. Affected modules: `scripts/install.py` settings helpers, `packages/core/installer/src/settings/`, `src/server/routes/wizard.ts` apply handler. Add unit tests covering the three-layer merge with missing project layer.
- [ ] **2.3** Setup-Wizard "Apply" writes the global file by default. The project copy is written **only** if the user ticks a new "scope to this project only" checkbox in Step 9 (Review). Default off.
- [ ] **2.4** Add `agent-config settings migrate` subcommand to lift an existing project-local `.agent-user.yml` / `.agent-settings.yml` into the global location. Idempotent; refuses to overwrite a non-empty global file without `--force`.
- [ ] **2.5** Update `docs/contracts/settings-api.md` to document the new merge order and the migrate subcommand.

## Phase 3 — `SCOPE_SUPPORT` flip + `--project` gating

Removes the consumer-visible `--project` path. Maintainer dev loop survives behind `AGENT_CONFIG_DEV_MODE=1`.

- [ ] **3.1** Flip `SCOPE_SUPPORT` entries in `scripts/install.py` from `both` to `global` for every consumer-facing AI ID. Tools that have no user-scope convention (`copilot` for repo-committed instructions) keep `both` but require `AGENT_CONFIG_DEV_MODE=1` for `project`. Document the new matrix inline.
- [ ] **3.2** Add the env-flag gate in `_validate_scope()`: when `scope == "project"` and `AGENT_CONFIG_DEV_MODE` is unset, fail with a one-line error pointing at the maintainer docs.
- [ ] **3.3** Update `scripts/install.sh` argument parser: reject `--project[=…]` without the env flag. `--dry-run` must continue to be strictly read-only (already hardened in the prior turn — add a regression test).
- [ ] **3.4** Update `packages/core/installer/src/cli.ts` flag handling to mirror the same gate.
- [ ] **3.5** Add `tests/test_install_scope_global_only.py` + `tests/e2e/cli-project-flag-rejected.spec.ts` covering the rejection path with and without the env flag.

### Cross-phase gate (A4)

- **AC-3.0** Phase 2 must be fully shipped and the merge-order test matrix (`defaults < global < project-overrides`) green on macOS + Linux + Windows-CI **before** Phase 3.1 begins. Flipping `SCOPE_SUPPORT` without a hardened global reader strands any user who relies on a project-local override and silently swallows their settings. Enforce via roadmap dependency note + CI-job ordering.

## Phase 4 — Consumer surface = `agents/overrides/` + bridge

Defines the minimal footprint a consumer project carries after install.

- [ ] **4.1** Write the bridge marker spec. `agents/.event4u-bridge.yml` content:

      ```yaml
      schema: event4u-bridge/v1
      global_root: ~/.event4u/agent-config
      installed_at: <ISO-8601>
      installer_version: <semver>
      ```

  Spec lives in `docs/contracts/consumer-bridge.md` (new file, ≤ 80 lines).
- [ ] **4.2** Installer writes the bridge marker into the project root during every consumer install (global scope). Idempotent — same file, updated `installed_at`.
- [ ] **4.3** Update the per-tool bridge logic so each tool that needs a per-project anchor (Windsurf / Cline / Gemini-CLI / Augment workspace) reads `global_root` from the marker and either symlinks (when supported) or generates a thin pointer file under the tool's per-project directory.
- [ ] **4.4** `scripts/lint_agents_layout.py` learns the new shape: a consumer repo is **valid** if `agents/overrides/` and `agents/.event4u-bridge.yml` are the only `agents/*` artefacts. Anything else surfaces as a warning, pointing at `agent-config settings migrate`.
- [ ] **4.5** Update `templates/` (the consumer scaffold) — remove every file that is now global. Keep `agents/overrides/{rules,skills,commands}/.gitkeep` and a minimal `agents/overrides/README.md`.
- [ ] **4.6** `.gitignore` template: ensure `.legacy-pre-global-only/` (from Phase 5) is ignored and any tool-scope leftovers (`.augment/`, `.claude/`, `.cursor/`) stay ignored for consumers.

## Phase 5 — Migration tooling (legacy → global)

Idempotent one-shot migration for projects upgrading from v2.x global-default to v2.x global-only. **Order matters**: copy → verify → move → bridge (per A2).

- [ ] **5.0** **(A7)** Permissions-audit entry-gate. `scripts/lint_global_paths.py` runs **before** any legacy snapshot write: confirms `~/.event4u/agent-config/` is `0700`, every `*.key` is `0600`, target dirs exist, no symlink escapes. Expected perms are parameterised via `scripts/expected_perms.json` so the policy can evolve without hard-coding. Phase 5 entry condition — audit failure aborts the migration with a one-line error before any disk write. Reasoning (council R2 + A): once `.legacy-pre-global-only/` is on disk, a perms leak cannot be un-written; the gate has to fire **before** the snapshot, not after.
- [ ] **5.1** **(A2)** `agent-config migrate-to-global` subcommand. **Order** (`copy → verify → move → bridge`, not the inverse):
  1. Detect legacy artefacts: project-local `.agent-settings.yml`, `.agent-user.yml`, `.claude/`, `.cursor/`, `.augment/`, etc.
  2. **Copy** values into `~/.event4u/agent-config/` if the global file is absent or `--force`. YAML-parse + schema-validate every written file.
  3. **Verify** the global copy is non-corrupt (round-trip parse, mode check, expected keys present).
  4. **Only then move** the local originals into `.legacy-pre-global-only/`.
  5. Write `agents/.event4u-bridge.yml` last.
  6. Print a single summary block: copied / verified / moved / skipped per file. On any step failure, abort with zero filesystem damage (no local moves made yet).
- [ ] **5.2** First-run hook in `scripts/install.py`: when consumer scope = global and legacy artefacts detected, prompt `Run migrate-to-global now? [Y/n]`. In `--non-interactive` / `--ci` mode default = yes.
- [ ] **5.3** Dry-run path for the migration. `agent-config migrate-to-global --dry-run` lists the copies + verifications + moves; zero writes; exit 0.
- [ ] **5.4** Tests: `tests/test_migrate_to_global.py` covers detect → copy → verify → move → bridge-write → idempotency (second run is a no-op) → mid-step failure leaves originals intact (no partial state).
- [ ] **5.5** **(A3)** `agent-config migrate-to-global --rollback` subcommand. Reads `.legacy-pre-global-only/`, deletes corresponding global files, restores local files, removes the bridge marker. Dry-run supported. Exits 1 if no backup found. Test: full forward-then-rollback round-trip leaves the project byte-identical to the pre-migration state.

## Phase 6 — Docs, ADR, dev-mode survival

- [ ] **6.1** Author `docs/decisions/ADR-019-global-only-consumer-scope.md`. Status: **Proposed** until Phase 1–4 land, then **Accepted**. Cross-link from ADR-007 § Amendment.
- [ ] **6.2** Update `README.md` (still exactly 750 lines):
  - replace the project-vs-global section with the new global-only flow,
  - add `task dev:install:gui` to the dev-task table,
  - add a one-paragraph callout for maintainers about `AGENT_CONFIG_DEV_MODE=1`.
- [ ] **6.3** Update `AGENTS.md` § *Working on this repo* — `task ci` table stays, add note that maintainer-only project-scope is gated behind the env flag.
- [ ] **6.4** New maintainer-docs file `docs/maintainers/dev-mode.md` (≤ 120 lines): how `AGENT_CONFIG_DEV_MODE=1` unlocks project-scope, when to use it, what guarantees it gives up.
- [ ] **6.5** Cross-ref sweep — update every doc that previously said *"global is the default"* to *"global is the only consumer scope"*. Use `scripts/check_cross_refs.py` to verify nothing dangles.

## Acceptance criteria

- Fresh consumer project: `npx @event4u/agent-config init` produces **only** `agents/overrides/` + `agents/.event4u-bridge.yml`. No other top-level artefacts in the repo.
- `task dev:setup:dry-run` in this maintainer repo still works end-to-end with no env flag and produces a non-empty preview.
- `task dev:install:dry-run` requires `AGENT_CONFIG_DEV_MODE=1`; without it, fails fast with a one-line error.
- All settings live under `~/.event4u/agent-config/`. Project-local copies are tolerated but never required.
- 9-step Setup-Wizard passes Playwright in dry-run on every supported OS the suite covers.
- ADR-019 is **Accepted** and cross-linked from ADR-007 and includes locked **D12** (payload-schema discriminator choice).
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
