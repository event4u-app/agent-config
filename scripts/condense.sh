#!/usr/bin/env bash
# Augment Sync — sync non-.md files and cleanup stale files
#
# Usage:
#   ./scripts/condense.sh              # sync non-.md files + cleanup
#   ./scripts/condense.sh --list       # list ALL .md files
#   ./scripts/condense.sh --changed    # list .md files changed since last condensation
#   ./scripts/condense.sh --check      # check if dirs are in sync
#   ./scripts/condense.sh --mark-done <path>  # mark file as condensed
#   ./scripts/condense.sh --mark-all-done     # mark all files as condensed
#
# .md condensation is done by the Augment agent interactively.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$SCRIPT_DIR/condense.py" "${@:---sync}"
