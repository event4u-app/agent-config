#!/usr/bin/env bash
# Mock `refine` step — blocks on empty acceptance criteria.
# Exit codes: 0 success, 10 blocked, 20 partial.
set -euo pipefail
STATE="$1"

AC_COUNT=$(jq '.ticket.acceptance_criteria | length' "$STATE")

if [[ "$AC_COUNT" -eq 0 ]]; then
  jq '.questions = [
    "1. Define a measurable performance target (e.g. P95 < 2s).",
    "2. Define a maximum dataset size or row count.",
    "3. Skip the optimisation — the ticket is too vague to execute."
  ]' "$STATE" > "$STATE.tmp"
  mv "$STATE.tmp" "$STATE"
  exit 10
fi

exit 0
