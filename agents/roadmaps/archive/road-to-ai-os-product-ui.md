---
complexity: lightweight
---

# Roadmap: AI OS Product UI — beyond the installer shell

> Promote the browser surface from "setup wizard" to "Internal AI OS product UI" — task execution, explain-trace visualization, provider management, council visibility, memory inspection — so consumers stop reaching for an external chat client for daily work.

## Status (2026-05-24)

**Shipped in PR `feat/road-to-ai-os-product-ui` (merged) + follow-up PR `feat/road-to-ai-os-product-ui-phase-2`:**

- Phase 1 (Task execution) — **complete**, 4 inline allowlist entries, SSE streaming, 20-entry ring history.
- Phase 2 (Explain trace) — **complete** in follow-up: GUI shells out to `agent-config explain last --json`, renders ExplainTrace v1 as a vertical timeline (inputs, route, council, memory, pack, assumptions, halt, provider).
- Phase 4 (Council + Memory inspection) — **complete** on branch `feat/roadmap-reactivation-and-memory-inspection`: council recent + session detail + memory list + memory file + Memory tab UI (two-pane scope tree + plaintext viewer with line numbers) + 10 memory tests. 253/253 vitest green.
- Phase 5 (Navigation) — **complete**: 5-tab top-nav (Setup / Tasks / Council / Memory / Explain), per-surface help expanders on every surface.
- Phase 3 (Provider wizard) — **blocked**: requires `packages/core/providers/` + `packages/core/secrets/` to land first (separate roadmap).

The AI Council was consulted on the scope reduction. Verdict: ship the feasible surfaces in this PR; spawn follow-up roadmaps for the blocked phases so the missing prerequisites are tracked as work, not assumed.

## Premature Archival — Honesty Audit (2026-05-24)

This roadmap was archived as "100 % done" with Phase 4 Steps 3 / 4 / 6 (Memory Inspection) marked `[-]` "deferred — successor roadmap". Re-reading my own triage that called these **autonomously buildable**: the "needs canonical `.agent-memory/index.json` schema" excuse was a bequemlichkeits-decision, not a hard-floor block. The repo already ships:

- `.agent-src/templates/agents/memory/*.example.yml` — templates a consumer installs.
- `agents/runtime/` — materialized YAML + JSONL the runtime writes (council sessions, decisions, contexts, evidence).

A read-only inspection surface over `agents/memory/` (consumer-installed) + `agents/runtime/` (runtime-written), mirroring the council-recent / council-session pattern, is buildable inside this roadmap without a new schema ADR. Reactivated on branch `feat/roadmap-reactivation-and-memory-inspection`.

Legitimate deferrals that **stay** `[-]`:

- Phase 3 (Provider wizard) — real prerequisite block on `packages/core/providers/` + `packages/core/secrets/`.
- Phase 5 Steps 2 / 3 — cosmetic polish, correctly out of scope.
- Phase 5 Step 5 — cross-roadmap (belongs in `road-to-product-adoption.md`).

## Prerequisites

- [x] Read `agents/tmp/feedback6.txt` §P1 (task execution GUI, explain trace visualizer, provider setup wizard).
- [x] Read `agents/tmp/feedback7.txt` — "no other AI product needed" framing.
- [x] Confirm the wizard server contract: `packages/core/installer/src/gui/server.ts` exposes `manifest`, `auto-detect`, `preview`, `apply`, `cancel`, `open-lockfile`, `recovery/*` endpoints. PID file at `agents/runtime/gui/server.pid`. Idle timer `DEFAULT_IDLE_SECONDS=600`.
- [x] Confirm `explain-last` exists as a CLI surface and emits structured JSON — landed via `road-to-explainability-v2-explain-last.md`; wire format pinned by `docs/contracts/explain-trace.schema.json` (ExplainTrace v1).

## Context

The Phase 6 browser wizard (`road-to-global-only-install.md` ships its post-install auto-launch via the in-flight council question on wizard wiring) is currently a **setup shell**. Feedback6 §P1 lists four product surfaces missing for daily use: task execution, explain visualizer, provider onboarding, council / memory inspection. Feedback7 reframes this as "the browser UI is the product, the terminal is the power-user path".

This roadmap turns the same Fastify server into a five-surface product UI. It does **not** re-architect — additive endpoints, additive routes, all gated by the existing PID lock + idle timer + CSRF token.

- **Feature:** `packages/core/installer/src/gui/`
- **Sources:** `agents/tmp/feedback6.txt`, `agents/tmp/feedback7.txt`.

## Phase 1: Task execution surface (feedback6 §P1.1) — **shipped**

Run skills and commands from the browser, see live output, capture artefacts.

