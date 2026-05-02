# Road to Council Modes

**Status:** Phase 2a + 2b COMPLETE + verified end-to-end (real Anthropic round-trip 2026-05-02, see `agents/council-sessions/2026-05-02T17-05-57Z/`). Phase 2c restructured per council review — research spike (G1.5) gates implementation; G2–G6 capture-only pending spike outcome + Playwright dependency authorisation.
**Started:** 2026-05-02
**Trigger:** Maintainer wants the council to support three execution paths — `api` (current), `manual` (copy-paste loop), `playwright` (browser automation) — all sharing one neutral context-handoff so external AIs receive enough project context to give a useful second opinion without seeing the host agent's reasoning.
**Mode:** Phase 2a + 2b shipped + verified via a real council call. Phase 2c is fenced behind a research spike: per the council review, no DOM adapter can be built before empirical evidence that providers expose a stable "streaming-finished" signal.

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

- Phase 2a (E1–E4) — Context-Handoff: `handoff_preamble()` in `prompts.py`, project-context detection, integration into `orchestrator.consult()`, tests. Estimated 0.5–1 dev day. **Used by `api` mode immediately; carries forward to manual + playwright.**

**Outside the plate (capture-only, gated on Phase 2a evidence):**

- Phase 2b (F1–F5) — Manual mode: copy-paste loop with per-member follow-up rounds.
- Phase 2c (G1–G6) — Playwright mode: browser-driven chat with persistent profile + per-provider DOM adapters.

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

## Phase 2c — Playwright mode (research spike + capture-only)

> Restructured 2026-05-02 after council review (`agents/council-sessions/2026-05-02T17-05-57Z/`). G1.5 added; G4 split into G4a/G4b; kill criterion made explicit. Implementation steps remain capture-only until the spike outputs evidence and the user authorises the new dependency.

- [ ] **G1.5** **Research spike — DOM stability proof-of-concept.** Before any client code lands, capture 10+ real chat sessions on `claude.ai` and `chatgpt.com` (devtools recordings or Playwright trace files, no automation yet) and document under `agents/research/playwright-dom-signals.md`:
      1. What DOM nodes appear/change during streaming?
      2. What CSS classes / ARIA attributes toggle when streaming stops?
      3. Does the signal survive scroll, navigation, and provider A/B-test variants?
      4. Can we distinguish "streaming complete" from "streaming paused (rate limit)" or "user navigated away mid-stream"?
      **Kill criterion:** if no provider exposes a stable signal, Phase 2c is **not viable**. Fallback options recorded explicitly in the research doc: (a) drop Playwright mode entirely, or (b) pivot to a "semi-manual" hybrid where the user confirms "response complete" before extraction.
- [ ] **G1** Add `PlaywrightClient` in `clients.py`. `ask()` opens a persistent-profile browser at the provider's chat URL, submits the system prompt + handoff preamble + artefact via DOM, polls for the streamed response, returns text. *Gated on G1.5.*
- [ ] **G2** Per-provider DOM adapter under `scripts/ai_council/playwright_adapters/<provider>.py` — `claude.ai` and `chatgpt.com` for v1; `gemini.google.com` and others later. Each adapter exposes `submit(text)`, `wait_for_complete()`, `extract_response()`. *Gated on G1.5.*
- [ ] **G3** Persistent browser profile under `~/.config/agent-config/playwright-profile/` mode 0700 so login persists between sessions. Never auto-fill credentials. Surface "log in if needed, then press 1 to continue" before the first DOM interaction per session. *Gated on G1.5.*
- [ ] **G4a** Navigation strategy — document and implement how each adapter goes from "logged-in landing page" to "blank new chat" (button click vs. base-URL redirect vs. `/new` endpoint). One per provider in the adapter file. *Gated on G1.5.*
- [ ] **G4b** Thread isolation — never reuse a thread (would leak prior context across council runs). Asserted as a contract test against the recorded HAR fixtures from G6. *Gated on G1.5.*
- [ ] **G5** Cost gate skipped (spend = $0). Provider rate-limit / quota warning surfaced once at session start. Includes a one-line warning that browser automation may violate provider TOS — user opts in via explicit `/council mode:playwright` invocation, never auto-selected. *Gated on G1.5.*
- [ ] **G6** Tests: adapter-level tests with recorded HAR files; integration tests gated behind a `PLAYWRIGHT_LIVE=1` env var so CI never hits real providers. *Gated on G1.5.*

## Decisions resolved (council review 2026-05-02)

All five questions settled after the round-trip review on `road-to-council-modes.md`. Trace: `agents/council-sessions/2026-05-02T17-05-57Z/raw-text.md`.

1. **Mode-selection precedence.** ✅ Accepted: invocation flag > per-member setting > global setting > built-in default (`api`). Mirrors `cost_profile` resolution. Clarification per council review: **mixed modes in one invocation are allowed**; the orchestrator prompts every manual-mode member *first*, then runs API-mode members, so the user is not context-switching between typing and waiting. Codified in `scripts/ai_council/modes.py` + tested under `tests/ai_council/test_modes.py` (already shipped in F3).
2. **Manual-mode prompt rendering.** ✅ Accepted: per-member Markdown block, one copy-paste per member. Matches the sequential orchestrator and keeps the follow-up loop scoped. Already shipped in F1.
3. **Playwright provider-adapter scope.** ✅ Accepted: v1 = `claude.ai` + `chatgpt.com` only; the adapter ABC remains open so Gemini / Mistral are one new file each later. Conditional on G1.5 finding a stable signal for both v1 providers.
4. **Playwright login detection.** ✅ Revised after review: **always ask** (DOM heuristics drift, explicit user confirmation per session is cheap), **and always require G1.5 evidence first** (the council flagged that login detection is the visible tip of a deeper "can we detect any state at all?" risk; G1.5 surfaces the deeper question).
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
