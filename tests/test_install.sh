#!/usr/bin/env bash
# Integration tests for scripts/install.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_SH="$SCRIPT_DIR/scripts/install.sh"
TMPDIR=""
PASS=0
FAIL=0

# --- Test framework ---
setup() {
    TMPDIR="$(mktemp -d)"
    touch "$TMPDIR/.gitignore"
}

teardown() {
    [[ -n "$TMPDIR" ]] && rm -rf "$TMPDIR"
}

run_install() {
    bash "$INSTALL_SH" --target "$TMPDIR" --quiet "$@" 2>&1
}

assert_true() {
    local desc="$1"
    shift
    if "$@" 2>/dev/null; then
        echo "  ✅  $desc"
        ((PASS++)) || true
    else
        echo "  ❌  FAIL: $desc"
        ((FAIL++)) || true
    fi
}

assert_false() {
    local desc="$1"
    shift
    if ! "$@" 2>/dev/null; then
        echo "  ✅  $desc"
        ((PASS++)) || true
    else
        echo "  ❌  FAIL: $desc (expected false)"
        ((FAIL++)) || true
    fi
}

assert_contains() {
    local desc="$1" file="$2" pattern="$3"
    if grep -qF "$pattern" "$file" 2>/dev/null; then
        echo "  ✅  $desc"
        ((PASS++)) || true
    else
        echo "  ❌  FAIL: $desc — pattern '$pattern' not found"
        ((FAIL++)) || true
    fi
}

# --- Tests ---

test_rules_are_real_copies() {
    setup; run_install
    assert_true "rules/php-coding.md exists" test -f "$TMPDIR/.augment/rules/php-coding.md"
    assert_false "rules/php-coding.md is NOT a symlink" test -L "$TMPDIR/.augment/rules/php-coding.md"
    teardown
}

test_skills_are_symlinks() {
    setup; run_install
    assert_true "skills/php-coder/SKILL.md is a symlink" test -L "$TMPDIR/.augment/skills/php-coder/SKILL.md"
    assert_true "skills/php-coder/SKILL.md resolves" test -e "$TMPDIR/.augment/skills/php-coder/SKILL.md"
    teardown
}

test_commands_are_symlinks() {
    setup; run_install
    local first_cmd
    first_cmd="$(ls "$TMPDIR/.augment/commands/" | head -1)"
    assert_true "commands/$first_cmd is a symlink" test -L "$TMPDIR/.augment/commands/$first_cmd"
    teardown
}

test_symlinks_resolve_correctly() {
    setup; run_install
    local content
    content="$(head -1 "$TMPDIR/.augment/skills/php-coder/SKILL.md" 2>/dev/null || echo "")"
    assert_true "skill symlink has readable content" test -n "$content"
    teardown
}

test_stale_files_removed() {
    setup; run_install
    # Add stale file
    mkdir -p "$TMPDIR/.augment/skills/old-skill"
    echo "stale" > "$TMPDIR/.augment/skills/old-skill/SKILL.md"
    # Re-run
    run_install
    assert_false "stale skill removed" test -e "$TMPDIR/.augment/skills/old-skill/SKILL.md"
    teardown
}

test_broken_symlinks_removed() {
    setup; run_install
    # Create broken symlink
    mkdir -p "$TMPDIR/.augment/skills/broken"
    ln -sf "/nonexistent/path" "$TMPDIR/.augment/skills/broken/SKILL.md"
    # Re-run
    run_install
    assert_false "broken symlink removed" test -L "$TMPDIR/.augment/skills/broken/SKILL.md"
    teardown
}

test_idempotent() {
    setup; run_install; run_install
    assert_false "rules still real file after 2nd run" test -L "$TMPDIR/.augment/rules/php-coding.md"
    assert_true "skills still symlink after 2nd run" test -L "$TMPDIR/.augment/skills/php-coder/SKILL.md"
    teardown
}

test_migration_real_to_symlink() {
    setup
    # Simulate old copy-based install
    mkdir -p "$TMPDIR/.augment/skills/php-coder"
    echo "old copy" > "$TMPDIR/.augment/skills/php-coder/SKILL.md"
    assert_false "pre-check: is real file" test -L "$TMPDIR/.augment/skills/php-coder/SKILL.md"
    run_install
    assert_true "after install: is symlink" test -L "$TMPDIR/.augment/skills/php-coder/SKILL.md"
    teardown
}

test_gitignore_marker_added() {
    setup; run_install
    assert_contains "gitignore has marker" "$TMPDIR/.gitignore" "# event4u/agent-config"
    assert_contains "gitignore has skills entry" "$TMPDIR/.gitignore" ".augment/skills/"
    teardown
}

