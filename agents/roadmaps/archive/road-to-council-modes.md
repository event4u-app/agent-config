# Road to Council Modes

**Status:** Phase 2a + 2b COMPLETE + verified end-to-end (real Anthropic round-trip 2026-05-02, see `agents/council-sessions/2026-05-02T17-05-57Z/`). **Phase 2c CANCELLED 2026-05-03** — browser-automation path (custom Playwright *or* `playwright-mcp`) judged not worth the maintenance cost vs. the value `manual` mode already delivers. Roadmap closed.
**Started:** 2026-05-02
**Closed:** 2026-05-03
**Trigger:** Maintainer wants the council to support three execution paths — `api` (current), `manual` (copy-paste loop), `playwright` (browser automation) — all sharing one neutral context-handoff so external AIs receive enough project context to give a useful second opinion without seeing the host agent's reasoning.
**Mode:** Phase 2a + 2b shipped + verified via a real council call. Phase 2c cancelled — `manual` mode covers the "use my web subscription" use-case without the browser-automation drift / TOS / login-loop overhead. Future browser path, if ever revived, lands as a fresh roadmap, not a resurrection of this one.

## Purpose

Right now the council bundles the artefact (roadmap / diff / prompt / files) plus a per-mode neutrality preamble — but **not** the surrounding project context. External AIs see "here's a roadmap, critique it" without knowing what the project is, what stack it lives in, or what the user originally asked for. That's enough for a diff review but thin for a roadmap critique.

Phase 2a adds a **neutral handoff preamble** modelled on `/agent-handoff`: one paragraph of project context + the user's original ask + the neutral reviewer role — without leaking the host agent's identity or framing. That preamble works the same in `api` mode now and in `manual` / `playwright` mode later.

Phase 2b + 2c add the two new execution modes once 2a has shipped.

## Design anchors (locked, not open for renegotiation)

| Anchor | Source | Decision |
|---|---|---|
| Iron Law of Neutrality | `ai-council` skill | The handoff preamble carries **project** context (stack, repo purpose) and the **user's** original ask. It does **not** carry the host agent's analysis, reasoning, or identity strings. |
| Token storage | `~/.config/agent-config/<provider>.key` | Manual + playwright modes use the user's web subscription — no API keys, but the persistent browser profile lives next to the keys under `~/.config/agent-config/playwright-profile/` mode 0700. |
| Cost gate | `non-destructive-by-default` + `commit-policy` | API mode keeps the existing USD gate. Manual mode skips the cost gate (spend = $0 to us). Playwright mode also skips, but warns the user about provider-side rate limits / quotas. |
| Hard Floor | `non-destructive-by-default` | All three modes are **read-only on the project** — they produce text, never edit files. Playwright drives the browser only at user-named provider URLs; never auto-logs-in, never stores credentials. |
| Mode selection | `.agent-settings.yml` | `ai_council.mode: api\|manual\|playwright` global default; `members.<provider>.mode` overrides per member; `/council mode:<x> …` overrides per invocation. |

## Horizon (visible plate)

**Inside the plate (this iteration):**

- Phase 2a (E1–E4) — Context-Handoff. ✅ Shipped.
- Phase 2b (F1–F5) — Manual mode. ✅ Shipped.
- Phase 2c (G0, G1.5, G1, G2–G6) — Playwright mode. ❌ Cancelled 2026-05-03 (see *Phase 2c cancellation* below).

**Outside the plate:**

- ~~Phase 2d+ (later) — Provider expansion via `playwright_providers.py`.~~ Moot — depended on Phase 2c.

## Phase 2a — Context-Handoff (visible plate)

> Granularity: F-step level, each row is a single PR-able commit.

### E1 — Project-context detector

- [x] **E1.1** Add `scripts/ai_council/project_context.py` with `detect_project_context() -> ProjectContext` dataclass. Fields: `name` (from `composer.json` / `package.json` / repo dir), `stack` (one-line summary inferred from manifest files), `repo_purpose` (first non-heading paragraph of root `README.md`, max 400 chars). All fields optional — fall back to `None` and let the preamble omit the line.
- [x] **E1.2** Tests under `tests/ai_council/test_project_context.py` covering: composer-only project, package-only project, both, neither, missing README, README with no prose paragraph.

### E2 — Handoff preamble

