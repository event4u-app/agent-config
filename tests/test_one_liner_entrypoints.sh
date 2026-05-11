#!/usr/bin/env bash
# Smoke tests for the one-liner entrypoints (Phase 2 of
# road-to-simplicity-and-everywhere).
#
# Covers:
#   - setup.sh   — `curl | bash` shell entrypoint
#   - packages/create-agent-config — `npx` Node wrapper
#
# Both entrypoints download a tarball, extract it, and run scripts/install.
# To stay offline, we build a local tarball from the current checkout and
# point both entrypoints at it via AGENT_CONFIG_TARBALL_URL=file://...

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETUP_SH="$REPO_ROOT/setup.sh"
NPX_BIN="$REPO_ROOT/packages/create-agent-config/bin/create-agent-config.js"
TMPDIR=""
TARBALL=""
PASS=0
FAIL=0

setup() {
    TMPDIR="$(mktemp -d -t one-liner-smoke-XXXXXX)"
    TARBALL="$TMPDIR/agent-config.tgz"
    # Pack the current checkout into the shape `git archive` would
    # produce (single top-level `agent-config/` directory). BSD tar
    # (default on macOS) lacks --transform, so we stage via a copy
    # under a parent dir and tar from there. We only ship the dirs the
    # installer actually reads.
    local stage="$TMPDIR/stage"
    mkdir -p "$stage/agent-config"
    local src
    for src in scripts templates .agent-src .agent-src.uncompressed \
               AGENTS.md router.json .agent-settings.yml; do
        if [[ -e "$REPO_ROOT/$src" ]]; then
            cp -R "$REPO_ROOT/$src" "$stage/agent-config/"
        fi
    done
    (cd "$stage" && tar -czf "$TARBALL" agent-config) \
        || { echo "  ❌  setup: failed to pack tarball" >&2; exit 1; }
}

teardown() {
    [[ -n "$TMPDIR" ]] && rm -rf "$TMPDIR"
}

pass() { echo "  ✅  $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌  FAIL: $1"; FAIL=$((FAIL + 1)); }

assert_file() {
    local desc="$1" path="$2"
    if [[ -f "$path" ]] || [[ -L "$path" ]]; then pass "$desc"; else fail "$desc (missing: $path)"; fi
}

assert_dir() {
    local desc="$1" path="$2"
    if [[ -d "$path" ]]; then pass "$desc"; else fail "$desc (missing dir: $path)"; fi
}

# --- Test 1: setup.sh --help works ---
test_setup_help() {
    if bash "$SETUP_SH" --help >/dev/null 2>&1; then pass "setup.sh --help exits 0"
    else fail "setup.sh --help exits non-zero"
    fi
}

# --- Test 2: setup.sh installs from local tarball ---
test_setup_local_install() {
    local target
    target="$TMPDIR/setup-target"
    mkdir -p "$target"
    AGENT_CONFIG_TARBALL_URL="file://$TARBALL" \
        bash "$SETUP_SH" --target "$target" --tools=claude-code --yes >"$TMPDIR/setup.log" 2>&1
    local rc=$?
    if [[ $rc -ne 0 ]]; then
        fail "setup.sh local install exit 0 (got $rc; tail: $(tail -5 "$TMPDIR/setup.log" | tr '\n' ' '))"
        return
    fi
    pass "setup.sh local install exit 0"
    assert_dir  "setup.sh: .claude/ populated"      "$target/.claude"
    assert_file "setup.sh: .agent-settings.yml rendered" "$target/.agent-settings.yml"
}

# --- Test 3: create-agent-config wrapper --help ---
test_npx_help() {
    if ! command -v node >/dev/null 2>&1; then
        echo "  ⏭️  skip: node not available"; return
    fi
    if node "$NPX_BIN" --help >/dev/null 2>&1; then pass "npx wrapper --help exits 0"
    else fail "npx wrapper --help exits non-zero"
    fi
}

# --- Test 4: create-agent-config wrapper installs from local tarball ---
test_npx_local_install() {
    if ! command -v node >/dev/null 2>&1; then
        echo "  ⏭️  skip: node not available"; return
    fi
    local target
    target="$TMPDIR/npx-target"
    mkdir -p "$target"
    AGENT_CONFIG_TARBALL_URL="file://$TARBALL" \
        node "$NPX_BIN" init --target "$target" --tools=claude-code --yes >"$TMPDIR/npx.log" 2>&1
    local rc=$?
    if [[ $rc -ne 0 ]]; then
        fail "npx wrapper local install exit 0 (got $rc; tail: $(tail -5 "$TMPDIR/npx.log" | tr '\n' ' '))"
        return
    fi
    pass "npx wrapper local install exit 0"
    assert_dir  "npx: .claude/ populated"           "$target/.claude"
    assert_file "npx: .agent-settings.yml rendered" "$target/.agent-settings.yml"
}

# --- Test 5: setup.sh dry-run-style (--help only, no network) ---
test_setup_unknown_flag_passes_through() {
    # Unknown flags should be passed through to scripts/install, which
    # will then fail with a clear error. We rely on AGENT_CONFIG_TARBALL_URL
    # to keep the test offline.
    AGENT_CONFIG_TARBALL_URL="file://$TARBALL" \
        bash "$SETUP_SH" --target "$TMPDIR/passthrough" --tools=does-not-exist --yes >/dev/null 2>&1
    local rc=$?
    if [[ $rc -ne 0 ]]; then pass "setup.sh forwards bad --tools to scripts/install (rc=$rc)"
    else fail "setup.sh accepted invalid --tools"
    fi
}

# --- Run ---
echo "  🧪  one-liner entrypoint smoke tests"
echo ""
setup
trap teardown EXIT

test_setup_help
test_setup_local_install
test_npx_help
test_npx_local_install
test_setup_unknown_flag_passes_through

echo ""
echo "Results: $PASS passed, $FAIL failed (total: $((PASS + FAIL)))"
[[ $FAIL -eq 0 ]] || exit 1
