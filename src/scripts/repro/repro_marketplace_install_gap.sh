#!/usr/bin/env bash
# Reproduce the silent marketplace-install gap that this roadmap fixes.
#
# Phase 0 of `road-to-hooks-actually-fire-in-consumers`.
#
# Simulates a consumer project that ran `/plugin install
# agent-config@event4u-agent-config` but NEVER ran `agent-config init`.
# The plugin's hooks.json fires under Claude's lifecycle, but every
# resolved command (`"$CLAUDE_PROJECT_DIR"/agent-config dispatch:hook
# …`) errors out silently because the prerequisites do not exist.
#
# Expected output (the bug):
#   - Dispatcher exits 0 (never-block contract)
#   - NO `agents/roadmaps-progress.md` written
#   - NO state file under `agents/runtime/state/`
#   - Hook tried, hook failed, no trace left behind
#
# Once Phases 1-4 land, the same script should produce a
# `dispatch-issues.jsonl` entry naming the missing artefact.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"  # src/scripts/repro/ -> repo root
TMPDIR_BASE="${TMPDIR:-/tmp}"
CONSUMER_ROOT="$(mktemp -d "$TMPDIR_BASE/marketplace-install-gap-XXXXXX")"
EVIDENCE_FILE="$REPO_ROOT/agents/evidence/analysis/hooks-marketplace-gap-2026-05-29.md"

cleanup() {
    rm -rf "$CONSUMER_ROOT" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Setting up synthetic marketplace-install consumer at: $CONSUMER_ROOT"

# 1. Write only the marketplace-install end-state (.claude/settings.json
#    with the plugin enabled). Nothing else — no symlink, no regenerator,
#    no .augment/, no agents/runtime/state/.
mkdir -p "$CONSUMER_ROOT/.claude"
cat > "$CONSUMER_ROOT/.claude/settings.json" <<'JSON'
{
  "enabledPlugins": {
    "agent-config@event4u-agent-config": true
  }
}
JSON

# 2. Fake roadmap so a hook on path_prefix `agents/roadmaps/` has a
#    target to react to. (For Phase 0 we don't actually run a hook
#    that depends on this — but it documents the file layout.)
mkdir -p "$CONSUMER_ROOT/agents/roadmaps"
cat > "$CONSUMER_ROOT/agents/roadmaps/road-to-fake.md" <<'MD'
---
complexity: lightweight
---
# Roadmap: fake

## Phase 1

- [ ] **Step 1:** placeholder
MD

# 3. Capture the missing-artefact inventory BEFORE we try anything.
echo
echo "==> Missing-artefact inventory:"
INVENTORY=""
for artefact in \
    ".claude/settings.json (plugin enabled)" \
    "agent-config symlink" \
    ".augment/scripts/update_roadmap_progress.py" \
    "dist/agent-src/scripts/update_roadmap_progress.py" \
    ".agent-src.uncondensed/scripts/update_roadmap_progress.py" \
    ".git/hooks/pre-commit" \
    "agents/runtime/state/"
do
    # Strip parenthetical for the existence check.
    path_only="${artefact% (*}"
    if [ -e "$CONSUMER_ROOT/$path_only" ] || [ -L "$CONSUMER_ROOT/$path_only" ]; then
        status="present"
    else
        status="MISSING"
    fi
    line="  $status: $artefact"
    INVENTORY="$INVENTORY$line"$'\n'
    echo "$line"
done

# 4. Emit a synthetic PostToolUse JSON envelope on stdin to the
#    dispatch hook, simulating what Claude Code would send when an
#    agent writes to the fake roadmap.
echo
echo "==> Invoking dispatch hook with synthetic PostToolUse envelope..."
ENVELOPE=$(cat <<JSON
{
  "session_id": "repro-marketplace-gap",
  "transcript_path": "/dev/null",
  "cwd": "$CONSUMER_ROOT",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "$CONSUMER_ROOT/agents/roadmaps/road-to-fake.md"
  },
  "tool_response": {}
}
JSON
)

DISPATCH_STDERR="$(mktemp "$TMPDIR_BASE/dispatch-stderr-XXXXXX")"
DISPATCH_EXIT=0
echo "$ENVELOPE" | (
    cd "$CONSUMER_ROOT"
    CLAUDE_PROJECT_DIR="$CONSUMER_ROOT" "$REPO_ROOT/node_modules/.bin/tsx" "$REPO_ROOT/src/scripts/hooks/dispatch_hook.ts" \
        --platform claude --event post_tool_use --native-event PostToolUse \
        2>"$DISPATCH_STDERR"
) || DISPATCH_EXIT=$?

echo "  dispatcher exit code: $DISPATCH_EXIT"
echo "  dispatcher stderr:"
sed 's/^/    /' "$DISPATCH_STDERR" | head -20

# 5. Confirm the silent-no-op shape.
echo
echo "==> Verifying the silent no-op:"

DASHBOARD_EXISTS="no"
if [ -e "$CONSUMER_ROOT/agents/roadmaps-progress.md" ]; then
    DASHBOARD_EXISTS="yes"
fi
echo "  agents/roadmaps-progress.md written: $DASHBOARD_EXISTS  (expected: no)"

STATE_FILES=0
if [ -d "$CONSUMER_ROOT/agents/runtime/state" ]; then
    STATE_FILES=$(find "$CONSUMER_ROOT/agents/runtime/state" -type f 2>/dev/null | wc -l | tr -d ' ')
fi
echo "  state files under agents/runtime/state/: $STATE_FILES  (expected: 0)"

# Phase-1-aware check: after that phase lands, dispatch-issues.jsonl
# should exist with at least one entry. Today (pre-Phase-1) it does
# not. The script reports both shapes.
DISPATCH_ISSUES="no"
if [ -e "$CONSUMER_ROOT/agents/runtime/state/dispatch-issues.jsonl" ]; then
    DISPATCH_ISSUES="yes"
fi
echo "  agents/runtime/state/dispatch-issues.jsonl: $DISPATCH_ISSUES  (pre-Phase-1: no; post-Phase-1: yes)"

rm -f "$DISPATCH_STDERR"

# 6. Append evidence.
mkdir -p "$(dirname "$EVIDENCE_FILE")"
{
    printf '## %s — repro run\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'Tmp consumer root: `%s`\n\n' "$CONSUMER_ROOT"
    printf 'Inventory:\n\n'
    printf '```\n%s```\n\n' "$INVENTORY"
    printf 'Dispatcher exit: `%s`\n' "$DISPATCH_EXIT"
    printf 'Dashboard written: `%s`\n' "$DASHBOARD_EXISTS"
    printf 'State files: `%s`\n' "$STATE_FILES"
    printf 'dispatch-issues.jsonl: `%s`\n\n' "$DISPATCH_ISSUES"
} >> "$EVIDENCE_FILE"

echo
echo "==> Evidence appended to: ${EVIDENCE_FILE#$REPO_ROOT/}"
