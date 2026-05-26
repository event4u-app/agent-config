---
slug: unified-setup
title: Unified Setup — v4.0.0 hard-cut to a single TS install/setup engine
owner: matze4u
opened: 2026-05-26
status: ready
complexity: structural
related_adrs:
  - ADR-018-trust-and-safety-layer
  - ADR-022-daily-workspace-decomposition
related_feedback:
  - 2026-05-26 chat: 9 locked decisions captured below (confidence 80–92 %)
  - 2026-05-26 council run (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds, $0.14 actual) — 7 substantive patches accepted, results at agents/runtime/council/responses/road-to-unified-setup-challenge.md
depends_on: []
---

# Unified Setup — v4.0.0 hard-cut to a single TS install/setup engine

> Today the package ships **two** installers: a legacy 4 808-LOC Python script (`scripts/install.py`, served at port 41100 via `installer gui`) and a modern Fastify/Preact wizard at port 41200 (`agent-config setup`). Both end at the same `.augment/`-tree, but the surface, the engine, and the conflict-resolution behaviour diverge. This roadmap kills the legacy Python path, ports the **essential** subset (~2 800 LOC after council-driven safety additions) to TypeScript, and ships **one** install/setup experience under `v4.0.0`. No backwards compatibility, no auto-migration — the hard-cut version bump is the contract.

## Goal — acceptance criteria

- **One server, one bundle, one codepath.** `npx @event4u/agent-config` boots a single Fastify process; `install` and `setup` are URL-routed sub-flows of the same Preact app.
- **TS-only install path.** `scripts/install.py` and `packages/core/installer/` are deleted; no Python is invoked during `npx … install` / `npx … setup`.
- **10-step Preact wizard wired end-to-end.** Existing 10-step UI (commits 55f88da..5ad6f22) drives the new TS engine for plan/apply.
- **Hard-Stop continue-screen after install Step 3.** Setup mode starts at install Step 4; install mode hands off at Step 3 with a continue-screen.
- **Recovery + `WIZARD_READY` survive the port.** PID-lockfile and idle-timer drop.
- **v4.0.0 published.** CHANGELOG names the hard-cut explicitly; users on 3.x re-run installer instead of auto-upgrading.

## Locked-in decisions (confidence band, 2026-05-26 chat)

| # | Decision | Confidence |
|---|---|---|
| 1 | Topology: 1 server, 1 bundle, 1 codepath | ~90 % |
| 2 | Engine language: TS-only, no Python in install path | ~88 % |
| 3 | Entry: `npx @event4u/agent-config` + thin Bash bootstrap | ~85 % |
| 4 | Package layout: kill `@event4u/installer` workspace, merge into main package | ~80 % |
| 5 | CLI surface: `agent-config install` + `agent-config setup`, same server, different initial step | ~82 % |
| 6 | Handoff: hard-stop continue-screen after Step 3 | ~82 % |
| 7 | Versioning: hard-cut → v4.0.0, no auto-migrate, no Profile-INI, simplified conflict-policy → ~2 650 LOC TS port (~2 weeks engine work) | ~88 % |
| 8 | Legacy GUI features: port `WIZARD_READY` + transaction-log/recovery; drop PID-lockfile + idle-timer | ~92 % |
| 9 | Migration sequence: 1 feature branch (`fix/broken-installation`), 5 phase commits A–E, squash-merge-series | ~88 % |

## Prerequisites

- [x] Three prep commits already on `fix/broken-installation`: `55f88da` (10-step wizard), `4192d8d8` (`--no-extended` flag), `5ad6f22a` (6-tab UI shell).
- [x] Council artefact authored at this file. External challenge complete (2026-05-26, 2 rounds, $0.14): 7 patches accepted, 2 findings rejected (A5/A6 already correctly ordered; Python-runtime hallucination — `task` is `go-task`, not Python).
- [x] Confirmed scope: `~/.event4u/agent-config/` install target unchanged; `.augment/` consumer tree unchanged; only the *engine* swaps.
- [x] Confirmed hard-floor rules — `non-destructive-by-default` (no prod-branch merge), `commit-policy` (split into logical chunks at phase boundaries), `scope-control` (no library swap mid-flight without permission).
- [x] Confirmed port scope from `scripts/install.py` (4 808 LOC):
  - **Port (~2 800 LOC TS):** install-plan + atomic writes (~1 500), simplified conflict-resolution + JSON deep-merge (~700), conflict-policy YAML reduced to `default_strategy` (~50), misc shared (~400), council-patched additions (log-rotation ~50, batch-conflict UI ~80, SSE error schema ~20).
  - **Drop:** legacy `.agent-settings` → YAML migration (~400), profile-INI rendering (~600), multi-version shim (~400), PID-lockfile, idle-timer.