- [x] **E2.1** Extend `scripts/ai_council/prompts.py` with `handoff_preamble(project: ProjectContext, original_ask: str) -> str`. Output is a single neutral paragraph: project name + stack + one-line purpose, then the user's original ask verbatim, then the standard `NEUTRALITY_PREAMBLE`. **Guard:** strip any line matching the host-agent identity patterns (Augment / Claude Code / Cursor / Cline / Windsurf) before returning.
- [x] **E2.2** Tests under `tests/ai_council/test_prompts.py`: identity-leak guard fires on each known host string; `original_ask` passes through verbatim; missing project fields are silently omitted (no `None` literals in the output).

### E3 — Orchestrator integration

- [x] **E3.1** Extend `orchestrator.consult()` signature with `original_ask: str` (the free-form user request that triggered the council, distinct from the bundled artefact). Pass it through to each member's system prompt via `handoff_preamble()`. The per-mode addendum from `prompts.py` still appends after.
- [x] **E3.2** Update `/council` command Step 5 to pass the user's original prompt as `original_ask`. For `prompt:"…"` mode the artefact and the ask are the same string; for `roadmap` / `diff` / `files` modes the ask is the user's free-form sentence ("review this roadmap before I execute it") which the command captures in Step 1.
- [x] **E3.3** Backward-compat: `original_ask=""` is allowed; when empty, `handoff_preamble()` falls back to today's behaviour (neutrality preamble only). Existing tests stay green.

### E4 — Documentation

- [x] **E4.1** Update `ai-council` skill § Neutrality guidelines with one paragraph explaining what the handoff preamble carries vs. what it must never carry. Cross-link to `/agent-handoff` as the inspiration pattern.
- [x] **E4.2** Update `/council` command Step 1 wording: capture the user's original ask explicitly so it can flow into `original_ask`.

## Phase 2b — Manual mode

- [x] **F1** Add `ManualClient` in `clients.py` implementing `ExternalAIClient`. `ask()` renders the full system prompt + handoff preamble + artefact as a single Markdown block, prints it to stdout for the user to copy, then blocks on stdin.
- [x] **F2** Per-member follow-up loop: after each pasted reply, surface `1. More feedback for this member 2. Done with this member, next 3. Abort` (per `user-interaction`). Loop until the user picks `2` or `3`.
- [x] **F3** Mode selection: extend `.agent-settings.yml` schema with `ai_council.mode` (global) and `ai_council.members.<provider>.mode` (per-member override). `/council mode:manual` overrides both per invocation. Resolver lives in `scripts/ai_council/modes.py`.
- [x] **F4** Skip the cost gate in manual mode (spend = $0). Implemented via `ExternalAIClient.billable=False`; `orchestrator.consult()` short-circuits the projection / overrun callback for non-billable members.
- [x] **F5** Tests: `tests/ai_council/test_manual_client.py` (8 tests — stub stdin/stdout, follow-up loop, abort, EOF), `tests/ai_council/test_modes.py` (15 tests — precedence, normalisation, validation), and three orchestrator tests for the non-billable bypass.

## Phase 2c — Playwright mode ❌ CANCELLED (2026-05-03)

> Originally planned as a custom Playwright + DOM-adapter path; re-architected mid-flight onto Microsoft's `playwright-mcp`. Both variants explored, both cancelled. Maintainer judgement: the value of browser-automation as a third council execution path does not justify the long-tail maintenance burden (login flows, cookie banners, provider-side WAF / Cloudflare, accessibility-tree drift, TOS exposure). `manual` mode already covers the "use my web subscription instead of API" use case without any of this surface area.
>
> Evidence trail: G0 (tool-availability gate) was implemented and tested; G1.5 (live round-trip spike) was attempted once against `claude.ai` and surfaced the Cloudflare / login-loop / cookie-banner friction predicted by the original kill-criterion analysis. Spike artefact, source files, and `.playwright-mcp/` cache deleted in the same commit that closes this roadmap.
>
> If browser-automation ever returns to the plate, it lands as a fresh roadmap (`road-to-council-browser-mode.md` or similar) — not as a resurrection of these G-items. Their context (10-session DOM stability, MCP semantic snapshots, provider tables) is preserved here for the historical record.

