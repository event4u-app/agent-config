#!/usr/bin/env bash
# mcp_setup.sh — One-line MCP server onboarding.
# Creates .venv-mcp/ (gitignored) and installs the `mcp` SDK.
# Idempotent: safe to re-run; reuses an existing .venv-mcp/.

set -euo pipefail

VENV_DIR=".venv-mcp"

log_ok()    { echo "✅  $*"; }
log_warn()  { echo "⚠️  $*" >&2; }
log_err()   { echo "❌  $*" >&2; }

# --- Locate a Python ≥ 3.11 ---
find_python() {
  for cand in python3.13 python3.12 python3.11; do
    if command -v "$cand" >/dev/null 2>&1; then
      echo "$cand"
      return 0
    fi
  done
  if command -v python3 >/dev/null 2>&1; then
    local ver
    ver="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
    case "$ver" in
      3.11|3.12|3.13|3.1[4-9]|3.[2-9][0-9]) echo "python3"; return 0 ;;
    esac
  fi
  return 1
}

PY="$(find_python || true)"
if [[ -z "${PY:-}" ]]; then
  log_err "Python 3.11+ not found."
  log_err "Install Python 3.11+ (e.g. via pyenv, asdf, brew, or apt) and re-run."
  exit 1
fi

PY_VER="$("$PY" -c 'import sys; print("%d.%d.%d" % sys.version_info[:3])')"

# --- Create or reuse venv ---
if [[ -d "$VENV_DIR" ]]; then
  log_ok "$VENV_DIR/ exists — reusing (Python $("$VENV_DIR/bin/python" --version 2>&1 | awk '{print $2}'))"
else
  "$PY" -m venv "$VENV_DIR"
  log_ok "Created $VENV_DIR/ with $PY ($PY_VER)"
fi

# --- Install / upgrade mcp SDK ---
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet --upgrade mcp

MCP_VER="$("$VENV_DIR/bin/python" -c 'import mcp, importlib.metadata as m; print(m.version("mcp"))' 2>/dev/null || echo "?")"
log_ok "Installed mcp SDK ($MCP_VER) in $VENV_DIR/"

# --- Smoke: import the server module ---
if ! "$VENV_DIR/bin/python" -c 'import scripts.mcp_server' 2>/dev/null; then
  log_warn "scripts.mcp_server import failed — check repository checkout."
  exit 1
fi
log_ok "scripts.mcp_server import OK"

# --- Print client config snippet ---
ROOT="$(pwd)"
PY_BIN="$ROOT/$VENV_DIR/bin/python"

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
        "command": "$PY_BIN",
        "args": ["-m", "scripts.mcp_server"],
        "env": { "PYTHONPATH": "$ROOT" }
      }
    }
  }
JSON
echo ""
echo "After saving the config: ⌘Q Claude Desktop and restart."
echo "──────────────────────────────────────────────────────────────"
