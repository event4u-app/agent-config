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
    assert_true "skills/coder/SKILL.md is a symlink" test -L "$TMPDIR/.augment/skills/coder/SKILL.md"
    assert_true "skills/coder/SKILL.md resolves" test -e "$TMPDIR/.augment/skills/coder/SKILL.md"
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
    content="$(head -1 "$TMPDIR/.augment/skills/coder/SKILL.md" 2>/dev/null || echo "")"
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
    assert_true "skills still symlink after 2nd run" test -L "$TMPDIR/.augment/skills/coder/SKILL.md"
    teardown
}

test_migration_real_to_symlink() {
    setup
    # Simulate old copy-based install
    mkdir -p "$TMPDIR/.augment/skills/coder"
    echo "old copy" > "$TMPDIR/.augment/skills/coder/SKILL.md"
    assert_false "pre-check: is real file" test -L "$TMPDIR/.augment/skills/coder/SKILL.md"
    run_install
    assert_true "after install: is symlink" test -L "$TMPDIR/.augment/skills/coder/SKILL.md"
    teardown
}

test_gitignore_marker_added() {
    setup; run_install
    assert_contains "gitignore has marker" "$TMPDIR/.gitignore" "# galawork/agent-config"
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

test_skill_symlinks_in_claude() {
    setup; run_install
    assert_true ".claude/skills/coder is symlink" test -L "$TMPDIR/.claude/skills/coder"
    assert_true ".claude/skills/coder resolves" test -d "$TMPDIR/.claude/skills/coder"
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

# --- Runner ---
echo "🧪  Running install.sh integration tests..."
echo ""

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
test_tool_symlinks_created
test_skill_symlinks_in_claude
test_windsurfrules_generated
test_gemini_md_created
test_dry_run_no_files
test_agents_md_copied
test_symlink_replaced_by_copy_for_rules

echo ""
echo "Results: $PASS passed, $FAIL failed ($(( PASS + FAIL )) total)"

if [[ $FAIL -gt 0 ]]; then
    exit 1
fi
