#!/usr/bin/env bash
# setup.sh — One-liner installer for @event4u/agent-config (curl | bash entrypoint).
#
# Mirrors agent-os: downloads the latest GitHub tarball into a temp dir,
# runs scripts/install with the user's tool selection, then cleans up.
# Use this when Node.js is not available (otherwise prefer
# `npx @event4u/agent-config init`).
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh | bash
#   curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh | bash -s -- --tools=claude-code,cursor --yes
#   curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh | bash -s -- --ref=v1.39.0 --tools=cursor --yes
#
# Options forwarded to scripts/install: --tools, --yes, plus everything else.
# Local-only flags (consumed by setup.sh):
#   --ref <git-ref>   git ref to install from (default: main)
#   --target <dir>    target directory (default: cwd)
#   --help, -h        show help

set -euo pipefail

REPO="event4u-app/agent-config"
REF="main"
TARGET="$PWD"
PASSTHROUGH=()

show_help() {
    cat <<'EOF'
Usage: curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh \
         | bash -s -- [OPTIONS]

Local options (consumed here):
  --ref <git-ref>   GitHub ref to download (default: main)
  --target <dir>    Target directory (default: cwd)
  --help, -h        Show this help

Forwarded to scripts/install:
  --tools <list>    Comma-separated tool IDs (default: all)
  --yes             Non-interactive
  --profile <name>  Cost profile (lite|balanced|heavy)
  …                 Anything else scripts/install accepts

Examples:
  bash setup.sh --tools=claude-code,cursor --yes
  bash setup.sh --ref=v1.39.0 --tools=cursor --yes
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --ref)      REF="$2"; shift 2 ;;
        --ref=*)    REF="${1#*=}"; shift ;;
        --target)   TARGET="$2"; shift 2 ;;
        --target=*) TARGET="${1#*=}"; shift ;;
        --help|-h)  show_help; exit 0 ;;
        *)          PASSTHROUGH+=("$1"); shift ;;
    esac
done

# --- Dependency checks ---
need_cmd() {
    command -v "$1" >/dev/null 2>&1 || { echo "  ❌  Missing required command: $1" >&2; exit 1; }
}
need_cmd bash
need_cmd tar
if command -v curl >/dev/null 2>&1; then
    DOWNLOADER="curl"
elif command -v wget >/dev/null 2>&1; then
    DOWNLOADER="wget"
else
    echo "  ❌  Need curl or wget to download the tarball." >&2
    exit 1
fi

TMPDIR_ROOT="$(mktemp -d -t agent-config-setup-XXXXXX)"
trap 'rm -rf "$TMPDIR_ROOT"' EXIT

EXTRACT_DIR="$TMPDIR_ROOT/src"
TARBALL="$TMPDIR_ROOT/package.tgz"

# AGENT_CONFIG_TARBALL_URL — test-only override. When set, skips the
# codeload URL build and downloads from there instead. Used by
# tests/test_one_liner_entrypoints.sh against a local file:// URL so
# the smoke test stays offline.
URL="${AGENT_CONFIG_TARBALL_URL:-https://codeload.github.com/${REPO}/tar.gz/${REF}}"

echo "  ⬇️   Downloading ${URL}"
case "$URL" in
    file://*)
        cp "${URL#file://}" "$TARBALL"
        ;;
    *)
        case "$DOWNLOADER" in
            curl) curl -sSL --fail "$URL" -o "$TARBALL" ;;
            wget) wget -q "$URL" -O "$TARBALL" ;;
        esac
        ;;
esac

mkdir -p "$EXTRACT_DIR"
tar -xzf "$TARBALL" -C "$EXTRACT_DIR" --strip-components=1

INSTALLER="$EXTRACT_DIR/scripts/install"
if [[ ! -f "$INSTALLER" ]]; then
    echo "  ❌  Installer not found at $INSTALLER (tarball layout unexpected)" >&2
    exit 1
fi

echo "  🚀  Running scripts/install --target $TARGET ${PASSTHROUGH[*]:-}"
bash "$INSTALLER" --target "$TARGET" "${PASSTHROUGH[@]}"
echo "  ✅  Done."
