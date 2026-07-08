#!/usr/bin/env bash
# Installer-level rule-scoping tests (road-to-request-scoped-rule-load
# Phase 1b Step 1 — the red-first witness).
#
# The projection filter (`rule_in_scope`, condense.ts) never ran on the
# install path: a consumer project install shipped 94/95 rules (dead
# EXCLUDE_RULES list) and the global payload shipped all 95 with no exclude
# at all — including `source-of-truth.md` on global but not project (the
# documented contradiction). These tests COUNT what actually arrives per
# scope, deriving the maintainer-only set from dist/router.json v2 so the
# assertions track the audited tags, never a hand-copied list.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_SH="$SCRIPT_DIR/src/scripts/install.sh"
ROUTER_JSON="$SCRIPT_DIR/dist/router.json"
RULES_SRC="$SCRIPT_DIR/dist/agent-src/rules"
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

run_install() {
    mkdir -p "$TMPDIR/home"
    HOME="$TMPDIR/home" \
    EVENT4U_CONFIG_HOME="$TMPDIR/home/.event4u/agent-config" \
        bash "$INSTALL_SH" --target "$TMPDIR" --quiet "$@" 2>&1
}

assert_eq() {
    local desc="$1" actual="$2" expected="$3"
    if [[ "$actual" == "$expected" ]]; then
        echo "  ✅  $desc ($actual)"
        ((PASS++)) || true
    else
        echo "  ❌  FAIL: $desc — got $actual, expected $expected"
        ((FAIL++)) || true
    fi
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

# --- Router-derived fixtures (never hand-copied) ---

# Rule basenames whose router entry is EXCLUSIVELY maintainer-workspace.
maintainer_only_rules() {
    node -e '
const r = require(process.argv[1]);
const out = [];
for (const tier of ["tier_1", "tier_2"]) {
    for (const e of r[tier] ?? []) {
        const ws = e.workspaces ?? [];
        if (ws.length === 1 && ws[0] === "agent-config-maintainer") out.push(e.id + ".md");
    }
}
process.stdout.write(out.sort().join("\n"));
' "$ROUTER_JSON"
}

kernel_rules() {
    node -e '
const r = require(process.argv[1]);
process.stdout.write((r.kernel ?? []).map((k) => String(k) + ".md").sort().join("\n"));
' "$ROUTER_JSON"
}

source_rule_count() {
    find "$RULES_SRC" -maxdepth 1 -name '*.md' | wc -l | tr -d ' '
}

installed_rule_count() {
    find "$TMPDIR/.augment/rules" -maxdepth 1 -name '*.md' | wc -l | tr -d ' '
}

# --- Tests ---

test_legacy_all_counts_and_compat_exclusion() {
    setup
    run_install >/dev/null
    local src_count installed
    src_count="$(source_rule_count)"
    installed="$(installed_rule_count)"
    # Legacy-all consumer default: everything ships EXCEPT the documented
    # compat exclusion (`source-of-truth.md` — a maintainer-repo rule whose
    # body forbids edits a consumer legitimately makes). Exactly −1.
    assert_eq "legacy-all project install ships src−1 rules" "$installed" "$((src_count - 1))"
    assert_false "source-of-truth.md excluded (project path)" \
        test -f "$TMPDIR/.augment/rules/source-of-truth.md"
    teardown
}

test_scoped_project_excludes_maintainer_only() {
    setup
    cat > "$TMPDIR/.agent-settings.yml" <<'EOF'
projection:
  rule_workspaces:
    - engineering
EOF
    run_install >/dev/null
    local missing=0 present=0
    while IFS= read -r rule; do
        [[ -n "$rule" ]] || continue
        if [[ -f "$TMPDIR/.augment/rules/$rule" ]]; then
            ((present++)) || true
        else
            ((missing++)) || true
        fi
    done < <(maintainer_only_rules)
    # Scoped consumer install: ZERO exclusively-maintainer rules arrive.
    assert_eq "maintainer-only rules present under scoped install" "$present" "0"
    assert_true "…and the maintainer-only set is non-trivial (sanity)" \
        test "$((present + missing))" -gt 5
    teardown
}

test_scoped_project_keeps_kernel() {
    setup
    cat > "$TMPDIR/.agent-settings.yml" <<'EOF'
projection:
  rule_workspaces:
    - engineering
EOF
    run_install >/dev/null
    local kernel_missing=0
    while IFS= read -r rule; do
        [[ -n "$rule" ]] || continue
        [[ -f "$TMPDIR/.augment/rules/$rule" ]] || ((kernel_missing++)) || true
    done < <(kernel_rules)
    assert_eq "kernel rules missing under scoped install" "$kernel_missing" "0"
    teardown
}

test_scoped_install_is_smaller_than_legacy() {
    setup
    run_install >/dev/null
    local legacy_count
    legacy_count="$(installed_rule_count)"
    teardown

    setup
    cat > "$TMPDIR/.agent-settings.yml" <<'EOF'
projection:
  rule_workspaces:
    - engineering
EOF
    run_install >/dev/null
    local scoped_count
    scoped_count="$(installed_rule_count)"
    assert_true "scoped install ($scoped_count) ships fewer rules than legacy-all ($legacy_count)" \
        test "$scoped_count" -lt "$legacy_count"
    teardown
}

# --- Run ---
echo "=== install.sh rule-scoping tests (Phase 1b) ==="
test_legacy_all_counts_and_compat_exclusion
test_scoped_project_excludes_maintainer_only
test_scoped_project_keeps_kernel
test_scoped_install_is_smaller_than_legacy

echo ""
echo "PASS: $PASS  FAIL: $FAIL"
[[ $FAIL -eq 0 ]] || exit 1
