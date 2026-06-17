#!/usr/bin/env bash
# syncso.sh — sync.so lip-sync post-process adapter: one rendered clip +
# one audio line in, a lip-synced clip out. Hosted, singing-capable, no
# GPU — the reference implementation for the lip-sync adapter class.
#
# Capability: audio=native — the returned clip embeds the driving audio
# line, so dropping its track at mux time would desync the mouth (the
# orchestrator keeps lip-sync scenes' native audio per /video:from-song
# Step 9.1).
#
# Lifecycle: experimental — structural shape conformant; no maintainer
# real-API smoke trace captured yet. See docs/contracts/provider-lifecycle.md
# for promotion criteria.
# Encoder note: provider-specific prompt grammar comes from the
#   motion-choreographer encoder table; the scene blueprint stays
#   provider-agnostic (see adapter-contract.md § Blueprint → provider translation).
#
# Kind: lipsync (adapter-contract.md v2 § Lip-sync adapters). Stdin is
# NOT the prompt-block shape — a lip-sync job consumes:
#   {"video_url":"https://…/scene.mp4", "audio_url":"https://…/line.wav",
#    "model_id":"lipsync-2"}
# Both URLs must be https and publicly fetchable by the provider; local
# paths are rejected with the host-the-artifacts hint (exit 7).
#
# Sparse-budget discipline: per-song lip-sync limits live MACHINE-READABLE
# in lib/model-capabilities/syncso.json under `lipsync_budget`
# (max_segments_per_song, max_segment_seconds, frontal_close_up_only) —
# the orchestrator enforces them BEFORE submitting anything; this
# adapter renders single segments and never sees the whole song.
#
# API (documented-best-effort — fields tagged ASSUMED are verified on
# the first live smoke; this adapter has no captured smoke trace yet):
#   base   https://api.sync.so
#   auth   x-api-key: <API_KEY>            (ASSUMED header name)
#   submit POST {base}/v2/generate          -> { id, status }
#          body {model, input:[{type:"video",url},{type:"audio",url}]}
#   poll   GET  {base}/v2/generate/<id>     -> { status }
#   fetch  GET  {base}/v2/generate/<id>     -> { outputUrl }   (ASSUMED)
#
# Contract: scripts/media/lib/adapter-contract.md (v2 — trust
# boundary: downloads via aiv_fetch_url, returned paths via
# aiv_validate_artifact_path).
# Provider: top-level <provider id="syncso" kind="lipsync"> in
# agents/.ai-video.xml. Kill-switch: <enabled>false</enabled> refuses
# every network subcommand.

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

ADAPTER_ID="syncso"
SYNCSO_BASE_DEFAULT="https://api.sync.so"
SYNCSO_MANIFEST="${AIV_LIB_DIR}/model-capabilities/syncso.json"

_syncso_base() {
  case "${AIV_ENDPOINT:-}" in
    https://*) printf '%s' "${AIV_ENDPOINT%/}" ;;
    *) printf '%s' "${SYNCSO_BASE_DEFAULT}" ;;
  esac
}

_syncso_auth() {
  printf 'x-api-key: %s' "${AIV_KEY}"
}

_syncso_assert_enabled() {
  [ "$(aiv_provider_enabled "${ADAPTER_ID}")" = "true" ] \
    || aiv_die 6 "${ADAPTER_ID}: provider disabled via <enabled>false</enabled> in agents/.ai-video.xml"
}

