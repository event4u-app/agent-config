#!/usr/bin/env bash
# mcp_setup.sh — One-line MCP server onboarding.
# The MCP server is a TypeScript module (scripts/mcp_server/) run via tsx;
# there is no Python venv / SDK install any more — the runtime is Node/tsx.
# Idempotent: safe to re-run; verifies tsx + the server module are present
# and prints the client config snippet.

set -euo pipefail

log_ok()    { echo "✅  $*"; }
log_warn()  { echo "⚠️  $*" >&2; }
log_err()   { echo "❌  $*" >&2; }

# Package root = two levels above this script (scripts/ → src? no: this script
# ships under src/scripts/, package root is two levels up).
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# --- Locate tsx (Node runtime) ---
if [[ -x "$PACKAGE_ROOT/node_modules/.bin/tsx" ]]; then
  TSX_BIN="$PACKAGE_ROOT/node_modules/.bin/tsx"
elif command -v npx >/dev/null 2>&1; then
  TSX_BIN="npx tsx"
else
  log_err "tsx runner not found."
  log_err "Run \`npm install\` in the package to provide node_modules/.bin/tsx and re-run."
  exit 1
fi
log_ok "tsx runner: $TSX_BIN"

# --- Locate the server module ---
SERVER_MAIN="$PACKAGE_ROOT/src/scripts/mcp_server/__main__.ts"
if [[ ! -f "$SERVER_MAIN" ]]; then
  log_err "MCP server module not found: $SERVER_MAIN"
  log_err "Check the repository checkout / package install."
  exit 1
fi
log_ok "scripts/mcp_server module present"

# --- Print client config snippet ---
echo ""
echo "──  MCP server ready  ─────────────────────────────────────────"
echo ""
echo "Run over stdio:"
echo "  task mcp:run"
echo ""
echo "Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json):"
cat <<JSON
  {
    "mcpServers": {
      "agent-config": {
        "command": "$TSX_BIN",
        "args": ["$SERVER_MAIN"]
      }
    }
  }
JSON
echo ""
echo "After saving the config: ⌘Q Claude Desktop and restart."
echo "──────────────────────────────────────────────────────────────"
