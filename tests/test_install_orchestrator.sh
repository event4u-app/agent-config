#!/usr/bin/env bash
# Integration tests for scripts/install — the orchestrator that chains
# scripts/install.sh (payload sync) and scripts/install.py (bridges).
#
# ADR-020 makes `--scope=project` maintainer-only; these tests exercise
# the project-scoped flow on purpose (temp-dir payload + bridges), so
# the dev-mode gate is opted in once at the script level. Mirrors the
# precedent set by smoke-quickstart in .github/workflows/tests.yml.
set -uo pipefail
export AGENT_CONFIG_DEV_MODE=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL="$SCRIPT_DIR/src/scripts/install"
INSTALL_PHP="$SCRIPT_DIR/bin/install.php"
TEST_TARGET=""
PASS=0
FAIL=0

setup() {
    TEST_TARGET="$(mktemp -d)"
    touch "$TEST_TARGET/.gitignore"
}

teardown() {
    [[ -n "$TEST_TARGET" ]] && rm -rf "$TEST_TARGET"
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
    bash "$INSTALL" --target "$TEST_TARGET" --quiet
    assert_true "exit 0 on full run" test $? -eq 0
    assert_true "payload: .augment/rules/php-coding.md exists" test -f "$TEST_TARGET/.augment/rules/php-coding.md"
    assert_true "payload: .augment/skills/ has symlinks" test -L "$TEST_TARGET/.augment/skills/php-coder/SKILL.md"
    assert_true "payload: .windsurfrules generated" test -f "$TEST_TARGET/.windsurfrules"
    assert_true "payload: GEMINI.md symlink" test -L "$TEST_TARGET/GEMINI.md"
    assert_true "bridges: .agent-settings.yml rendered" test -f "$TEST_TARGET/agents/settings/.agent-settings.yml"
    assert_true "bridges: .vscode/settings.json created" test -f "$TEST_TARGET/.vscode/settings.json"
    assert_true "bridges: .augment/settings.json created" test -f "$TEST_TARGET/.augment/settings.json"
    teardown
}

test_skip_sync_runs_bridges_only() {
    setup
    bash "$INSTALL" --target "$TEST_TARGET" --skip-sync --quiet
    assert_true "exit 0 with --skip-sync" test $? -eq 0
    assert_false "payload skipped: no .augment/rules/" test -d "$TEST_TARGET/.augment/rules"
    assert_true "bridges still ran: .agent-settings.yml exists" test -f "$TEST_TARGET/agents/settings/.agent-settings.yml"
    teardown
}

test_skip_bridges_runs_sync_only() {
    setup
    bash "$INSTALL" --target "$TEST_TARGET" --skip-bridges --quiet
    assert_true "exit 0 with --skip-bridges" test $? -eq 0
    assert_true "payload ran: rules copied" test -f "$TEST_TARGET/.augment/rules/php-coding.md"
    assert_false "bridges skipped: no .agent-settings.yml" test -f "$TEST_TARGET/agents/settings/.agent-settings.yml"
    assert_false "bridges skipped: no .vscode/settings.json" test -f "$TEST_TARGET/.vscode/settings.json"
    teardown
}

test_dry_run_creates_no_files() {
    setup
    bash "$INSTALL" --target "$TEST_TARGET" --dry-run --quiet
    local file_count leaked
    file_count="$(find "$TEST_TARGET" -type f ! -name ".gitignore" 2>/dev/null | wc -l | tr -d ' ')"
    leaked="$(find "$TEST_TARGET" -type f ! -name ".gitignore" 2>/dev/null | sed "s|$TEST_TARGET/|<target>/|" | tr '\n' ' ')"
    assert_true "no files after --dry-run (found $file_count: $leaked)" test "$file_count" -eq 0
    teardown
}

test_profile_forwarded_to_bridges() {
    setup
    bash "$INSTALL" --target "$TEST_TARGET" --profile=balanced --quiet
    assert_true "profile=balanced written to .agent-settings.yml" \
        grep -q "^rule_loading_tier: balanced" "$TEST_TARGET/agents/settings/.agent-settings.yml"
    teardown
}

