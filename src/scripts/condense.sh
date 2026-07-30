#!/usr/bin/env bash
# Augment Sync — sync non-.md files and cleanup stale files
#
# Usage:
#   ./scripts/condense.sh              # sync non-.md files + cleanup
#   ./scripts/condense.sh --list       # list ALL .md files
#   ./scripts/condense.sh --changed    # list .md files whose projection is out of date
#   ./scripts/condense.sh --check      # check if dirs are in sync
#
# .md files are projected verbatim with the path rewriter applied — --sync
# writes them; there is no separate condensation step.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Run the TypeScript condense twin via the scripts-run shim (resolves tsx +
# run.ts; the Python condense.py was removed in the Python→TS final deletion).
if [ "$#" -eq 0 ]; then
  set -- --sync
fi
exec "$REPO_ROOT/scripts-run" src/scripts/condense "$@"
