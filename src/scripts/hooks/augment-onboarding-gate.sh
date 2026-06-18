#!/usr/bin/env bash
# Augment Code lifecycle-hook trampoline for onboarding-gate.
#
# Augment requires hook scripts to use the .sh extension and live at
# either a system path (/etc/augment/...) or user scope
# (~/.augment/...). This trampoline lives at user scope and dispatches
# every event to whichever workspace fired it, so a single install
# covers every project that has ./agent-config available.
#
# Behaviour:
#   - Read the JSON event from stdin into a buffer.
#   - Extract workspace_roots[0]; bail silently when missing.
#   - cd into that workspace; bail silently when it is not a directory
#     or does not contain ./agent-config.
#   - Re-pipe the original JSON into
#       ./agent-config onboarding-gate:hook --platform augment
#     so onboarding_gate_hook.py can refresh the state file.
#   - Always exit 0 — onboarding-gate must never block the agent loop.

set -u

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
    | ./agent-config onboarding-gate:hook --platform augment \
        >/dev/null 2>&1 || true

exit 0