test_gitignore_idempotent() {
    setup; run_install
    local size1; size1="$(wc -c < "$TMPDIR/.gitignore")"
    run_install
    local size2; size2="$(wc -c < "$TMPDIR/.gitignore")"
    assert_true "gitignore same size after 2nd run" test "$size1" -eq "$size2"
    teardown
}


test_gitignore_not_created_if_missing() {
    TMPDIR="$(mktemp -d)"  # No .gitignore
    run_install
    assert_false "no .gitignore created" test -f "$TMPDIR/.gitignore"
    teardown
}

test_gitignore_reinstall_adds_missing_entry() {
    setup
    # Seed a legacy block missing a newer entry (.agent-chat-history).
    cat > "$TMPDIR/.gitignore" <<'EOF'
/vendor/

# event4u/agent-config
# Agent config — symlinked from vendor (auto-managed)
.augment/skills/
.augment/commands/

# Agent config — CLI wrapper (auto-generated on every install)
/agent-config
EOF
    run_install
    assert_contains "chat-history entry added on re-install" \
        "$TMPDIR/.gitignore" ".agent-chat-history"
    assert_contains "pre-existing user entry preserved" \
        "$TMPDIR/.gitignore" "/vendor/"
    teardown
}

test_gitignore_skip_flag() {
    setup
    echo "/vendor/" > "$TMPDIR/.gitignore"
    run_install --skip-gitignore
    assert_false "no agent-config block written with --skip-gitignore" \
        grep -qF "# event4u/agent-config" "$TMPDIR/.gitignore"
    teardown
}

test_tool_symlinks_created() {
    setup; run_install
    assert_true ".claude/rules/ exists" test -d "$TMPDIR/.claude/rules"
    assert_true ".cursor/rules/ exists" test -d "$TMPDIR/.cursor/rules"
    assert_true ".clinerules/ exists" test -d "$TMPDIR/.clinerules"
    assert_true ".claude/rules/php-coding.md is symlink" test -L "$TMPDIR/.claude/rules/php-coding.md"
    assert_true ".cursor/rules/php-coding.md is symlink" test -L "$TMPDIR/.cursor/rules/php-coding.md"
    assert_true ".clinerules/php-coding.md is symlink" test -L "$TMPDIR/.clinerules/php-coding.md"
    teardown
}

test_stale_tool_symlinks_removed() {
    setup; run_install
    # Add a stale symlink to .claude/rules/
    ln -sf "../../.augment/rules/nonexistent.md" "$TMPDIR/.claude/rules/nonexistent.md"
    assert_true "stale symlink exists" test -L "$TMPDIR/.claude/rules/nonexistent.md"
    run_install
    assert_false "stale tool symlink removed" test -L "$TMPDIR/.claude/rules/nonexistent.md"
    teardown
}

test_stale_skill_symlinks_removed() {
    setup; run_install
    # Add a stale symlink to .claude/skills/
    ln -sf "../../.augment/skills/nonexistent" "$TMPDIR/.claude/skills/nonexistent"
    assert_true "stale skill symlink exists" test -L "$TMPDIR/.claude/skills/nonexistent"
    run_install
    assert_false "stale skill symlink removed" test -L "$TMPDIR/.claude/skills/nonexistent"
    teardown
}

test_skill_symlinks_in_claude() {
    setup; run_install
    assert_true ".claude/skills/php-coder is symlink" test -L "$TMPDIR/.claude/skills/php-coder"
    assert_true ".claude/skills/php-coder resolves" test -d "$TMPDIR/.claude/skills/php-coder"
    teardown
}

test_windsurfrules_generated() {
    setup; run_install
    assert_true ".windsurfrules exists" test -f "$TMPDIR/.windsurfrules"
    assert_contains "windsurfrules has header" "$TMPDIR/.windsurfrules" "Auto-generated"
    teardown
}

test_gemini_md_created() {
    setup; run_install
    assert_true "GEMINI.md is symlink" test -L "$TMPDIR/GEMINI.md"
    teardown
}

test_dry_run_no_files() {
    TMPDIR="$(mktemp -d)"
    bash "$INSTALL_SH" --target "$TMPDIR" --dry-run --quiet 2>&1 || true
    # Dry-run should not create any files (dirs may be created)
    local file_count
    file_count="$(find "$TMPDIR" -type f 2>/dev/null | wc -l | tr -d ' ')"
    assert_true "no files in dry-run (found $file_count)" test "$file_count" -eq 0
    teardown
}

