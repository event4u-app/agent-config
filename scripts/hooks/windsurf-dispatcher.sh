#!/usr/bin/env bash
# Windsurf (Cascade) universal hook trampoline (Phase 7.7,
# hook-architecture-v1.md).
#
# Routes Windsurf hook events — fired from either the project-scope
# `.windsurf/hooks.json` or the user-scope `~/.codeium/windsurf/hooks.json`
# — into the active workspace's `./agent-config dispatch:hook`.
#
# Windsurf event payload (per docs.windsurf.com/windsurf/cascade/hooks):
#   { "agent_action_name": "<event>",
#     "tool_info": { "cwd": "...", "file_path": "...", ... } }
#
# Workspace resolution — Windsurf does NOT pass a workspace_roots array
# the way Cursor/Cline do. Instead:
#   1. Project-scope hook → cwd is the workspace root (Cascade convention).
#      `$PWD` containing `./agent-config` is the happy path.
#   2. User-scope hook → cwd may be the workspace, but for some events
#      Windsurf executes from `$HOME` or a tmp dir. Fall back to:
#       - tool_info.cwd from the JSON payload
#       - tool_info.file_path → walk up to nearest .agent-settings.yml
#       - $ROOT_WORKSPACE_PATH (only set on post_setup_worktree)
#   3. Bail silently when no resolution succeeds — concerns are
#      observe-only at this layer; chat-history / roadmap-progress /
#      context-hygiene never block, and onboarding-gate writes state,
#      not exit code.
#
# Output — none. Windsurf does not consume stdout from hooks (post hooks
# are async, pre hooks block via exit code 2). We always exit 0 since
# none of our concerns block.

set -u

# Args from the platform's hooks.json command string:
#   $1 = agent-config event name (session_start, stop, user_prompt_submit)
#   $2 = Windsurf-native event name (pre_user_prompt, post_cascade_response, …)
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

# 3. Parse JSON tool_info for cwd / file_path.
if [ -z "$WORKSPACE" ]; then
    if command -v jq >/dev/null 2>&1; then
        EXTRACTED="$(printf '%s' "$EVENT_DATA" \
            | jq -r '.tool_info.cwd // .tool_info.file_path // empty' 2>/dev/null)"
    elif command -v python3 >/dev/null 2>&1; then
        EXTRACTED="$(printf '%s' "$EVENT_DATA" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
info = data.get("tool_info") or {}
print(info.get("cwd") or info.get("file_path") or "")
' 2>/dev/null)"
    else
        EXTRACTED=""
    fi
    EXTRACTED="${EXTRACTED%$'\r'}"
    if [ -n "$EXTRACTED" ]; then
        # Walk up looking for .agent-settings.yml.
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

# 4. $ROOT_WORKSPACE_PATH is set only on post_setup_worktree.
if [ -z "$WORKSPACE" ] && [ -n "${ROOT_WORKSPACE_PATH-}" ]; then
    if [ -f "$ROOT_WORKSPACE_PATH/.agent-settings.yml" ]; then
        WORKSPACE="$ROOT_WORKSPACE_PATH"
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
        --platform windsurf \
        --event "$EVENT" \
        --native-event "$NATIVE_EVENT" \
        >/dev/null 2>&1 || true

exit 0
