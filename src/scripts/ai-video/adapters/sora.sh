#!/usr/bin/env bash
# sora.sh — OpenAI Sora structural-prompt video adapter.
#
# Capability: audio=native. Sora-class models produce muxed MP4 with
# dialogue + ambient sound; we pass the audio block straight through.
# Structural-prompt path informed by upstream `awesome-sora-prompts`
# (attribution in agents/reference/ai-video/prompts/cinematic-blueprint.md).
#
# Lifecycle: stable — promoted 2026-06-10 (maintainer-authorized): live
# round-trip validated 1/1 — 4.1s h264 720p with native AAC audio,
# ~60s render, ~$0.40 (sora-2, 4s). API param enums verified empirically
# (seconds {4,8,12}, size {720x1280,1280x720,1024x1792,1792x1024}). Raw
# trace is local-only operator evidence (smoke-traces/, gitignored).
#
# Live API (OpenAI Videos API — param enums verified empirically
# 2026-06-10 via validation-error probes, no spend):
#   base   https://api.openai.com/v1   (from XML <endpoint>)
#   auth   Authorization: Bearer <API_KEY>
#   submit POST {base}/videos
#          {"model":"sora-2"|"sora-2-pro","prompt":"…",
#           "seconds":"4"|"8"|"12" (string enum, verified),
#           "size":"720x1280"|"1280x720"|"1024x1792"|"1792x1024" (verified)}
#          -> {id:"video_…", status:"queued"}
#   poll   GET  {base}/videos/{id}
#          -> status: queued|in_progress|completed|failed (ASSUMED names)
#   fetch  GET  {base}/videos/{id}/content -> MP4 bytes (ASSUMED route;
#          download needs the same Bearer header -> AIV_FETCH_HEADER)
#
# job_id = the provider video id; re-validated as untrusted input on
# every poll/fetch (charset whitelist, no traversal).
#
# Contract: scripts/media/lib/adapter-contract.md (v2 — trust
# boundary: downloads via aiv_fetch_url, returned paths via
# aiv_validate_artifact_path).
# Provider: top-level <provider id="sora" kind="video"> in
# agents/.ai-video.xml. Kill-switch: <enabled>false</enabled>.
# Encoder note: provider-specific prompt grammar comes from the
#   motion-choreographer encoder table; the scene blueprint stays
#   provider-agnostic (see adapter-contract.md § Blueprint → provider translation).

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

ADAPTER_ID="sora"

_sora_auth() {
  printf 'Authorization: Bearer %s' "${AIV_KEY}"
}

_sora_assert_enabled() {
  [ "$(aiv_provider_enabled "${ADAPTER_ID}")" = "true" ] \
    || aiv_die 6 "${ADAPTER_ID}: provider disabled via <enabled>false</enabled> in agents/.ai-video.xml"
}

# _sora_validate_video_id <id> — video ids are tainted input (provider
# response / orchestrator replay); they land in the request URL. Sets
# SORA_VIDEO_ID (global; not command-substituted so aiv_die's exit
# reaches the caller).
_sora_validate_video_id() {
  SORA_VIDEO_ID="${1:-}"
  [ -n "${SORA_VIDEO_ID}" ] || aiv_die 2 "${ADAPTER_ID}: job_id (video id) required"
  printf '%s' "${SORA_VIDEO_ID}" | grep -Eq '^[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal video id: ${SORA_VIDEO_ID}"
}

# _sora_model_rate_usd_per_s <model> — modeled per-second USD rate for
# cost_estimate (documented-best-effort; ASSUMED until the invoice
# confirms). Unknown models → empty ("unknown").
_sora_model_rate_usd_per_s() {
  case "${1:-}" in
    sora-2-pro*) printf '0.30' ;;
    sora-2*)     printf '0.10' ;;
    *)           printf '' ;;
  esac
}

# _sora_video_json <video_id> — GET the video job; echoes the raw body.
_sora_video_json() {
  local vid="${1}" base resp http body
  base="${AIV_ENDPOINT%/}"
  resp="$(curl -sS -w '\n%{http_code}' -X GET "${base}/videos/${vid}" \
    -H "$(_sora_auth)")" \
    || aiv_die 8 "${ADAPTER_ID}: poll curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: poll HTTP ${http}: $(printf '%s' "${body}" | jq -r '.error.message // "unknown"' 2>/dev/null | head -c 300)" ;; esac
  printf '%s' "${body}"
}