test_agents_md_copied() {
    setup; run_install
    assert_true "AGENTS.md exists" test -f "$TMPDIR/AGENTS.md"
    teardown
}

test_symlink_replaced_by_copy_for_rules() {
    setup
    mkdir -p "$TMPDIR/.augment/rules"
    ln -sf "$SCRIPT_DIR/.augment/rules/php-coding.md" "$TMPDIR/.augment/rules/php-coding.md"
    assert_true "pre-check: is symlink" test -L "$TMPDIR/.augment/rules/php-coding.md"
    run_install
    assert_false "after install: not a symlink" test -L "$TMPDIR/.augment/rules/php-coding.md"
    assert_true "after install: is real file" test -f "$TMPDIR/.augment/rules/php-coding.md"
    teardown
}

test_cli_wrapper_installed() {
    setup; run_install
    assert_true "./agent-config exists" test -f "$TMPDIR/agent-config"
    assert_true "./agent-config is executable" test -x "$TMPDIR/agent-config"
    teardown
}

test_cli_wrapper_gitignored() {
    setup; run_install
    assert_contains "gitignore covers /agent-config" "$TMPDIR/.gitignore" "/agent-config"
    teardown
}

test_cli_wrapper_overwrites_on_reinstall() {
    setup; run_install
    echo "# stale content" > "$TMPDIR/agent-config"
    run_install
    assert_false "stale marker removed" grep -q "# stale content" "$TMPDIR/agent-config"
    assert_true "./agent-config still executable" test -x "$TMPDIR/agent-config"
    teardown
}

test_cli_wrapper_delegates_to_master() {
    setup; run_install
    # Simulate node_modules layout so the wrapper can find the master CLI.
    mkdir -p "$TMPDIR/node_modules/@event4u"
    ln -sf "$SCRIPT_DIR" "$TMPDIR/node_modules/@event4u/agent-config"
    local out
    out="$(cd "$TMPDIR" && ./agent-config help 2>&1)"
    if printf '%s' "$out" | grep -q "agent-config — event4u/agent-config CLI"; then
        echo "  ✅  wrapper delegates to master (help reached master)"
        ((PASS++)) || true
    else
        echo "  ❌  FAIL: wrapper did not reach master; output was:"
        printf '%s\n' "$out" | sed 's/^/       /'
        ((FAIL++)) || true
    fi
    teardown
}

test_cli_wrapper_errors_without_install() {
    setup; run_install
    # No node_modules / vendor exists → wrapper must fail clearly, exit 127.
    local out rc
    out="$(cd "$TMPDIR" && ./agent-config help 2>&1)" && rc=0 || rc=$?
    assert_true "wrapper exits 127 when master missing" test "$rc" -eq 127
    if printf '%s' "$out" | grep -q "master CLI not found"; then
        echo "  ✅  wrapper prints actionable error"
        ((PASS++)) || true
    else
        echo "  ❌  FAIL: wrapper error message missing"
        ((FAIL++)) || true
    fi
    teardown
}

# --- Runner ---
TESTS=(
    test_rules_are_real_copies
    test_skills_are_symlinks
    test_commands_are_symlinks
    test_symlinks_resolve_correctly
    test_stale_files_removed
    test_broken_symlinks_removed
    test_idempotent
    test_migration_real_to_symlink
    test_gitignore_marker_added
    test_gitignore_idempotent
    test_gitignore_not_created_if_missing
    test_gitignore_reinstall_adds_missing_entry
    test_gitignore_skip_flag
    test_tool_symlinks_created
    test_stale_tool_symlinks_removed
    test_skill_symlinks_in_claude
    test_stale_skill_symlinks_removed
    test_windsurfrules_generated
    test_gemini_md_created
    test_dry_run_no_files
    test_agents_md_copied
    test_symlink_replaced_by_copy_for_rules
    test_cli_wrapper_installed
    test_cli_wrapper_gitignored
    test_cli_wrapper_overwrites_on_reinstall
    test_cli_wrapper_delegates_to_master
    test_cli_wrapper_errors_without_install
)

# --list: print test names (used by parallel runner). --single NAME: run one
# test (used by parallel runner). --parallel [N]: dispatch all tests via
# xargs -P, default jobs = nproc. No args: sequential (legacy behaviour).
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
    echo "🧪  Running install.sh integration tests (parallel, jobs=$jobs)..."
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

echo "🧪  Running install.sh integration tests..."
echo ""

for t in "${TESTS[@]}"; do "$t"; done

echo ""
echo "Results: $PASS passed, $FAIL failed ($(( PASS + FAIL )) total)"

if [[ $FAIL -gt 0 ]]; then
    exit 1
fi
