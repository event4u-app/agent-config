#!/usr/bin/env bash
# smoke_host_loadability.sh — real-host loadability smoke
# (road-to-ecosystem-harvest-skill-quality-gates Phase 4, Source G).
#
# The static check (check_host_loadability.ts) proves the generated trees
# PARSE; this smoke proves the real Claude Code CLI actually ACCEPTS them:
#
#   1. `claude plugin validate .claude-plugin` — the host's own validator on
#      the marketplace manifest + plugin dirs.
#   2. Temp-home install: add this repo as a marketplace in a throwaway HOME,
#      install the bootstrap-shim plugin, assert it shows up in
#      `claude plugin list`. Nothing touches the developer's real ~/.claude.
#   3. Metadata cross-consistency (marketplace ↔ plugin dirs ↔ docs):
#      lint_marketplace + lint_marketplace_install_completeness +
#      lint_supported_tools_matrix + check_host_loadability.
#
# Contract: OPTIONAL in CI (runners without the claude CLI skip with exit 0
# and a notice), REQUIRED before releases — pass --require to make a missing
# CLI a failure (wired into the release flow, see docs/contracts/release-pr-gating.md).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

REQUIRE=0
for arg in "$@"; do
  case "$arg" in
    --require) REQUIRE=1 ;;
    *) echo "usage: smoke_host_loadability.sh [--require]" >&2; exit 2 ;;
  esac
done

CLAUDE_BIN="${CLAUDE_CLI:-$(command -v claude || true)}"
if [ -n "$CLAUDE_BIN" ] && [ ! -x "$CLAUDE_BIN" ]; then
  CLAUDE_BIN=""
fi
if [ -z "$CLAUDE_BIN" ]; then
  if [ "$REQUIRE" -eq 1 ]; then
    echo "❌  claude CLI not found and --require set (release gate). Install Claude Code or set CLAUDE_CLI." >&2
    exit 1
  fi
  echo "⚠️  claude CLI not found — real-host smoke skipped (static checks still run)."
  ./scripts-run src/scripts/check_host_loadability --root .
  ./scripts-run src/scripts/lint_supported_tools_matrix
  exit 0
fi

MARKETPLACE_NAME="$(node -e "console.log(JSON.parse(require('node:fs').readFileSync('.claude-plugin/marketplace.json','utf8')).name)")"
PLUGIN_NAME="$(node -e "console.log(JSON.parse(require('node:fs').readFileSync('.claude-plugin/marketplace.json','utf8')).plugins[0].name)")"

echo "→ 1/3 host-CLI manifest validation (claude plugin validate)"
# validate expects the directory that CONTAINS .claude-plugin/.
"$CLAUDE_BIN" plugin validate "$REPO_ROOT"

echo "→ 2/3 temp-home install + load assertion (${PLUGIN_NAME}@${MARKETPLACE_NAME})"
TMP_HOME="$(mktemp -d)"
cleanup() { rm -rf "$TMP_HOME"; }
trap cleanup EXIT
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
HOME="$TMP_HOME" "$CLAUDE_BIN" plugin marketplace add "$REPO_ROOT"
HOME="$TMP_HOME" "$CLAUDE_BIN" plugin install "${PLUGIN_NAME}@${MARKETPLACE_NAME}"
if ! HOME="$TMP_HOME" "$CLAUDE_BIN" plugin list | grep -q "$PLUGIN_NAME"; then
  echo "❌  plugin '${PLUGIN_NAME}' not listed after temp-home install — host did not load it" >&2
  exit 1
fi

echo "→ 3/3 metadata cross-consistency (marketplace ↔ plugin dirs ↔ docs)"
./scripts-run src/scripts/lint_marketplace
./scripts-run src/scripts/lint_marketplace_install_completeness
./scripts-run src/scripts/lint_supported_tools_matrix
./scripts-run src/scripts/check_host_loadability --root .

echo "✅  host-loadability smoke green (validate + temp-home install + cross-consistency)"
