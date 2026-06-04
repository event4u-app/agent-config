#!/usr/bin/env bash
# Fixture-driven tests for scripts/recruit_preflight.sh.
#
# Phase B Step 2 of road-to-adoption-proof-and-ci-green.md. Drives the
# preflight script against a controlled env so the five checks each
# pass and fail at least once. The harness uses bash `set -u`-safe
# constructs only — no jq / yq.
#
# Run: bash tests/test_recruit_preflight.sh
# Exit: 0 on all-pass, non-zero on any failure.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/src/scripts/recruit_preflight.sh"
TESTS_RUN=0
TESTS_FAIL=0

_pass() { TESTS_RUN=$((TESTS_RUN + 1)); echo "  ✅  $1"; }
_fail() { TESTS_RUN=$((TESTS_RUN + 1)); TESTS_FAIL=$((TESTS_FAIL + 1)); echo "  ❌  $1"; }

_assert_exit() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [ "$expected" = "$actual" ]; then
    _pass "$label (exit $actual)"
  else
    _fail "$label — expected exit=$expected, got $actual"
  fi
}

# Sandbox env vars that the script reads.
unset ANTHROPIC_API_KEY OPENAI_API_KEY AGENT_CONFIG_DRYRUN || true

# Test 1: no provider keys, no dry-run → fails.
echo "Test 1: no provider keys, no dry-run flag"
set +e
OUTPUT=$(env -i HOME="$HOME" PATH="$PATH" bash "$SCRIPT" --quiet 2>&1)
EXIT=$?
set -e
_assert_exit 1 "$EXIT" "exits non-zero without provider keys"

# Test 2: dry-run with the flag → passes.
echo "Test 2: dry-run accepted via flag"
set +e
OUTPUT=$(env -i HOME="$HOME" PATH="$PATH" AGENT_CONFIG_DRYRUN=true \
  bash "$SCRIPT" --quiet --dry-run-allowed 2>&1)
EXIT=$?
set -e
_assert_exit 0 "$EXIT" "exits zero with --dry-run-allowed + DRYRUN=true"

# Test 3: ANTHROPIC_API_KEY set → passes the provider-key check.
echo "Test 3: ANTHROPIC_API_KEY satisfies provider keys"
set +e
OUTPUT=$(env -i HOME="$HOME" PATH="$PATH" ANTHROPIC_API_KEY=test-key \
  bash "$SCRIPT" --quiet 2>&1)
EXIT=$?
set -e
_assert_exit 0 "$EXIT" "exits zero with ANTHROPIC_API_KEY set"
if echo "$OUTPUT" | grep -q "1 fail"; then
  _fail "unexpected failure row in OUTPUT (Test 3)"
else
  _pass "no failure rows surfaced (Test 3)"
fi

# Test 4: OPENAI_API_KEY set → passes the provider-key check.
echo "Test 4: OPENAI_API_KEY satisfies provider keys"
set +e
OUTPUT=$(env -i HOME="$HOME" PATH="$PATH" OPENAI_API_KEY=test-key \
  bash "$SCRIPT" --quiet 2>&1)
EXIT=$?
set -e
_assert_exit 0 "$EXIT" "exits zero with OPENAI_API_KEY set"

# Test 5: dry-run flag missing but DRYRUN env set → still fails
echo "Test 5: AGENT_CONFIG_DRYRUN alone does not accept (needs --dry-run-allowed)"
set +e
OUTPUT=$(env -i HOME="$HOME" PATH="$PATH" AGENT_CONFIG_DRYRUN=true \
  bash "$SCRIPT" --quiet 2>&1)
EXIT=$?
set -e
_assert_exit 1 "$EXIT" "exits non-zero when --dry-run-allowed is not passed"

# Test 6: --help exits zero and prints usage.
echo "Test 6: --help"
set +e
OUTPUT=$(bash "$SCRIPT" --help 2>&1)
EXIT=$?
set -e
_assert_exit 0 "$EXIT" "--help exits zero"
if echo "$OUTPUT" | grep -q "Recruit-session day-of pre-flight"; then
  _pass "--help prints usage line"
else
  _fail "--help did not print usage line"
fi

# Test 7: --quiet suppresses per-check rows.
echo "Test 7: --quiet output discipline"
set +e
OUTPUT=$(env -i HOME="$HOME" PATH="$PATH" ANTHROPIC_API_KEY=test-key \
  bash "$SCRIPT" --quiet 2>&1)
EXIT=$?
set -e
LINE_COUNT=$(echo "$OUTPUT" | wc -l | tr -d ' ')
if [ "$LINE_COUNT" = "1" ]; then
  _pass "--quiet emits exactly one summary line"
else
  _fail "--quiet emitted $LINE_COUNT lines (expected 1)"
fi

# Test 8: unknown arg → exits 2.
echo "Test 8: unknown arg rejected"
set +e
OUTPUT=$(bash "$SCRIPT" --bogus 2>&1)
EXIT=$?
set -e
_assert_exit 2 "$EXIT" "unknown arg exits 2"

echo ""
echo "test_recruit_preflight: ${TESTS_RUN} run / ${TESTS_FAIL} fail"
if [ "$TESTS_FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
