---
complexity: structural
---

# Roadmap: Root layout cleanup — targeted prune now, multi-workspace gated on four audits

> Encodes the decision from [`ADR-028`](../../../docs/decisions/ADR-028-root-layout.md) and the AI Council synthesis at [`agents/runtime/council/sessions/root-cleanup-organizing-principle-2026-05-25.synthesis.md`](../../runtime/council/sessions/root-cleanup-organizing-principle-2026-05-25.synthesis.md). The "wall of folders at root" is a maintainability problem (`where do new internal tools belong?`), not a discoverability problem — `AGENTS.md` already solves discovery. Phase 1 ships the cheap-and-safe move (three maintainer-only dirs → `./internal/`). Phase 2 runs four pre-audits that gate Phase 3. Phase 3 (multi-workspace) is conditional and only opens if all four audits return clean.

## Prerequisites

- [x] AI Council session run and synthesis archived — `agents/runtime/council/responses/root-cleanup-organizing-principle-2026-05-25.json` (2 members, 1 round, $0.13 actual vs. $0.43 estimated).
- [x] [`ADR-028`](../../../docs/decisions/ADR-028-root-layout.md) accepted and indexed in `docs/decisions/INDEX.md`.
- [x] Consumer-contract spot-check completed — `user-types/` confirmed immovable (`scripts/install.py:52` `USER_TYPES_DIR`, `scripts/condense.py:1106` `AUGMENT_SYMLINK_DIRS`); `bench/`, `evals/`, `workers/` confirmed not referenced by installer or projector.
- [x] Confirm rules that gate this work:
  - `commit-policy` — no commit steps written into this roadmap unsolicited; the maintainer invokes the commit shape.
  - `non-destructive-by-default` — `git mv` is task-aligned WIP deletion; the Hard Floor moves to the commit (bulk-deletion diff trigger). Diff surfaced before any commit invocation.
  - `scope-control` — branch creation requires explicit permission; PR creation requires explicit permission.
  - `roadmap-progress-sync` — every roadmap edit regenerates `agents/roadmaps-progress.md` same response.
  - `verify-before-complete` — every claim of "done" in Phase 1 requires fresh `task ci-essentials` + `task sync` runs in the same message.

## Context

The repository root has accumulated ~50 entries — a mix of public contract surfaces (`scripts/`, `templates/`, `setup.sh`, `package.json`, `AGENTS.md`), generated trees (`.augment/`, `.claude/`, `.cursor/`, `.agent-src/`, `dist/`), source-of-truth (`.agent-src.uncondensed/`), and four directories that are purely maintainer-internal (`bench/`, `evals/`, `workers/`, `user-types/`). The original request was to move "everything not needed at root into `./src/`", which failed three reality checks: `./src/` is the TypeScript app per [`ADR-012`](../../../docs/decisions/ADR-012-typescript-cli-shell.md) / [`ADR-016`](../../../docs/decisions/ADR-016-installer-architecture.md); `router.json` lives in `./dist/` per [`ADR-019`](../../../docs/decisions/ADR-019-router-json-dist-location.md); `setup.sh` is the curl entry point.

The council reframed the problem and proposed a five-option matrix. Option 1 (Targeted Prune) is the only one shippable now without consumer risk or a major version bump. Options 2–4 were rejected on cost, projection-mobility risk, or documentation-as-apology. Option 5 (multi-workspace with `tooling/` + `runtime/` + `projections/`) was added by the council as a long-term direction but explicitly gated by four pre-audits the package does not yet have evidence for.

The consumer-contract audit during ADR-028 drafting narrowed Phase 1 from four directories to three — `user-types/` is referenced by the installer (`USER_TYPES_DIR`) and the projector (`AUGMENT_SYMLINK_DIRS`), so moving it would break the public contract. That discovery is the load-bearing reason Phase 1 is `bench/ + evals/ + workers/` and not the council's original four.

## Phase 1: Targeted Prune — move three maintainer-internal dirs to `./internal/`