test_subagent_keys_seeded() {
    # After the YAML migration, subagent keys are nested under the
    # `subagents:` block. Match the indented child keys (two-space
    # indent, unambiguous inside the template).
    setup
    bash "$INSTALL" --target "$TEST_TARGET" --quiet
    assert_true "subagents.implementer_model seeded" \
        grep -q "^  implementer_model:" "$TEST_TARGET/agents/settings/.agent-settings.yml"
    assert_true "subagents.judge_model seeded" \
        grep -q "^  judge_model:" "$TEST_TARGET/agents/settings/.agent-settings.yml"
    assert_true "subagents.max_parallel: 3 seeded" \
        grep -q "^  max_parallel: 3" "$TEST_TARGET/agents/settings/.agent-settings.yml"
    teardown
}

test_idempotent() {
    setup
    bash "$INSTALL" --target "$TEST_TARGET" --quiet
    bash "$INSTALL" --target "$TEST_TARGET" --quiet
    assert_true "second run exits 0 (idempotent)" test $? -eq 0
    assert_true "rules still present" test -f "$TEST_TARGET/.augment/rules/php-coding.md"
    assert_true ".agent-settings.yml still present" test -f "$TEST_TARGET/agents/settings/.agent-settings.yml"
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
    php "$INSTALL_PHP" --target "$TEST_TARGET" --quiet >/dev/null 2>&1
    local rc=$?
    assert_true "bin/install.php exit 0" test $rc -eq 0
    assert_true "bin/install.php: payload synced" test -f "$TEST_TARGET/.augment/rules/php-coding.md"
    assert_true "bin/install.php: bridges rendered" test -f "$TEST_TARGET/agents/settings/.agent-settings.yml"
    teardown
}

# --- Phase 1 (--tools selector) ---

test_list_tools_prints_catalog() {
    local out
    out="$(bash "$INSTALL" --list-tools 2>&1)"
    if echo "$out" | grep -q "claude-code" && \
       echo "$out" | grep -q "cursor" && \
       echo "$out" | grep -q "windsurf" && \
       echo "$out" | grep -q "all"; then
        pass "--list-tools prints catalog with known IDs"
    else
        fail "--list-tools missing catalog entries"
    fi
}

test_unknown_tool_id_rejected() {
    local rc
    bash "$INSTALL" --target "$(mktemp -d)" --tools=not-a-tool --quiet >/dev/null 2>&1
    rc=$?
    assert_true "unknown --tools ID exits non-zero (rc=$rc)" test $rc -ne 0
}

test_empty_tools_value_rejected() {
    local rc
    bash "$INSTALL" --target "$(mktemp -d)" --tools= --quiet >/dev/null 2>&1
    rc=$?
    assert_true "--tools= (empty) exits non-zero (rc=$rc)" test $rc -ne 0
}

test_tools_cursor_only_excludes_claude_and_windsurf() {
    setup
    bash "$INSTALL" --target "$TEST_TARGET" --tools=cursor --quiet
    assert_true "cursor: .cursor/rules populated" test -d "$TEST_TARGET/.cursor/rules"
    assert_false "cursor: no .claude/rules" test -d "$TEST_TARGET/.claude/rules"
    assert_false "cursor: no .clinerules" test -d "$TEST_TARGET/.clinerules"
    assert_false "cursor: no .windsurfrules" test -f "$TEST_TARGET/.windsurfrules"
    assert_false "cursor: no GEMINI.md" test -e "$TEST_TARGET/GEMINI.md"
    assert_false "cursor: no .github/copilot-instructions.md" test -f "$TEST_TARGET/.github/copilot-instructions.md"
    # Substrate is always written.
    assert_true "cursor: .augment/ substrate present" test -d "$TEST_TARGET/.augment/rules"
    assert_true "cursor: AGENTS.md universal contract present" test -f "$TEST_TARGET/AGENTS.md"
    teardown
}

