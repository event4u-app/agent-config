---
complexity: lightweight
---

# Road to chat-history cross-agent hardening

**Status:** READY FOR EXECUTION (Phase 1 unblocks ~30 of 127 pre-existing test failures; Phase 2 carries a Hard-Floor trigger that must be re-authorized at execution time).
**Started:** 2026-05-05
**Trigger:** Cowork session 2026-05-05 (working with Augment in parallel) surfaced cross-agent debt that affects every chat-history consumer — Cowork, Claude Code CLI/IDE, Augment, Cursor, Cline, Windsurf, Gemini CLI:

1. The schema-v4 refactor migrated the runtime path (`hook_dispatch`, `hook_append`, `init`, `append`) but left the CLI surface (`scripts/chat_history.py:1122-1411`) referencing removed v3 symbols. `./agent-config chat-history:state`, `chat-history:adopt`, and several `--first-user-msg` flags crash at invocation.
2. 127 tests in `tests/test_chat_history.py` test removed v3 concepts (`OwnershipError`, `write_sidecar`, `adopt`, `EXIT_OWNERSHIP_REFUSED`, `--first-user-msg`). They are dead test code, not hidden bugs — but they keep `pytest tests/` red on every developer machine.
3. Smoke-testing the dispatcher inside Cowork (or any agent that runs in the same project) accidentally rotates the live `agents/.agent-chat-history` header — auto-adopt is too aggressive when the smoke caller has a synthetic prompt. Recovery requires manual JSON surgery.
4. The `agent` field added to body entries (entries 23/24 in `agents/.agent-chat-history`, 2026-05-05) gives multi-agent attribution but has no read-side surface. `chat-history:read`, `chat-history:sessions`, and `chat-history:status` do not expose or filter on it.
5. The payload-verified upgrade for Cursor / Cline / Windsurf / Gemini requires a 7-step manual flow (per [`PAYLOAD-CAPTURE-GUIDE.md`](../PAYLOAD-CAPTURE-GUIDE.md)). Each step is small but the overall friction blocks opportunistic captures.

**Mode:** v3-debt-first — Phase 1 fixes production-code dead refs in a single small file (~50-line patch). Phase 2 clears the test debt but is gated on user authorization for the bulk-deletion. Phases 3-5 are cross-agent ergonomics, independently deliverable in any order after Phase 1.

## Why this is a separate roadmap

`road-to-verified-chat-history-platforms.md` (archived 2026-05-05) closed the
docs-verified extractor work for all six supported platforms. The v3→v4
schema migration that landed on HEAD between commits `c00a3e2` and `5fa2e14`
is itself complete on the runtime path — but it left CLI and test debt that
no platform-specific roadmap can absorb because the debt is cross-cutting.

This roadmap also tracks the cross-agent ergonomics (smoke-test isolation,
attribution surface, capture automation) that became visible only when two
agents ran against the same project in parallel. That observation has no
home in a single-platform roadmap.

## Authoritative artifacts

- Runtime path (already v4-clean): [`scripts/chat_history.py`](../../scripts/chat_history.py) — `hook_dispatch`, `hook_append`, `init`, `append`, `derive_session_tag`
- CLI surface (v3-resident): [`scripts/chat_history.py:1122-1411`](../../scripts/chat_history.py) — `_cmd_init`, `_cmd_append`, `_cmd_state`, `_cmd_adopt`, `_cmd_reset`, `_cmd_hook_append`, plus the argparse subparsers
- Test surface: [`tests/test_chat_history.py`](../../tests/test_chat_history.py) — 127 failures, categorized in [`HANDOFF-cowork-chat-history-platform.md`](../HANDOFF-cowork-chat-history-platform.md) § "v4 test-migration debt"
- Capture guide: [`PAYLOAD-CAPTURE-GUIDE.md`](../PAYLOAD-CAPTURE-GUIDE.md) — current 7-step manual flow that Phase 5 automates
- Platform matrix: [`chat-history-platform-hooks.md`](../contexts/chat-history-platform-hooks.md)

## Out of scope (explicit)

