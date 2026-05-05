# Handoff — Cowork chat-history platform wiring

**Date:** 2026-05-05
**Status:** Runtime green, test-migration debt open, install plumbing deferred upstream.
**Audience:** Next agent picking up from this session (IDE-side).

## Goal

Register `cowork` (the Claude desktop app's local-agent-mode runtime) as a
first-class chat-history platform so body entries can be attributed to
Cowork sessions via the `agent` field, distinguishing them from CLI/IDE
Claude Code sessions even when both run against the same project.

Upstream context — Cowork lifecycle hooks currently do not fire from inside
the `local-agent-mode` sandbox. Two open bugs:

- [anthropics/claude-code#40495](https://github.com/anthropics/claude-code/issues/40495) — Cowork sessions ignore all three Claude Code settings sources (user, project, env). "Sandbox platform mismatch breaks all settings resolution."
- [anthropics/claude-code#27398](https://github.com/anthropics/claude-code/issues/27398) — Cowork spawns the CLI with `--setting-sources user`, excluding plugin-scope `hooks/hooks.json`.

Plan in this session: ship the dispatcher-ready mapping + trampoline + tests
+ docs now, defer install plumbing until upstream resolves.

## What was completed

All edits live on the working tree (uncommitted).

### Core platform registration

- **`scripts/chat_history.py`** — added `cowork:` block to `PLATFORM_EVENT_MAP` (mirrors `claude:`); extended Stop-transcript extractor to `platform in ("claude", "cowork")` so `_extract_claude_transcript_response` runs for both.
- **`scripts/hook_manifest.yaml`** — added `platforms.cowork` block (mirrors `claude:`) and `native_event_aliases.cowork` (verbatim PascalCase event names).
- **`scripts/hooks/cowork-dispatcher.sh`** — new trampoline. Extracts `cwd` (Claude Code default) with fallback to `workspace_roots[0]` (Augment-style); routes to `./agent-config dispatch:hook --platform cowork --event $1 --native-event $2`. Permissions 700, mirrors the cursor/cline/gemini trampolines.
- **`scripts/lint_hook_manifest.py`** — added `cowork` to `KNOWN_PLATFORMS` so the orphan-trampoline-on-disk check passes.

### Status reporter

- **`scripts/hooks_status.py`** — added `cowork` to `PLATFORM_BRIDGES` with empty `bridge_path` (resolves to `status: "n/a"`) and an `upstream-blocked` hint. Extended the hint-rendering condition from `{missing, empty, degraded}` to also include `n/a` so the upstream block is visible in `./agent-config hooks:status`.

### Tests

- **`tests/test_chat_history.py`** — added `test_cowork_platform_registered_with_claude_event_vocabulary` and `test_hook_dispatch_cowork_stop_reads_transcript_for_agent_text` (mirrors the claude variant).
- **`tests/hooks/test_event_shape_contract.py`** — added cowork sample payloads (3 events: `SessionStart`, `UserPromptSubmit`, `PostToolUse`) to the frozen `SAMPLES` dict.
- **`tests/hooks/test_manifest_linter.py`** — added `cowork:` to `VALID_BODY` and `_BODY_WITH_DEAD_CONCERN` fixtures (otherwise the orphan-trampoline check would fail every clean-manifest test); added `test_cowork_null_with_trampoline_on_disk_fails`.
- **`tests/hooks/test_hooks_status.py`** — extended `test_missing_bridges_reported_when_project_empty` with cowork assertions (status="n/a", bridge_path=None, bindings non-empty, hint contains "upstream-blocked").

### Documentation

- **`agents/contexts/chat-history-platform-hooks.md`** — added decision-matrix row for Cowork and a full `## Cowork (Claude desktop app — local-agent-mode)` section: hook surface, lifecycle events, workspace shape, both upstream blockers cited explicitly, distinguishing-Cowork-from-CLI-Claude-Code section, sources.
- **`docs/contracts/hook-architecture-v1.md`** — extended the canonical platform list (vocabulary table, line ~23) to include `cowork` with a note on why it's a separate platform identifier.
- **`README.md`** — extended the hook-coverage paragraph to list Cowork; added inline link to the platform context section. File ends at exactly 500 lines (readme_linter threshold).

## What is verified green (this session)

- `python3 -m pytest tests/hooks/` → 59 passed, 4 subtests passed.
- `python3 -m pytest tests/ -k cowork` → 3 passed.
- `python3 -m pytest tests/test_chat_history.py::test_hook_dispatch_claude_stop_reads_transcript_for_agent_text tests/test_chat_history.py::test_hook_dispatch_cowork_stop_reads_transcript_for_agent_text` → 2 passed (load-bearing path).
- `python3 scripts/lint_hook_manifest.py` → exit 0.
- `python3 scripts/check_compression.py` / `check_references.py` / `check_portability.py` → all exit 0.
- `python3 scripts/skill_linter.py --all` → 145 pass / 139 warn / 0 fail.
- `python3 scripts/readme_linter.py` → exit 0, no issues.
- End-to-end smoke `dispatch_hook.py --platform cowork --event post_tool_use --dry-run` → resolved 5 concerns correctly.
- `hooks_status.py --format json` for `cowork` → `status: "n/a"`, `bridge_path: null`, `hint: "upstream-blocked: anthropics/claude-code#40495 + #27398 (settings.json ignored in Cowork sandbox)"`, all 5 events bound to their concern chains.

## What is open

### A. v4 test-migration debt (127 failures in `tests/test_chat_history.py`)

`scripts/chat_history.py` was migrated from schema v3 (sidecar + ownership +
auto-adopt) to schema v4 (per-entry `s` tag, no sidecar, no ownership) in
this session by an external tool. The runtime path is fully migrated; the
test file is not. All 127 failures test removed v3 concepts.

Failure breakdown (categorize before touching anything):

| Count | Symptom | v3 concept being tested |
|---|---|---|
| 60 | `freq must be one of [...]` | Tests call `init(first_user_msg, freq=…)` — old positional signature |
| 19 | `EXIT_OWNERSHIP_REFUSED is not defined` | Removed CLI exit code |
| 16 | `hook_append() unexpected kwarg first_user_msg` | Removed kwarg |
| 5 | `module 'chat_history' has no attribute 'write_sidecar'` | Sidecar removed |
| 5 | `init() got multiple values for argument 'freq'` | Old positional vs kw collision |
| 4 | `assert 'session_start_noop' == 'initialized'` | v4 makes session_start a noop |
| 3 | `module 'chat_history' has no attribute 'sidecar_path'` | Sidecar removed |
| 2 | `module 'chat_history' has no attribute 'adopt'` | Adopt flow removed |
| 2 | `module 'chat_history' has no attribute 'OwnershipError'` | Exception class removed |
| ~11 | Misc | All v3 leftovers |

These are not hidden bugs — they are dead test code. Per the v4 docstring at
`scripts/chat_history.py:9-13` ("No ownership layer, no sidecar, no
auto-adopt"), the right action is to delete tests for removed concepts and
rewrite tests for changed semantics (e.g., `session_start` returning
`session_start_noop` instead of `initialized`).

**Hard-Floor caveat (`non-destructive-by-default` rule):** mass-deleting 127
tests is a bulk-deletion trigger that requires explicit user authorization.
The user has authorized the broader fix in this conversation but has not
explicitly approved test deletion — surface the test-deletion plan in a
numbered-options block before executing.

### B. CLI v3 surface still resident (`scripts/chat_history.py:1122-1417`)

Production-code dead refs that fail at runtime if their CLI subcommand is
invoked:

- `_cmd_init` (Z.1122-25) — `init(args.first_user_msg, freq=args.freq)` → wrong signature in v4.
- `_cmd_hook_append` (Z.1128-55) — `hook_append(... first_user_msg=...)` and `EXIT_OWNERSHIP_REFUSED` reference.
- `_cmd_append` (Z.1177-95) — `append(entry, first_user_msg=...)`, `OwnershipError`, `EXIT_OWNERSHIP_REFUSED`.
- `_cmd_state` (Z.1203-05) — calls `ownership_state(...)`, removed function.
- `_cmd_adopt` (Z.1208-11) — calls `adopt(...)`, removed function.
- `_cmd_reset` (Z.1228-32) — `reset_with_entries(args.first_user_msg, ...)` — but new signature is `reset_with_entries(entries, freq=…, *, path=…)`.
- Argparse subparsers (Z.1296-1411) — `--first-user-msg` flags on `init`, `append`, `state`, `adopt`, `reset`, `hook-append`; `state` and `adopt` subcommands themselves; `EXIT_OWNERSHIP_REFUSED` constant referenced in help text.

Plan: drop the `state` and `adopt` subcommands entirely (their concept is
gone); strip `--first-user-msg` from `init/append/hook-append/reset`; remove
`EXIT_OWNERSHIP_REFUSED` constant; align argument forwarding to v4 function
signatures. Net effect: ~30 of the 127 test failures resolve once the CLI
matches v4 semantics.

### C. Cowork install plumbing (deferred upstream)

`scripts/install.py` has `ensure_<platform>_bridge` / `ensure_<platform>_user_hooks` for every supported platform — none for Cowork. Intentional: until Anthropic resolves [#40495](https://github.com/anthropics/claude-code/issues/40495), the canonical Cowork settings location is undefined. Writing to a guessed path produces disk noise the agent will never read.

When upstream lands the fix:
1. Read the official Cowork settings location from the resolution.
2. Add `COWORK_DISPATCHER_BINDINGS` (mirror `CLAUDE_DISPATCHER_BINDINGS` at `scripts/install.py:585-591`).
3. Implement `ensure_cowork_bridge()` (project scope) + optionally `ensure_cowork_user_hooks()` (user scope, mirror cursor pattern at `scripts/install.py:695-...`).
4. Wire `--cowork-user-hooks` argparse flag (mirror Z.1241/1318).
5. Update `PLATFORM_BRIDGES` in `scripts/hooks_status.py` from empty path to the real bridge path; remove the `upstream-blocked` hint.
6. Add `test_cowork_user_hooks_*` snapshot tests (mirror existing platform patterns under `tests/hooks/test_install_snapshot.py`).

## Constraints for the next agent

1. **Do not touch `scripts/chat_history.py` while a v4 migration is in
   flight by another tool.** This file changed twice during this session
   under "intentional" system reminders. Coordinate before editing — either
   confirm the in-flight refactor is finished, or work on a separate file.
2. **Do not commit.** `commit-policy` applies. The user invokes a commit
   command or says so explicitly.
3. **Do not delete the 127 v3 tests without explicit authorization.** That
   is a Hard-Floor trigger per `non-destructive-by-default`. Surface the
   plan in a numbered-options block first.
4. **Do not write a `.cowork/settings.json` or similar guessed path** in
   `install.py`. The location is upstream-undefined; guessing creates
   maintenance debt.
5. **Augment session is live in this repo.** Sidecar `.agent-chat-history.session` at `/Users/.../agent-config/.agent-chat-history.session` is owned by Augment fp `96a78d73…` (Cowork was previously rotated in by a smoke test and then rolled back). Do not run `chat_history.py hook-dispatch` smokes against the live file unless you intend to disrupt the session — use a tmp file via `AGENT_CHAT_HISTORY_FILE`.

## Three execution paths

1. **CLI cleanup only** — fix the v4 surface in `scripts/chat_history.py:1122-1411`, leave the test file alone. Effect: ~30 test failures resolve, 97 v3-concept tests remain failing. Smallest blast radius; safe even if the v4 refactor by the external tool is still partial.
2. **Full v4 alignment** — CLI cleanup + delete v3-concept tests + rewrite v4-semantic tests where the underlying behavior is still meaningful. Effect: ~127 test failures resolved, file is consistent with the v4 docstring. Largest blast radius (~1000-line diff); collision risk if the external tool is mid-edit.
3. **Stop here, ship handoff** — runtime is verified working for Cowork; package CI has 127 pre-existing v3-test failures that are noise. Wait for the v4 refactor's owner to finish the test migration on their own cadence.

**Recommendation: 1 — CLI cleanup only.** The CLI surface has dead refs that
fail at runtime when the subcommand is invoked (`./agent-config chat-history:state`,
`./agent-config chat-history:adopt`, etc.) — that is real production-code
debt, not test debt. Cleaning the CLI is contained, single-file, and does
not require deleting any test code. Caveat: if you discover the v4
refactor's owner is mid-edit on the CLI itself when you start, downgrade
to option 3 to avoid collision.

## Verification checklist (run before claiming option N done)

```bash
python3 -m pytest tests/                     # delta to baseline 127 failures
python3 -m pytest tests/hooks/               # must stay 59 passed
python3 -m pytest tests/ -k cowork           # must stay 3 passed
python3 scripts/lint_hook_manifest.py        # exit 0
python3 scripts/check_compression.py         # exit 0
python3 scripts/check_references.py          # exit 0
python3 scripts/check_portability.py         # exit 0
python3 scripts/skill_linter.py --all        # 0 fail
python3 scripts/readme_linter.py             # exit 0
echo '{"hook_event_name":"PostToolUse","cwd":"/tmp","session_id":"x","tool_name":"Read"}' \
  | python3 scripts/hooks/dispatch_hook.py --platform cowork --event post_tool_use --native-event PostToolUse --dry-run
# expect: resolved [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff]
```

## Sources

- [anthropics/claude-code#40495 — Cowork ignores user hooks and managed settings](https://github.com/anthropics/claude-code/issues/40495)
- [anthropics/claude-code#27398 — Cowork plugin hooks never fire](https://github.com/anthropics/claude-code/issues/27398)
- [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks)
- Local: [`agents/contexts/chat-history-platform-hooks.md`](contexts/chat-history-platform-hooks.md) — full platform matrix (this session updated the Cowork section)
- Local: [`docs/contracts/hook-architecture-v1.md`](../docs/contracts/hook-architecture-v1.md) — canonical platform vocabulary (this session updated)
- Local: [`scripts/hook_manifest.yaml`](../scripts/hook_manifest.yaml) — runtime resolver (this session added `cowork:` blocks)
