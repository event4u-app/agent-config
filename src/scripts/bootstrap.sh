#!/usr/bin/env bash
# bootstrap.sh — Thin Bash entry for the v4 unified setup wizard.
#
# road-to-unified-setup § C1. Replaces the legacy Python boot path.
# Flow:
#   1. Verify Node ≥ 20.11.0 (the package engines bound).
#   2. Launch `npx @event4u/agent-config <subcommand>` in the background.
#   3. Tail stdout for the `WIZARD_READY <url>` marker (Phase B4).
#   4. Open the URL in the user's browser (best-effort; no fatal error
#      when no `open` / `xdg-open` is available — print the URL instead).
#   5. Wait for the server process so Ctrl-C tears the wizard down cleanly.
#
# Usage:
#   scripts/bootstrap.sh install        # default — install wizard
#   scripts/bootstrap.sh setup
#   scripts/bootstrap.sh setup --no-extended
#   AGENT_CONFIG_NO_OPEN=1 scripts/bootstrap.sh install   # CI / headless
#
# Exit codes:
#   0 — wizard process exited cleanly
#   1 — Node missing or below the engines bound
#   2 — WIZARD_READY did not arrive within 30 seconds
#   3 — npx invocation failed before the marker
set -euo pipefail

MIN_NODE_MAJOR=20
MIN_NODE_MINOR=11
TIMEOUT_SECONDS=30
SUBCOMMAND="${1:-install}"
shift || true

if ! command -v node >/dev/null 2>&1; then
    echo "error: Node.js not found in PATH (need ≥ ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0)." >&2
    echo "install Node first — https://nodejs.org/" >&2
    exit 1
fi

NODE_VERSION="$(node -p 'process.versions.node')"
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if [ "${NODE_MAJOR}" -lt "${MIN_NODE_MAJOR}" ] \
   || { [ "${NODE_MAJOR}" -eq "${MIN_NODE_MAJOR}" ] && [ "${NODE_MINOR}" -lt "${MIN_NODE_MINOR}" ]; }; then
    echo "error: Node ${NODE_VERSION} is below the required ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0." >&2
    exit 1
fi

PIPE="$(mktemp -u "${TMPDIR:-/tmp}/agent-config-bootstrap.XXXXXX")"
mkfifo "${PIPE}"
trap 'rm -f "${PIPE}"' EXIT

# Always pass --no-open here — the bootstrap script owns the browser
# launch so it can defer it until after WIZARD_READY arrives.
npx --yes @event4u/agent-config "${SUBCOMMAND}" --no-open "$@" >"${PIPE}" 2>&1 &
NPX_PID=$!

URL=""
DEADLINE=$(( $(date +%s) + TIMEOUT_SECONDS ))
while IFS= read -r line; do
    printf '%s\n' "${line}"
    if [[ "${line}" == WIZARD_READY\ * ]]; then
        URL="${line#WIZARD_READY }"
        break
    fi
    if [ "$(date +%s)" -ge "${DEADLINE}" ]; then
        echo "error: WIZARD_READY did not arrive within ${TIMEOUT_SECONDS}s." >&2
        kill "${NPX_PID}" 2>/dev/null || true
        exit 2
    fi
done <"${PIPE}" &
READER_PID=$!

# If npx died before we saw the marker, surface the failure.
if ! kill -0 "${NPX_PID}" 2>/dev/null; then
    wait "${READER_PID}" || true
    echo "error: npx exited before WIZARD_READY arrived." >&2
    exit 3
fi

wait "${READER_PID}" || true

if [ -z "${URL}" ]; then
    echo "error: server did not emit WIZARD_READY." >&2
    kill "${NPX_PID}" 2>/dev/null || true
    exit 2
fi

if [ -z "${AGENT_CONFIG_NO_OPEN:-}" ]; then
    if command -v open >/dev/null 2>&1; then
        open "${URL}" || true
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "${URL}" >/dev/null 2>&1 || true
    else
        echo "info: open the wizard manually: ${URL}"
    fi
fi

# Keep streaming stdout so the user sees server logs until Ctrl-C.
cat "${PIPE}" &
wait "${NPX_PID}"
