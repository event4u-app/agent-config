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
