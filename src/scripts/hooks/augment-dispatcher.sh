#!/usr/bin/env bash
# Augment Code universal hook trampoline (Phase 7.3, hook-architecture-v1.md).
#
# Replaces the four per-concern trampolines (augment-chat-history.sh,
# augment-roadmap-progress.sh, augment-onboarding-gate.sh,
# augment-context-hygiene.sh). One script, dispatched per (platform, event)
# tuple via scripts/hooks/dispatch_hook.py reading scripts/hook_manifest.yaml.
#
# Augment requires hook scripts to use the .sh extension and live at user
# scope (~/.augment/hooks/) — same constraint as the legacy trampolines.
#
# Behaviour:
#   - Read the JSON event from stdin into a buffer.
#   - Extract workspace_roots[0]; bail silently when missing.
#   - cd into that workspace; bail silently when it is not a directory
#     or does not contain ./agent-config.
#   - Re-pipe the original JSON into
#       ./agent-config dispatch:hook --platform augment \
#           --event $1 --native-event $2
#   - Always exit 0 — Augment hooks must never block the agent loop
#     (chat-history / roadmap-progress / context-hygiene are observe-only;
#     onboarding-gate writes state but does not deny SessionStart).

set -u

# Args from the platform's settings.json hook entry:
#   $1 = agent-config event name (session_start, post_tool_use, …)
#   $2 = Augment-native event name (SessionStart, PostToolUse, …)
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
elif command -v python3 >/dev/null 2>&1; then
    WORKSPACE="$(printf '%s' "$EVENT_DATA" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
roots = data.get("workspace_roots") or []
if roots:
    print(roots[0])
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
        --platform augment \
        --event "$EVENT" \
        --native-event "$NATIVE_EVENT" \
        >/dev/null 2>&1 || true

exit 0
