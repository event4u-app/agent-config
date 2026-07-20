#!/usr/bin/env bash
# Opt-in, local-only first-run check for the production-validator wedge.
#
# Default-off by construction: nothing runs unless YOU invoke this script.
# It writes ONE aggregate line to a local log in your repo and never opens a
# network connection — consistent with the package's no-telemetry posture
# (docs/contracts/adoption-signal-floor.md). Delete the log any time.
#
# Usage (after your first @production-validator verdict):
#   bash first-run-check.sh ready       # first verdict was READY
#   bash first-run-check.sh not-ready   # first verdict was NOT READY
#   bash first-run-check.sh abandoned   # you gave up before a verdict
#
# The same outcome vocabulary feeds the B9 install-friction study
# (agents/recruit-sessions/_install-friction-runbook.md) when a session is
# proctored; unproctored users simply keep a private local record.
set -euo pipefail

OUTCOME="${1:-}"
case "$OUTCOME" in
  ready|not-ready|abandoned) ;;
  *)
    echo "usage: bash first-run-check.sh <ready|not-ready|abandoned>" >&2
    exit 2
    ;;
esac

AGENT_FILE=".claude/agents/production-validator.md"
LOG_FILE=".claude/wedge-first-run.local.log"

if [ ! -f "$AGENT_FILE" ]; then
  echo "NOT INSTALLED — $AGENT_FILE missing. Install first:" >&2
  echo "  mkdir -p .claude/agents && curl -fsSL https://raw.githubusercontent.com/event4u-app/agent-config/main/docs/wedge/production-validator/production-validator.md -o $AGENT_FILE" >&2
  exit 1
fi

# One aggregate line: date + outcome. No user, host, repo, or content data.
printf '%s wedge=production-validator first_run=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$OUTCOME" >> "$LOG_FILE"

echo "Recorded locally in $LOG_FILE (never leaves this machine)."
echo "Add it to .gitignore if you don't want it committed."
