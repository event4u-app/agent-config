#!/usr/bin/env bash
# postinstall.sh — npm postinstall wrapper for scripts/install
#
# Runs the orchestrator and decides on an exit strategy that is honest
# without breaking `npm install` for unrelated reasons:
#
#   - Success        → exit 0, silent.
#   - Soft failure   → exit 0, print actionable hint. The orchestrator
#                      already handles environment issues (no python3)
#                      internally and continues with the payload sync.
#   - Hard failure   → print a loud error block, print the captured output,
#                      exit 0. `npm install` keeps working; the developer
#                      sees exactly what failed and the command to retry.
#
# Delegates to scripts/install (the orchestrator). Never calls install.sh
# or install.py directly.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER="$SCRIPT_DIR/install"

if [[ ! -f "$INSTALLER" ]]; then
    # Nothing to do — shipping this wrapper without the installer would be a
    # packaging bug, not a consumer problem.
    echo "agent-config postinstall: $INSTALLER missing, skipping." >&2
    exit 0
fi

LOG="$(mktemp -t agent-config-postinstall.XXXXXX.log 2>/dev/null || mktemp)"
trap 'rm -f "$LOG"' EXIT

bash "$INSTALLER" --quiet >"$LOG" 2>&1
CODE=$?
if [[ $CODE -eq 0 ]]; then
    exit 0
fi

cat >&2 <<EOF

────────────────────────────────────────────────────────────────
⚠️  agent-config: postinstall failed (exit $CODE)
────────────────────────────────────────────────────────────────
Output:
$(sed 's/^/    /' "$LOG")

The rest of \`npm install\` continues — but agent-config was NOT
installed. Re-run manually to see the full trace:

    bash node_modules/@event4u/agent-config/scripts/install

If this keeps happening, please open an issue:
    https://github.com/event4u-app/agent-config/issues
────────────────────────────────────────────────────────────────

EOF

# Exit 0 so npm install doesn't break for unrelated consumer workflows.
# The loud block above makes the failure visible — unlike `|| true`.
exit 0