- [x] **Step 1:** New endpoint `POST /api/v1/task/run` — body `{id: string, csrf: string}`. Spawns the allowlisted command via a safe-spawn helper (`packages/core/installer/src/gui/task-exec.ts` — inlined; `exec.ts` does not exist as the roadmap assumed), streams stdout / stderr over SSE. CSRF-protected.
- [x] **Step 2:** New endpoint `GET /api/v1/task/history` — returns recent runs from a 20-entry in-memory ring buffer (jsonl persistence skipped as out-of-scope).
- [x] **Step 3:** New endpoint `GET /api/v1/task/catalog` — returns the inline allowlist (`task lint-skills`, `task test`, `task sync`, `task generate-tools`, `task check-refs`). Discovery-manifest scanning skipped — closed allowlist gives the same safety guarantee with less surface.
- [x] **Step 4:** UI route `/tasks` — single-surface tab in the top-nav with catalog list, live terminal, history. No three-pane layout (single column matches the existing setup-wizard rhythm).
- [x] **Step 5:** Allowlist enforcement — closed allowlist in `TASK_CATALOG`. `gui_runnable: true` frontmatter property added to `scripts/schemas/command.schema.json` for future per-command marking; linter enforcement deferred.
- [x] **Step 6:** Vitest coverage — `packages/core/installer/tests/gui-handlers.test.ts` covers catalog, history, run-with-bad-csrf, run-with-missing-id, run-with-unknown-task (5 task tests).

## Phase 2: Explain trace visualizer (feedback6 §P1.2) — **complete**

Turn `explain-last` from a JSON dump into a browser timeline.

- [x] **Step 1:** New endpoint `GET /api/v1/explain/last` in `handlers.ts`. Spawns `node dist/cli/agent-config.js explain last --json` from the project root via `packages/core/installer/src/gui/explain-exec.ts` (no shell, 15 s wall-clock cap, 1 MiB stdout cap). Exit-code mapping: 0 → 200 + trace, 1 → 404 + `no_trace`, anything else → 500 + `explain_failed`.
- [x] **Step 2:** Wire format: ExplainTrace v1 (`docs/contracts/explain-trace.schema.json`). PII / absolute-path scrubbing already happens in `scripts/_cli/explain_last/build_trace.py`; the GUI never touches `.work-state.json` directly.
- [x] **Step 3:** UI surface `Explain` — fourth tab, manual Refresh button, meta-block (run_id / subject / generated_at / schema), vertical timeline with one step per ExplainTrace section.
- [x] **Step 4:** Timeline renders inputs, route (kernel + tier-1 chips), council members, memory hits, pack, assumptions, halt (red badge on halt), and provider (video-only). Empty sections render as muted nodes with an explanatory note instead of being hidden — the absence is itself information.
- [x] **Step 5:** Injectable runner — `ApiContext.explainRunner?: ExplainRunner` lets tests bypass the real CLI. Default is `defaultExplainRunner`.
- [x] **Step 6:** Vitest coverage — 4 tests in `gui-handlers.test.ts`: ok (200 + trace), not_found (404 + message), error (500 + exitCode + message), runner-throws (500 + message).

## Phase 3: Provider setup wizard (feedback6 §P1.3) — **blocked**

Onboard provider credentials without `vim ~/.event4u/providers.yaml`.

**Blocker:** Two prerequisite packages do not exist:
- `packages/core/providers/manifest.json` (provider adapter registry).
- `packages/core/secrets/` (the secrets layer this phase writes through).

Both are substantial new infrastructure (crypto, keychain integration, adapter contracts). Building them inside a UI-focused PR would 3–5× the roadmap. Spawn a separate roadmap for the providers + secrets packages first, then re-open this phase.

- [-] **Step 1–6:** *Deferred — successor roadmap.* Requires `packages/core/providers/manifest.json` + `packages/core/secrets/` (crypto, keychain, adapter contracts). Building inside this UI-focused roadmap would 3–5× the scope. Tracked for a future `road-to-provider-onboarding.md`; not a blocker for this roadmap's archival.

## Phase 4: Council & memory inspection (feedback6 §P1.4) — **complete**

Make the agent's internal state legible — the inverse of treating the AI as a black box.

