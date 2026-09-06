#!/usr/bin/env bash
# Cursor universal hook trampoline (Phase 7.5, hook-architecture-v1.md).
#
# Routes user-scope `~/.cursor/hooks.json` events into the active
# workspace's `./agent-config dispatch:hook`. Project-scope
# `.cursor/hooks.json` does NOT need this trampoline — the installer
# `ensure_cursor_bridge()` writes direct dispatch:hook commands there
# because the project hooks fire with the workspace as cwd.
#
# Cursor event payload (per https://cursor.com/docs/hooks):
#   { "conversation_id": "...", "generation_id": "...",
#     "model": "...", "hook_event_name": "...",
#     "cursor_version": "...", "workspace_roots": ["<path>"],
#     "user_email": "...|null", "transcript_path": "...|null", ... }
#
# Behaviour mirrors augment-dispatcher.sh:
#   - Read JSON event from stdin into a buffer.
#   - Extract workspace_roots[0]; bail silently when missing.
#   - cd into that workspace; bail silently when it lacks ./agent-config.
#   - Re-pipe the original JSON into
#       ./agent-config dispatch:hook --platform cursor \
#           --event $1 --native-event $2
#   - Always exit 0 — Cursor's pre-hooks can block via exit code. The
#     manifest declares 7 concerns at `severity: blocking`, and this host
#     binds none of them: cursor's platform row carries session_start,
#     session_end, stop, user_prompt_submit and post_tool_use, and every
#     blocking concern sits in a slot or platform row outside that set.
#     The count is a YAML parse of the concerns map, never `grep -c
#     'severity: blocking'`, which returns 8 by also counting the prose
#     line that quotes the key. What IS bound here — chat-history /
#     roadmap-progress / context-hygiene — is observe-only, and
#     onboarding-gate writes state without denying sessionStart.

set -u

# Args from the platform's hooks.json command string:
#   $1 = agent-config event name (session_start, post_tool_use, …)
#   $2 = Cursor-native event name (sessionStart, postToolUse, …)
EVENT="${1-}"
NATIVE_EVENT="${2-}"

if [ -z "$EVENT" ]; then
    exit 0
fi

EVENT_DATA="$(cat)"

WORKSPACE=""
if command -v jq >/dev/null 2>&1; then
    WORKSPACE="$(printf '%s' "$EVENT_DATA" \
        | jq -r '.workspace_roots[0] // empty' 2>/dev/null)"
elif command -v node >/dev/null 2>&1; then
    WORKSPACE="$(printf '%s' "$EVENT_DATA" | node -e '
let b="";process.stdin.on("data",c=>b+=c);process.stdin.on("end",()=>{let d;try{d=JSON.parse(b)}catch(e){process.exit(0)}const r=(d&&d.workspace_roots)||[];if(r.length)process.stdout.write(String(r[0]))});
' 2>/dev/null)"
fi

if [ -z "$WORKSPACE" ] || [ ! -d "$WORKSPACE" ]; then
    exit 0
fi

cd "$WORKSPACE" 2>/dev/null || exit 0

if [ ! -x ./agent-config ]; then
    exit 0
fi

printf '%s' "$EVENT_DATA" \
    | ./agent-config dispatch:hook \
        --platform cursor \
        --event "$EVENT" \
        --native-event "$NATIVE_EVENT" \
        >/dev/null 2>&1 || true

exit 0
