#!/usr/bin/env bash
# Cline universal hook trampoline (Phase 7.6, hook-architecture-v1.md).
#
# Routes user-scope `~/Documents/Cline/Hooks/<HookName>` events into
# the active workspace's `./agent-config dispatch:hook`. Project-scope
# `.clinerules/hooks/<HookName>` does NOT need this trampoline —
# install.py `ensure_cline_bridge()` writes per-event scripts there
# that dispatch directly because Cline fires project hooks with the
# workspace as cwd.
#
# Cline event payload (per docs.cline.bot/customization/hooks):
#   { "taskId": "...", "hookName": "...", "clineVersion": "...",
#     "timestamp": "...", "workspaceRoots": ["<path>"], "userId": "...",
#     "model": { ... }, "<hookName-camelCase>": { ... }, ... }
#
# Output (read by Cline): JSON `{ cancel: bool, contextModification?,
# errorMessage? }`. Per agent-config we always emit an empty `{}` —
# concerns are observe-only at this layer; chat-history /
# roadmap-progress / context-hygiene never block, and onboarding-gate
# blocks via state file, not via cancel-on-TaskStart.
#
# Phase 7.6 amendment — Windows path guard: Cline upstream issue
# cline#8073 reports `workspaceRoots` containing CRLF or
# Windows-style paths on certain hosts. We only act when the first
# entry is a directory; other shapes silently no-op.

set -u

# Args from the hook script that wraps this trampoline:
#   $1 = agent-config event name (session_start, post_tool_use, …)
#   $2 = Cline-native hook name (TaskStart, PostToolUse, …)
EVENT="${1-}"
NATIVE_EVENT="${2-}"

if [ -z "$EVENT" ]; then
    printf '%s\n' '{}'
    exit 0
fi

EVENT_DATA="$(cat)"

WORKSPACE=""
if command -v jq >/dev/null 2>&1; then
    WORKSPACE="$(printf '%s' "$EVENT_DATA" \
        | jq -r '.workspaceRoots[0] // empty' 2>/dev/null)"
elif command -v python3 >/dev/null 2>&1; then
    WORKSPACE="$(printf '%s' "$EVENT_DATA" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
roots = data.get("workspaceRoots") or []
if roots:
    print(roots[0])
' 2>/dev/null)"
fi

# Strip CR (cline#8073 — Windows hosts can emit CRLF) and reject
# obviously-bogus shapes before the cd.
WORKSPACE="${WORKSPACE%$'\r'}"

if [ -z "$WORKSPACE" ] || [ ! -d "$WORKSPACE" ]; then
    printf '%s\n' '{}'
    exit 0
fi

cd "$WORKSPACE" 2>/dev/null || { printf '%s\n' '{}'; exit 0; }

if [ ! -x ./agent-config ]; then
    printf '%s\n' '{}'
    exit 0
fi

printf '%s' "$EVENT_DATA" \
    | ./agent-config dispatch:hook \
        --platform cline \
        --event "$EVENT" \
        --native-event "$NATIVE_EVENT" \
        >/dev/null 2>&1 || true

# Cline expects a JSON envelope on stdout; empty object = "no cancel,
# no context modification, no error". Errors from concerns surface
# through agents/state/.dispatcher/<session_id>/ per Phase 7.3.
printf '%s\n' '{}'
exit 0