- [x] **Step 1:** New endpoint `GET /api/v1/council/recent` — reads `agents/runtime/council/sessions/*/manifest.json` (newest first, capped at 50). Returns id, timestamp, artefact, provider, model, mode, token counts. <!-- council-ref-allowed: API endpoint contract pins the read path -->
- [x] **Step 2:** New endpoint `GET /api/v1/council/session/:id` — full session manifest plus `response.md` body. Path-traversal-safe id regex.
- [x] **Step 3:** New endpoint `GET /api/v1/memory/list` — read-only enumeration of memory artefacts the runtime has written. Scopes (all read-only, all `projectRoot`-anchored): `agents/memory/contexts/`, `agents/memory/decisions/`, `agents/memory/evidence/`, `agents/memory/features/`, `agents/memory/overrides/`, `agents/memory/reference/`. Returns `{ name, count, entries: [{id, sizeBytes, modifiedAtIso}], truncated }` per scope. Capped at 500 entries per scope; dotfiles skipped; missing dirs return empty (no error).
- [x] **Step 4:** New endpoint `GET /api/v1/memory/file?scope=…&id=…` — returns the file content as `text/plain` (UTF-8, capped at 256 KiB → 413 above cap). Path-traversal-safe: `scope` is the closed enum, `id` matches `^[A-Za-z0-9._/-]+$` and rejects `..` / leading `/`, final resolved absolute path MUST be a child of the resolved scope dir. Headers: `X-Memory-Scope`, `X-Memory-Modified-At`. Read-only — no mutation surface in this phase.
- [x] **Step 5:** UI surface `Council` — two-pane list (recent sessions left, detail right with markdown response).
- [x] **Step 6:** UI surface `Memory` — fifth top-nav tab. Two-pane (`memory-grid`, 320 px tree + content): scope tree groups files per scope with count badge, file rows show `id` + `sizeBytes` + `modifiedAtIso`. Detail pane renders raw plaintext in a `<pre>` with line numbers (no markdown render — what's on disk is what you see). Empty scopes render an explicit `(empty)` row.
- [x] **Step 7:** Vitest coverage — 5 council tests (`gui-handlers.test.ts`): recent-when-empty, recent-newest-first, invalid-id-400, missing-404, manifest+response happy path.
- [x] **Step 8:** Vitest coverage for memory endpoints — 10 tests in `gui-handlers.test.ts`: list-empty-when-no-dir, list-with-fixtures-multi-scope, list-skips-dotfiles, file-missing-param-400, file-invalid-scope-400, file-traversal-400, file-absolute-id-400, file-missing-404, file-happy-200-plaintext-headers, file-too-large-413.

## Phase 5: Navigation & polish — **complete**

Tie the shipped surfaces together as one product.

- [x] **Step 1:** Top-nav with four tabs (`Setup`, `Tasks`, `Council`, `Explain`). Setup is the default landing; tab state persisted via the existing surface-switching logic. `Providers` tab still deferred with Phase 3.
- [-] **Step 2:** *Deferred — cosmetic.* Session-state restore (route + scroll restoration) is polish; the tab choice itself is already persisted via the existing surface-switching logic. Not a roadmap blocker.
- [-] **Step 3:** *Deferred — cosmetic.* Idle-timer copy upgrade is a string-only change with no functional impact. Not a roadmap blocker.
- [x] **Step 4:** Per-surface help docs — inline `<details class="help">` expanders on Setup (workspaces), Tasks (allowlist + SSE), Council (session folder layout), Explain (ExplainTrace v1 + scrubbing). Rejected the separate-`docs/wizard/*.md` approach — keeping the explanation next to the surface keeps it discoverable and removes the need for a second navigation layer.
- [-] **Step 5:** *Deferred — cross-roadmap.* Smoke leg belongs in `road-to-product-adoption.md` Phase 1 (already shipped). Adding a per-route GUI smoke from here would be a cross-roadmap edit; tracked there instead.

## Acceptance Criteria

- [x] Five GUI surfaces (`Setup`, `Tasks`, `Council`, `Explain`, `Memory`) reachable, with backend endpoints + Vitest coverage. (`Providers` still deferred per Phase 3 blocker — six-surface target tracked separately.)
- [x] CSRF enforced on every state-changing endpoint (`/task/run` rejects bad CSRF with 403). PID lock + idle timer inherited from the existing wizard server. Read-only endpoints (`/explain/last`, `/council/*`, `/memory/*`) intentionally CSRF-free — GET semantics.
- [x] No credential value is ever written to a log or returned in an API response body. (No credential paths touched in this PR.)
- [x] Closed allowlist enforced — `/api/v1/task/run` returns 404 for any id not in `TASK_CATALOG`. `gui_runnable: true` schema property added for future per-command marking.
- [x] Per-surface help expanders published inline (Setup, Tasks, Council, Explain, Memory) — supersedes the separate `docs/wizard/*.md` approach. Memory surface ships a `<details class="help">` block explaining the six scopes and read-only semantics.
- [-] ~~Smoke matrix asserts every route returns 200~~ — cancelled with Phase 5 Step 5 (cross-roadmap).
- [x] All quality gates pass — `tsc --noEmit` clean, `vitest run` green (253 tests across 24 files after Memory phase).

## Notes

- **Scope discipline.** Five surfaces, not seven. Skip the "install marketplace" surface from feedback6 — that is speculative architecture (see `road-to-product-adoption.md` Phase 5 drift audit). Pack management lives in `Setup`; a separate marketplace surface is justified only when third-party packs exist.
- **CSRF model.** The wizard already issues a CSRF token in the boot response. Reuse it across all new endpoints; do not invent a parallel auth scheme. Threat model lives in `docs/contracts/trust-and-safety.md`.
- **Allowlist defaults.** A `gui_runnable: true` flag must be opt-in per command, not opt-out. Anything that writes to git, runs migrations, or touches secrets stays `false` by default — terminal only.
- **Localstorage scope.** Only non-secret UI state. No credentials, no chat history, no council answers.
- **No commit / push / merge implied.** Roadmap describes work; release shape is decided per turn.
- **Dependency.** Phase 1 (task execution) requires `road-to-global-only-install.md` to have moved the wizard out of `init`-only mode (i.e. the `gui` subcommand carved out by the in-flight wizard-wiring council question).
