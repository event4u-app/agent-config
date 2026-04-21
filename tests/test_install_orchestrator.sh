#!/usr/bin/env bash
# Integration tests for scripts/install — the orchestrator that chains
# scripts/install.sh (payload sync) and scripts/install.py (bridges).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL="$SCRIPT_DIR/scripts/install"
INSTALL_PHP="$SCRIPT_DIR/bin/install.php"
POSTINSTALL="$SCRIPT_DIR/scripts/postinstall.sh"
TMPDIR=""
PASS=0
FAIL=0

setup() {
    TMPDIR="$(mktemp -d)"
    touch "$TMPDIR/.gitignore"
}

teardown() {
    [[ -n "$TMPDIR" ]] && rm -rf "$TMPDIR"
}

pass() { echo "  ✅  $1"; ((PASS++)) || true; }
fail() { echo "  ❌  FAIL: $1"; ((FAIL++)) || true; }

assert_true() {
    local desc="$1"; shift
    if "$@" 2>/dev/null; then pass "$desc"; else fail "$desc"; fi
}

assert_false() {
    local desc="$1"; shift
    if ! "$@" 2>/dev/null; then pass "$desc"; else fail "$desc (expected false)"; fi
}

# --- Tests ---

test_full_run_creates_payload_and_bridges() {
    setup
    bash "$INSTALL" --target "$TMPDIR" --quiet
    assert_true "exit 0 on full run" test $? -eq 0
    assert_true "payload: .augment/rules/php-coding.md exists" test -f "$TMPDIR/.augment/rules/php-coding.md"
    assert_true "payload: .augment/skills/ has symlinks" test -L "$TMPDIR/.augment/skills/php-coder/SKILL.md"
    assert_true "payload: .windsurfrules generated" test -f "$TMPDIR/.windsurfrules"
    assert_true "payload: GEMINI.md symlink" test -L "$TMPDIR/GEMINI.md"
    assert_true "bridges: .agent-settings rendered" test -f "$TMPDIR/.agent-settings"
    assert_true "bridges: .vscode/settings.json created" test -f "$TMPDIR/.vscode/settings.json"
    assert_true "bridges: .augment/settings.json created" test -f "$TMPDIR/.augment/settings.json"
    teardown
}

test_skip_sync_runs_bridges_only() {
    setup
    bash "$INSTALL" --target "$TMPDIR" --skip-sync --quiet
    assert_true "exit 0 with --skip-sync" test $? -eq 0
    assert_false "payload skipped: no .augment/rules/" test -d "$TMPDIR/.augment/rules"
    assert_true "bridges still ran: .agent-settings exists" test -f "$TMPDIR/.agent-settings"
    teardown
}

test_skip_bridges_runs_sync_only() {
    setup
    bash "$INSTALL" --target "$TMPDIR" --skip-bridges --quiet
    assert_true "exit 0 with --skip-bridges" test $? -eq 0
    assert_true "payload ran: rules copied" test -f "$TMPDIR/.augment/rules/php-coding.md"
    assert_false "bridges skipped: no .agent-settings" test -f "$TMPDIR/.agent-settings"
    assert_false "bridges skipped: no .vscode/settings.json" test -f "$TMPDIR/.vscode/settings.json"
    teardown
}

test_dry_run_creates_no_files() {
    setup
    bash "$INSTALL" --target "$TMPDIR" --dry-run --quiet
    local file_count
    file_count="$(find "$TMPDIR" -type f ! -name ".gitignore" 2>/dev/null | wc -l | tr -d ' ')"
    assert_true "no files after --dry-run (found $file_count)" test "$file_count" -eq 0
    teardown
}

test_profile_forwarded_to_bridges() {
    setup
    bash "$INSTALL" --target "$TMPDIR" --profile=balanced --quiet
    assert_true "profile=balanced written to .agent-settings" \
        grep -q "^cost_profile=balanced" "$TMPDIR/.agent-settings"
    teardown
}