- [-] **G0** **Tool-availability gate.** Implemented + tested (12 unit tests stubbed; real binary 0.0.73 resolved). Source deleted with cancellation: `scripts/ai_council/playwright_mcp.py`, `tests/ai_council/test_playwright_mcp.py`.
- [-] **G1.5** **Live round-trip smoke test.** Attempted against `claude.ai` 2026-05-03; surfaced `claude.ai/logout` redirect on fresh profile + cookie-banner overlay. REPL-loop variant of the spike script also written. Cancelled before completion. Source deleted: `scripts/ai_council/playwright_mcp_spike.py`, `agents/research/playwright-mcp-spike.md`, `~/.cache/agent-config/playwright-mcp-spike-profile/`, `.playwright-mcp/` console-log cache.
- [-] **G1** `PlaywrightMCPClient`. Cancelled — never started.
- [-] **G1-S** Semi-manual fallback. Cancelled — never started.
- [-] **G2** `playwright_providers.py` config table. Cancelled — never started.
- [-] **G3** Persistent profile at `~/.config/agent-config/playwright-profile/`. Cancelled — never created.
- [-] **G4a** New-chat navigation. Cancelled — never started.
- [-] **G4b** Thread-isolation unit test. Cancelled — never started.
- [-] **G5** TOS warning + opt-in gate. Cancelled — never started.
- [-] **G6** JSON-RPC stub test fixture + live integration test. Cancelled — never started.

## Decisions resolved (council review 2026-05-02)

All five questions settled after the round-trip review on `road-to-council-modes.md`. Trace: `agents/council-sessions/2026-05-02T17-05-57Z/raw-text.md`.

1. **Mode-selection precedence.** ✅ Accepted: invocation flag > per-member setting > global setting > built-in default (`api`). Mirrors `cost_profile` resolution. Clarification per council review: **mixed modes in one invocation are allowed**; the orchestrator prompts every manual-mode member *first*, then runs API-mode members, so the user is not context-switching between typing and waiting. Codified in `scripts/ai_council/modes.py` + tested under `tests/ai_council/test_modes.py` (already shipped in F3).
2. **Manual-mode prompt rendering.** ✅ Accepted: per-member Markdown block, one copy-paste per member. Matches the sequential orchestrator and keeps the follow-up loop scoped. Already shipped in F1.
3. **Playwright provider-adapter scope.** Moot — Phase 2c cancelled 2026-05-03 (decision preserved for the historical record only).
4. **Playwright login detection.** Moot — Phase 2c cancelled 2026-05-03 (the council's "can we detect any state at all?" concern was vindicated by the G1.5 spike: fresh-profile login redirect + cookie banner blocked the round-trip; cancellation followed).
5. **Project-context fallback.** ✅ Accepted: send the preamble with empty stack/purpose silently; the original ask is the load-bearing part. User extends manually via `/council mode:manual` for richer context. Already shipped in E1.1.

## Documentation backports from council review

The council review highlighted two phase-2a / 2b ambiguities that are not implementation gaps but documentation gaps in the already-shipped code. Both are folded into `ai-council` skill or test docstrings; no code change.

- **F2 abort behaviour.** When the user picks `3. Abort` in the manual follow-up loop, the current member's consultation terminates and the orchestrator skips to the next member in the roster. To abort the *entire* council run, the user sends Ctrl-C (existing SIGINT trap in the command layer). Documented in `tests/ai_council/test_manual_client.py` docstring + `ai-council` skill § Manual mode.
- **E1.1 truncation strategy.** `repo_purpose` is capped at 400 chars by stopping at the last full sentence ≤ 400 chars, with an ellipsis if truncated — never mid-sentence. Verified in `tests/ai_council/test_project_context.py`; behaviour documented in `project_context.py` module docstring.
- **E2.1 identity-leak strategy.** Lines containing a host-agent identity substring are dropped *whole* (not just the substring), erring toward false-positive (slightly less context) over false-negative (neutrality leak). Documented in `prompts.py` `_strip_host_identity()` docstring.

## Why now

Phase 1 of `road-to-ai-council.md` shipped a working `api`-mode round-trip. The next bottleneck is **context** — external reviewers do better critique when they know what the project is, not just what the artefact says. The handoff preamble is the smallest change that fixes that, and it's the same preamble manual + playwright modes will need anyway. Building it once now means modes 2b + 2c only add transport, not framing.

## See also

- `road-to-ai-council.md` — Phase 1 (api mode) and Phase 2+ capture-only items (some superseded by this roadmap).
- `ai-council` skill — Iron Law of Neutrality, redaction expectations, cost-UX reference.
- `/council` command — orchestration entry point.
- `/agent-handoff` skill — inspiration pattern for the neutral preamble shape.
