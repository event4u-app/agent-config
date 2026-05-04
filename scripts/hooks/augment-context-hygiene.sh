#!/usr/bin/env bash
# Augment Code lifecycle-hook trampoline for context-hygiene.
#
# Augment requires hook scripts to use the .sh extension and live at
# either a system path (/etc/augment/...) or user scope
# (~/.augment/...). This trampoline lives at user scope and dispatches
# every PostToolUse event to whichever workspace fired it, so a single
# install covers every project that has ./agent-config available.
#
# Behaviour:
#   - Read the JSON event from stdin into a buffer.
#   - Extract workspace_roots[0]; bail silently when missing.
#   - cd into that workspace; bail silently when it is not a directory
#     or does not contain ./agent-config.
#   - Re-pipe the original JSON into
#       ./agent-config context-hygiene:hook --platform augment
#     so context_hygiene_hook.py can update the per-turn tracker.
#   - Always exit 0 — PostToolUse hooks must never block.

set -u

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
    | ./agent-config context-hygiene:hook --platform augment \
        >/dev/null 2>&1 || true

exit 0
