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
# and that the canonical command count matches README + getting-started docs.
#
# The command-count gate exists because three consecutive PRs landed
# post-CI count-drift fixes (e.g. f2fb0026 "bump command count
# 101→103"). Catching the drift pre-push stops it from flooding remote
# CI. Runtime ~0.1s.

fail=0

echo "🔍 Checking .agent-src/ sync..."
if ! python3 scripts/compress.py --check; then
    echo "❌  .agent-src/ is out of sync. Run 'task sync' and compress changed .md files, then commit."
    fail=1
fi

echo "🔍 Checking command count messaging..."
if ! python3 scripts/check_command_count_messaging.py; then
    echo "❌  Command-count drift in README / AGENTS.md / getting-started. Run 'task counts-update', stage the changes, then re-commit."
    fail=1
fi

if [ $fail -ne 0 ]; then
    echo ""
    echo "   Push blocked — fix the failures above and re-push."
    echo "   Bypass for a WIP push:  git push --no-verify"
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
# that exists on disk under .claude/skills/, AND verify
# agents/roadmaps-progress.md is in sync with the current state of
# agents/roadmaps/ (roadmap-progress-sync Iron Law).

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

# Roadmap dashboard sync — only fires when staged changes touch a roadmap
# file or the dashboard itself, so unrelated commits stay fast.
if git diff --cached --name-only | grep -qE '^agents/roadmaps(-progress\.md|/)'; then
    python3 .augment/scripts/update_roadmap_progress.py --check
    rstatus=$?
    if [ $rstatus -ne 0 ]; then
        echo ""
        echo "❌  Commit blocked — agents/roadmaps-progress.md is stale."
        echo "   Run './agent-config roadmap:progress' (or"
        echo "   'python3 .augment/scripts/update_roadmap_progress.py'),"
        echo "   stage agents/roadmaps-progress.md, then re-commit."
        echo "   To bypass for an unrelated WIP commit: git commit --no-verify"
        exit 1
    fi
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
# boundary in agents/.agent-chat-history when an agent session is active.
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
# $name: append a phase boundary to agents/.agent-chat-history when an agent
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
