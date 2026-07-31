#!/usr/bin/env bash
# evaluator_umbrella.sh — the external evaluator's "first five minutes" as
# ONE suite over the PACKED artifact (road-to-credible-install Phase 6).
#
# Runs in a clean container (see .github/workflows/evaluator-umbrella.yml)
# on every release PR and nightly — never against the checkout's working
# tree: every check below exercises the tarball `npm pack` produces or the
# clean consumer install made from it.
#
# Checks (each individually red-testable via its own gate/tests):
#   1. audit gate           npm audit --omit=dev --audit-level=high
#   2. tarball integrity    publint + prepack script-target assertion
#                           (lifecycle gate: tests/scripts/prepack_lifecycle_check.test.ts)
#   3. headless install     npm install --omit=dev <tarball> in a scratch project
#   4. staleness lints      lint_pre_migration_refs (+ consumer-internal refs
#                           lint when present)
#   5. hook-latency bench   bench_hook_latency --gate (budget + regression)
#   6. cold-start budgets   CLI --version, mcp-server boot-to-initialize
#   7. size budgets         unpacked, node_modules, dep count (>10% regression
#                           fails even under budget)
#   8. surface budgets      CLI registry command count, MCP tools/list count
#                           (frozen post-Phase-3 values, ADR-132: 19)
#   9. npx smoke            first-touch paths (--version, --help, mcp initialize)
#   6-8 feed src/scripts/check_evaluator_budgets.ts against
#   src/config/evaluator-budgets.json (owner + review date lint-enforced).
#
# Usage: bash src/scripts/evaluator_umbrella.sh [--skip-pack <tarball>]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TARBALL=""
if [[ "${1:-}" == "--skip-pack" && -n "${2:-}" ]]; then
  TARBALL="$2"
fi

step() { printf '\n=== umbrella: %s ===\n' "$1"; }

# ---------------------------------------------------------------- 1. audit
step "npm audit (runtime deps, high+)"
npm audit --omit=dev --audit-level=high

# ------------------------------------------------------------- 2. pack + shape
if [[ -z "$TARBALL" ]]; then
  step "npm pack (prepack chain: build + discovery + manifest + prepack-check)"
  TARBALL="$(npm pack --silent | tail -1)"
else
  step "using pre-packed tarball: $TARBALL"
fi
[[ -f "$TARBALL" ]] || { echo "❌ tarball missing: $TARBALL" >&2; exit 1; }

step "publint (published-package shape)"
npm run lint:publint --silent

# `--ignore-scripts` is NOT honoured for `prepare` by every npm version: on the
# node-20 container npm still runs it, and this repo's prepare installs the git
# hooks and prints a banner — straight into the `--json` stdout we parse. Slice
# from the first `[` so any lifecycle banner ahead of the payload is tolerated
# instead of turning into `SyntaxError: Unexpected token '✅'`.
UNPACKED_BYTES="$(npm pack --dry-run --json --ignore-scripts --silent 2>/dev/null \
  | node -e 'let b="";process.stdin.on("data",c=>b+=c).on("end",()=>{const i=b.indexOf("[");const j=JSON.parse(i>=0?b.slice(i):b);console.log(j[0].unpackedSize)})')"

# ------------------------------------------------------- 3. headless install
step "headless consumer install from the tarball"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
COLD_START_T0="$(node -e 'console.log(Date.now())')"
( cd "$WORK" && npm init -y >/dev/null 2>&1 \
  && npm install --omit=dev --no-audit --no-fund --silent "$ROOT/$TARBALL" )
PKG_DIR="$WORK/node_modules/@event4u/agent-config"
[[ -d "$PKG_DIR" ]] || { echo "❌ install did not produce the package dir" >&2; exit 1; }

# ------------------------------------------- 3b. cold start: install → doctor
# The bare-machine wall-clock a first-time user lives through, measured end to
# end from `npm install` to `doctor` having run. This is EVIDENCE, never a
# promise, and deliberately NOT a budget entry: it is dominated by network and
# registry latency, which are not ours to guarantee. A gate on it would flap on
# runner weather and teach the reader to ignore the line
# (road-to-zero-ceremony-install Phase 6).
step "cold start: install → doctor (evidence, not a gate)"
COLD_START_MS="$(node -e '
const {execFileSync}=require("node:child_process");
const [bin, t0] = process.argv.slice(1);
try { execFileSync(bin, ["doctor"], {stdio:"ignore"}); }
catch { /* doctor may report findings; the run still bounds the wall-clock */ }
console.log(Date.now() - Number(t0));' "$WORK/node_modules/.bin/agent-config" "$COLD_START_T0")"
COLD_START_CONDITIONS="$(uname -s)/$(uname -m) · node $(node --version) · npm $(npm --version) · npm install --omit=dev from a LOCAL tarball (no registry round-trip for the package itself; a real first-touch install adds registry latency)"
printf 'cold_start_install_to_doctor_ms=%s\n' "$COLD_START_MS"
printf 'cold_start_conditions=%s\n' "$COLD_START_CONDITIONS"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    printf '### Cold start — install → doctor\n\n'
    printf '**%s ms**\n\n' "$COLD_START_MS"
    printf 'Conditions: %s\n\n' "$COLD_START_CONDITIONS"
    printf 'Evidence, not a promise — no shipped claim states this as a guarantee.\n'
  } >> "$GITHUB_STEP_SUMMARY"
