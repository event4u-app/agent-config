---
complexity: lightweight
---

# Road to verified chat-history platforms

**Status:** ARCHIVED 2026-05-05 — Phases 1–6 docs-verified shipping. The 8 remaining open items are deferred-watch with explicit external trigger events (4× opportunistic payload-verified upgrade gated on live IDE sessions; 3× Cowork install plumbing gated on [anthropics/claude-code#40495](https://github.com/anthropics/claude-code/issues/40495); 1× Phase 6 re-evaluation secondary-gated on the payload-verified upgrades). No active execution remaining; reopen via `git mv` back to `agents/roadmaps/` if/when a trigger fires.
**Started:** 2026-05-05
**Trigger:** AI Council session `agents/council-sessions/20260505T050924Z-chat-history-unified.json` flagged that only Augment Code and Claude Code have a payload-shape that has been verified against vendor docs. Cursor, Cline, Windsurf, and Gemini CLI relied on top-level-key guesses inside `scripts/chat_history.py::_extract_hook_text` and had never been observed end-to-end.
**Mode:** Two-tier verification — `docs-verified` (extractor branch matches vendor docs + tests cover documented shapes) ships now; `payload-verified` (same branch confirmed against a redacted live capture) is the optional upgrade path. Council ruling 2026-05-05 (anthropic/claude-opus-4-1 + openai/gpt-4o, mixed verdict): proceed with docs-verified for all four remaining platforms; flag Cursor + Windsurf as schema-volatile and revisit if a live capture becomes available.

## Why this is a separate roadmap

`road-to-stable-chat-history.md` (archived 2026-05) closed Phase 1 of the original effort: cadence, session isolation, sidecar cleanup, and the platform-hooks context document. The Augment + Claude payload-extraction patch (2026-05-05) is a Phase 1.5 follow-up that ships the matrix's first two `docs-verified` entries.

This roadmap tracks the remaining four platforms. They are independent (different vendors, different IDE surfaces, separate release cadences), so they get their own discovery phases instead of being bundled into the closed roadmap.

## Authoritative artifacts

- Platform matrix + payload schemas — [`agents/contexts/chat-history-platform-hooks.md`](../contexts/chat-history-platform-hooks.md)
- Dispatcher + extractor — [`scripts/chat_history.py`](../../scripts/chat_history.py) (`_extract_hook_text`, `_extract_augment_conversation`, `_extract_claude_transcript_response`, `hook_dispatch`)
- Capture tooling — [`scripts/hooks/dispatch_hook.py`](../../scripts/hooks/dispatch_hook.py) (`_maybe_capture_payload`, env-gated by `AGENT_HOOK_CAPTURE_DIR`) + [`scripts/redact_hook_capture.py`](../../scripts/redact_hook_capture.py) (sanitises captures before they land in this roadmap)
- Council ruling — [`agents/council-sessions/20260505T050924Z-chat-history-unified.json`](../council-sessions/20260505T050924Z-chat-history-unified.json)

## One-shot capture protocol

Every discovery phase reuses the same loop. Tooling is shipped — only the platform-side enable + the actual session run are user actions.

```bash
# 1. Pick a capture dir (gitignored — never commit raw captures)
export AGENT_HOOK_CAPTURE_DIR="$HOME/.agent-config-captures/<platform>"
mkdir -p "$AGENT_HOOK_CAPTURE_DIR"

# 2. Run ONE representative session on the platform (e.g. "what time is it?")
#    The dispatcher writes raw payloads as JSON before any concern fires.

# 3. Redact (replaces userPrompt / agentTextResponse / prompt / response /
#    message / content with <REDACTED>; envelope keys preserved)
python3 scripts/redact_hook_capture.py "$AGENT_HOOK_CAPTURE_DIR" --strict

# 4. Inspect <platform>__<event>__*.redacted.json — paste the smallest
#    representative one into the relevant phase below as a fenced JSON block.

# 5. Lock the schema in agents/contexts/chat-history-platform-hooks.md
#    (flip the platform's `Verification` column to `payload-verified`).

# 6. Add an _extract_<platform>_* branch in scripts/chat_history.py
#    ONLY if the captured shape diverges from the existing top-level
#    fallback. Otherwise document that the fallback is sufficient.

# 7. Tests cover the captured envelope with synthetic non-sensitive content.
```

The redaction step is non-negotiable — the goal is to lock schemas, not to archive conversations.

## Horizon

Capture-only on all four discovery phases until the user decides which platform is worth a probe run. Each phase is small (1 capture + 1 schema lock + 1 extractor branch + tests), but they are gated on access to a working install of the platform and on the user agreeing to enable hook debug logging on that platform.

## Phase 1 — Augment + Claude (DONE 2026-05-05)

- [x] Patch `_extract_hook_text` to be platform-aware
- [x] Add `_extract_augment_conversation` helper for `conversation.userPrompt` / `conversation.agentTextResponse`
- [x] Add `_extract_claude_transcript_response` helper that walks the JSONL transcript
- [x] Dual-emit `user_prompt` + `stop` from a single Augment `Stop` event in `hook_dispatch`
- [x] 10 new tests in `tests/test_chat_history.py` — all 2342 package tests green
- [x] Update `agents/contexts/chat-history-platform-hooks.md` with `Verification` column + Augment/Claude payload schemas
- [x] Patch user's `~/.augment/settings.json` so the `Stop` hook ships `metadata.includeConversationData: true` (docs: only `Stop` supports the flag)

## Phase 2 — Cursor (docs-verified 2026-05-05)

- [x] Confirm Cursor version + hook config location (`.cursor/hooks.json` project-scope vs `~/.cursor/hooks.json` user-scope; Cursor also reads `.claude/settings.json`) — captured in [`chat-history-platform-hooks.md § Cursor`](../contexts/chat-history-platform-hooks.md#cursor)
- [x] Wire a one-shot debug hook — capture is now universal via `AGENT_HOOK_CAPTURE_DIR` (no per-platform script needed). Cursor enable: keep the existing dispatcher install + run with the env set.
- [x] Lock documented schema in [`chat-history-platform-hooks.md`](../contexts/chat-history-platform-hooks.md) — Cursor section + `### Cursor payload shape` block; Verification flipped to `docs-verified`
- [x] Add `_extract_cursor_text` branch to `_extract_hook_text` — `transcript_path` JSONL on `stop`/`afterAgentResponse`, top-level `prompt` on `beforeSubmitPrompt`
- [x] Tests covering the documented shape (`test_extract_cursor_text_uses_transcript_path`, `test_extract_cursor_text_ignores_non_response_event`, `test_hook_dispatch_cursor_after_agent_response`, `test_hook_dispatch_cursor_before_submit_prompt`)
- [ ] **Optional upgrade — payload-verified:** capture a real session, redact, paste payload into this roadmap, flip Verification to `payload-verified`. Gated on having a working Cursor install with hook debug logging.

> Cursor enable steps (one-time): ensure `~/.cursor/hooks.json` (or project-scope `.cursor/hooks.json`) routes `stop` + `afterAgentResponse` through `scripts/hooks/cursor-dispatcher.sh` (already shipped by `python3 scripts/install.py --cursor`). Then run `export AGENT_HOOK_CAPTURE_DIR="$HOME/.agent-config-captures/cursor"`, restart Cursor, run one session, and execute the redact step from § One-shot capture protocol.
>
> Council caveat (anthropic/claude-opus-4-1, 2026-05-05): Cursor hooks are actively evolving (beta since 1.7); the docs-verified branch may need adjustment after first live capture. The `transcript_path` shape reuses Claude's JSONL schema per current docs — flag if vendor diverges.

## Phase 3 — Cline (docs-verified 2026-05-05)

- [x] Confirm Cline build constraint (non-Windows; hooks unsupported on Windows per [`cline/cline#8073`](https://github.com/cline/cline/issues/8073)) — captured in [`chat-history-platform-hooks.md § Cline`](../contexts/chat-history-platform-hooks.md#cline)
- [x] Wire a debug hook for `TaskComplete` + `UserPromptSubmit` — covered by `AGENT_HOOK_CAPTURE_DIR` + the shipped `scripts/hooks/cline-dispatcher.sh`
- [x] Lock documented schema in [`chat-history-platform-hooks.md`](../contexts/chat-history-platform-hooks.md) — Cline section + `### Cline payload shape` block; Verification flipped to `docs-verified`
- [x] Add `_extract_cline_text` branch to `_extract_hook_text` — accepts top-level `prompt` and `userPrompt` on `UserPromptSubmit`; `TaskComplete` maps to `session_end` (no body text)
- [x] Tests (`test_extract_cline_text_user_prompt_camelcase`, `_snakecase`, `_returns_empty_on_other_events`, `test_hook_dispatch_cline_user_prompt`)
- [ ] **Optional upgrade — payload-verified:** capture a real Cline task, redact, paste payload, flip Verification to `payload-verified`.

> Cline enable steps: drop a hook entry in `.cline/hooks/` that calls `scripts/hooks/cline-dispatcher.sh` for `TaskComplete` and `UserPromptSubmit` (template via `python3 scripts/install.py --cline`). Set `AGENT_HOOK_CAPTURE_DIR`, restart Cline, run one task, redact.
>
> Council ruling (anthropic/claude-opus-4-1, 2026-05-05): "Most stable, open-source, well-documented hooks." Lowest schema-drift risk among the four.

## Phase 4 — Windsurf (docs-verified 2026-05-05)

- [x] Confirm Windsurf ≥ v1.12.41 (hooks shipped there) — captured in [`chat-history-platform-hooks.md § Windsurf`](../contexts/chat-history-platform-hooks.md#windsurf)
- [x] Wire a debug hook for `pre_user_prompt` + `post_cascade_response` — covered by `AGENT_HOOK_CAPTURE_DIR` + `scripts/hooks/windsurf-dispatcher.sh`
- [x] Lock documented schema in [`chat-history-platform-hooks.md`](../contexts/chat-history-platform-hooks.md) — Windsurf section + `### Windsurf payload shape` block; Verification flipped to `docs-verified`
- [x] Add `_extract_windsurf_text` branch to `_extract_hook_text` — `tool_info.response` on `post_cascade_response` (sync); `transcript_path` JSONL on `post_cascade_response_with_transcript` (async)
- [x] Tests (`test_extract_windsurf_text_tool_info_response`, `_transcript_variant`, `test_hook_dispatch_windsurf_post_cascade_response`, `_pre_user_prompt`)
- [ ] **Optional upgrade — payload-verified:** capture a real Cascade exchange, redact, paste payload, flip Verification to `payload-verified`.

> Windsurf enable steps: ensure `.windsurf/hooks.json` routes `pre_user_prompt` + `post_cascade_response` through the dispatcher (template via `python3 scripts/install.py --windsurf`). `post_cascade_response` is async — capture is observe-only, no critical-path risk. Set `AGENT_HOOK_CAPTURE_DIR`, run one Cascade exchange, redact.
>
> Council caveat (anthropic/claude-opus-4-1, 2026-05-05): "Cascade docs are too vague for reliable extraction without seeing actual payloads." The branch covers the two documented variants (sync `tool_info.response`, async `transcript_path`); a third undocumented shape would currently fall through to the top-level walker.

## Phase 5 — Gemini CLI (docs-verified 2026-05-05)

- [x] Confirm Gemini CLI version + hook config path (`SessionStart` is advisory and cannot block per [`#15746`](https://github.com/google-gemini/gemini-cli/pull/15746)) — captured in [`chat-history-platform-hooks.md § Gemini CLI`](../contexts/chat-history-platform-hooks.md#gemini-cli)
- [x] Wire a debug hook for `BeforeAgent` + `AfterAgent` — covered by `AGENT_HOOK_CAPTURE_DIR` + `scripts/hooks/gemini-dispatcher.sh`
- [x] Lock documented schema in [`chat-history-platform-hooks.md`](../contexts/chat-history-platform-hooks.md) — Gemini CLI section + `### Gemini CLI payload shape` block; Verification flipped to `docs-verified`
- [x] Add `_extract_gemini_text` branch to `_extract_hook_text` — top-level `prompt_response` on `AfterAgent`; falls back to `transcript_path` JSONL when absent
- [x] Tests (`test_extract_gemini_text_prompt_response_direct`, `_falls_back_to_transcript`, `test_hook_dispatch_gemini_after_agent`)
- [ ] **Optional upgrade — payload-verified:** capture a real Gemini CLI session, redact, paste payload, flip Verification to `payload-verified`.

> Gemini enable steps: configure Gemini CLI hooks for `BeforeAgent` + `AfterAgent` to route through the dispatcher (template via `python3 scripts/install.py --gemini`). `SessionStart` payloads are also captured but advisory (`continue` / `decision` are ignored upstream). Set `AGENT_HOOK_CAPTURE_DIR`, run one CLI session, redact.
>
> Council ruling (anthropic/claude-opus-4-1, 2026-05-05): "Google maintains strict API contracts and comprehensive documentation." Lowest schema-drift risk alongside Cline.

## Cowork — upstream-blocked, deferred (no phase number, runtime-only)

Cowork (Claude desktop app's `local-agent-mode` runtime) is registered as a first-class platform — runtime hook bindings + dispatcher are shipped — but install plumbing is intentionally absent until upstream Anthropic resolves the sandbox-settings bugs. No capture phase is possible while hooks do not fire.

Upstream blockers:

- [`anthropics/claude-code#40495`](https://github.com/anthropics/claude-code/issues/40495) — Cowork sessions ignore all three Claude Code settings sources (user / project / env). Sandbox platform mismatch breaks all settings resolution.
- [`anthropics/claude-code#27398`](https://github.com/anthropics/claude-code/issues/27398) — Cowork spawns the CLI with `--setting-sources user`, excluding plugin-scope `hooks/hooks.json`.

What is already shipped (runtime-ready):

- [x] `cowork` registered in [`scripts/hook_manifest.yaml`](../../scripts/hook_manifest.yaml) with bindings for `session_start`, `user_prompt_submit`, `post_tool_use`, `stop`, `session_end`
- [x] [`scripts/hooks/cowork-dispatcher.sh`](../../scripts/hooks/cowork-dispatcher.sh) shipped
- [x] `_extract_hook_text` falls back through generic envelope keys (sufficient until a real payload is captured)
- [x] [`scripts/hook_status.py`](../../scripts/hook_status.py) reports `status: "n/a"`, `bridge_path: null`, `hint: "upstream-blocked: anthropics/claude-code#40495 + #27398"` for cowork
- [x] [`scripts/install.py`](../../scripts/install.py) deliberately has zero `cowork` references — guessing a `.cowork/settings.json` path before upstream defines it would write disk noise the agent never reads

What unblocks each item below:

- [ ] **When `#40495` resolves** — read the canonical Cowork settings location from the resolution (do NOT guess); add `COWORK_DISPATCHER_BINDINGS` + `ensure_cowork_bridge()` + `ensure_cowork_user_hooks()` to `scripts/install.py`; wire a `--cowork-user-hooks` flag mirroring the `--claude-user-hooks` pattern; extend `PLATFORM_BRIDGES`; add install snapshot tests
- [ ] **Once hooks fire** — run the standard one-shot capture protocol from § Capture protocol; lock the payload schema in [`chat-history-platform-hooks.md`](../contexts/chat-history-platform-hooks.md) → flip Cowork's `Verification` to `payload-verified`
- [ ] **Once schema is locked** — add `_extract_cowork_*` branch only if the shape diverges from the existing fallback; otherwise document the fallback as sufficient + add tests covering the captured envelope

Tracking signal: when [`anthropics/claude-code#40495`](https://github.com/anthropics/claude-code/issues/40495) is closed, this phase moves from upstream-blocked to capture-ready and follows the same loop as Phases 2–5.

## Phase 6 — Cross-platform consolidation (evaluation 2026-05-05)

Now that Phases 1–5 are docs-verified — Augment, Claude, Cursor, Cline, Windsurf, Gemini — the per-platform branches in `_extract_hook_text` are stable enough to evaluate descriptor-table consolidation.

- [x] Evaluate whether the six branches collapse into a small descriptor table (platform → key path)
- [x] **Decision: keep per-branch shape (no refactor).** Three of six branches need non-flat behaviour that does not fit a `(platform, event) → key path` descriptor:
  - Augment dual-emits two body entries (`user_prompt` + `agent_response`) from a single `Stop` payload — control flow, not key lookup
  - Claude / Cowork / Cursor / Windsurf-async / Gemini-fallback parse a JSONL transcript via `_extract_claude_transcript_response` — file I/O, not in-payload extraction
  - Windsurf-sync reads a nested `tool_info.response`; Gemini-direct reads top-level `prompt_response`; Cline reads top-level `prompt`/`userPrompt` — three different key shapes for the same `agent_response` event
- [x] Lock the per-branch shape — documented above; revisit only if a future platform adds a flat-key extractor that overlaps with an existing one. The four `_extract_<platform>_text` helpers are the single source of truth; `_extract_hook_text` is a thin dispatcher.
- [ ] **Re-evaluate on payload-verified upgrade.** If/when a live capture forces a branch revision, re-run this evaluation — divergence between docs and reality might surface a flat-key shape that the descriptor table could absorb.

## Out-of-scope (explicit)

- Auto-writing privacy-sensitive opt-in flags (`includeConversationData`, equivalents on other platforms) into user `settings.json` from the installer — council ruled this is a per-machine privacy decision and stays manual.
- A unified design across all six platforms before evidence — premature per council; this roadmap exists to gather the evidence first.
- Changing the dispatch cadence (`per_session` / `per_turn` / `per_phase`) or the session-fingerprint scheme — both are stable from `road-to-stable-chat-history.md` and out of scope here.
- Auto-enabling capture in CI or installer flows. `AGENT_HOOK_CAPTURE_DIR` is opt-in-per-developer-machine; raw captures are gitignored and never committed.
