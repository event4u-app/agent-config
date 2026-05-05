---
complexity: lightweight
---

# Road to verified chat-history platforms

**Status:** READY FOR EXECUTION (Phase 1 done, discovery phases capture-only).
**Started:** 2026-05-05
**Trigger:** AI Council session `agents/council-sessions/20260505T050924Z-chat-history-unified.json` flagged that only Augment Code and Claude Code have a payload-shape that has been verified against vendor docs. Cursor, Cline, Windsurf, and Gemini CLI rely on top-level-key guesses inside `scripts/chat_history.py::_extract_hook_text` and have never been observed end-to-end.
**Mode:** Discovery-first per platform — capture a real payload, lock the schema, add a platform-aware extractor branch + tests. No code path is added before evidence exists.

## Why this is a separate roadmap

`road-to-stable-chat-history.md` (archived 2026-05) closed Phase 1 of the original effort: cadence, session isolation, sidecar cleanup, and the platform-hooks context document. The Augment + Claude payload-extraction patch (2026-05-05) is a Phase 1.5 follow-up that ships the matrix's first two `docs-verified` entries.

This roadmap tracks the remaining four platforms. They are independent (different vendors, different IDE surfaces, separate release cadences), so they get their own discovery phases instead of being bundled into the closed roadmap.

## Authoritative artifacts

- Platform matrix + payload schemas — [`agents/contexts/chat-history-platform-hooks.md`](../contexts/chat-history-platform-hooks.md)
- Dispatcher + extractor — [`scripts/chat_history.py`](../../scripts/chat_history.py) (`_extract_hook_text`, `_extract_augment_conversation`, `_extract_claude_transcript_response`, `hook_dispatch`)
- Council ruling — [`agents/council-sessions/20260505T050924Z-chat-history-unified.json`](../council-sessions/20260505T050924Z-chat-history-unified.json)

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

## Phase 2 — Cursor (capture-only)

- [ ] Confirm Cursor version + hook config location (`.cursor/hooks.json` vs `~/.cursor/hooks.json`); note that Cursor also reads `.claude/settings.json`
- [ ] Wire a one-shot debug hook that dumps `stop` and `afterAgentResponse` payloads to `~/.cursor/.chat-history-debug.jsonl`
- [ ] Capture one real session, redact, paste payload into this roadmap
- [ ] Lock schema in [`chat-history-platform-hooks.md`](../contexts/chat-history-platform-hooks.md) — flip `Verification` to `payload-verified`
- [ ] Add `_extract_cursor_*` branch to `_extract_hook_text` if shape diverges from Augment/Claude; otherwise document that top-level fallback is sufficient
- [ ] Tests covering the captured shape (positive + negative path)

## Phase 3 — Cline (capture-only)

- [ ] Confirm Cline build (non-Windows; hooks unsupported on Windows per `cline/cline#8073`)
- [ ] Debug hook on `TaskComplete` and `UserPromptSubmit`
- [ ] Capture, redact, lock schema, branch + tests as in Phase 2

## Phase 4 — Windsurf (capture-only)

- [ ] Confirm Windsurf ≥ v1.12.41 (hooks shipped there)
- [ ] Debug hook on `pre_user_prompt` and `post_cascade_response`
- [ ] Capture, redact, lock schema, branch + tests as in Phase 2

## Phase 5 — Gemini CLI (capture-only)

- [ ] Confirm Gemini CLI version + hook config path
- [ ] Debug hook on `BeforeAgent` / `AfterAgent` (note: `SessionStart` is advisory and cannot block)
- [ ] Capture, redact, lock schema, branch + tests as in Phase 2

## Phase 6 — Cross-platform consolidation (gated on Phases 2–5)

- [ ] Once at least 4 of 6 platforms are `payload-verified`, evaluate whether the per-platform branches in `_extract_hook_text` collapse into a small descriptor table (platform → key path)
- [ ] If yes: refactor to descriptor table + one generic walker; keep platform-specific helpers only for non-flat shapes (transcript JSONL, multi-event dispatch)
- [ ] If no: document why and lock the per-branch shape

## Out-of-scope (explicit)

- Auto-writing privacy-sensitive opt-in flags (`includeConversationData`, equivalents on other platforms) into user `settings.json` from the installer — council ruled this is a per-machine privacy decision and stays manual.
- A unified design across all six platforms before evidence — premature per council; this roadmap exists to gather the evidence first.
- Changing the dispatch cadence (`per_session` / `per_turn` / `per_phase`) or the session-fingerprint scheme — both are stable from `road-to-stable-chat-history.md` and out of scope here.

## Capture-and-redact protocol

For every discovery phase, the same protocol applies:

1. Enable debug logging at the platform level (per-platform mechanism documented in the matrix).
2. Run a single representative session (e.g. "what's the time" → response). Avoid sessions that touch real secrets.
3. Read the captured JSONL, **redact** any user content (replace `userPrompt` / `agentTextResponse` strings with `<REDACTED>`, keep envelope keys + types).
4. Paste the redacted payload into this roadmap under the relevant phase.
5. Only then add a code branch + tests. Tests use synthetic payloads that mirror the captured envelope but with non-sensitive content.

The redaction step is non-negotiable — the goal is to lock schemas, not to archive conversations.
