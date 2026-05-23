---
complexity: lightweight
---

# Roadmap: AI OS Product UI — beyond the installer shell

> Promote the browser surface from "setup wizard" to "Internal AI OS product UI" — task execution, explain-trace visualization, provider management, council visibility, memory inspection — so consumers stop reaching for an external chat client for daily work.

## Prerequisites

- [ ] Read `agents/tmp/feedback6.txt` §P1 (task execution GUI, explain trace visualizer, provider setup wizard).
- [ ] Read `agents/tmp/feedback7.txt` — "no other AI product needed" framing.
- [ ] Confirm the wizard server contract: `packages/core/installer/src/gui/server.ts` exposes `manifest`, `auto-detect`, `preview`, `apply`, `cancel`, `open-lockfile`, `recovery/*` endpoints. PID file at `agents/runtime/gui/server.pid`. Idle timer `DEFAULT_IDLE_SECONDS=600`.
- [ ] Confirm `explain-last` exists as a CLI surface and emits structured JSON (route, provider, halts, trust gates, reasoning chain).

## Context

The Phase 6 browser wizard (`road-to-global-only-install.md` ships its post-install auto-launch via `agents/tmp/council-question-wizard-wiring.md`) is currently a **setup shell**. Feedback6 §P1 lists four product surfaces missing for daily use: task execution, explain visualizer, provider onboarding, council / memory inspection. Feedback7 reframes this as "the browser UI is the product, the terminal is the power-user path".

This roadmap turns the same Fastify server into a five-surface product UI. It does **not** re-architect — additive endpoints, additive routes, all gated by the existing PID lock + idle timer + CSRF token.

- **Feature:** `packages/core/installer/src/gui/`
- **Sources:** `agents/tmp/feedback6.txt`, `agents/tmp/feedback7.txt`.

## Phase 1: Task execution surface (feedback6 §P1.1)

Run skills and commands from the browser, see live output, capture artefacts.

- [ ] **Step 1:** New endpoint `POST /api/v1/task/run` — body `{command: string, args: object, cwd: string}`. Spawns the command via the existing CLI plumbing (`packages/core/installer/src/exec.ts`), streams stdout / stderr over SSE. CSRF-protected via the existing header.
- [ ] **Step 2:** New endpoint `GET /api/v1/task/history?limit=50` — returns recent runs (id, command, started_at, finished_at, exit_code) from `agents/runtime/gui/task-history.jsonl`.
- [ ] **Step 3:** New endpoint `GET /api/v1/task/catalog` — discovers runnable commands by reading `dist/discovery/discovery-manifest.json`; returns the role-filtered list for the current pack selection.
- [ ] **Step 4:** UI route `/tasks` — three-pane (catalog left, terminal-output center, history right). Reuses the existing CSS tokens; no new design system.
- [ ] **Step 5:** Allowlist enforcement — only commands flagged `gui_runnable: true` in their frontmatter are executable from the browser. Default `false`. Skill linter (`task lint-skills`) extended to validate the flag.
- [ ] **Step 6:** Vitest coverage — `packages/core/installer/tests/gui-task-execution.test.ts`: catalog returns >0 entries, SSE stream emits stdout for a deterministic command, history file appends.

## Phase 2: Explain trace visualizer (feedback6 §P1.2)

Turn `explain-last` from a JSON dump into a browser timeline.

- [ ] **Step 1:** New endpoint `GET /api/v1/explain/last` — wraps `explain-last` CLI, returns its JSON.
- [ ] **Step 2:** New endpoint `GET /api/v1/explain/list?limit=20` — lists historical explain dumps from `agents/runtime/explain/`.
- [ ] **Step 3:** UI route `/explain` — single-column timeline. Per node: routing decision, provider choice, halts triggered, trust gate verdicts, reasoning chain summary, full prompt + response (collapsed).
- [ ] **Step 4:** Filter chips — by `halt`, `trust_gate_failed`, `provider`, `cost_band`. Persist last filter in localStorage.
- [ ] **Step 5:** Export current view as Markdown (`button: Export trace`) — file saved to `agents/exports/explain-<timestamp>.md`. Useful for pasting into a PR review or a council question.
- [ ] **Step 6:** Vitest coverage — `gui-explain-timeline.test.ts`: list endpoint returns ordered entries, single explain dump renders all node types.

## Phase 3: Provider setup wizard (feedback6 §P1.3)

Onboard provider credentials without `vim ~/.event4u/providers.yaml`.

