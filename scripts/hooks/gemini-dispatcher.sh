#!/usr/bin/env bash
# Gemini CLI universal hook trampoline (Phase 7.8,
# hook-architecture-v1.md).
#
# Routes Gemini hook events — fired from either the project-scope
# `.gemini/settings.json` or the user-scope `~/.gemini/settings.json`
# — into the active workspace's `./agent-config dispatch:hook`.
#
# Gemini event payload (per geminicli.com/docs/hooks/reference/):
#   { "session_id": "...", "cwd": "...",
#     "hook_event_name": "SessionStart" | "BeforeAgent" | ...,
#     <event-specific fields: source, prompt, tool_name, ...> }
#
# Workspace resolution — Gemini does NOT pass a workspace_roots array
# the way Cursor/Cline do. Instead:
#   1. Project-scope hook → cwd is the workspace root (Gemini fires
#      hooks with the project as cwd).
#      `$PWD` containing `./agent-config` is the happy path.
#   2. User-scope hook → cwd may be the workspace, but for some
#      events Gemini executes from `$HOME` or a tmp dir. Fall back to:
#       - the JSON payload's `cwd` field
#       - walk up to nearest .agent-settings.yml
#   3. Bail silently when no resolution succeeds — concerns are
#      observe-only at this layer; chat-history / roadmap-progress /
#      context-hygiene never block, and onboarding-gate writes state,
#      not exit code.
#
# Output — none on stdout. Gemini consumes JSON on stdout for
# context injection / decision; we don't inject anything from this
# layer (concerns stream their own state via agents/state/.dispatcher/).
# SessionStart / SessionEnd are advisory in Gemini (continue/decision
# ignored), so we always exit 0.

set -u

# Args from the platform's settings.json command string:
#   $1 = agent-config event name (session_start, stop, user_prompt_submit, ...)
#   $2 = Gemini-native event name (SessionStart, BeforeAgent, ...)
EVENT="${1-}"
NATIVE_EVENT="${2-}"

if [ -z "$EVENT" ]; then
    exit 0
fi

EVENT_DATA="$(cat)"

# 1. $PWD wins when it already looks like an agent-config workspace.
WORKSPACE=""
if [ -x "$PWD/agent-config" ] || [ -f "$PWD/.agent-settings.yml" ]; then
    WORKSPACE="$PWD"
fi

# 2. Walk up from $PWD looking for .agent-settings.yml (covers
#    sub-directory invocations).
if [ -z "$WORKSPACE" ]; then
    candidate="$PWD"
    while [ -n "$candidate" ] && [ "$candidate" != "/" ]; do
        if [ -f "$candidate/.agent-settings.yml" ]; then
            WORKSPACE="$candidate"
            break
        fi
        candidate="$(dirname "$candidate")"
    done
fi

# 3. Parse JSON `cwd` field from the payload.
if [ -z "$WORKSPACE" ]; then
    if command -v jq >/dev/null 2>&1; then
        EXTRACTED="$(printf '%s' "$EVENT_DATA" \
            | jq -r '.cwd // empty' 2>/dev/null)"
    elif command -v python3 >/dev/null 2>&1; then
        EXTRACTED="$(printf '%s' "$EVENT_DATA" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print(data.get("cwd") or "")
' 2>/dev/null)"
    else
        EXTRACTED=""
    fi
    EXTRACTED="${EXTRACTED%$'\r'}"
    if [ -n "$EXTRACTED" ]; then
        candidate="$EXTRACTED"
        if [ -f "$candidate" ]; then
            candidate="$(dirname "$candidate")"
        fi
        while [ -n "$candidate" ] && [ "$candidate" != "/" ]; do
            if [ -f "$candidate/.agent-settings.yml" ]; then
                WORKSPACE="$candidate"
                break
            fi
            candidate="$(dirname "$candidate")"
        done
    fi
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
        --platform gemini \
        --event "$EVENT" \
        --native-event "$NATIVE_EVENT" \
        >/dev/null 2>&1 || true

exit 0