# Submit: read contract JSON from stdin, return {job_id, status:"queued",
# cost_estimate?}.
aiv_cmd_submit() {
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  aiv_assert_dryrun
  _sora_assert_enabled
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  local stdin_json model base req resp http body vid secs size rate
  stdin_json="$(cat)"
  # Sora's structural-prompt path expects all eight blocks present;
  # fail loud if the blueprint parser dropped any.
  printf '%s' "${stdin_json}" \
    | jq -e '.prompt.style and .prompt.subject and .prompt.environment and
             .prompt.action and .prompt.camera and .prompt.lens and
             .prompt.lighting and .prompt.mood' >/dev/null \
    || aiv_die 3 "${ADAPTER_ID}: stdin JSON missing one or more required prompt blocks"

  model="${AIV_MODEL:-sora-2}"
  base="${AIV_ENDPOINT%/}"

  # stdin duration → seconds enum {"4","8","12"} (string, verified).
  secs="$(printf '%s' "${stdin_json}" | jq -r '
    if .duration == null then "4"
    elif .duration <= 4 then "4"
    elif .duration <= 8 then "8"
    else "12" end')"
  # aspect → size enum (verified): landscape 1280x720, portrait 720x1280.
  size="$(printf '%s' "${stdin_json}" | jq -r '
    if .aspect == "9:16" then "720x1280" else "1280x720" end')"

  req="$(printf '%s' "${stdin_json}" | jq --arg model "${model}" --arg secs "${secs}" --arg size "${size}" '{
    model: $model,
    seconds: $secs,
    size: $size,
    prompt: ([.prompt.style, .prompt.subject, .prompt.environment,
              .prompt.action, .prompt.camera, .prompt.lens,
              .prompt.lighting, .prompt.mood]
             | map(select(. != null and . != "")) | join(". "))
  }')"

  resp="$(curl -sS -w '\n%{http_code}' -X POST "${base}/videos" \
    -H "$(_sora_auth)" -H "Content-Type: application/json" \
    --data-binary "${req}")" \
    || aiv_die 8 "${ADAPTER_ID}: submit curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: submit HTTP ${http}: $(printf '%s' "${body}" | jq -r '.error.message // "unknown"' 2>/dev/null | head -c 300)" ;; esac

  vid="$(printf '%s' "${body}" | jq -r '.id // empty')"
  [ -n "${vid}" ] || aiv_die 8 "${ADAPTER_ID}: no video id in submit response (got: $(printf '%s' "${body}" | head -c 200))"
  _sora_validate_video_id "${vid}"

  rate="$(_sora_model_rate_usd_per_s "${model}")"
  if [ -n "${rate}" ]; then
    jq -n --arg id "${SORA_VIDEO_ID}" --argjson c "$(jq -n --argjson r "${rate}" --argjson s "${secs}" '$r * $s')" \
      '{job_id:$id, status:"queued", cost_estimate:$c}'
  else
    jq -n --arg id "${SORA_VIDEO_ID}" '{job_id:$id, status:"queued", cost_estimate:"unknown"}'
  fi
}

# Poll: stateless — the video id IS the job_id.
aiv_cmd_poll() {
  _sora_validate_video_id "${1:-}"
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  aiv_assert_dryrun
  _sora_assert_enabled
  local body st err
  body="$(_sora_video_json "${SORA_VIDEO_ID}")" || exit $?
  st="$(printf '%s' "${body}" | jq -r '.status // empty')"
  case "${st}" in
    completed|succeeded)      printf '{"status":"done"}\n' ;;
    queued)                   printf '{"status":"queued"}\n' ;;
    in_progress|processing)   printf '{"status":"running"}\n' ;;
    failed|error)
      err="$(printf '%s' "${body}" | jq -r '.error.message // .failure_reason // "failed"' | head -c 200)"
      jq -n --arg r "${err}" '{status:"failed", reason:$r}' ;;
    *)                        printf '{"status":"running","raw":"%s"}\n' "${st:-unknown}" ;;
  esac
}

# Fetch: confirm the job completed, then download the MP4 from the
# content route through the v2 trust boundary (Bearer header via
# AIV_FETCH_HEADER; size-cap + path validation).
aiv_cmd_fetch() {
  _sora_validate_video_id "${1:-}"
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  aiv_assert_dryrun
  _sora_assert_enabled
  local body st base url dest root out
  body="$(_sora_video_json "${SORA_VIDEO_ID}")" || exit $?
  st="$(printf '%s' "${body}" | jq -r '.status // empty')"
  case "${st}" in completed|succeeded) : ;; *) aiv_die 8 "${ADAPTER_ID}: fetch before completion (status=${st:-unknown}; poll first)" ;; esac

  base="${AIV_ENDPOINT%/}"
  url="${base}/videos/${SORA_VIDEO_ID}/content"

  if [ -n "${AIV_PROJECT_DIR:-}" ] && [ -n "${AIV_SCENE_ID:-}" ]; then
    dest="$(aiv_scene_dir "${AIV_PROJECT_DIR}" "${AIV_SCENE_ID}")/scene-${SORA_VIDEO_ID}.mp4"
    root="${AIV_PROJECT_DIR}"
  elif [ -n "${AIV_OUT:-}" ]; then
    dest="${AIV_OUT}"
    root="$(dirname "${AIV_OUT}")"
  else
    root="$(mktemp -d -t aiv-sora-XXXXXX)"
    dest="${root}/scene-${SORA_VIDEO_ID}.mp4"
  fi
  AIV_FETCH_HEADER="$(_sora_auth)" aiv_fetch_url "${url}" "${dest}" >/dev/null
  out="$(aiv_validate_artifact_path "${root}" "${dest}")"
  jq -n --arg p "${out}" '{video_path:$p, audio_embedded:true}'
}

aiv_dispatch "${ADAPTER_ID}" "native" "$@"