- [x] **v3 → v4 coexistence policy (council Finding #21):** v4 installer **detects** existing `~/.event4u/agent-config/VERSION == 3.x` on boot. Renders backup-screen with two CTAs: `Backup v3 to ~/.event4u/agent-config.v3.bak/ and proceed` (default) · `Abort, manually uninstall v3 first`. No silent overwrite. Surfaced in Phase E migration UX.

## Phase A: TS engine port (~2 800 LOC, ~5–7 working days)

The heart of the migration. Port the essential subset of `scripts/install.py` into `src/install/` as pure TypeScript.

- [x] **A1: Foundation + types.** Create `src/install/{types,detect,plan,paths}.ts` skeleton with `InstallPlan`, `InstallTarget`, `FileEntry`, `ConflictStrategy` interfaces. Mirror Python dataclasses 1:1. **`paths.ts` exports `getTempPath()` / `getInstallRoot()` / `getLogPath()` helpers (council Finding #16)** so every downstream module reads paths from one place — no inline `os.tmpdir()` / `~/.event4u/...` literals scattered across A2–A6. `tsconfig.json` updated to include `src/install/**/*`. Coverage: type-only smoke test under `tests/install/types.test.ts` + `paths.test.ts` asserting platform-correct resolution (POSIX + Windows env-var fallback).
- [x] **A2: Detection layer.** Port `_detect_*` helpers — project-shape (composer/package/cargo/pyproject), AI-tool presence (`.augment/`, `.claude/`, `.cursor/`, `.clinerules`, `.windsurfrules`, `AGENTS.md`), pack discovery (workspace root + `packages/<pack>/`). Pure functions, no I/O side effects in the detection itself — read once, return plan. Coverage: fixture-driven unit tests on a tmp tree.
- [x] **A3: Plan builder.** Port `_build_install_plan` — walks `.agent-src/` (or `.agent-src.uncondensed/` for the package self-install), produces a list of `FileEntry` with target paths + content hashes. Plan is **declarative** — apply step never recomputes paths. Coverage: golden-snapshot test against a fixture pack.
- [x] **A4: Atomic writes + bounded recovery.** Port `_atomic_write_file` — write to `.tmp` sibling, fsync, rename. Plus transaction-log: each successful write appends to `getLogPath()` (`~/.event4u/agent-config/install-log.jsonl`) so recovery on crash is `tail -n` + reverse-apply. No PID-lockfile (per decision 8). **Log-rotation + recovery-depth caps (council Finding #18):** rotate at 10 MB or 30 days (whichever first) to `install-log.<ISO>.jsonl.gz`; recovery scans at most the **last 500 entries** of the active log — older incomplete tails are treated as abandoned and surfaced to the UI as "previous run aborted; ignoring". Prevents unbounded scan on a corrupt or ancient log. Coverage: crash-simulation test (kill mid-apply, replay log, assert clean tree) + rotation test + recovery-depth-cap test.
- [x] **A5: Conflict resolution (simplified).** Port `_resolve_conflict` — three modes only: `skip` / `overwrite` / `surface-to-UI`. JSON-aware deep-merge **stays** (needed for `.claude/settings.json` merges). Mode selection happens in the UI (decision 7); CLI uses `--force-overwrite` for headless / CI. Coverage: matrix test across skip/overwrite/merge × text/JSON.
- [x] **A6: Bridge generators.** Port `generate_*_bridges` for the 16+ AI tools (Claude Code, Cursor, Cline, Windsurf, Copilot, etc.). These are pure-template rendering passes — straight port, no logic change. Coverage: snapshot-test each bridge against committed fixtures under `tests/fixtures/bridges/`.

## Phase B: Wire 10-step Preact wizard to the TS engine (~2–3 working days)

UI shell (commits 55f88da..5ad6f22) is ready. Wire `WizardReview` → `POST /api/install/plan` → `POST /api/install/apply` using the Phase A engine.

- [x] **B0: Entrypoint dispatch (council Finding #15, moved from C2).** `bin/agent-config.js` dispatches `install` / `setup` / `council` / `…` to existing handlers BEFORE the Phase A engine wires into API routes — `install` + `setup` both call `uiServe` with a different initial-step config. Same Fastify server, same bundle. Promoted ahead of the API/UI wiring so B1–B5 can be exercised end-to-end via `agent-config install` / `agent-config setup` from day one of Phase B. Coverage: integration test that boots both modes against a tmp install root and asserts the wizard lands on Step 1 vs Step 4 respectively.
- [x] **B1: API routes + SSE error schema.** `src/server/routes/install.ts` — `GET /api/install/detect`, `POST /api/install/plan`, `POST /api/install/apply`. Streams progress events over SSE so the wizard's progress bar reflects per-file apply state. **Error schema (council Finding #20):** every SSE frame is one of `{type: "progress", file, written, total}` · `{type: "conflict", entries: [...]}` · `{type: "error", code, message, recoverable}` · `{type: "done", summary}`. Errors carry a stable `code` (`E_DISK_FULL` / `E_PERM` / `E_CONFLICT_UNRESOLVED` / `E_CRASH`) so the UI maps them to localized copy. **Abort-on-disconnect (council Finding #24):** server registers `req.on("close")` on the SSE channel; if the client disconnects mid-apply, the engine flushes the current write, appends an `aborted` marker to the transaction log, and stops. Next boot's recovery-pre-step picks up the abort marker and offers `Resume` / `Rollback` / `Ignore`. Coverage: error-schema contract test + disconnect-mid-apply integration test.
- [x] **B2: Wizard state → plan.** `src/ui/wizard/state.ts` collects user choices across 10 steps; on Review-confirm, POST to `/api/install/plan` and render the diff. Empty plan → "nothing to do" screen.
- [x] **B3: Conflict UI + batch resolution (council Finding #19).** When the plan surfaces conflicts, render the conflict-screen (per decision 7, replaces headless 3-mode policy). **Single conflict** → per-file picker (`skip` / `overwrite` / `merge (JSON only)`). **Batch threshold ≥ 5 conflicts** → batch-screen shows a summary table + global CTAs (`Skip all` / `Overwrite all` / `Merge JSON, skip rest` / `Review each one`) so users do not click 50 times for a stale `.agent-src/`. Selection (per-file or batch) is part of the apply payload; batch choices expand to per-file entries server-side. Coverage: UI snapshot tests for both modes + apply-payload integration test for the batch-expansion.
- [x] **B4: `WIZARD_READY` stdout contract.** Server emits `WIZARD_READY\n` to stdout once Fastify is listening — bash bootstrap watches for it. Recovery-pre-step: on boot, check `install-log.jsonl` for an incomplete tail; render recovery screen if found.
- [x] **B5: Hard-stop continue-screen.** Install mode lands at Step 3, then the wizard renders a continue-screen with a single CTA: "Continue with setup (10 more steps) or finish here". Setup mode jumps directly to Step 4 via `?mode=setup` URL parameter.

## Phase C: Bash bootstrap (~0.5 working days)

- [x] **C1: Bash bootstrap.** `scripts/bootstrap.sh` is the thin entry — checks Node version, runs `npx @event4u/agent-config` (which resolves to the bundled `bin/agent-config.js`), waits for `WIZARD_READY` on stdout, opens the browser. ~50 LOC bash, no Python.
- [x] **C2: `--no-extended` already wired** (commit `4192d8d8`). Confirmed; no further work.

> Note: previous `C2: bin/agent-config.js dispatch` step moved to **B0** per council Finding #15 — the dispatch is a Phase B prerequisite, not a Phase C concern.

## Phase D: Legacy deletion (~0.5 working days)

- [x] **D1: Move legacy out of import paths.** `packages/core/installer/{src,tests,…}` deleted entirely; `package.json` workspaces config narrowed (now `[]` since no other workspace exists). `packages/core/installer/python/` is kept in place — its `knowledge_*` / `workspace_*` utilities back the `/knowledge:*` and `/analytics:*` commands and are independent of the install flow. **Note:** the `scripts/install.py` → `bin/install.legacy.py.bak` rename is deferred to v5 — the file still drives the no-Node `curl | bash setup.sh` CURL flow + the `smoke-public-install.yml` CI job; the npx flow no longer invokes it (acceptance criterion "no Python is invoked during npx … install" is met by the TS engine in Phase A/B).
- [x] **D2: Cleanup references.** Removed `installer gui` / `agent-config-installer` references from `CONTRIBUTING.md`, `packages/core/deploy/README.md`, `taskfiles/dev.yml`, `taskfiles/ci-fast.yml`. Deleted `install-via-agent` command (source + condensed) since its agent-mode JSON protocol shipped with the now-removed TS installer. Regenerated `agents/index.md` + `docs/catalog.md` + `dist/discovery/`.
- [x] **D3: Reduce conflict-policy YAML.** N/A — no `agents/settings/.agent-conflict-policy.yml` shipped in this repo. The simplified `default_strategy` policy is enforced inline by the TS engine (`src/install/conflict.ts` + the wizard's per-conflict picker), not via a stand-alone YAML.

## Phase E: v4.0.0 release (~0.5 working days)

- [x] **E1: CHANGELOG + v3-detection copy.** Hard-cut entry added to `CHANGELOG.md` under `[Unreleased]` — names the `~/.event4u/agent-config.v3.bak/` backup path, the manual `mv` rollback command, the retired surfaces (`packages/core/installer/`, `/install-via-agent`, installer CI gates), and the v3 `scripts/install.py` deferred removal (v5).
- [x] **E2: Version-detection + backup screen wired.** `detectLegacyV3()` in `src/install/detect.ts` reads `~/.event4u/agent-config/VERSION` and returns `{present,path,version,backupTarget}`. Wizard renders `BackupScreen.tsx` pre-Step-1 as a hard gate (no chrome until acknowledged). Server routes `GET /api/v1/install/legacy-v3` + `POST /api/v1/install/backup-v3` (atomic `cpSync` to `…/agent-config.v3.bak/`, refuses to overwrite an existing backup target). Coverage: 5 detect-unit tests + 5 server-route tests (`tests/install/detect.test.ts`, `tests/server/install.test.ts`).
- [x] **E3: Version bumps.** `package.json` → `4.0.0`. Lockfile refreshed (`npm install`). Tag `v4.0.0` deferred until merge per `non-destructive-by-default` (tag push needs explicit user permission).
- [~] **E4: PR description + merge.** PR draft prepared off `feat/unified-setup`, split into logical commit chunks per `commit-policy`. **Human-owner gate:** merge to `main` requires explicit user permission per `commit-policy` + `non-destructive-by-default`; PR is opened ready-for-review only.

## Out of scope

- Adding new install/setup features beyond what the legacy script already supported.
- Refactoring the 6-tab UI shell further (Tasks / Council / Memory / Explain / Workspace tabs stay as-is).
- Touching the consumer-side `.augment/` tree generator (`task sync` / `task generate-tools`).
- Adding new AI-tool bridges; Phase A6 is a 1:1 port, no new tools.

## Risks + rollback

- **Risk: TS port mis-handles an edge case the Python tested but TS tests miss.** Mitigation: Phase A coverage uses fixtures lifted directly from `tests/fixtures/install/` plus golden-snapshot regression. Rollback: revert phase commit, `bin/install.legacy.py.bak` is re-promotable until next minor release.
- **Risk: Recovery transaction-log corrupts on partial-disk-full or grows unbounded.** Mitigation: log append is itself atomic (fsync before rename); empty/truncated log on read → recovery-skip with surfaced warning; rotation + 500-entry recovery cap (A4) prevents unbounded scan.
- **Risk: Hard-cut frustrates 3.x users mid-migration.** Mitigation: CHANGELOG names the single 1-command migration (`npx @event4u/agent-config install`); v3-detection + backup-screen (E2) preserves the prior install before any write; no silent overwrite.
- **Risk: SSE client disconnects mid-apply leave the tree in an unknown state.** Mitigation: abort-on-disconnect (B1) flushes the current write, appends an `aborted` marker, and offers Resume / Rollback / Ignore on next boot.
- **Risk: Large stale install (e.g. 50+ conflicts) creates a click-fatigue UX dead-end.** Mitigation: batch-conflict screen at threshold ≥5 (B3) gives global CTAs without losing per-file granularity.
- **Risk: Branch grows past reviewable size before merge.** Mitigation: phase commits enforce ≤500-LOC chunks; A1–A6 are ≤450 LOC each by design.

## Council challenge — complete (2026-05-26)

External 2-round consultation via `/council run` against anthropic/claude-sonnet-4-5 + openai/gpt-4o. Estimated $0.43; actual spend $0.14. Full responses at `agents/runtime/council/responses/road-to-unified-setup-challenge.md`.

**Accepted (7 patches landed in this roadmap):**

| # | Finding | Landing site |
|---|---|---|
| 15 | `bin/agent-config.js` dispatch is a Phase B prerequisite, not a Phase C concern | Moved C2 → **B0** |
| 16 | Centralise path helpers (`getTempPath` / `getInstallRoot` / `getLogPath`) in A1 to avoid scattered literals | A1 paths.ts |
| 18 | Transaction-log needs rotation + recovery-depth cap to bound disk + scan cost | **A4** |
| 19 | ≥5 simultaneous conflicts are click-fatigue without batch CTAs | **B3** |
| 20 | SSE frames need a stable error schema with `code` + `recoverable` so the UI can route | **B1** |
| 21 | v3 → v4 needs explicit detection + backup screen, not just a CHANGELOG line | **Prereqs + E1/E2** |
| 24 | SSE abort-on-disconnect prevents zombie apply when the wizard tab closes | **B1** |

**Rejected (2 findings):**

- Reordering A5 ↔ A6 (claimed bridges should land before conflict-resolution) — bridges depend on the resolved file layout; current order is correct.
- "Python runtime ships in the install path via `task`" — hallucination; `task` here is `go-task` (Go binary), not a Python tool. Hard-cut to TS-only stands.
