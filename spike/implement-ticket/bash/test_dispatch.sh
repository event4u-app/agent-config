#!/usr/bin/env bash
# Phase 0 spike — smoke for the Bash dispatcher.
#
# Compare-point: same assertions as the pytest version, but via shell.
# Measures test-writability for the Bash prototype. Throwaway.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPATCHER="$SCRIPT_DIR/implement-ticket.sh"
FIXTURES="$SCRIPT_DIR/../fixtures"

PASS=0
FAIL=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  ✅  $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌  $label"
    echo "       expected: $expected"
    echo "       actual:   $actual"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  ✅  $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌  $label (missing: $needle)"
    FAIL=$((FAIL + 1))
  fi
}

echo "## clean ticket → success, all 8 steps"
set +e
OUT=$("$DISPATCHER" "$FIXTURES/ticket-clean.yml" 2>&1)
RC=$?
set -e
assert_eq "exit code" "0" "$RC"
assert_contains "final SUCCESS" "Delivery report — SUCCESS" "$OUT"
for step in refine memory analyze plan implement test verify report; do
  assert_contains "step ran: $step" "\"$step\":\"success\"" "$OUT"
done

echo
echo "## ambiguous ticket → blocked at refine"
set +e
OUT=$("$DISPATCHER" "$FIXTURES/ticket-ambiguous.yml" 2>&1)
RC=$?
set -e
assert_eq "exit code blocked=10" "10" "$RC"
assert_contains "final BLOCKED" "Delivery report — BLOCKED" "$OUT"
assert_contains "blocked at refine" "blocked at: refine" "$OUT"
assert_contains "numbered Q1" "1. Define a measurable performance target" "$OUT"
# Halting: memory must NOT have been recorded.
if [[ "$OUT" == *"\"memory\":"* ]]; then
  echo "  ❌  halted after block (memory ran)"
  FAIL=$((FAIL + 1))
else
  echo "  ✅  halted after block"
  PASS=$((PASS + 1))
fi

echo
echo "─────────────"
echo "$PASS pass · $FAIL fail"
[[ "$FAIL" -eq 0 ]] || exit 1