test_subagent_keys_seeded() {
    setup
    bash "$INSTALL" --target "$TMPDIR" --quiet
    assert_true "subagent_implementer_model seeded" \
        grep -q "^subagent_implementer_model=" "$TMPDIR/.agent-settings"
    assert_true "subagent_judge_model seeded" \
        grep -q "^subagent_judge_model=" "$TMPDIR/.agent-settings"
    assert_true "subagent_max_parallel=3 seeded" \
        grep -q "^subagent_max_parallel=3" "$TMPDIR/.agent-settings"
    teardown
}

test_idempotent() {
    setup
    bash "$INSTALL" --target "$TMPDIR" --quiet
    bash "$INSTALL" --target "$TMPDIR" --quiet
    assert_true "second run exits 0 (idempotent)" test $? -eq 0
    assert_true "rules still present" test -f "$TMPDIR/.augment/rules/php-coding.md"
    assert_true ".agent-settings still present" test -f "$TMPDIR/.agent-settings"
    teardown
}

test_help_flag() {
    local out
    out="$(bash "$INSTALL" --help 2>&1)"
    if echo "$out" | grep -q "Primary entry\|orchestrates\|install.sh\|install.py\|Orchestrates"; then
        pass "--help describes orchestrator"
    else
        fail "--help output missing orchestrator context"
    fi
}

test_unknown_flag_errors() {
    local rc
    bash "$INSTALL" --nonsense-flag-xyz --quiet >/dev/null 2>&1
    rc=$?
    assert_true "unknown flag exits non-zero (exit=$rc)" test $rc -ne 0
}

test_bin_install_php_routes_through_orchestrator() {
    [[ -f "$INSTALL_PHP" ]] || { echo "  ⏭️  skip: bin/install.php missing"; return; }
    command -v php >/dev/null 2>&1 || { echo "  ⏭️  skip: php not available"; return; }
    setup
    php "$INSTALL_PHP" --target "$TMPDIR" --quiet >/dev/null 2>&1
    local rc=$?
    assert_true "bin/install.php exit 0" test $rc -eq 0
    assert_true "bin/install.php: payload synced" test -f "$TMPDIR/.augment/rules/php-coding.md"
    assert_true "bin/install.php: bridges rendered" test -f "$TMPDIR/.agent-settings"
    teardown
}

test_postinstall_exits_zero_even_on_failure() {
    # Build a fake scripts dir with a broken orchestrator, invoke postinstall.sh,
    # confirm it prints the loud block and exits 0.
    local fake
    fake="$(mktemp -d)"
    cp "$POSTINSTALL" "$fake/postinstall.sh"
    printf '#!/usr/bin/env bash\necho "boom" >&2\nexit 1\n' > "$fake/install"
    chmod +x "$fake/install"
    local out rc
    out="$(bash "$fake/postinstall.sh" 2>&1)"
    rc=$?
    assert_true "postinstall exit 0 even on failure (got $rc)" test $rc -eq 0
    if echo "$out" | grep -q "postinstall failed"; then
        pass "postinstall prints loud failure block"
    else
        fail "postinstall missing loud failure block"
    fi
    rm -rf "$fake"
}

# --- Runner ---
echo "🧪  Running scripts/install orchestrator tests..."
echo ""

test_full_run_creates_payload_and_bridges
test_skip_sync_runs_bridges_only
test_skip_bridges_runs_sync_only
test_dry_run_creates_no_files
test_profile_forwarded_to_bridges
test_subagent_keys_seeded
test_idempotent
test_help_flag
test_unknown_flag_errors
test_bin_install_php_routes_through_orchestrator
test_postinstall_exits_zero_even_on_failure

echo ""
echo "Results: $PASS passed, $FAIL failed ($(( PASS + FAIL )) total)"
[[ $FAIL -eq 0 ]]