# _syncso_validate_url <url> <label> — input URLs are operator/orchestrator
# supplied but still constrained: https only, no quotes/control chars
# (they land in a JSON body and in redacted logs).
_syncso_validate_url() {
  local url="${1:-}" label="${2:-url}"
  [ -n "${url}" ] || aiv_die 7 "${ADAPTER_ID}: ${label} required (host the artifact and pass an https URL — local paths are not fetchable by the provider)"
  case "${url}" in
    https://*) : ;;
    /*|./*|file://*) aiv_die 7 "${ADAPTER_ID}: ${label} is a local path — host the clip/line first (https only)" ;;
    *) aiv_die 7 "${ADAPTER_ID}: ${label} must be https: ${url}" ;;
  esac
  case "${url}" in
    *"'"* | *'`'* | *'$('* | *'"'*) aiv_die 7 "${ADAPTER_ID}: illegal character in ${label}" ;;
  esac
  printf '%s' "${url}"
}

# _syncso_validate_job_id <id> — provider-returned ids are tainted input;
# re-validated on every poll/fetch (stateless, no side-channel files).
_syncso_validate_job_id() {
  local jid="${1:-}"
  [ -n "${jid}" ] || aiv_die 2 "${ADAPTER_ID}: job_id required"
  printf '%s' "${jid}" | grep -Eq '^[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal job_id: ${jid}"
  printf '%s' "${jid}"
}

_syncso_resolve_model() {
  local mid
  mid="$(printf '%s' "${1}" | jq -r '.model_id // empty')"
  [ -n "${mid}" ] || mid="${AIV_MODEL:-lipsync-2}"
  printf '%s' "${mid}" | grep -Eq '^[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal model_id: ${mid}"
  printf '%s' "${mid}"
}

# Submit: read lip-sync job JSON from stdin, return {job_id, status:"queued"}.
aiv_cmd_submit() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _syncso_assert_enabled
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  local stdin_json model video_url audio_url base req resp http body jid
  stdin_json="$(cat)"
  model="$(_syncso_resolve_model "${stdin_json}")"
  video_url="$(_syncso_validate_url "$(printf '%s' "${stdin_json}" | jq -r '.video_url // empty')" video_url)"
  audio_url="$(_syncso_validate_url "$(printf '%s' "${stdin_json}" | jq -r '.audio_url // empty')" audio_url)"
  base="$(_syncso_base)"

  req="$(jq -n --arg m "${model}" --arg v "${video_url}" --arg a "${audio_url}" \
    '{model:$m, input:[{type:"video",url:$v},{type:"audio",url:$a}]}')"

  resp="$(curl -sS -w '\n%{http_code}' -X POST "${base}/v2/generate" \
    -H "$(_syncso_auth)" -H "Content-Type: application/json" \
    --data-binary "${req}")" \
    || aiv_die 8 "${ADAPTER_ID}: submit curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: submit HTTP ${http}: $(printf '%s' "${body}" | jq -r '.message // .error // "unknown"' 2>/dev/null | head -c 300)" ;; esac

  jid="$(printf '%s' "${body}" | jq -r '.id // empty')"
  [ -n "${jid}" ] || aiv_die 8 "${ADAPTER_ID}: no id in submit response (got: $(printf '%s' "${body}" | head -c 200))"
  _syncso_validate_job_id "${jid}" >/dev/null
  jq -n --arg id "${jid}" '{job_id:$id, status:"queued"}'
}

_syncso_status_json() {
  local jid="${1}" base resp http body
  base="$(_syncso_base)"
  resp="$(curl -sS -w '\n%{http_code}' -X GET "${base}/v2/generate/${jid}" \
    -H "$(_syncso_auth)")" \
    || aiv_die 8 "${ADAPTER_ID}: status curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: status HTTP ${http}" ;; esac
  printf '%s' "${body}"
}

aiv_cmd_poll() {
  local jid
  jid="$(_syncso_validate_job_id "${1:-}")"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _syncso_assert_enabled
  local st
  st="$(_syncso_status_json "${jid}" | jq -r '.status // empty')"
  case "${st}" in
    COMPLETED|completed)              printf '{"status":"done"}\n' ;;
    PENDING|pending|QUEUED|queued)    printf '{"status":"queued"}\n' ;;
    PROCESSING|processing)            printf '{"status":"running"}\n' ;;
    FAILED|failed|REJECTED|rejected|CANCELED|canceled)
      printf '{"status":"failed","reason":"%s"}\n' "${st}" ;;
    *)                                printf '{"status":"running","raw":"%s"}\n' "${st:-unknown}" ;;
  esac
}

aiv_cmd_fetch() {
  local jid
  jid="$(_syncso_validate_job_id "${1:-}")"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _syncso_assert_enabled
  local body url dest root out
  body="$(_syncso_status_json "${jid}")"
  url="$(printf '%s' "${body}" | jq -r '.outputUrl // .output_url // .output.url // empty')"
  [ -n "${url}" ] || aiv_die 8 "${ADAPTER_ID}: no output url in result (status=$(printf '%s' "${body}" | jq -r '.status // "?"'))"

  # Trust boundary (contract v2): scene-scoped dest when the orchestrator
  # scoped us, else AIV_OUT, else a temp dir; download via aiv_fetch_url
  # and validate the final path against its scope root.
  if [ -n "${AIV_PROJECT_DIR:-}" ] && [ -n "${AIV_SCENE_ID:-}" ]; then
    dest="$(aiv_scene_dir "${AIV_PROJECT_DIR}" "${AIV_SCENE_ID}")/lipsync-${jid}.mp4"
    root="${AIV_PROJECT_DIR}"
  elif [ -n "${AIV_OUT:-}" ]; then
    dest="${AIV_OUT}"
    root="$(dirname "${AIV_OUT}")"
  else
    root="$(mktemp -d -t aiv-syncso-XXXXXX)"
    dest="${root}/lipsync-${jid}.mp4"
  fi
  aiv_fetch_url "${url}" "${dest}" >/dev/null
  out="$(aiv_validate_artifact_path "${root}" "${dest}")"
  jq -n --arg p "${out}" '{video_path:$p, audio_embedded:true}'
}

aiv_dispatch "${ADAPTER_ID}" "native" "$@"
