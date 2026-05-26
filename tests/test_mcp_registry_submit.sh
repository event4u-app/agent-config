#!/usr/bin/env bash
# Fixture-driven tests for scripts/mcp_registry_submit.sh.
#
# Phase C Step 1 of road-to-adoption-proof-and-ci-green.md. Exercises
# the --dry-run path so no network call leaves the sandbox. Covers:
#
#   1. --help exits zero with usage text.
#   2. --dry-run validates the submission template and prints the plan.
#   3. --dry-run with --registry / --branch / --workdir overrides honoured.
#   4. Unknown arg exits 2.
#   5. Missing registries.md surfaces a clear error.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/mcp_registry_submit.sh"
TESTS_RUN=0
TESTS_FAIL=0

_pass() { TESTS_RUN=$((TESTS_RUN + 1)); echo "  ✅  $1"; }
_fail() { TESTS_RUN=$((TESTS_RUN + 1)); TESTS_FAIL=$((TESTS_FAIL + 1)); echo "  ❌  $1"; }

# 1. --help
echo "Test 1: --help"
set +e
OUTPUT=$(bash "$SCRIPT" --help 2>&1)
EXIT=$?
set -e
if [ "$EXIT" = "0" ]; then _pass "--help exits zero"; else _fail "--help exit=$EXIT"; fi
if echo "$OUTPUT" | grep -q "Interactive MCP registry submission helper"; then
  _pass "--help prints usage line"
else
  _fail "--help did not print usage"
fi

# 2. --dry-run on the live repo (registries.md is present).
echo "Test 2: --dry-run validates and prints the plan"
set +e
OUTPUT=$(bash "$SCRIPT" --dry-run 2>&1)
EXIT=$?
set -e
if [ "$EXIT" = "0" ]; then _pass "--dry-run exits zero"; else _fail "--dry-run exit=$EXIT"; fi
if echo "$OUTPUT" | grep -q "DRY-RUN"; then
  _pass "--dry-run prints DRY-RUN banner"
else
  _fail "--dry-run did not print DRY-RUN banner"
fi
if echo "$OUTPUT" | grep -q "event4u/agent-config"; then
  _pass "--dry-run surfaces the submission template entry"
else
  _fail "--dry-run did not surface the entry"
fi

# 3. --dry-run with overrides honoured.
echo "Test 3: overrides --registry / --branch / --workdir"
set +e
OUTPUT=$(bash "$SCRIPT" \
  --dry-run \
  --registry "test-org/test-registry" \
  --branch "test-branch-xyz" \
  --workdir "/tmp/test-workdir" 2>&1)
EXIT=$?
set -e
if [ "$EXIT" = "0" ]; then _pass "overrides exits zero"; else _fail "overrides exit=$EXIT"; fi
if echo "$OUTPUT" | grep -q "registry   : test-org/test-registry"; then
  _pass "--registry override honoured"
else
  _fail "--registry override not surfaced"
fi
if echo "$OUTPUT" | grep -q "branch     : test-branch-xyz"; then
  _pass "--branch override honoured"
else
  _fail "--branch override not surfaced"
fi

# 4. Unknown arg exits 2.
echo "Test 4: unknown arg rejected"
set +e
OUTPUT=$(bash "$SCRIPT" --bogus 2>&1)
EXIT=$?
set -e
if [ "$EXIT" = "2" ]; then _pass "unknown arg exits 2"; else _fail "unknown arg exit=$EXIT"; fi

# 5. Missing registries.md surfaces a clear error.
echo "Test 5: missing registries.md path"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/mcp-submit-fixture-XXXX")
# Copy the script into the fixture root; the script resolves its own
# REPO_ROOT relative to its location, so we mirror the layout
# (script under <fixture>/scripts/, no docs/distribution/ tree).
mkdir -p "$TMP/scripts"
cp "$SCRIPT" "$TMP/scripts/mcp_registry_submit.sh"
chmod +x "$TMP/scripts/mcp_registry_submit.sh"
set +e
OUTPUT=$(bash "$TMP/scripts/mcp_registry_submit.sh" --dry-run 2>&1)
EXIT=$?
set -e
if [ "$EXIT" = "3" ]; then _pass "missing registries.md exits 3"; else _fail "missing registries.md exit=$EXIT"; fi
rm -rf "$TMP"

echo ""
echo "test_mcp_registry_submit: ${TESTS_RUN} run / ${TESTS_FAIL} fail"
if [ "$TESTS_FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
