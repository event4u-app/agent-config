#!/usr/bin/env bash
# Cowork universal hook trampoline.
#
# Cowork is the Claude desktop app's local-agent-mode runtime. It runs
# the Claude Code CLI inside a sandbox VM, so hook events use the
# Claude Code shape (PascalCase native names; Stop carries
# `transcript_path`). The payload typically carries `cwd` (Claude
# Code's standard field) rather than Augment's `workspace_roots[0]`.
# We accept either, falling back through both.
#
# Upstream caveat: as of writing this trampoline, lifecycle events do
# not actually fire from Cowork sessions —
# anthropics/claude-code#40495 reports all three Claude Code settings
# sources (user, project, env) are ignored inside Cowork's sandbox,
# and #27398 reports plugin-scope `hooks/hooks.json` is excluded
# because Cowork spawns the CLI with `--setting-sources user`. The
# trampoline is structurally ready; install plumbing is deferred
# until upstream resolves the bugs and a stable settings location is
# documented. See `agents/contexts/chat-history-platform-hooks.md`
# § Cowork.
#
# Behaviour mirrors cursor-dispatcher.sh:
#   - Read JSON event from stdin into a buffer.
#   - Extract cwd (Claude Code) or workspace_roots[0] (fallback);
#     bail silently when neither resolves to a directory.
#   - cd into that workspace; bail silently when it lacks ./agent-config.
#   - Re-pipe the original JSON into
#       ./agent-config dispatch:hook --platform cowork \
#           --event $1 --native-event $2
#   - Always exit 0 — chat-history must never block the agent loop.

set -u

# Args from the platform's hooks config (whatever shape Cowork ends up
# using once upstream lands the fix):
#   $1 = agent-config event name (session_start, post_tool_use, …)
#   $2 = Cowork-native event name (SessionStart, PostToolUse, …)
EVENT="${1-}"
NATIVE_EVENT="${2-}"

if [ -z "$EVENT" ]; then
    exit 0
fi

EVENT_DATA="$(cat)"

# Debug-only: when ~/.claude/.cowork-chat-history-debug exists, dump
# the raw stdin payload for offline inspection. No-op otherwise.
# Useful once upstream fixes #40495 to verify the actual payload shape.
if [ -f "$HOME/.claude/.cowork-chat-history-debug" ]; then
    DUMP_DIR="$HOME/.claude/cowork-chat-history-debug"
    mkdir -p "$DUMP_DIR" 2>/dev/null
    printf '%s' "$EVENT_DATA" \
        > "$DUMP_DIR/event-$(date +%Y%m%d-%H%M%S)-$$.json" 2>/dev/null || true
fi

# Extract workspace path. Try Claude Code's `cwd` first, then fall
# back to Augment-style `workspace_roots[0]`. Either is acceptable —
# we need a directory containing ./agent-config.
WORKSPACE=""
if command -v jq >/dev/null 2>&1; then
    WORKSPACE="$(printf '%s' "$EVENT_DATA" \
        | jq -r '.cwd // .workspace_roots[0] // empty' 2>/dev/null)"
elif command -v python3 >/dev/null 2>&1; then
    WORKSPACE="$(printf '%s' "$EVENT_DATA" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
cwd = data.get("cwd")
if isinstance(cwd, str) and cwd:
    print(cwd)
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
        --platform cowork \
        --event "$EVENT" \
        --native-event "$NATIVE_EVENT" \
        >/dev/null 2>&1 || true

exit 0
