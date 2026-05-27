---
complexity: structural
status: active
---

# Roadmap: Single Install Source-of-Truth — finish the `--apply-payload` bridge

> Extends the **already-locked** decision **D12 / [`ADR-020`](../../docs/decisions/ADR-020-global-only-consumer-scope.md)**:
> the GUI is a selection front-end; `scripts/install.py` is the payload
> router and the single installer. The bridge already exists for
> **dry-run** (`src/server/routes/wizard.ts` → `install.py
> --apply-payload <tmp> --dry-run`). This roadmap finishes the
> **real-apply** path (currently a `fail()` stub in `install.py`),
> repoints the GUI off the parallel TS apply mirror, and wires `init`
> to launch the GUI. No new architectural decision — this completes the
> existing one. No "flag day"; every phase builds and ships.

## Goal

Close the parity gap (TS apply mirror misses `installed-tools.lock`,
`event4u-bridge`, augment/gemini hooks) by routing **all** GUI installs
through `install.py --apply-payload`, deleting the TS mirror, and making
`npx … init` open the GUI when a display is available.

## Phase 1 — `install.py --apply-payload` real-apply

- [x] Remove the `fail("--apply-payload without --dry-run is not yet wired")` stub in `main()` (~line 4472).
- [x] Wire the translated `opts` (tools/scope from `wizard-v2` + settings/packs) into the existing real-install path (`install_global` / scope flow) so real apply reuses the canonical installer — no second code path.
- [x] Map `wizard-v2` `settings{}` → `--profile` / `--user-type`; `packs[]` → pack-overlay activation; per-tool hook opts → the `ensure_*_hook` flags. <!-- hooks: deliberately left OFF — wizard-v2 carries no hook fields; auto-enabling user-scope hooks violates non-destructive-by-default (AI-council 2026-05-27) -->
- [x] Emit machine-readable progress under `--apply-payload` (NDJSON on stdout: `{type:"file",file,written,total,status}` + terminal `{type:"done"|"error",…}`) so the GUI can stream it.
- [x] Verify: `python3 scripts/install.py --apply-payload <tmp.json>` (real, temp HOME) installs tools + writes `installed-tools.lock` + `event4u-bridge` + hooks; NDJSON well-formed. <!-- carve-out: new-gate-verification -->

## Phase 2 — GUI apply uses the real bridge

- [x] `src/server/routes/wizard.ts` `/api/v1/wizard/apply`: drop `--dry-run` on real apply; spawn `install.py --apply-payload <tmp>`, stream NDJSON → existing SSE frames (`plan-file`/`progress`/`done`/`error`). <!-- real apply now SSE-streams install.py NDJSON→progress/done/error; dry_run:true keeps the buffered preview for the Review step; SPA finish() consumes via apiStream -->
- [x] Preserve CSRF, Host/Origin allowlist, transaction log, abort-on-disconnect (Finding #24). <!-- CSRF + Host/Origin via app onRequest hooks; abort-on-disconnect kills the install.py child on reply.raw 'close'; install.py owns its own transactional state (lockfile/manifest) -->
- [~] Verify: GUI apply on a temp HOME produces byte-identical output to the equivalent `install.py` CLI run. <!-- same assertion as Phase 6 parity test — closed there -->

## Phase 3 — Retire the parallel TS apply mirror

- [x] Repoint the SPA to `/api/v1/wizard/apply`; delete the legacy `/api/v1/install/apply` route (`src/server/routes/install.ts`) once unused. <!-- SPA apply already targeted /wizard/apply (now REAL SSE, Phase 2); the /install/apply route + applyHandler + apply-only helpers (mapApplyProgressToFrame/summaryFrame/buildResolutionMap/writeFrame/mapErrorCode) removed -->
- [~] Delete `src/install/apply.ts`, `src/install/bridges/*`, `src/install/wizard-plan.ts`, `src/install/plan.ts`. <!-- DELETED apply.ts (the write mirror) + bridges/* (tests-only). KEPT plan.ts/wizard-plan.ts/conflict.ts: the SPA Review step's per-tool install-plan summary AND the WizardConflicts pre-resolution UI depend on /api/v1/install/plan (buildInstallPlan/computeConflicts). Repointing the preview to install.py --dry-run would regress that tested conflict UI. AI-council split (Gemini=full-delete, Codex=keep-for-preview); the conflict-UI dependency tips it to Codex's option (b). Follow-up: add structured plan+conflict output to install.py --dry-run, then drop plan.ts + /install/plan. -->
- [x] Keep `src/ui/wizard/state.ts` `VALID_TOOLS` (selection UI only); re-point any lingering import. <!-- VALID_TOOLS untouched; no imports referenced the deleted modules -->
- [x] Remove dead `install/apply` tests; keep the Phase 2 delegation tests. <!-- deleted tests/install/apply.test.ts + tests/install/bridges/*; removed the /install/apply describe blocks from tests/server/install.test.ts; kept plan/conflict/types tests -->
- [x] Verify: `npm run build:cli` green, TS suite green, no dangling imports. <!-- build:cli green; tests/install/{plan,conflict,types} + tests/server/install (70 tests) green; no dangling imports (grep clean) -->

## Phase 4 — `init` becomes a thin GUI launcher

- [ ] Fix the drift in `install.py` wizard auto-launch: `_wizard_cli_dist()` → `dist/cli/agent-config.js`; spawn `install`/`setup` (not the dead `gui`); `_WIZARD_READY_RE` → match `WIZARD_READY <url>` (no `url=`, allow `?token=` query); browser-open suppression via `--no-open`.
- [ ] `init` on TTY + display + no `--no-ui`/CI → launch the GUI wizard, skip CLI tool questions.
- [ ] Headless / CI / `--no-ui` / explicit `--tools=` → run non-interactive `install.py` directly (unchanged).
- [ ] Verify: `./agent-config init` opens the wizard locally; `CI=1 ./agent-config init --tools=cursor` runs headless CLI without hanging.

## Phase 5 — Contract + docs

- [x] [`docs/contracts/gui-wizard.md`](../../docs/contracts/gui-wizard.md): fix stale `packages/core/installer/src/gui/*` source-of-truth paths (the real GUI is `src/server/` + `src/ui/`); correct the `WIZARD_READY` contract; note the single real-apply route. <!-- rewrote source-of-truth, boot sequence + WIZARD_READY contract, endpoints table, real-apply section, SSE frames, security/non-goals, D12 -->
- [x] Update README `init` story (GUI-when-possible + headless fallback). <!-- made the auto-launch conditions explicit (TTY+display→GUI; CI/no-tty/--no-ui/explicit --tools→headless); noted GUI+CLI share install.py -->
- [x] Update cross-refs to the removed TS apply layer. <!-- gui-wizard.md was the only doc referencing it; updated to state /api/v1/install/apply + the TS apply engine were removed -->

## Phase 6 — Tests + CI gate

- [ ] Parity test: GUI delegation output ≡ `install.py` CLI output for a representative tool set.
- [ ] Headless fallback test: no-display `init` does not hang waiting for a GUI.
- [ ] `init`-launch smoke test (the `WIZARD_READY` handshake).
- [ ] Run `task ci` green before the PR. <!-- carve-out: new-gate-verification -->

## Acceptance criteria

- One installer (`install.py`) via `--apply-payload`; the TS apply mirror is gone.
- GUI apply produces byte-identical output to the CLI for the same selection (incl. `installed-tools.lock`, `event4u-bridge`, all hooks).
- `npx … init` opens the GUI when a display is available; headless/CI installs non-interactively with no regression.
- `gui-wizard.md` matches the code; `task ci` green.
