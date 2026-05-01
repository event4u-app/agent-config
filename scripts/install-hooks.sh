#!/usr/bin/env bash
# Install git hooks for this repository.
# Run once: bash scripts/install-hooks.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

mkdir -p "$HOOKS_DIR"

cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/usr/bin/env bash
# Pre-push hook: verify .agent-src/ is in sync with .agent-src.uncompressed/

echo "🔍 Checking .agent-src/ sync..."
python3 scripts/compress.py --check

if [ $? -ne 0 ]; then
    echo ""
    echo "❌  Push blocked — .agent-src/ is out of sync."
    echo "   Run 'task sync' and compress changed .md files, then commit."
    exit 1
fi
EOF

chmod +x "$HOOKS_DIR/pre-push"
echo "✅  Pre-push hook installed."

# Pre-commit: marketplace consistency -----------------------------------------
#
# Distribution manifests (.claude-plugin/marketplace.json) drift silently —
# adding a skill on disk without updating the manifest renders it invisible to
# Claude Code Plugin Marketplace consumers. CI catches it, but a structural
# pre-commit gate stops the bad commit from landing in the first place.
# Runtime is ~40 ms; always-on is cheaper than scoped detection.

cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/usr/bin/env bash
# Pre-commit hook: verify .claude-plugin/marketplace.json lists every skill
# that exists on disk under .claude/skills/.

python3 scripts/lint_marketplace.py
status=$?

if [ $status -ne 0 ]; then
    echo ""
    echo "❌  Commit blocked — .claude-plugin/marketplace.json is out of sync."
    echo "   Add the missing skill to the manifest (or remove the stale entry),"
    echo "   then re-stage and commit. To bypass for an unrelated WIP commit:"
    echo "       git commit --no-verify"
    exit 1
fi
EOF

chmod +x "$HOOKS_DIR/pre-commit"
echo "✅  Pre-commit hook installed."

# Chat-history bridge hooks ----------------------------------------------------
#
# Augment IDE plugin (and any other agent surface without native chat
# lifecycle hooks) cannot fire SessionStart/Stop/PostToolUse. Git hooks
# are the platform-agnostic lifecycle surface that fires regardless of
# IDE — every commit, merge, checkout, and rewrite turns into a phase
# boundary in .agent-chat-history when an agent session is active.
#
# The hooks are silent no-ops when no agent session is active (the
# chat_history.py hook-append script returns "skipped_no_sidecar" with
# exit 0) and `|| true` belt-and-suspenders ensures git operations are
# never blocked.

write_chat_history_hook() {
    local name="$1"
    local phase_tag="$2"
    cat > "$HOOKS_DIR/$name" << EOF
#!/usr/bin/env bash
# $name: append a phase boundary to .agent-chat-history when an agent
# session is active. Silent no-op otherwise. Never blocks git.

if [ -x ./agent-config ]; then
    ref="\$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
    payload="{\"phase\":\"$phase_tag\",\"source\":\"git-hook:\$ref\"}"
    ./agent-config chat-history:checkpoint --payload "\$payload" \
        >/dev/null 2>&1 || true
fi
exit 0
EOF
    chmod +x "$HOOKS_DIR/$name"
    echo "✅  $name hook installed."
}

write_chat_history_hook "post-commit"   "git:post-commit"
write_chat_history_hook "post-merge"    "git:post-merge"
write_chat_history_hook "post-checkout" "git:post-checkout"
write_chat_history_hook "post-rewrite"  "git:post-rewrite"
