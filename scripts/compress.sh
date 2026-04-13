#!/usr/bin/env bash
# Augment Sync — sync non-.md files and cleanup stale files
#
# Usage:
#   ./scripts/compress.sh              # sync non-.md files + cleanup
#   ./scripts/compress.sh --list       # list .md files needing agent compression
#   ./scripts/compress.sh --check      # check if dirs are in sync
#
# .md compression is done by the Augment agent interactively.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$SCRIPT_DIR/compress.py" "${1:---sync}"
