#!/usr/bin/env bash
# Release install E2E gate (road-to-feedback-9.8.0-followups).
#
# Proves the PACKED npm artifact — not the source tree — installs,
# upgrades, and boots end-to-end. Closes the 9.8.0 skip-class: a release
# can ship a tarball that installs cleanly in source-level tests yet is
# broken as an actual global npm package (missing files, silent
# postinstall side effects, a stale upgrade path, a broken WASM load).
#
# Sections (each its own `::group::`, fail-closed — the first failing
# assertion aborts the whole run):
#   1. fresh-global-install        — npm install -g into an isolated prefix
#   2. no-silent-gui-postinstall   — no postinstall script, no GUI side effect
#   3. upgrade-from-9.7.0          — baseline tarball, then release on top
#   4. wasm-tree-sitter-load       — code-graph build/validate on a fixture repo
#   5. gui-server-ping             — headless dry-run boot + HTTP ping
#   6. reach-doctor                — read-only channel health report
#   7. secret-gate-smoke           — repo-side check_secret_leak (not shipped
#                                    as an installed CLI command — see § 7)
#   8. clean-uninstall             — npm uninstall -g leaves no orphans
#
# Env:
#   RELEASE_TARBALL   — pre-built tarball to install. Unset → `npm pack`
#                        the current checkout (repo root) into a temp dir
#                        (triggers the `prepack` build — several minutes).
#   BASELINE_TARBALL  — a 9.7.0 tarball for the upgrade leg. Unset →
#                        `npm pack @event4u/agent-config@9.7.0` once
#                        (network). A failed fetch is a SETUP failure,
#                        not a validation failure — see § 3.
#
# Usage:
#   bash tests/test_release_install_e2e.sh
#   RELEASE_TARBALL=/path/to/agent-config.tgz bash tests/test_release_install_e2e.sh
#   BASELINE_TARBALL=/path/to/baseline-9.7.0.tgz bash tests/test_release_install_e2e.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_PATH="$PATH"
TMP_ROOT=""
SERVER_PID=""

# --- helpers -------------------------------------------------------------

ok() { echo "  ✅  $1"; }
group_start() { echo "::group::$1"; echo "  🧪  $1"; }
group_end() { echo "::endgroup::"; }
die() {
    echo "::error::$1" >&2
    exit 1
}