- **Cowork upstream bugs** ([`#40495`](https://github.com/anthropics/claude-code/issues/40495), [`#27398`](https://github.com/anthropics/claude-code/issues/27398)) — deferred-watch, not actionable in this repo. When upstream resolves, the install plumbing items in the archived `road-to-verified-chat-history-platforms.md` execute.
- **Adding new platforms** — the platform list is closed at 7 (Augment / Claude / Cowork / Cursor / Cline / Windsurf / Gemini); a new entry would get its own discovery roadmap.
- **Schema v5** — no concrete trigger yet; v4's per-entry `s` tag works.

## Phase 1 — CLI v3 cleanup (production-code dead refs)

Single-file patch on `scripts/chat_history.py:1122-1411`. Resolves ~30 of
the 127 pre-existing test failures (the ones rooted in CLI dead refs)
and prevents `./agent-config chat-history:<subcommand>` crashes.

- [ ] Read `scripts/chat_history.py:1122-1411` end-to-end and inventory every reference to `OwnershipError`, `write_sidecar`, `read_sidecar`, `ownership_state`, `adopt`, `EXIT_OWNERSHIP_REFUSED`, `--first-user-msg` (record line numbers in this checkbox text on edit)
- [ ] Drop the `state` subparser and `_cmd_state` (Z.1203-05) — `ownership_state` no longer exists in v4
- [ ] Drop the `adopt` subparser and `_cmd_adopt` (Z.1208-11) — `adopt` no longer exists in v4
- [ ] Update `_cmd_init` to v4 signature: `init(freq=args.freq)`, drop `--first-user-msg` from the parser
- [ ] Update `_cmd_append` to v4 signature: `append(entry)`, drop `--first-user-msg`, drop `OwnershipError` except block, drop `EXIT_OWNERSHIP_REFUSED` exit
- [ ] Update `_cmd_hook_append` to v4 signature: `hook_append(event, session_id=…, payload=…, settings_path=…)`, drop `--first-user-msg`, drop `EXIT_OWNERSHIP_REFUSED` reference at Z.1154
- [ ] Update `_cmd_hook_dispatch` to drop the `EXIT_OWNERSHIP_REFUSED` reference at Z.1173 (the action will never appear in v4)
- [ ] Update `_cmd_reset` to v4 signature: `reset_with_entries(entries, freq=…)`, drop `--first-user-msg` from the parser
- [ ] Remove the `EXIT_OWNERSHIP_REFUSED` constant declaration (search the file)
- [ ] Re-run `./agent-config chat-history:status` and `chat-history:sessions` end-to-end — must exit 0 with no AttributeError
- [ ] Re-run `python3 -m pytest tests/test_chat_history.py --tb=no -q` and record the new failure count for the Phase 2 baseline (expected: ~95-100 remaining, all in the test file itself)

## Phase 2 — Test debt clearance (v3 → v4)

**Hard-Floor caveat:** mass-deleting / rewriting 127 tests is a bulk
operation that requires explicit user authorization at execution time
per the `non-destructive-by-default` rule. Before starting Phase 2,
the executing agent MUST surface the test-deletion plan as a numbered
options block per `user-interaction` and wait for an affirmative reply
in the chat. This roadmap step is the *plan*, not the *authorization*.

- [ ] Categorize the remaining failures from Phase 1's baseline output by root cause (sidecar / ownership / adopt / first_user_msg / session_start_noop semantic / misc) — write the count breakdown into a comment block at the top of `tests/test_chat_history.py`
- [ ] Surface the deletion plan to the user as numbered options (delete / rewrite / leave) per `user-interaction`; wait for explicit authorization before executing the next step
- [ ] Delete tests for v3-only concepts that have no v4 analogue: any test referencing `OwnershipError`, `write_sidecar`, `read_sidecar`, `sidecar_path`, `adopt`, `ownership_state`, `EXIT_OWNERSHIP_REFUSED`
- [ ] Rewrite tests whose v3 assertion changed semantically in v4 (e.g. `'session_start_noop' == 'initialized'` → assert the new noop action) — rough scope: ~10 tests across `_cmd_*`, `init`, `hook_append` paths
- [ ] Drop the `--first-user-msg` flag from any remaining test invocations of `chat_history.py` CLI
- [ ] Re-run `python3 -m pytest tests/ -q` — target: 0 failures (delta to current 127)
- [ ] Update [`HANDOFF-cowork-chat-history-platform.md`](../HANDOFF-cowork-chat-history-platform.md) § "v4 test-migration debt" to note the migration is complete, or delete the file entirely if the handoff is no longer useful

## Phase 3 — Smoke-test isolation

Standardize the safe pattern so any agent (Cowork, Augment, Claude
Code) can smoke-test the dispatcher without rotating the live session.

- [ ] Document in `agents/contexts/chat-history-platform-hooks.md` that smoke tests MUST use `AGENT_CHAT_HISTORY_FILE=/tmp/<unique>.jsonl` and never the project default
- [ ] Add a `--dry-run` flag to `scripts/hooks/dispatch_hook.py` (extends the existing flag from concern-resolution to also short-circuit before any concern is invoked) — must print the resolved chain and exit 0 without any side effect
- [ ] Add a `--dry-run` mirror in `./agent-config dispatch:hook` and `./agent-config chat-history:hook`
- [ ] Add a session-start guardrail: when `hook_append` would write a v4 header to an existing non-empty file, log a one-line warning to stderr if the *most recent* body entry's `s` tag differs from the new session's `s` tag — agents see the rotation intent before it lands
- [ ] Add a test under `tests/hooks/` that asserts the dry-run path leaves the chat-history file untouched
- [ ] Update [`PAYLOAD-CAPTURE-GUIDE.md`](../PAYLOAD-CAPTURE-GUIDE.md) § "Pre-flight" to mention `--dry-run` as the recommended first invocation

## Phase 4 — Multi-agent attribution surface

The `agent` field on body entries already exists as of 2026-05-05 but
has no read-side tools. Surface it so multi-agent projects can see who
wrote what.

- [ ] Add `--agent <name>` filter to `chat-history:read` (mirrors the existing `--session` filter); accepts platform identifiers (`augment`, `claude`, `cowork`, …) and the literal `<unknown>` for legacy entries
- [ ] Extend `chat-history:sessions` table to include an `AGENTS` column listing the distinct `agent` values seen in each session's body entries (comma-separated)
- [ ] Extend `chat-history:status` JSON output with an `agents` field — array of distinct values across the whole file, plus per-agent count
- [ ] Add tests under `tests/test_chat_history.py` covering the new filter and table column (use the v4 fixture pattern from Phase 2)
- [ ] Update [`PAYLOAD-CAPTURE-GUIDE.md`](../PAYLOAD-CAPTURE-GUIDE.md) and [`chat-history-platform-hooks.md`](../contexts/chat-history-platform-hooks.md) to document the new read-side surface
- [ ] Backfill: agents written before the `agent` field landed (pre-2026-05-05) carry no value — document that the filter treats absence as `<unknown>`

## Phase 5 — Capture workflow automation

Replace the 7-step manual flow in `PAYLOAD-CAPTURE-GUIDE.md` with one
CLI invocation that orchestrates: env setup, install verify, restart
hint, redact step, paste-target lookup, verify gate.

- [ ] Add a new CLI subcommand `./agent-config chat-history:capture --platform <name>`; the wrapper at `scripts/agent-config` routes to a new `scripts/capture_payload.py`
- [ ] `capture_payload.py --platform <name> setup` — checks the bridge is installed, exports `AGENT_HOOK_CAPTURE_DIR=$HOME/.agent-config-captures/<platform>`, prints the platform-specific restart instructions
- [ ] `capture_payload.py --platform <name> finalize` — runs `redact_hook_capture.py` on the dir, picks the smallest representative file per event, prints the file path + the archived-roadmap phase to paste into
- [ ] Add a `--paste` flag to `finalize` that writes the redacted payload directly into the matching phase of `agents/roadmaps/archive/road-to-verified-chat-history-platforms.md` under a `### <Platform> payload shape (captured YYYY-MM-DD)` heading and flips the corresponding `[ ]` checkbox to `[x]`
- [ ] Add tests under `tests/` for the setup / finalize / paste paths (synthetic capture dir with stub JSON files; verify the paste-target lookup matches the platform name)
- [ ] Replace the manual Common-loop section of `PAYLOAD-CAPTURE-GUIDE.md` with a one-line invocation; keep the per-platform restart instructions (those still need a human)
- [ ] Optional: add a `chat-history:capture --status` view that reports the verification level per platform (docs-verified vs payload-verified) so the next agent sees at a glance what's left

## Cross-cutting verification (run after each phase)

```bash
python3 -m pytest tests/ -q                       # delta to baseline 127
python3 -m pytest tests/hooks/ -q                 # must stay 59 passed
python3 scripts/lint_hook_manifest.py             # exit 0
python3 scripts/check_compression.py              # exit 0
python3 scripts/check_references.py               # exit 0
python3 scripts/check_portability.py              # exit 0
python3 scripts/skill_linter.py --all             # 0 fail
python3 scripts/readme_linter.py                  # exit 0
./agent-config hooks:status                       # all expected platforms shown
./agent-config roadmap:progress                   # regenerate dashboard if any roadmap touched
```

## Constraints for the executing agent

1. **Phase ordering matters.** Phase 1 unblocks the test signal needed to verify Phase 2; Phase 2's deletion plan needs the Phase 1 baseline count. Phases 3-5 are independently orderable after Phase 1.
2. **Hard-Floor on Phase 2.** The 127-test deletion is bulk-destructive. Surface the plan as numbered options *before* deletion; do not infer authorization from "let's do phase 2" — that's plan-level, not execution-level.
3. **Do not edit the runtime path.** `hook_dispatch` and `hook_append` are already v4-clean. Phase 1's scope is *only* the CLI surface (Z.1122-1411 in `scripts/chat_history.py`); no edits to the module-level code above it.
4. **Do not commit unsolicited.** Per `commit-policy`, this roadmap plans work, not commits. The user owns commit invocation.
5. **No new platforms.** Adding a new platform mid-execution gets its own discovery roadmap — do not absorb it into Phase 4 or 5.
6. **Update this roadmap, not stable artifacts.** Per `no-roadmap-references`, do not link from rules, skills, or context docs to this roadmap. The roadmap links out, not in.
