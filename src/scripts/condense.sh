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
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Run the TypeScript condense twin via the scripts-run shim (resolves tsx +
# run.ts; the Python condense.py was removed in the Python→TS final deletion).
if [ "$#" -eq 0 ]; then
  set -- --sync
fi
exec "$REPO_ROOT/scripts-run" src/scripts/condense "$@"
