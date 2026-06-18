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
# Adapters live per-domain under scripts/<domain>/adapters/; the shared
# substrate (scripts/media/lib) is domain-neutral, so the harness resolves a
# provider from any media domain (ai-video, ai-image, …).
ADAPTER_DIRS=(
  "${ROOT}/src/scripts/ai-video/adapters"
  "${ROOT}/src/scripts/ai-image/adapters"
)
# shellcheck source=/dev/null
. "${ROOT}/src/scripts/media/lib/adapter-common.sh"

PROVIDER=""
MODE="dry-run"
MODEL=""
REF_IMAGE=""
OUT_DIR="${ROOT}/agents/reference/ai-video/smoke-traces"
while [ $# -gt 0 ]; do
  case "$1" in
    --provider)  PROVIDER="${2:-}"; shift 2 ;;
    --model)     MODEL="${2:-}"; shift 2 ;;
    --ref-image) REF_IMAGE="${2:-}"; shift 2 ;;
    --live)      MODE="live"; shift ;;
    --out)       OUT_DIR="${2:-}"; shift 2 ;;
    *) echo "smoke-trace: unknown arg '$1'" >&2; exit 2 ;;
  esac
done
[ -n "${PROVIDER}" ] || { echo "smoke-trace: --provider <id> required" >&2; exit 2; }
ADAPTER=""
for _dir in "${ADAPTER_DIRS[@]}"; do
  [ -f "${_dir}/${PROVIDER}.sh" ] && { ADAPTER="${_dir}/${PROVIDER}.sh"; break; }
done
[ -n "${ADAPTER}" ] || { echo "smoke-trace: no adapter for '${PROVIDER}' under ${ADAPTER_DIRS[*]}" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "smoke-trace: jq required" >&2; exit 2; }

TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p "${OUT_DIR}"
# Per-model traces (multiplexer adapters) carry a filesystem-safe model slug
# in the filename so one adapter can collect traces per reachable model.
MODEL_SLUG=""
[ -n "${MODEL}" ] && MODEL_SLUG="-$(printf '%s' "${MODEL}" | tr '/' '_' | tr -cd 'A-Za-z0-9._-')"
TRACE="${OUT_DIR}/${PROVIDER}${MODEL_SLUG}-${MODE}-${TS}.json"

# Minimal valid stdin JSON (contract: prompt.* blocks mandatory). --model
# injects the optional top-level model_id key (multiplexer adapters route it;
# single-model adapters ignore unknown stdin keys per contract). --ref-image
# injects ref_images[0] for image2video adapters (e.g. higgsfield) that
# animate a still instead of generating from text alone.
STDIN_JSON="$(jq -nc --arg model "${MODEL}" --arg ref "${REF_IMAGE}" '{
  prompt: {style:"smoke-test", subject:"a red cube", environment:"white void",
           action:"rotates slowly", camera:"locked", lens:"50mm",
           lighting:"soft key", mood:"neutral"},
  duration: 2.0, aspect:"16:9", seed: 1
} + (if $model != "" then {model_id: $model} else {} end)
  + (if $ref   != "" then {ref_images: [$ref]} else {} end)')"

ms_now() { node -e 'console.log(Date.now())'; }

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
  # Scope the adapter's artifact into a per-trace dir beside the trace JSON
  # (contract v2: unscoped adapters fall back to mktemp OUTSIDE the repo,
  # which the harness's own ROOT-scoped validation below would then reject).
  ARTIFACT_DIR="${OUT_DIR}/artifacts"
  mkdir -p "${ARTIFACT_DIR}"
  export AIV_OUT="${ARTIFACT_DIR}/${PROVIDER}-${TS}.mp4"
  run_phase submit "${STDIN_JSON}" bash "${ADAPTER}" submit
  JOB="$(jq -r '.job_id // empty' <<<"${LAST_OUT}" 2>/dev/null || true)"
  if [ -n "${JOB}" ]; then
    # Async providers render for minutes — poll quietly until done/failed or
    # AIV_SMOKE_POLL_TIMEOUT (default 600s; interval AIV_SMOKE_POLL_INTERVAL,
    # default 10s), then record ONE final poll phase with the attempt count
    # (recording every tick would bloat the trace with dozens of identical
    # "running" records).
    POLL_DEADLINE=$(( $(date +%s) + ${AIV_SMOKE_POLL_TIMEOUT:-600} ))
    POLL_ATTEMPTS=0
    POLL_ST=""
    while :; do
      POLL_OUT="$(bash "${ADAPTER}" poll "${JOB}" 2>/dev/null || true)"
      POLL_ATTEMPTS=$((POLL_ATTEMPTS + 1))
      POLL_ST="$(jq -r '.status // empty' <<<"${POLL_OUT}" 2>/dev/null || true)"
      case "${POLL_ST}" in done|failed) break ;; esac
      [ "$(date +%s)" -lt "${POLL_DEADLINE}" ] || break
      sleep "${AIV_SMOKE_POLL_INTERVAL:-10}"
    done
    run_phase "poll(final,attempts=${POLL_ATTEMPTS})" "" bash "${ADAPTER}" poll "${JOB}"
    POLL_ST="$(jq -r '.status // empty' <<<"${LAST_OUT}" 2>/dev/null || true)"
    if [ "${POLL_ST}" = "done" ]; then
      run_phase fetch "" bash "${ADAPTER}" fetch "${JOB}"
      FETCH_OUT="${LAST_OUT}"
    else
      SUCCESS=false   # timed out or provider-failed — recorded in PHASES
    fi
  elif [ -n "$(jq -r '.video_path // .image_path // empty' <<<"${LAST_OUT}" 2>/dev/null || true)" ]; then
    # Synchronous adapter (e.g. images API): submit produced the artifact
    # directly — its stdout IS the round-trip result, no poll/fetch.
    FETCH_OUT="${LAST_OUT}"
  else
    SUCCESS=false   # stub adapter (live not wired) or submit failed — recorded in PHASES
  fi
fi

# Validate the returned artifact path against the trust boundary (when present).
[ -n "${FETCH_OUT}" ] || FETCH_OUT='{}'
VIDEO_PATH="$(jq -r '.video_path // .image_path // empty' <<<"${FETCH_OUT}" 2>/dev/null | head -1 || true)"
ARTIFACT_OK="n/a"
if [ -n "${VIDEO_PATH}" ]; then
  # Subshell the validation: aiv_validate_artifact_path uses aiv_die (exit),
  # which would kill the harness BEFORE the trace is written. In live mode the
  # scope root is the per-trace artifact dir; dry-run fixtures live in ROOT.
  VALIDATE_ROOT="${ROOT}"
  [ "${MODE}" = "live" ] && [ -n "${ARTIFACT_DIR:-}" ] && VALIDATE_ROOT="${ARTIFACT_DIR}"
  if ( aiv_validate_artifact_path "${VALIDATE_ROOT}" "${VIDEO_PATH}" ) >/dev/null 2>&1; then ARTIFACT_OK=true; else ARTIFACT_OK=false; SUCCESS=false; fi
fi
# cost_estimate lives on the SUBMIT stdout (contract v2); fall back to fetch.
COST="$(jq -r 'first(.[] | select(.name=="submit") | .stdout | try fromjson | .cost_estimate | select(. != null) | tostring) // empty' <<<"${PHASES}" 2>/dev/null | head -1 || true)"
[ -n "${COST}" ] || COST="$(jq -r '.cost_estimate // "unknown"' <<<"${FETCH_OUT}" 2>/dev/null | head -1 || echo unknown)"
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
