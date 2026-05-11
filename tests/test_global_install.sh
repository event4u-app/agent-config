#!/usr/bin/env bash
# Smoke tests for `scripts/install --global` (Phase 3 of
# road-to-simplicity-and-everywhere, S16).
#
# Verifies:
#   - --global ships the kernel rules + curated skills under user-scope dirs
#     namespaced as event4u/.
#   - --tools scopes which surfaces receive files (claude-code, cursor,
#     windsurf), with a fallback ~/.config/agent-config/ that always fires.
#   - --uninstall removes only the event4u/ namespace dir, never user files.
#   - --uninstall without --global is rejected with a non-zero exit.
#
# Runs with HOME pointed at a throwaway directory so it cannot touch the
# real user home on a developer machine or CI runner.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL="$REPO_ROOT/scripts/install"
TMPDIR=""
PASS=0
FAIL=0

setup() {
    TMPDIR="$(mktemp -d -t global-install-smoke-XXXXXX)"
}

teardown() {
    [[ -n "$TMPDIR" && -d "$TMPDIR" ]] && rm -rf "$TMPDIR"
}

trap teardown EXIT

pass() { PASS=$((PASS + 1)); echo "  ✅  $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌  $1"; }

assert_dir_count_at_least() {
    local dir="$1" min="$2" label="$3"
    if [[ ! -d "$dir" ]]; then
        fail "$label — directory missing: $dir"
        return
    fi
    local n; n=$(find "$dir" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')
    if (( n >= min )); then
        pass "$label — $n entries (>= $min) under $(basename "$(dirname "$dir")")/$(basename "$dir")"
    else
        fail "$label — only $n entries under $dir (expected >= $min)"
    fi
}

assert_dir_absent() {
    local dir="$1" label="$2"
    if [[ ! -e "$dir" ]]; then
        pass "$label — $dir absent"
    else
        fail "$label — $dir still present"
    fi
}

# ---------------------------------------------------------------------------
# Test 1: install + uninstall via the bash orchestrator (multi-surface)
# ---------------------------------------------------------------------------
test_install_and_uninstall() {
    setup
    local home="$TMPDIR/home"
    mkdir -p "$home"

    echo ""
    echo "Test 1: install --global --tools=claude-code,cursor,windsurf"
    HOME="$home" bash "$INSTALL" --global \
        --tools=claude-code,cursor,windsurf --quiet
    local rc=$?
    if (( rc != 0 )); then
        fail "install --global exited $rc"
        teardown; return
    fi

    # Each surface gets its own rules + skills under event4u/.
    assert_dir_count_at_least "$home/.claude/rules/event4u"  9 \
        "claude-code rules"
    assert_dir_count_at_least "$home/.claude/skills/event4u" 1 \
        "claude-code skills"
    assert_dir_count_at_least "$home/.cursor/rules/imported/event4u/rules"  9 \
        "cursor rules"
    assert_dir_count_at_least "$home/.cursor/rules/imported/event4u/skills" 1 \
        "cursor skills"
    assert_dir_count_at_least \
        "$home/.codeium/windsurf/global_workflows/event4u/rules" 9 \
        "windsurf rules"

    # Fallback ~/.config/agent-config/ is always written.
    assert_dir_count_at_least \
        "$home/.config/agent-config/rules/event4u"  9 "fallback rules"
    assert_dir_count_at_least \
        "$home/.config/agent-config/skills/event4u" 1 "fallback skills"

    echo ""
    echo "Test 1: uninstall --global --tools=claude-code,cursor,windsurf"
    HOME="$home" bash "$INSTALL" --global --uninstall \
        --tools=claude-code,cursor,windsurf --quiet
    rc=$?
    if (( rc != 0 )); then
        fail "uninstall --global exited $rc"
        teardown; return
    fi

    assert_dir_absent "$home/.claude/rules/event4u"  "claude rules removed"
    assert_dir_absent "$home/.claude/skills/event4u" "claude skills removed"
    assert_dir_absent "$home/.cursor/rules/imported/event4u" \
        "cursor namespace removed"
    assert_dir_absent "$home/.codeium/windsurf/global_workflows/event4u" \
        "windsurf namespace removed"
    assert_dir_absent "$home/.config/agent-config/rules/event4u" \
        "fallback rules removed"

    teardown
}

# ---------------------------------------------------------------------------
# Test 2: --uninstall without --global is rejected
# ---------------------------------------------------------------------------
test_uninstall_requires_global() {
    setup
    local out
    echo ""
    echo "Test 2: --uninstall without --global must error out"
    out=$(HOME="$TMPDIR/home" bash "$INSTALL" --uninstall --quiet 2>&1)
    local rc=$?
    if (( rc != 0 )) && [[ "$out" == *"--uninstall is only valid"* ]]; then
        pass "rejected --uninstall standalone (rc=$rc)"
    else
        fail "expected non-zero exit + error message, got rc=$rc out=$out"
    fi
    teardown
}

main() {
    echo "=== scripts/install --global smoke tests ==="
    test_install_and_uninstall
    test_uninstall_requires_global

    echo ""
    echo "=== Results: $PASS passed, $FAIL failed ==="
    exit $(( FAIL == 0 ? 0 : 1 ))
}

main "$@"