cleanup() {
    if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    PATH="$BASE_PATH"
    [[ -n "$TMP_ROOT" ]] && rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

# Extract `version` from a tarball's own package.json — robust to a
# caller-supplied pre-built tarball whose version we cannot otherwise
# infer (never trust the repo's current package.json for this).
tarball_version() {
    local tarball="$1"
    tar -xzO -f "$tarball" package/package.json | node -e '
        let d = "";
        process.stdin.on("data", (c) => { d += c; });
        process.stdin.on("end", () => { console.log(JSON.parse(d).version); });
    '
}

# Resolve the single `.tgz` a pack-destination dir. `npm pack --json`'s
# stdout is unreliable to parse here — packing a local project re-runs
# `prepack` (tsc/esbuild/vite), and those build tools write their own
# console output to the SAME stdout stream, interleaved with npm's final
# JSON. Globbing the destination dir sidesteps that entirely: each
# resolve_* function below uses a fresh, private temp dir, so exactly one
# `.tgz` is the only possible successful outcome.
single_tarball_in() {
    local destdir="$1" label="$2"
    local tarballs=("$destdir"/*.tgz)
    [[ -f "${tarballs[0]:-}" ]] || die "$label: no .tgz produced in $destdir"
    [[ ${#tarballs[@]} -eq 1 ]] || die "$label: expected exactly 1 .tgz in $destdir, found ${#tarballs[@]}"
    printf '%s' "${tarballs[0]}"
}

resolve_release_tarball() {
    if [[ -n "${RELEASE_TARBALL:-}" ]]; then
        printf '%s' "$RELEASE_TARBALL"
        return 0
    fi
    local destdir="$TMP_ROOT/release-pack"
    mkdir -p "$destdir"
    if ! (cd "$REPO_ROOT" && npm pack --pack-destination "$destdir") >"$TMP_ROOT/release-pack.log" 2>&1; then
        cat "$TMP_ROOT/release-pack.log" >&2
        die "release tarball build failed (npm pack at repo root — setup phase, not validation)."
    fi
    single_tarball_in "$destdir" "resolve_release_tarball"
}

resolve_baseline_tarball() {
    if [[ -n "${BASELINE_TARBALL:-}" ]]; then
        printf '%s' "$BASELINE_TARBALL"
        return 0
    fi
    local destdir="$TMP_ROOT/baseline-pack"
    mkdir -p "$destdir"
    if ! npm pack '@event4u/agent-config@9.7.0' --pack-destination "$destdir" >"$TMP_ROOT/baseline-fetch.log" 2>&1; then
        echo "::error::baseline fetch failed (setup phase, not validation) — could not pack @event4u/agent-config@9.7.0 from the registry." >&2
        cat "$TMP_ROOT/baseline-fetch.log" >&2
        exit 1
    fi
    single_tarball_in "$destdir" "resolve_baseline_tarball"
}

# --- setup -----------------------------------------------------------------

TMP_ROOT="$(mktemp -d -t release-install-e2e-XXXXXX)"
# Every write this package makes (token, server-info, first-run marker,
# settings) is redirected here — never the real developer/runner
# $HOME/.event4u/agent-config/. See src/scripts/_lib/user_global_paths.ts.
export EVENT4U_CONFIG_HOME="$TMP_ROOT/event4u-home"

echo "  🧪  release install E2E gate"
echo ""

RELEASE_TARBALL_PATH="$(resolve_release_tarball)"
[[ -f "$RELEASE_TARBALL_PATH" ]] || die "resolved release tarball not found: $RELEASE_TARBALL_PATH"
RELEASE_TARBALL_VERSION="$(tarball_version "$RELEASE_TARBALL_PATH")" || die "could not read version from release tarball: $RELEASE_TARBALL_PATH"
ok "release tarball: $RELEASE_TARBALL_PATH ($RELEASE_TARBALL_VERSION)"

BASELINE_TARBALL_PATH="$(resolve_baseline_tarball)"
[[ -f "$BASELINE_TARBALL_PATH" ]] || die "resolved baseline tarball not found: $BASELINE_TARBALL_PATH"
BASELINE_TARBALL_VERSION="$(tarball_version "$BASELINE_TARBALL_PATH")" || die "could not read version from baseline tarball: $BASELINE_TARBALL_PATH"
ok "baseline tarball: $BASELINE_TARBALL_PATH ($BASELINE_TARBALL_VERSION)"
echo ""

# --- 1. fresh-global-install ------------------------------------------------

PREFIX_FRESH="$TMP_ROOT/prefix-fresh"
GLOBAL_ROOT_FRESH=""

section_fresh_global_install() {
    group_start "fresh-global-install"
    mkdir -p "$PREFIX_FRESH"
    export NPM_CONFIG_PREFIX="$PREFIX_FRESH"
    export PATH="$PREFIX_FRESH/bin:$BASE_PATH"

    npm install -g "$RELEASE_TARBALL_PATH" --no-audit --no-fund \
        --fetch-retries=5 --fetch-retry-mintimeout=10000 \
        || die "fresh-global-install: npm install -g failed"

    local resolved
    resolved="$(command -v agent-config || true)"
    [[ "$resolved" == "$PREFIX_FRESH/bin/agent-config" ]] \
        || die "fresh-global-install: agent-config resolved to '$resolved', expected '$PREFIX_FRESH/bin/agent-config'"
    ok "agent-config resolves from the isolated prefix ($resolved)"

    GLOBAL_ROOT_FRESH="$(npm root -g)" || die "fresh-global-install: 'npm root -g' failed"
    [[ -d "$GLOBAL_ROOT_FRESH/@event4u/agent-config" ]] \
        || die "fresh-global-install: installed package dir not found under $GLOBAL_ROOT_FRESH"
    ok "installed package tree present ($GLOBAL_ROOT_FRESH/@event4u/agent-config)"
    group_end
}

# --- 2. no-silent-gui-postinstall -------------------------------------------

section_no_silent_gui_postinstall() {
    group_start "no-silent-gui-postinstall"

    node -e '
        const fs = require("node:fs");
        const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        const scripts = pkg.scripts || {};
        const forbidden = ["preinstall", "install", "postinstall"].filter((k) => scripts[k]);
        if (forbidden.length > 0) {
            console.error("forbidden lifecycle script(s) in installed package.json: " + forbidden.join(", "));
            process.exit(1);
        }
    ' "$GLOBAL_ROOT_FRESH/@event4u/agent-config/package.json" \
        || die "no-silent-gui-postinstall: installed package.json declares a forbidden lifecycle script"
    ok "installed package.json has no preinstall/install/postinstall script"

    [[ ! -e "$EVENT4U_CONFIG_HOME/local-server.token" && ! -e "$EVENT4U_CONFIG_HOME/local-server.json" ]] \
        || die "no-silent-gui-postinstall: install already wrote a server-info/token artifact before any command ran"
    ok "no server-info/token artifact exists before the first CLI invocation"

    local out
    out="$(CI=1 agent-config --help 2>&1)" \
        || die "no-silent-gui-postinstall: 'agent-config --help' (CI=1) exited non-zero"
    ok "'agent-config --help' (CI=1) exits 0"

    if printf '%s' "$out" | grep -qi 'browser GUI'; then
        die "no-silent-gui-postinstall: first CLI invocation printed the first-run GUI notice under CI=1/non-TTY"
    fi
    ok "no first-run GUI notice printed (piped, non-TTY)"

    [[ ! -e "$EVENT4U_CONFIG_HOME/local-server.token" && ! -e "$EVENT4U_CONFIG_HOME/local-server.json" ]] \
        || die "no-silent-gui-postinstall: 'agent-config --help' booted the UI server as a side effect"
    ok "no server-info/token artifact exists after 'agent-config --help'"
    group_end
}

# --- 3. upgrade-from-9.7.0 ---------------------------------------------------

section_upgrade_from_9_7_0() {
    group_start "upgrade-from-9.7.0"
    local prefix="$TMP_ROOT/prefix-upgrade"
    mkdir -p "$prefix"
    export NPM_CONFIG_PREFIX="$prefix"
    export PATH="$prefix/bin:$BASE_PATH"

    npm install -g "$BASELINE_TARBALL_PATH" --no-audit --no-fund \
        --fetch-retries=5 --fetch-retry-mintimeout=10000 \
        || die "upgrade-from-9.7.0: baseline npm install -g failed"

    local baseline_actual
    baseline_actual="$(agent-config versions --offline --json | node -e '
        let d = "";
        process.stdin.on("data", (c) => { d += c; });
        process.stdin.on("end", () => { console.log(JSON.parse(d).current); });
    ')" || die "upgrade-from-9.7.0: could not read the baseline-installed version"
    [[ "$baseline_actual" == "$BASELINE_TARBALL_VERSION" ]] \
        || die "upgrade-from-9.7.0: baseline reports version '$baseline_actual', expected '$BASELINE_TARBALL_VERSION'"
    ok "baseline install reports version $baseline_actual"

    npm install -g "$RELEASE_TARBALL_PATH" --no-audit --no-fund \
        --fetch-retries=5 --fetch-retry-mintimeout=10000 \
        || die "upgrade-from-9.7.0: release npm install -g (over baseline) failed"

    local release_actual
    release_actual="$(agent-config versions --offline --json | node -e '
        let d = "";
        process.stdin.on("data", (c) => { d += c; });
        process.stdin.on("end", () => { console.log(JSON.parse(d).current); });
    ')" || die "upgrade-from-9.7.0: could not read the post-upgrade version"
    [[ "$release_actual" == "$RELEASE_TARBALL_VERSION" ]] \
        || die "upgrade-from-9.7.0: post-upgrade reports version '$release_actual', expected '$RELEASE_TARBALL_VERSION'"
    ok "upgrade landed release version $release_actual"

    agent-config --help >/dev/null 2>&1 \
        || die "upgrade-from-9.7.0: agent-config binary does not run after the upgrade"
    ok "agent-config still runs after the upgrade"
    group_end
}

# --- 4. wasm-tree-sitter-load + code-graph-fixture --------------------------

section_wasm_code_graph() {
    group_start "wasm-tree-sitter-load + code-graph-fixture"
    export NPM_CONFIG_PREFIX="$PREFIX_FRESH"
    export PATH="$PREFIX_FRESH/bin:$BASE_PATH"

    local fixture="$TMP_ROOT/code-graph-fixture"
    mkdir -p "$fixture"
    git -C "$fixture" init -q
    cat >"$fixture/a.ts" <<'TS_EOF'
export function greet(name: string): string {
    return `hello ${name}`;
}
TS_EOF
    cat >"$fixture/b.ts" <<'TS_EOF'
import { greet } from './a';

export function run(): string {
    return greet('world');
}
TS_EOF

    local graph_out="$TMP_ROOT/code-graph-fixture.json"
    agent-config code-graph build --root "$fixture" --out "$graph_out" \
        || die "wasm-tree-sitter-load: 'agent-config code-graph build' failed (exercises the web-tree-sitter WASM load)"
    ok "code-graph build succeeded on the fixture repo (WASM grammar load OK)"

    [[ -f "$graph_out" ]] || die "wasm-tree-sitter-load: code-graph build produced no output at $graph_out"

    agent-config code-graph validate --graph "$graph_out" \
        || die "wasm-tree-sitter-load: 'agent-config code-graph validate' rejected the built graph"
    ok "code-graph validate accepts the built graph"
    group_end
}

# --- 5. gui-server-ping ------------------------------------------------------

section_gui_server_ping() {
    group_start "gui-server-ping"
    export NPM_CONFIG_PREFIX="$PREFIX_FRESH"
    export PATH="$PREFIX_FRESH/bin:$BASE_PATH"

    local server_log="$TMP_ROOT/gui-server.log"
    agent-config setup --no-open --allow-headless --dry-run >"$server_log" 2>&1 &
    SERVER_PID=$!

    local url="" deadline=$((SECONDS + 30))
    while ((SECONDS < deadline)); do
        if grep -q '^WIZARD_READY ' "$server_log" 2>/dev/null; then
            url="$(grep '^WIZARD_READY ' "$server_log" | head -1 | awk '{print $2}')"
            break
        fi
        if ! kill -0 "$SERVER_PID" 2>/dev/null; then
            break
        fi
        sleep 0.5
    done

    if [[ -z "$url" ]]; then
        echo "::error::gui-server-ping: no WIZARD_READY line within 30s. Server log:" >&2
        cat "$server_log" >&2
        exit 1
    fi
    ok "server printed WIZARD_READY ($url)"

    # NOTE: the roadmap calls this leg "embed ping". Embed mode (`?embed=1`)
    # has no implementation yet (road-to-ac-embeddable-gui Phase 1 is
    # unbuilt) — this pings the plain GUI server, the closest existing
    # surface. Update to the embed route once it ships.
    local http_code
    http_code="$(curl -s -o /dev/null -w '%{http_code}' "$url")" \
        || die "gui-server-ping: curl against $url failed"
    [[ "$http_code" == "200" ]] \
        || die "gui-server-ping: expected HTTP 200 from $url, got $http_code"
    ok "GET $url → HTTP 200"

    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
    group_end
}

# --- 6. reach-doctor ---------------------------------------------------------

section_reach_doctor() {
    group_start "reach-doctor"
    export NPM_CONFIG_PREFIX="$PREFIX_FRESH"
    export PATH="$PREFIX_FRESH/bin:$BASE_PATH"

    agent-config reach:doctor >/dev/null 2>"$TMP_ROOT/reach-doctor.log" \
        || die "reach-doctor: 'agent-config reach:doctor' exited non-zero (log: $TMP_ROOT/reach-doctor.log)"
    ok "'agent-config reach:doctor' (read-only, no --deep) exits 0"
    group_end
}

# --- 7. secret-gate-smoke (repo-side gate) -----------------------------------

section_secret_gate_smoke() {
    group_start "secret-gate-smoke (repo-side gate — NOT an installed-artifact CLI command)"

    # check_secret_leak.ts ships inside the tarball's src/scripts/ tree, but
    # it is not wired into _dispatch.bash as a CLI subcommand — there is no
    # `agent-config <something>` a consumer can invoke to run it. If that
    # ever changes, fail loudly here rather than silently keep testing the
    # wrong (repo-local) surface.
    local installed_dispatch="$GLOBAL_ROOT_FRESH/@event4u/agent-config/src/scripts/_dispatch.bash"
    if [[ -f "$installed_dispatch" ]] && grep -qE 'secret[-_]leak' "$installed_dispatch"; then
        die "secret-gate-smoke: check_secret_leak now appears wired into the installed CLI dispatcher — update this section to exercise it via the installed 'agent-config' binary instead of the repo-local ./scripts-run fallback."
    fi
    ok "confirmed check_secret_leak is not an installed CLI command (repo-local gate only)"

    local fixture="$TMP_ROOT/secret-gate-fixture"
    mkdir -p "$fixture"
    # Fake AWS access key — matches the `aws-access-key` rule (AKIA + 16
    # alnum chars) and contains no placeholder word (no "example",
    # "changeme", "your-", etc.), so it scores high confidence, not low.
    printf 'aws_access_key = "AKIATESTFAKEKEY12345"\n' >"$fixture/leaky.txt"
    printf 'this fixture file has no secrets in it, just prose.\n' >"$fixture/clean.txt"

    if (cd "$REPO_ROOT" && ./scripts-run src/scripts/check_secret_leak "$fixture/leaky.txt") >"$TMP_ROOT/secret-leaky.log" 2>&1; then
        cat "$TMP_ROOT/secret-leaky.log" >&2
        die "secret-gate-smoke: check_secret_leak did not flag the obvious fake AWS key fixture"
    fi
    ok "check_secret_leak flags the fake-AWS-key fixture (non-zero exit)"

    if ! (cd "$REPO_ROOT" && ./scripts-run src/scripts/check_secret_leak "$fixture/clean.txt") >"$TMP_ROOT/secret-clean.log" 2>&1; then
        cat "$TMP_ROOT/secret-clean.log" >&2
        die "secret-gate-smoke: check_secret_leak flagged a clean fixture file"
    fi
    ok "check_secret_leak passes a clean fixture (exit 0)"
    group_end
}

# --- 8. clean-uninstall -------------------------------------------------------

section_clean_uninstall() {
    group_start "clean-uninstall"
    export NPM_CONFIG_PREFIX="$PREFIX_FRESH"
    export PATH="$PREFIX_FRESH/bin:$BASE_PATH"

    npm uninstall -g @event4u/agent-config --no-audit --no-fund \
        || die "clean-uninstall: npm uninstall -g failed"

    [[ ! -e "$PREFIX_FRESH/bin/agent-config" ]] \
        || die "clean-uninstall: orphaned bin symlink remains at $PREFIX_FRESH/bin/agent-config"
    ok "no orphaned bin symlink"

    [[ ! -d "$GLOBAL_ROOT_FRESH/@event4u/agent-config" ]] \
        || die "clean-uninstall: orphaned package dir remains at $GLOBAL_ROOT_FRESH/@event4u/agent-config"
    ok "no orphaned package directory"
    group_end
}

# --- run ---------------------------------------------------------------------

section_fresh_global_install
section_no_silent_gui_postinstall
section_upgrade_from_9_7_0
section_wasm_code_graph
section_gui_server_ping
section_reach_doctor
section_secret_gate_smoke
section_clean_uninstall

echo ""
echo "✅  release install E2E gate: all sections passed"