test_tools_claude_code_only_excludes_others() {
    setup
    bash "$INSTALL" --target "$TEST_TARGET" --tools=claude-code --quiet
    assert_true "claude-code: .claude/rules populated" test -d "$TEST_TARGET/.claude/rules"
    assert_true "claude-code: .claude/skills populated" test -d "$TEST_TARGET/.claude/skills"
    assert_false "claude-code: no .cursor/rules" test -d "$TEST_TARGET/.cursor/rules"
    assert_false "claude-code: no .clinerules" test -d "$TEST_TARGET/.clinerules"
    assert_false "claude-code: no .windsurfrules" test -f "$TEST_TARGET/.windsurfrules"
    assert_false "claude-code: no GEMINI.md" test -e "$TEST_TARGET/GEMINI.md"
    teardown
}

test_tools_all_matches_default() {
    setup
    bash "$INSTALL" --target "$TEST_TARGET" --tools=all --quiet
    assert_true "tools=all: .claude/rules" test -d "$TEST_TARGET/.claude/rules"
    assert_true "tools=all: .cursor/rules" test -d "$TEST_TARGET/.cursor/rules"
    assert_true "tools=all: .clinerules" test -d "$TEST_TARGET/.clinerules"
    assert_true "tools=all: .windsurfrules" test -f "$TEST_TARGET/.windsurfrules"
    assert_true "tools=all: GEMINI.md" test -L "$TEST_TARGET/GEMINI.md"
    assert_true "tools=all: .github/copilot-instructions.md" test -f "$TEST_TARGET/.github/copilot-instructions.md"
    teardown
}

test_tools_combination_cursor_plus_windsurf() {
    setup
    bash "$INSTALL" --target "$TEST_TARGET" --tools=cursor,windsurf --quiet
    assert_true "combo: .cursor/rules" test -d "$TEST_TARGET/.cursor/rules"
    assert_true "combo: .windsurfrules" test -f "$TEST_TARGET/.windsurfrules"
    assert_false "combo: no .claude/rules" test -d "$TEST_TARGET/.claude/rules"
    assert_false "combo: no .clinerules" test -d "$TEST_TARGET/.clinerules"
    teardown
}

# Source-repo guard — defense-in-depth so a project install into the
# agent-config dev tree itself cannot corrupt .augment/ symlinks. The guard
# is skipped for --global because user-scope installs never touch the source
# tree, and bypassable via AGENT_CONFIG_ALLOW_SELF_INSTALL=1 for self-tests.
test_source_repo_guard_blocks_project_install() {
    setup
    mkdir -p "$TEST_TARGET/.agent-src.uncondensed"
    local out exit_code
    out="$(bash "$INSTALL" --target "$TEST_TARGET" --quiet 2>&1)"; exit_code=$?
    assert_true "guard: exit 2 on project install into source tree" test "$exit_code" -eq 2
    assert_true "guard: 'Refusing' message printed" grep -q "Refusing to install agent-config" <<<"$out"
    assert_false "guard: no .augment/ created in source tree" test -d "$TEST_TARGET/.augment"
    teardown
}

test_source_repo_guard_allows_global_install() {
    setup
    mkdir -p "$TEST_TARGET/.agent-src.uncondensed"
    # Sandbox HOME so user-scope deploys (~/.claude/, ~/.cursor/, …) land
    # under TEST_TARGET instead of the developer's real config dirs. Mirrors
    # the `isolated_lock` fixture in tests/test_installed_lock.py.
    mkdir -p "$TEST_TARGET/home"
    local out exit_code
    out="$(AGENT_CONFIG_INSTALLED_LOCK="$TEST_TARGET/installed.lock" \
        HOME="$TEST_TARGET/home" \
        USERPROFILE="$TEST_TARGET/home" \
        EVENT4U_CONFIG_HOME="$TEST_TARGET/home/.event4u/agent-config" \
        bash "$INSTALL" --target "$TEST_TARGET" --global --tools=claude-code --quiet 2>&1)"; exit_code=$?
    assert_true "guard: exit 0 on --global into source tree" test "$exit_code" -eq 0
    assert_false "guard: no 'Refusing' message on --global" grep -q "Refusing to install agent-config" <<<"$out"
    assert_true "guard: lockfile written to redirected path" test -f "$TEST_TARGET/installed.lock"
    teardown
}

