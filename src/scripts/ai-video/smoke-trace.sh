#!/usr/bin/env bash
# smoke-trace.sh — capture an adapter smoke trace (positioning Phase 2, turnkey harness).
#
# Runs an adapter's contract round-trip and records a structured trace under
# agents/reference/ai-video/smoke-traces/. Two modes:
#
#   (default) DRY-RUN  — calls the adapter's `dry-run` subcommand (deterministic
#                        fixture, NO network, NO spend). Proves the harness +
#                        validates the v2 stdout shape + the trust boundary on the
#                        returned artifact path. The trace is marked mode=dry-run
#                        and is NOT a real validation — it is plumbing proof.
#
#   --live             — calls the real submit -> poll -> fetch round-trip
#                        (AIV_DRYRUN=false). Requires a provider key in
#                        agents/.ai-video.xml and REAL SPEND — this is the
#                        maintainer's Hard-Floor step (non-destructive-by-default).
#                        Stub adapters that are not live-wired record an honest
#                        "live not wired" failure instead of a trace.
#
# Usage:
#   bash src/scripts/ai-video/smoke-trace.sh --provider <id> [--live] [--out <dir>]
#
# Exit: 0 = trace captured (dry-run plumbing OK, or live success),
#       non-zero = adapter/harness error (recorded in the trace + stderr).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ADAPTER_DIR="${ROOT}/src/scripts/ai-video/adapters"
# shellcheck source=/dev/null
. "${ROOT}/src/scripts/ai-video/lib/adapter-common.sh"

PROVIDER=""
MODE="dry-run"
OUT_DIR="${ROOT}/agents/reference/ai-video/smoke-traces"
while [ $# -gt 0 ]; do
  case "$1" in
    --provider) PROVIDER="${2:-}"; shift 2 ;;
    --live)     MODE="live"; shift ;;
    --out)      OUT_DIR="${2:-}"; shift 2 ;;
    *) echo "smoke-trace: unknown arg '$1'" >&2; exit 2 ;;
  esac
done
[ -n "${PROVIDER}" ] || { echo "smoke-trace: --provider <id> required" >&2; exit 2; }
ADAPTER="${ADAPTER_DIR}/${PROVIDER}.sh"
[ -f "${ADAPTER}" ] || { echo "smoke-trace: no adapter at ${ADAPTER}" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "smoke-trace: jq required" >&2; exit 2; }

TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p "${OUT_DIR}"
TRACE="${OUT_DIR}/${PROVIDER}-${MODE}-${TS}.json"

# Minimal valid stdin JSON (contract: prompt.* blocks mandatory).
STDIN_JSON="$(jq -nc '{
  prompt: {style:"smoke-test", subject:"a red cube", environment:"white void",
           action:"rotates slowly", camera:"locked", lens:"50mm",
           lighting:"soft key", mood:"neutral"},
  duration: 2.0, aspect:"16:9", seed: 1
}')"

ms_now() { python3 -c 'import time;print(int(time.time()*1000))'; }

PHASES="[]"
SUCCESS=true
FETCH_OUT=""
LAST_OUT=""
TIER="$(grep -oE 'Lifecycle:[[:space:]]*[a-z]+' "${ADAPTER}" | head -1 | awk '{print $2}')"
[ -n "${TIER}" ] || TIER="unknown"

# run_phase NAME STDIN -- CMD...  : runs CMD with STDIN, times it, appends a
# {name,ms,exit,stdout,stderr} record to PHASES (in THIS shell — no subshell),
# and stashes stdout in LAST_OUT. Sets SUCCESS=false on non-zero exit.
run_phase() {
  local name="$1" stdin="$2"; shift 2
  local t0 t1 rc errf="/tmp/smoke_err.$$"
  t0="$(ms_now)"
  set +e; LAST_OUT="$(printf '%s' "${stdin}" | "$@" 2>"${errf}")"; rc=$?; set -e
  t1="$(ms_now)"
  PHASES="$(jq -c --arg n "${name}" --argjson ms "$((t1 - t0))" --argjson rc "${rc}" \
    --arg out "${LAST_OUT}" --arg err "$(cat "${errf}" 2>/dev/null || true)" \
    '. + [{name:$n, ms:$ms, exit:$rc, stdout:$out, stderr:$err}]' <<<"${PHASES}")"
  rm -f "${errf}"
  [ "${rc}" -eq 0 ] || SUCCESS=false
  return 0
}

if [ "${MODE}" = "dry-run" ]; then
  run_phase capability "" bash "${ADAPTER}" capability
  run_phase dry-run "${STDIN_JSON}" bash "${ADAPTER}" dry-run
  FETCH_OUT="${LAST_OUT}"
else
  export AIV_DRYRUN=false
  run_phase submit "${STDIN_JSON}" bash "${ADAPTER}" submit
  JOB="$(jq -r '.job_id // empty' <<<"${LAST_OUT}" 2>/dev/null || true)"
  if [ -n "${JOB}" ]; then
    run_phase poll "" bash "${ADAPTER}" poll "${JOB}"
    run_phase fetch "" bash "${ADAPTER}" fetch "${JOB}"
    FETCH_OUT="${LAST_OUT}"
  else
    SUCCESS=false   # stub adapter (live not wired) or submit failed — recorded in PHASES
  fi
fi

# Validate the returned artifact path against the trust boundary (when present).
[ -n "${FETCH_OUT}" ] || FETCH_OUT='{}'
VIDEO_PATH="$(jq -r '.video_path // empty' <<<"${FETCH_OUT}" 2>/dev/null | head -1 || true)"
ARTIFACT_OK="n/a"
if [ -n "${VIDEO_PATH}" ]; then
  if aiv_validate_artifact_path "${ROOT}" "${VIDEO_PATH}" >/dev/null 2>&1; then ARTIFACT_OK=true; else ARTIFACT_OK=false; SUCCESS=false; fi
fi
COST="$(jq -r '.cost_estimate // "unknown"' <<<"${FETCH_OUT}" 2>/dev/null | head -1 || echo unknown)"
AUDIO_EMB="$(jq -r 'if .audio_embedded == true then "true" else "false" end' <<<"${FETCH_OUT}" 2>/dev/null | head -1 || echo false)"

NOTE="dry-run = plumbing proof (no network/spend); NOT a real validation. Run --live with a provider key for the real smoke trace."
[ "${MODE}" = "live" ] && NOTE="live round-trip against the real provider API (real spend)."

jq -n \
  --arg provider "${PROVIDER}" --arg tier "${TIER}" --arg mode "${MODE}" \
  --arg ts "${TS}" --argjson phases "${PHASES}" \
  --arg video "${VIDEO_PATH}" --arg artifact_ok "${ARTIFACT_OK}" \
  --arg cost "${COST}" --argjson audio "${AUDIO_EMB}" \
  --argjson success "${SUCCESS}" --arg note "${NOTE}" \
  '{provider:$provider, lifecycle_tier:$tier, mode:$mode, captured_utc:$ts,
    success:$success, video_path:$video, artifact_path_validated:$artifact_ok,
    cost_estimate:$cost, audio_embedded:$audio, phases:$phases, note:$note}' \
  > "${TRACE}"

echo "smoke-trace: ${MODE} ${PROVIDER} (tier=${TIER}) success=${SUCCESS} → ${TRACE#"${ROOT}/"}"
[ "${SUCCESS}" = true ]