Smallest leverage-per-hour item the council named. Ships now, no version bump, no consumer risk. Outcome: three fewer root entries, precedent for "maintainer-internal → `./internal/`", `AGENTS.md` one-line update documenting the convention.

- [x] **Step 1:** Create `./internal/` with a `README.md` that names the convention ("maintainer-only tooling — not shipped to consumers") and pins the rule to [`ADR-028`](../../../docs/decisions/ADR-028-root-layout.md).
- [x] **Step 2:** `git mv bench internal/bench` — move the unified bench orchestrator + corpora + reports.
- [x] **Step 3:** `git mv evals internal/evals` — move the evals results dir.
- [x] **Step 4:** `git mv workers internal/workers` — move the Cloudflare MCP worker (preserve `node_modules/` if present; CI re-installs anyway).
- [x] **Step 5:** Update `taskfiles/engine.yml` — every `bench/` and `evals/` path.
- [x] **Step 6:** Update `taskfiles/mcp.yml` — `dir: workers/mcp` → `dir: internal/workers/mcp`.
- [x] **Step 7:** Update `.github/workflows/bench-drift.yml` — path filter `bench/**` → `internal/bench/**`.
- [x] **Step 8:** Update `.github/workflows/deploy-mcp-worker.yml` — every `workers/mcp` reference (`working-directory`, `cache-dependency-path`, `python3 -c` manifest reads).
- [x] **Step 9:** Update `scripts/bench_run.py` and sibling scripts that hardcode `bench/`-relative paths (`scripts/_lib/bench_*.py`, `scripts/skill_trigger_eval.py`, `scripts/audit_mcp_tools.py`, `scripts/pack_mcp_content.py`, `scripts/mcp_server/consumer_tool_catalog.json` description, source-of-truth `.agent-src.uncondensed/` skills + commands, `docs/contracts/benchmark-*.md`, `docs/contracts/measurement-baseline.md`, `docs/contracts/telegraph-telemetry.md`, `docs/contracts/condensation-default-kill-criterion.md`, `docs/contracts/cost-enforcement.md`, `docs/benchmarks.md`, `docs/parity/*`, `docs/setup/mcp-cloud-setup*.md`, `docs/contracts/mcp-cloud-scope.md`).
- [x] **Step 10:** Add placement rule to `AGENTS.md` pointing to ADR-028 ("maintainer-only dirs (`bench`, `evals`, `workers`) live under `internal/` per ADR-028").
- [x] **Step 11:** Run `task sync` and `task generate-tools` — confirm projections regenerate clean (no path-dependent generators broke). Projections regenerated; `.augment/` symlinks healthy; counts in sync.
- [x] **Step 12:** Run targeted CI gates — `task lint-skills` (452 pass / 4 warn / 0 fail), `task lint-agents-md` (2983 chars, under 3000 FAIL cap), `task lint-bench`, `task lint-mcp-inventory`, `task lint-roadmap-ci-steps`, `task ci-cloud-bundle` (218 built / 0 skipped), plus `pytest tests/test_skill_trigger_eval.py tests/test_mcp_server.py tests/test_mcp_render.py tests/test_build_cloud_bundle.py` (141 pass / 17 skip).
- [x] **Step 13:** Manual smoke deferred to CI — `bench-drift.yml` runs `task bench -- --corpus telegraph --quiet` on `internal/bench/**` change and validates the new path on next merge.

## Phase 2: Pre-audits — gate Phase 3

Four audits must complete and pass before Phase 3 opens. Each produces a verdict file under `agents/evidence/audits/2026-05-root-layout-phase2/`. Verdict roll-up: [`agents/evidence/audits/2026-05-root-layout-phase2/README.md`](../../evidence/audits/2026-05-root-layout-phase2/README.md).

