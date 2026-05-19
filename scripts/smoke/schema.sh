#!/usr/bin/env bash
# scripts/smoke/schema.sh — schema-tier smoke (step-11 Phase 3 Step 4).
#
# Runs scripts/skill_linter.py --all over every lintable artefact and
# asserts:
#   1. 0 schema FAILs (hard).
#   2. Warns ≤ EXPECTED_WARNS (regression lock).
#   3. Total ≥ EXPECTED_MIN_TOTAL (catches accidental skill deletion).
#
# v2 schema (step-5) fields are deferred — when step-5 Phase 1 closes,
# this smoke gains a `model_tier` presence check; Phase 3 adds
# `schema_version: "2"`. See docs/contracts/smoke-contracts.md § 3.3.
#
# Runtime ceiling: 30 s.
# Output: table by default, baseline line on stdout last; SMOKE_QUIET=1
# suppresses the table.
# Contract: docs/contracts/smoke-contracts.md § 3.3

set -euo pipefail

EXPECTED_WARNS=93
EXPECTED_MIN_TOTAL=438

quiet="${SMOKE_QUIET:-0}"
log() { [ "$quiet" = "1" ] || printf '%s\n' "$*"; }

# Run the linter and capture summary
out=$(python3 scripts/skill_linter.py --all --quiet 2>&1 || true)
summary=$(printf '%s\n' "$out" | grep -E '^Summary: ' | tail -1)

if [ -z "$summary" ]; then
  echo "❌ skill_linter.py produced no summary line"
  printf '%s\n' "$out" | tail -5
  exit 1
fi

# Parse: "Summary: 346 pass, 92 warn, 0 fail, 438 total"
pass=$(echo "$summary" | sed -E 's/.*Summary: ([0-9]+) pass.*/\1/')
warn=$(echo "$summary" | sed -E 's/.*, ([0-9]+) warn.*/\1/')
fail=$(echo "$summary" | sed -E 's/.*, ([0-9]+) fail.*/\1/')
total=$(echo "$summary" | sed -E 's/.*, ([0-9]+) total.*/\1/')

log "## Schema smoke"
log ""
log "| Check | Value |"
log "|---|---:|"
log "| Total artefacts | $total (≥ $EXPECTED_MIN_TOTAL) |"
log "| Pass | $pass |"
log "| Warn | $warn (locked ≤ $EXPECTED_WARNS) |"
log "| Fail | $fail (hard 0) |"
log "| v2 schema enforcement | deferred (see step-5-schema-rigor.md) |"

exit_code=0
if [ "$fail" -gt 0 ]; then
  echo "❌ schema FAILs: $fail (must be 0)"
  printf '%s\n' "$out" | grep -E '^\[FAIL\]' | head -10 || true
  exit_code=1
fi
if [ "$warn" -gt "$EXPECTED_WARNS" ]; then
  echo "❌ schema warns: $warn > $EXPECTED_WARNS (regression)"
  exit_code=1
fi
if [ "$total" -lt "$EXPECTED_MIN_TOTAL" ]; then
  echo "❌ artefact total $total < $EXPECTED_MIN_TOTAL (unexpected deletion?)"
  exit_code=1
fi

log ""
echo "BASELINE: $total lintable artefacts · $fail schema FAIL(s) · $warn warn(s)"

exit $exit_code
