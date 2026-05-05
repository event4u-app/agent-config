# Hook payload capture guide

**Purpose:** walk through the live-session payload capture for one platform
in roughly 5 minutes, so the corresponding entry in
[`agents/contexts/chat-history-platform-hooks.md`](../agents/contexts/chat-history-platform-hooks.md)
can move from `docs-verified` to `payload-verified`.

**Scope:** Cursor · Cline · Windsurf · Gemini CLI. Augment Code and Claude
Code already shipped as `docs-verified` in Phase 1 of the now-archived
[`road-to-verified-chat-history-platforms.md`](../agents/roadmaps/archive/road-to-verified-chat-history-platforms.md).
Cowork is upstream-blocked separately
([`#40495`](https://github.com/anthropics/claude-code/issues/40495)) and
not in scope here.

**Why this is opportunistic:** the payload-verified upgrade is a nice-to-have.
The shipping `docs-verified` extractors already match the vendor docs —
captures are insurance against silent vendor-side schema drift. Pick one
platform when convenient; do not run all four in one sitting unless you
already have all four IDEs installed and licensed.

## Pre-flight (one-time, ~30 seconds)

```bash
cd /path/to/agent-config

# Confirm the dispatcher is wired in this project (idempotent — safe to rerun).
# Replace <platform> with cursor / cline / windsurf / gemini as appropriate
# when you reach that platform's section.
python3 scripts/install.py --<platform>

# Confirm the trampoline + project-scope hooks file landed.
./agent-config hooks:status | grep -E "^[ ✓✅⚠️❌·] (cursor|cline|windsurf|gemini)"
```

`hooks:status` should report `installed` for the platform you just wired
(or `missing` if the project-scope file did not land — in that case rerun
the install with `--force`).

## Common capture loop (steps reused on every platform)

```bash
# 1. Pick a per-platform capture dir (gitignored; never committed).
export AGENT_HOOK_CAPTURE_DIR="$HOME/.agent-config-captures/<platform>"
mkdir -p "$AGENT_HOOK_CAPTURE_DIR"

# 2. Restart / reload the platform so it picks up the env var.
#    Per-platform commands below.

# 3. Run ONE short, boring session in the platform.
#    Recommended prompt: "echo hello" or "what time is it".
#    Goal is to capture the envelope shape, not interesting content.

# 4. Confirm capture files exist.
ls -1 "$AGENT_HOOK_CAPTURE_DIR" | head

# 5. Redact (replaces user-content fields with <REDACTED>;
#    envelope keys preserved).
python3 scripts/redact_hook_capture.py "$AGENT_HOOK_CAPTURE_DIR" --strict

# 6. Pick the smallest representative file.
ls -1Sr "$AGENT_HOOK_CAPTURE_DIR"/*.redacted.json | head -1

# 7. cat it; copy the JSON; paste into the archived roadmap section
#    (see § Where to paste below).
```

The redaction step is non-negotiable. The goal is to lock schemas, not to
archive conversations.

## Per-platform notes

### Cursor (~5 min)

- **Install:** `python3 scripts/install.py --cursor` (project) or
  `--cursor-user-hooks` (covers every project you open).
- **Restart:** quit Cursor (Cmd+Q on macOS), then relaunch from the
  shell where you exported `AGENT_HOOK_CAPTURE_DIR` so the env var
  propagates to the renderer process. Reopening a window from the
  Dock will not inherit the env.
- **Trigger event:** type a prompt in Cursor's agent panel and let it
  finish. Expected captures: one `sessionStart`, one
  `beforeSubmitPrompt`, one `afterAgentResponse` and/or `stop`,
  zero or more `postToolUse`.
- **File pattern:** `cursor__afterAgentResponse__<ts>__<pid>.json` is
  the most useful one to paste.
- **CLI vs IDE:** Cursor CLI fires only
  `beforeShellExecution`/`afterShellExecution` — for the
  per-turn payload you need the IDE.

### Cline (~5 min)

- **Install:** `python3 scripts/install.py --cline` (project) or
  `--cline-user-hooks` (user-scope, covers every workspace).
- **Restart:** in VS Code or JetBrains, run "Developer: Reload
  Window" (Cmd+Shift+P) from a terminal where the env is exported.
  Cline reads hooks at task start, so a fresh task is required —
  closing and reopening the side panel is not enough.
- **Trigger event:** start a new Cline task and let one turn complete.
  Cline calls them "tasks" not "sessions"; the equivalent boundaries
  are `TaskStart` → `UserPromptSubmit` → `PostToolUse`* →
  `TaskComplete`.
- **File pattern:** `cline__TaskComplete__<ts>__<pid>.json` if you let
  the task finish; `cline__UserPromptSubmit__<ts>__<pid>.json` is also
  acceptable (carries the `prompt` envelope).
- **Windows caveat:** hooks are unsupported on Windows
  ([`cline/cline#8073`](https://github.com/cline/cline/issues/8073));
  capture from macOS or Linux.

### Windsurf (~5 min)

- **Install:** `python3 scripts/install.py --windsurf` (project) or
  `--windsurf-user-hooks` (user-scope at `~/.codeium/windsurf/hooks.json`).
- **Restart:** quit Cascade fully, then relaunch from the shell with
  the env exported. The `pre_user_prompt` event fires on every turn —
  no full restart needed once Cascade is up, but the *first* turn after
  launch must be the captured one.
- **Trigger event:** ask Cascade one short question and let it answer.
  Expected captures: `pre_user_prompt`,
  `post_cascade_response_with_transcript`. The
  `_with_transcript` variant is the more useful one to paste because it
  carries the full response inline.
- **File pattern:** `windsurf__post_cascade_response_with_transcript__<ts>__<pid>.json`.
- **Async caveat:** `post_cascade_response` fires asynchronously off
  the critical path. The capture file might land a second or two after
  the response renders — wait briefly before running the redact step.

### Gemini CLI (~5 min)

- **Install:** `python3 scripts/install.py --gemini` (project) or
  `--gemini-user-hooks` (user-scope at `~/.gemini/settings.json`).
- **Restart:** Gemini CLI is invoked per command — no daemon to
  restart. Just open a new shell with `AGENT_HOOK_CAPTURE_DIR`
  exported and run the next session there.
- **Trigger event:** any short Gemini CLI session
  (`gemini "what time is it"` or similar). Hooks fire on
  `SessionStart` → `BeforeAgent` → `AfterTool`* → `AfterAgent` →
  `SessionEnd`.
- **File pattern:** `gemini__AfterAgent__<ts>__<pid>.json` carries the
  per-turn close envelope and is the recommended paste target.
- **Advisory hooks:** `SessionStart` and `SessionEnd` are advisory only
  in Gemini CLI — do not be alarmed if those captures look thinner than
  the others.

## Where to paste the redacted payload

The roadmap is now archived. Paste under the matching phase:

[`agents/roadmaps/archive/road-to-verified-chat-history-platforms.md`](../agents/roadmaps/archive/road-to-verified-chat-history-platforms.md)

- Cursor → § Phase 2 — Cursor
- Cline → § Phase 3 — Cline
- Windsurf → § Phase 4 — Windsurf
- Gemini CLI → § Phase 5 — Gemini CLI

In the chosen phase, paste the redacted JSON inside a fenced
`json` block under a heading like `### <Platform> payload shape (captured 2026-MM-DD)`,
then flip the `[ ] Optional upgrade — payload-verified` checkbox to
`[x]`.

Then update the matching row in
[`agents/contexts/chat-history-platform-hooks.md`](../agents/contexts/chat-history-platform-hooks.md):
the `Verification` column moves from `docs-verified` to
`payload-verified`.

If the captured shape diverges from the docs-verified extractor
branch, that is the trigger for a code patch — open a tiny new roadmap
under `agents/roadmaps/` for the divergence work, do **not** edit the
archived roadmap to track new code work
(see [`no-roadmap-references`](../.agent-src/rules/no-roadmap-references.md)).

## Final verify

After pasting and flipping the checkbox:

```bash
# Lint gates must stay green.
python3 scripts/lint_hook_manifest.py
python3 scripts/check_references.py
python3 scripts/check_portability.py

# Tests still green.
python3 -m pytest tests/hooks/ -q

# Optional: regenerate the dashboard if the archived roadmap's
# checkbox change should bubble up. Iron Law from
# `roadmap-progress-sync` says yes if it does.
./agent-config roadmap:progress
```

Per
[`commit-policy`](../.agent-src/rules/commit-policy.md):
do **not** commit unless explicitly told to. The user owns the commit
step.

## Cleanup after capture

```bash
# Raw captures (not redacted) contain real prompt content.
# Either delete the directory or leave it for repeat captures.
rm -rf "$AGENT_HOOK_CAPTURE_DIR"

# Or keep redacted ones only:
# find "$AGENT_HOOK_CAPTURE_DIR" -type f ! -name '*.redacted.json' -delete

# Unset the env var when done so subsequent sessions do not capture.
unset AGENT_HOOK_CAPTURE_DIR
```

The capture directory is gitignored project-wide; raw captures are
never accidentally committed. The redaction step is still mandatory
before paste because the redacted output goes into a tracked file
(the archived roadmap) and would otherwise leak.

## Sources

- Capture engine: [`scripts/hooks/dispatch_hook.py`](../scripts/hooks/dispatch_hook.py) — `_maybe_capture_payload`
- Redactor: [`scripts/redact_hook_capture.py`](../scripts/redact_hook_capture.py)
- Per-platform install logic: [`scripts/install.py`](../scripts/install.py) — search `ensure_<platform>_bridge` / `ensure_<platform>_user_hooks`
- Platform matrix + payload schemas: [`agents/contexts/chat-history-platform-hooks.md`](../agents/contexts/chat-history-platform-hooks.md)
- Hook architecture: [`docs/contracts/hook-architecture-v1.md`](contracts/hook-architecture-v1.md)
- Archived roadmap with per-phase paste sections: [`agents/roadmaps/archive/road-to-verified-chat-history-platforms.md`](../agents/roadmaps/archive/road-to-verified-chat-history-platforms.md)
