#!/usr/bin/env bash
#
# Container e2e for the installer + browser-wizard apply path.
#
# Runs inside the installer-e2e image (node + a built dist/). It
# reproduces, in a pristine container, the field bug where the browser wizard
# finished but nothing was installed: a consumer project with a legacy
# `.claude/` dir + a global-scope apply made the migrate-to-global path fail
# and abort the whole install.
#
# Two scenarios, both must pass (exit 0 = green):
#   A. Direct apply — `tsx install.ts --apply-payload` in a clean env,
#      exactly how the wizard server spawns it.
#   B. Real wizard server — boot `createApp` and drive POST
#      /api/v1/wizard/apply over HTTP end-to-end.
set -euo pipefail

PKG=/pkg
fail() { echo "FAIL: $*" >&2; exit 1; }

# Wizard-v2 payload: Claude Code, global scope (default), minimal tier.
PAYLOAD='{"schema_version":"wizard-v2","tools":["claude-code"],"packs":[],"settings":{"rule_loading_tier":"minimal"},"scope_to_project_only":false,"dry_run":false}'

# ---------------------------------------------------------------------------
# Scenario A — direct `--apply-payload`, clean env, NO PYTHONPATH.
# ---------------------------------------------------------------------------
echo "== Scenario A: install.py --apply-payload (no PYTHONPATH, legacy .claude) =="
A_CONSUMER=/work/a/consumer
A_GLOBAL=/work/a/global
mkdir -p "$A_CONSUMER/.claude" "$A_GLOBAL"
echo "$PAYLOAD" > /work/a/payload.json

# `env -u PYTHONPATH` reproduces the wizard spawn (no PYTHONPATH). DEV/CI/NO_UI
# stripped so legacy detection + the migrate path actually fire. The installer
# is now TypeScript; the wizard server spawns it via node_modules/.bin/tsx
# (src/server/routes/wizard.ts:resolveTsxInvocation) — mirror that here.
set +e
env -u PYTHONPATH -u AGENT_CONFIG_DEV_MODE -u CI -u AGENT_CONFIG_NO_UI \
    EVENT4U_CONFIG_HOME="$A_GLOBAL" AGENT_CONFIG_NO_UPDATE_CHECK=1 \
    "$PKG/node_modules/.bin/tsx" "$PKG/src/scripts/install.ts" \
    --apply-payload /work/a/payload.json --project "$A_CONSUMER" \
    >/work/a/out.ndjson 2>/work/a/err.log
A_RC=$?
set -e

echo "--- scenario A stdout (tail) ---"; tail -5 /work/a/out.ndjson || true
[ "$A_RC" -eq 0 ] || { cat /work/a/err.log >&2; fail "scenario A exited $A_RC"; }
grep -q "migrate unavailable" /work/a/err.log /work/a/out.ndjson \
    && fail "scenario A hit the 'migrate unavailable' abort (the bug)"
grep -q '"type":"done"' /work/a/out.ndjson \
    || fail "scenario A produced no terminal 'done' frame"
[ -f "$A_GLOBAL/installed.lock" ] \
    || fail "scenario A wrote no installed.lock — nothing was created (the bug)"
echo "Scenario A: PASS (installed.lock present, no abort)"

# ---------------------------------------------------------------------------
# Scenario B — real wizard server over HTTP.
# ---------------------------------------------------------------------------
echo "== Scenario B: real wizard server → POST /api/v1/wizard/apply =="
B_CONSUMER=/work/b/consumer
B_GLOBAL=/work/b/global
B_UI=/work/b/ui
mkdir -p "$B_CONSUMER/.claude" "$B_GLOBAL" "$B_UI"
printf '<!doctype html><html><body>ok</body></html>' > "$B_UI/index.html"

PORT=8753
TOKEN=$(head -c 32 /dev/zero | tr '\0' 's')   # 32-char fixed token

# The server-spawned install.py inherits this process env, so EVENT4U_CONFIG_HOME
# routes the global write into a dir we can assert on.
EVENT4U_CONFIG_HOME="$B_GLOBAL" AGENT_CONFIG_NO_UPDATE_CHECK=1 \
    node "$PKG/tests/fixtures/installer-e2e/boot-wizard.mjs" \
    "$PORT" "$B_CONSUMER" "$B_UI" "$PKG" "$TOKEN" >/work/b/server.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

# Wait for WIZARD_READY (max ~15s).
for _ in $(seq 1 60); do
    grep -q "WIZARD_READY" /work/b/server.log && break
    kill -0 "$SERVER_PID" 2>/dev/null || { cat /work/b/server.log >&2; fail "wizard server died on boot"; }
    sleep 0.25
done
grep -q "WIZARD_READY" /work/b/server.log || { cat /work/b/server.log >&2; fail "wizard server never became ready"; }
echo "wizard server ready on :$PORT"

curl -sS -N -X POST "http://127.0.0.1:$PORT/api/v1/wizard/apply" \
    -H "Host: 127.0.0.1:$PORT" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    -d "$PAYLOAD" > /work/b/sse.out 2>/work/b/curl.err || { cat /work/b/curl.err >&2; fail "apply request failed"; }

echo "--- scenario B SSE (tail) ---"; tail -8 /work/b/sse.out || true
grep -q '"type":"error"' /work/b/sse.out && { cat /work/b/sse.out >&2; fail "apply streamed an error frame"; }
grep -q '"type":"done"' /work/b/sse.out || { cat /work/b/sse.out >&2; fail "apply never streamed a 'done' frame (aborted?)"; }
[ -f "$B_GLOBAL/installed.lock" ] \
    || fail "wizard apply wrote no installed.lock — nothing was created (the bug)"
echo "Scenario B: PASS (SSE done frame + installed.lock present)"

echo "ALL CONTAINER E2E SCENARIOS PASSED"