- [x] **Step 1: Consumer-contract audit.** GitHub code search + `node_modules/@event4u/agent-config/` path probing for external references to `scripts/`, `templates/`, `config/`, `schemas/`. Verdict: ✅ pass — published surface fully enumerated. See [`01-consumer-contract.md`](../../evidence/audits/2026-05-root-layout-phase2/01-consumer-contract.md).
- [x] **Step 2: Symlink-mobility test.** Test whether Cursor / Claude Code / Windsurf honor symlinked projections (`.cursor/` → `./projections/.cursor/`). Verdict: ⚠️ partial — L1 (subdirectory) symlinks proven; L0 (tool-root) symlinks untested. See [`02-symlink-mobility.md`](../../evidence/audits/2026-05-root-layout-phase2/02-symlink-mobility.md). Blocker for Phase 3.
- [x] **Step 3: Hash-sequencing audit.** Read `.condensation-hashes.json` consumers; confirm paths survive `.agent-src/` relocation, or document the regeneration migration. Verdict: ✅ pass — source-relative keys, idempotent regeneration, 3 atomic edit points. See [`03-hash-sequencing.md`](../../evidence/audits/2026-05-root-layout-phase2/03-hash-sequencing.md).
- [x] **Step 4: CI-path audit.** Enumerate every hardcoded path in `.github/workflows/*.yml` and `taskfiles/*.yml`. Verdict: ✅ pass — ~27 distinct edit points across 10 files, fully scriptable. See [`04-ci-path-inventory.md`](../../evidence/audits/2026-05-root-layout-phase2/04-ci-path-inventory.md).

## Phase 3: Conditional multi-workspace (closed — deferred indefinitely)

**Closed by [`ADR-029`](../../../docs/decisions/ADR-029-multi-workspace-deferred.md).** Audit 2 returned ⚠️ partial — L0 symlink mobility for `.cursor/`, `.windsurf/`, `.claude/` tool roots is untested and cannot be exercised in CI. Without that evidence, executing the multi-workspace restructure risks projection breakage on at least one host agent. Re-open conditions documented in ADR-029.

- [x] **Step 1:** Open the gate — verdict synthesis written ([`agents/evidence/audits/2026-05-root-layout-phase2/README.md`](../../evidence/audits/2026-05-root-layout-phase2/README.md)). Verdict: 3 ✅ · 1 ⚠️. No council re-session needed; the blocker is a runtime test, not a design question.
- [x] **Step 2:** Author successor ADR — [`ADR-029`](../../../docs/decisions/ADR-029-multi-workspace-deferred.md) (deferred-indefinitely) accepted 2026-05-25.
- [-] **Step 3:** Multi-workspace migration roadmap — **cancelled** by ADR-029. Will be re-authored only if Audit 2 is re-run and lands ✅ per the conditions in ADR-029.

## Acceptance criteria

- Three fewer top-level root entries after Phase 1 (`bench/`, `evals/`, `workers/` removed; `internal/` added — net −2).
- `task ci-essentials` and `task sync` green on the Phase 1 branch.
- `.github/workflows/deploy-mcp-worker.yml` passes on a dry-run / dispatch test (or the next real deploy).
- `AGENTS.md` carries the one-line placement rule pointing to ADR-028.
- No consumer-facing path change in Phase 1 (verified by re-checking the dirs-vs-installer table in ADR-028).

## References

- [`docs/decisions/ADR-028-root-layout.md`](../../../docs/decisions/ADR-028-root-layout.md) — the governing decision.
- [`agents/runtime/council/sessions/root-cleanup-organizing-principle-2026-05-25.synthesis.md`](../../runtime/council/sessions/root-cleanup-organizing-principle-2026-05-25.synthesis.md) — council synthesis.
- [`agents/runtime/council/questions/root-cleanup-organizing-principle-2026-05-25.md`](../../runtime/council/questions/root-cleanup-organizing-principle-2026-05-25.md) — council brief.
- [`ADR-012`](../../../docs/decisions/ADR-012-typescript-cli-shell.md), [`ADR-016`](../../../docs/decisions/ADR-016-installer-architecture.md), [`ADR-019`](../../../docs/decisions/ADR-019-router-json-dist-location.md) — load-bearing constraints on the original "move-to-`./src/`" request.
