#!/usr/bin/env bash
# Augment Sync — sync non-.md files and cleanup stale files
#
# Usage:
#   ./scripts/compress.sh              # sync non-.md files + cleanup
#   ./scripts/compress.sh --list       # list ALL .md files
#   ./scripts/compress.sh --changed    # list .md files changed since last compression
#   ./scripts/compress.sh --check      # check if dirs are in sync
#   ./scripts/compress.sh --mark-done <path>  # mark file as compressed
#   ./scripts/compress.sh --mark-all-done     # mark all files as compressed
#
# .md compression is done by the Augment agent interactively.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$SCRIPT_DIR/compress.py" "${@:---sync}"