fi

# --------------------------------------------------------- 4. staleness lints
step "staleness lints (pre-migration refs)"
./scripts-run src/scripts/lint_pre_migration_refs
if [[ -f src/scripts/lint_consumer_internal_refs.ts ]]; then
  ./scripts-run src/scripts/lint_consumer_internal_refs
fi

# ------------------------------------------------------ 5. hook-latency bench
step "hook-latency bench (pre-registered budget gate)"
./scripts-run src/scripts/bench_hook_latency --gate

# ----------------------------------------------- 6-8. measured budget metrics
step "cold-start + size + surface measurements"
MEASURE_TMP="$WORK/measurements.json"
CLI_BIN="$WORK/node_modules/.bin/agent-config"

CLI_MS="$(node -e '
const {execFileSync}=require("node:child_process");
const t=Date.now();
execFileSync(process.argv[1],["--version"],{stdio:"ignore"});
console.log(Date.now()-t);' "$CLI_BIN")"

MCP_MS="$(node -e '
const {spawnSync}=require("node:child_process");
const t=Date.now();
const p=spawnSync("node",[process.argv[1]+"/dist/mcp/server.mjs"],{input:JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"p",version:"0"}}})+"\n",encoding:"utf-8",timeout:30000});
if(!(p.stdout||"").includes("serverInfo")){console.error(p.stderr);process.exit(1)}
console.log(Date.now()-t);' "$PKG_DIR")"

NM_MB="$(du -sm "$WORK/node_modules" | awk '{print $1}')"
DEP_COUNT="$(node -e '
const j=require(process.argv[1]);
console.log(Object.keys(j.packages||{}).length-1);' "$WORK/package-lock.json")"

CLI_COUNT="$(node -e '
const fs=require("node:fs");
const t=fs.readFileSync(process.argv[1],"utf-8");
console.log((t.match(/\{ name: /g)||[]).length);' "$ROOT/src/cli/registry.ts")"

MCP_TOOLS="$(node -e '
const {spawnSync}=require("node:child_process");
const reqs=[{jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"p",version:"0"}}},{jsonrpc:"2.0",method:"notifications/initialized"},{jsonrpc:"2.0",id:2,method:"tools/list"}];
const p=spawnSync("node",[process.argv[1]+"/dist/mcp/server.mjs"],{input:reqs.map(r=>JSON.stringify(r)).join("\n")+"\n",encoding:"utf-8",timeout:30000});
const lines=(p.stdout||"").trim().split("\n").map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);
const resp=lines.find(l=>l.id===2);
if(!resp||!resp.result||!Array.isArray(resp.result.tools)){console.error("no tools/list result");process.exit(1)}
console.log(resp.result.tools.length);' "$PKG_DIR")"

node -e '
const fs=require("node:fs");
const m={
  unpacked_size_mb: Number(process.argv[2])/1e6,
  node_modules_mb: Number(process.argv[3]),
  runtime_dep_count: Number(process.argv[4]),
  cli_version_cold_ms: Number(process.argv[5]),
  mcp_boot_to_initialize_ms: Number(process.argv[6]),
  cli_help_command_count: Number(process.argv[7]),
  mcp_public_tool_count: Number(process.argv[8]),
  // Evidence-only: carried in the artifact with its conditions, never gated.
  // check_evaluator_budgets iterates the BUDGET entries, so an extra
  // measurement is recorded and ignored by the gate — by design.
  cold_start_install_to_doctor_ms: Number(process.argv[9]),
  cold_start_conditions: process.argv[10],
};
fs.writeFileSync(process.argv[1], JSON.stringify(m, null, 2));
console.log(JSON.stringify(m, null, 1));' \
  "$MEASURE_TMP" "$UNPACKED_BYTES" "$NM_MB" "$DEP_COUNT" "$CLI_MS" "$MCP_MS" "$CLI_COUNT" "$MCP_TOOLS" \
  "$COLD_START_MS" "$COLD_START_CONDITIONS"

step "budget gate (absolute + >regression_pct creep)"
./scripts-run src/scripts/check_evaluator_budgets --measurements "$MEASURE_TMP"

# ------------------------------------------------------------- 9. npx smoke
step "first-touch smoke (installed bin)"
"$CLI_BIN" --version >/dev/null
"$CLI_BIN" --help >/dev/null

echo
echo "✅  evaluator umbrella green — the first five minutes hold on the packed artifact."
