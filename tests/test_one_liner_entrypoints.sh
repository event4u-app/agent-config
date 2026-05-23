#!/usr/bin/env bash
# Smoke tests for the one-liner entrypoints (Phase 2 of
# road-to-simplicity-and-everywhere).
#
# Covers:
#   - setup.sh                  — `curl | bash` shell entrypoint
#   - scripts/agent-config init — npm/npx bin entry for `@event4u/agent-config`
#
# setup.sh downloads a tarball and runs scripts/install; the npx entrypoint
# is the package bin (`scripts/agent-config`) which forwards `init` to
# scripts/install. To stay offline we build a local tarball, extract it,
# and invoke the bin from there — mirroring what npx does after fetch.

set -uo pipefail

# ADR-020: --scope=project is maintainer-only. This smoke suite exercises
# the legacy project-scope path on purpose (setup.sh + `agent-config init`
# default to --scope=project for backward compatibility). Opt in via the
# documented dev-mode env so the consumer gate doesn't reject the install.
export AGENT_CONFIG_DEV_MODE=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETUP_SH="$REPO_ROOT/setup.sh"
TMPDIR=""
TARBALL=""
NPX_EXTRACT=""
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
    for src in scripts templates config .agent-src .agent-src.uncompressed \
               AGENTS.md .agent-settings.yml package.json \
               bin docker .augment; do
        if [[ -e "$REPO_ROOT/$src" ]]; then
            cp -R "$REPO_ROOT/$src" "$stage/agent-config/"
        fi
    done
    # Stage `dist/router.json` only — the router-kernel compiled artefact
    # the installer reads. The rest of `dist/` (TS-compiled CLI) requires
    # node_modules to run and is not staged here; the bin shim falls back
    # to the legacy bash dispatcher when `dist/cli/agent-config.js` is
    # absent, which is what these smoke tests exercise.
    if [[ -f "$REPO_ROOT/dist/router.json" ]]; then
        mkdir -p "$stage/agent-config/dist"
        cp "$REPO_ROOT/dist/router.json" "$stage/agent-config/dist/router.json"
    fi
    (cd "$stage" && tar -czf "$TARBALL" agent-config) \
        || { echo "  ❌  setup: failed to pack tarball" >&2; exit 1; }
    # Extract once for npx-style invocations (simulates `npx` post-fetch).
    NPX_EXTRACT="$TMPDIR/npx-extract"
    mkdir -p "$NPX_EXTRACT"
    (cd "$NPX_EXTRACT" && tar -xzf "$TARBALL") \
        || { echo "  ❌  setup: failed to extract tarball" >&2; exit 1; }
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

# --- Test 3: `agent-config init --help` (npm bin entry) ---
test_npx_help() {
    local bin="$NPX_EXTRACT/agent-config/scripts/agent-config"
    if AGENT_CONFIG_NO_PIN_REEXEC=1 bash "$bin" help >/dev/null 2>&1; then
        pass "agent-config bin help exits 0"
    else
        fail "agent-config bin help exits non-zero"
    fi
}

# --- Test 4: `agent-config init` installs from extracted tarball ---
test_npx_local_install() {
    local bin="$NPX_EXTRACT/agent-config/scripts/agent-config"
    local target
    target="$TMPDIR/npx-target"
    mkdir -p "$target"
    AGENT_CONFIG_NO_PIN_REEXEC=1 \
        bash "$bin" init --target "$target" --tools=claude-code --yes >"$TMPDIR/npx.log" 2>&1
    local rc=$?
    if [[ $rc -ne 0 ]]; then
        fail "agent-config init local install exit 0 (got $rc; tail: $(tail -5 "$TMPDIR/npx.log" | tr '\n' ' '))"
        return
    fi
    pass "agent-config init local install exit 0"
    assert_dir  "agent-config init: .claude/ populated"           "$target/.claude"
    assert_file "agent-config init: .agent-settings.yml rendered" "$target/.agent-settings.yml"
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
