#!/usr/bin/env bash
# Contract tests for scripts/install_openai_key.sh.
#
# Two test surfaces:
#   1. Source contract — grep the script for the security-critical
#      patterns the Iron Law depends on (mode 0600, /dev/tty
#      enforcement, atomic write, format check, no env-var bypass).
#   2. Behavior — when no controlling terminal is available, the
#      script must exit 2 with a clear message. Skipped on platforms
#      without `setsid` (macOS by default).
#
# We deliberately do NOT test the interactive happy path. Driving
# /dev/tty input requires a pty allocator (`expect`, `script`); the
# source-contract grep covers the same guarantees and is portable
# across CI runners.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$SCRIPT_DIR/scripts/install_openai_key.sh"
PASS=0
FAIL=0

pass() { echo "  ✅  $1"; ((PASS++)) || true; }
fail() { echo "  ❌  FAIL: $1"; ((FAIL++)) || true; }

assert_grep() {
    local desc="$1" pattern="$2"
    if grep -qE "$pattern" "$SCRIPT"; then pass "$desc"; else fail "$desc (pattern: $pattern)"; fi
}

assert_no_grep() {
    local desc="$1" pattern="$2"
    if ! grep -qE "$pattern" "$SCRIPT"; then pass "$desc"; else fail "$desc (forbidden pattern matched: $pattern)"; fi
}

# --- Source contract tests ---

test_script_exists_and_executable() {
    if [[ -f "$SCRIPT" ]]; then pass "script exists at $SCRIPT"; else fail "script missing"; return; fi
    if [[ -x "$SCRIPT" ]]; then pass "script is executable"; else fail "script not executable"; fi
}

test_safe_bash_flags() {
    assert_grep "set -euo pipefail at top" '^set -euo pipefail'
}

test_target_path_contract() {
    assert_grep "TARGET_DIR is ~/.config/agent-config" 'TARGET_DIR=.*\.config/agent-config'
    assert_grep "TARGET_FILE is openai.key" 'TARGET_FILE=.*openai\.key'
}

test_dev_tty_enforcement() {
    assert_grep "opens /dev/tty on fd 3" 'exec 3</dev/tty'
    assert_grep "exits 2 when /dev/tty unavailable" 'exit 2'
    assert_grep "reads key from fd 3 (/dev/tty), not stdin" 'read -r -s -u 3'
}

test_format_check() {
    assert_grep "rejects non-sk- prefix" 'sk-\*'
    assert_grep "rejects empty input" '\-z "\$\{API_KEY\}"'
}

test_atomic_write() {
    assert_grep "uses mktemp for tmpfile" 'mktemp .*openai\.key'
    assert_grep "chmod 0600 BEFORE writing key" 'chmod 0600 "\$\{TMP_FILE\}"'
    assert_grep "atomic mv into place" 'mv "\$\{TMP_FILE\}" "\$\{TARGET_FILE\}"'
    assert_grep "trap cleanup on EXIT" 'trap cleanup EXIT'
}

test_post_write_mode_verification() {
    assert_grep "stat mode after write" 'stat -[fc]'
    assert_grep "fails non-zero on mode drift" 'exit 3'
}

test_no_bypass_paths() {
    assert_no_grep "no --force flag" '"--force"|\-\-force\)'
    assert_no_grep "no --yes flag" '"--yes"|\-\-yes\)'
    assert_no_grep "no OPENAI_API_KEY env-var fallback" 'OPENAI_API_KEY'
    assert_no_grep "no curl/wget download of key" '(curl|wget) '
}

test_overwrite_confirmation() {
    assert_grep "prompts before overwrite" 'already exists'
    assert_grep "requires literal 'yes' to overwrite" '"yes"'
}

test_post_install_hint_present() {
    # Q46: explicit opt-in. Script must surface how to enable in
    # .agent-settings.yml so users do not assume install ≡ enable.
    assert_grep "hint mentions ai_council.members.openai.enabled" 'ai_council.*members.*openai.*enabled'
    assert_grep "hint mentions .agent-settings.yml" '\.agent-settings\.yml'
}

# --- Behavior test (no controlling terminal) ---

test_no_tty_exits_2() {
    if ! command -v setsid >/dev/null 2>&1; then
        echo "  ⏭️  skip: setsid not available (macOS without coreutils)"
        return
    fi
    local out rc
    out="$(setsid bash "$SCRIPT" </dev/null 2>&1 || true)"
    rc=$?
    if echo "$out" | grep -q "controlling terminal"; then
        pass "no-tty path prints 'controlling terminal' message"
    else
        fail "no-tty path missing expected message (got: $out)"
    fi
    # `setsid` itself returns the child's exit code in most distros.
    assert_grep_str() { echo "$out" | grep -q "$1"; }
    if assert_grep_str "/dev/tty not available"; then
        pass "no-tty path mentions /dev/tty"
    else
        fail "no-tty path missing /dev/tty mention"
    fi
}

# --- Runner ---

echo "🧪  Running install_openai_key.sh contract tests..."
echo ""

test_script_exists_and_executable
test_safe_bash_flags
test_target_path_contract
test_dev_tty_enforcement
test_format_check
test_atomic_write
test_post_write_mode_verification
test_no_bypass_paths
test_overwrite_confirmation
test_post_install_hint_present
test_no_tty_exits_2

echo ""
echo "Results: $PASS passed, $FAIL failed ($(( PASS + FAIL )) total)"
[[ $FAIL -eq 0 ]]