test_source_repo_guard_override_env_bypasses() {
    setup
    mkdir -p "$TEST_TARGET/.agent-src.uncondensed"
    local out exit_code
    out="$(AGENT_CONFIG_ALLOW_SELF_INSTALL=1 \
        bash "$INSTALL" --target "$TEST_TARGET" --quiet 2>&1)"; exit_code=$?
    assert_true "guard: exit 0 with AGENT_CONFIG_ALLOW_SELF_INSTALL=1" test "$exit_code" -eq 0
    assert_false "guard: no 'Refusing' message with override" grep -q "Refusing to install agent-config" <<<"$out"
    teardown
}

test_source_repo_guard_package_json_marker() {
    setup
    # No .agent-src.uncondensed/, but package.json declares the source name.
    cat >"$TEST_TARGET/package.json" <<'JSON'
{ "name": "@event4u/agent-config", "version": "0.0.0" }
JSON
    local out exit_code
    out="$(bash "$INSTALL" --target "$TEST_TARGET" --quiet 2>&1)"; exit_code=$?
    assert_true "guard: exit 2 on package.json name marker" test "$exit_code" -eq 2
    assert_true "guard: 'package.json::name' in detected reason" grep -q 'package.json::name' <<<"$out"
    teardown
}

# --- Runner ---
TESTS=(
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
    test_list_tools_prints_catalog
    test_unknown_tool_id_rejected
    test_empty_tools_value_rejected
    test_tools_cursor_only_excludes_claude_and_windsurf
    test_tools_claude_code_only_excludes_others
    test_tools_all_matches_default
    test_tools_combination_cursor_plus_windsurf
    test_source_repo_guard_blocks_project_install
    test_source_repo_guard_allows_global_install
    test_source_repo_guard_override_env_bypasses
    test_source_repo_guard_package_json_marker
)

# SHARD=N/M env var: keep only Nth slice of M (1-indexed) before dispatch.
# Composes with --parallel so workflow can run matrix shards in parallel.
if [[ -n "${SHARD:-}" ]]; then
    _shard_n="${SHARD%/*}"
    _shard_m="${SHARD#*/}"
    _shard_total="${#TESTS[@]}"
    _filtered=()
    for _i in "${!TESTS[@]}"; do
        if (( _i % _shard_m == _shard_n - 1 )); then
            _filtered+=("${TESTS[$_i]}")
        fi
    done
    TESTS=("${_filtered[@]}")
    echo "🧪  SHARD=$SHARD → running ${#TESTS[@]} of $_shard_total tests"
fi

if [[ "${1:-}" == "--list" ]]; then
    printf '%s\n' "${TESTS[@]}"
    exit 0
fi

if [[ "${1:-}" == "--single" ]]; then
    "$2"
    [[ $FAIL -eq 0 ]] && exit 0 || exit 1
fi

if [[ "${1:-}" == "--parallel" ]]; then
    jobs="${2:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)}"
    log="$(mktemp)"
    echo "🧪  Running scripts/install orchestrator tests (parallel, jobs=$jobs)..."
    echo ""
    printf '%s\n' "${TESTS[@]}" | xargs -n1 -P "$jobs" -I {} bash "$0" --single {} > "$log" 2>&1
    rc=$?
    cat "$log"
    pass=$(grep -c '✅' "$log" || true)
    fail=$(grep -c '❌' "$log" || true)
    rm -f "$log"
    echo ""
    echo "Results: $pass passed, $fail failed ($(( pass + fail )) total) [parallel jobs=$jobs]"
    [[ $rc -eq 0 ]] || exit 1
    exit 0
fi

echo "🧪  Running scripts/install orchestrator tests..."
echo ""

for t in "${TESTS[@]}"; do "$t"; done

echo ""
echo "Results: $PASS passed, $FAIL failed ($(( PASS + FAIL )) total)"
[[ $FAIL -eq 0 ]]