- [ ] **Step 1:** New endpoint `GET /api/v1/providers/list` — returns the available provider adapters (`openai`, `anthropic`, `google`, `local-ollama`, `veo`, `kling`, `sora`) from `packages/core/providers/manifest.json` (new; replaces hard-coded list).
- [ ] **Step 2:** New endpoint `POST /api/v1/providers/{id}/test` — body `{credentials: object}`. Runs the adapter's validation request (small token round-trip for chat providers; metadata fetch for image / video providers). Returns `{ok: bool, error?: string, latency_ms: int}`. **Never logs the credential value.**
- [ ] **Step 3:** New endpoint `POST /api/v1/providers/{id}/save` — writes to `~/.event4u/providers.yaml` via the existing secrets layer (`packages/core/secrets/`). CSRF + dry-run preview gate before write.
- [ ] **Step 4:** UI route `/providers` — list view with status pill per provider (`not configured | configured | failing`). Per provider: configure form with key fields, "Test connection" button, "Save" button (disabled until test passes).
- [ ] **Step 5:** Trust-banner — render the provider's trust level (`stable | beta | experimental | community` per `provider-lifecycle-discipline`) prominently above the configure form. Don't allow `experimental` save without a typed confirmation.
- [ ] **Step 6:** Vitest coverage — `gui-providers.test.ts`: list endpoint matches manifest; test endpoint returns `{ok: false, error: "..."}` on bad credential; save endpoint refuses without CSRF.

## Phase 4: Council & memory inspection (feedback6 §P1.4)

Make the agent's internal state legible — the inverse of treating the AI as a black box.

- [ ] **Step 1:** New endpoint `GET /api/v1/council/recent?limit=20` — reads `agents/runtime/council/*/decision.json` (the existing council artefact path). Returns id, question (truncated 80 chars), verdict, timestamp.
- [ ] **Step 2:** New endpoint `GET /api/v1/council/{id}` — full council artefact: question, options, persona votes, verdict, dissents.
- [ ] **Step 3:** New endpoint `GET /api/v1/memory/list?scope={project|user}&limit=50` — reads `.agent-memory/index.json` (project) or `~/.event4u/agent-memory/index.json` (user). Returns id, summary, tags, last_used_at.
- [ ] **Step 4:** New endpoint `DELETE /api/v1/memory/{id}` — CSRF-gated. Surfaces the entry once more before deletion (dry-run preview).
- [ ] **Step 5:** UI route `/council` — two-pane (recent left, detail right). Voting table with each persona's verdict + their one-line rationale.
- [ ] **Step 6:** UI route `/memory` — list with filter chips by tag, scope toggle (project vs user), per-entry "Forget" action.
- [ ] **Step 7:** Vitest coverage — `gui-council.test.ts`, `gui-memory.test.ts`: read-only endpoints behind happy-path fixtures; delete endpoint refuses without CSRF.

## Phase 5: Navigation & polish

Five surfaces is enough; tie them together as one product.

- [ ] **Step 1:** Top-nav with five tabs: `Setup`, `Tasks`, `Explain`, `Providers`, `Council & Memory`. `Setup` becomes the default landing when fresh install; `Tasks` becomes default after first-pack-applied.
- [ ] **Step 2:** Session-state restore — closing the browser tab does not lose the open task / explain trace; localStorage preserves the route + scroll position; server pickup on next open.
- [ ] **Step 3:** Idle-timer copy upgrade — current message: "Server idle, shutting down in N seconds." New: "No activity in your AI OS for N minutes. The server will hibernate; reopen anytime with `<command>`."
- [ ] **Step 4:** Per-surface "help" link → `docs/wizard/<surface>.md` (five new docs, ≤ 150 lines each).
- [ ] **Step 5:** Smoke leg — append a wizard-boot + each-route-200-OK assertion to the matrix from `road-to-product-adoption.md` Phase 1.

## Acceptance Criteria

- [ ] Five GUI surfaces (`/setup`, `/tasks`, `/explain`, `/providers`, `/council`) reachable, with backend endpoints + Vitest coverage.
- [ ] CSRF, PID lock, idle timer enforced on every new endpoint.
- [ ] No credential value is ever written to a log or returned in an API response body.
- [ ] `gui_runnable: true` allowlist enforced — command without the flag returns 403 from `/api/v1/task/run`.
- [ ] Five `docs/wizard/<surface>.md` docs published, linked from the in-UI help.
- [ ] Smoke matrix (from `road-to-product-adoption.md`) asserts every route returns 200.
- [ ] All quality gates pass (`task lint-skills`, `task test`, Vitest, smoke matrix).

## Notes

- **Scope discipline.** Five surfaces, not seven. Skip the "install marketplace" surface from feedback6 — that is speculative architecture (see `road-to-product-adoption.md` Phase 5 drift audit). Pack management lives in `Setup`; a separate marketplace surface is justified only when third-party packs exist.
- **CSRF model.** The wizard already issues a CSRF token in the boot response. Reuse it across all new endpoints; do not invent a parallel auth scheme. Threat model lives in `docs/contracts/trust-and-safety.md`.
- **Allowlist defaults.** A `gui_runnable: true` flag must be opt-in per command, not opt-out. Anything that writes to git, runs migrations, or touches secrets stays `false` by default — terminal only.
- **Localstorage scope.** Only non-secret UI state. No credentials, no chat history, no council answers.
- **No commit / push / merge implied.** Roadmap describes work; release shape is decided per turn.
- **Dependency.** Phase 1 (task execution) requires `road-to-global-only-install.md` to have moved the wizard out of `init`-only mode (i.e. the `gui` subcommand from `agents/tmp/council-question-wizard-wiring.md`).
