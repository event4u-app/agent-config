#!/usr/bin/env bash
# higgsfield.sh — Higgsfield motion-preset video adapter.
#
# Capability: per-model. The provider exposes named motion presets
# (e.g. Mix, Burst, DVD) each with its own audio behaviour. Capability
# discovery via `capability --preset <name>` so the orchestrator can
# pick the right mux path.
#
# Contract: scripts/ai-video/lib/adapter-contract.md
# Provider: top-level <provider id="higgsfield" kind="video"> in
# agents/.ai-video.xml. Preset → motion-choreographer profile mapping
# is documented in agents/reference/ai-video/prompts/motion-choreography.md
# (Phase 6).
#
# Lifecycle: experimental — capability-discovery path conformant; no
# maintainer real-API smoke trace captured yet. See
# docs/contracts/provider-lifecycle.md for promotion criteria. The
# agent must surface this tier and ask before defaulting to this
# adapter.
# Encoder note: provider-specific prompt grammar comes from the
#   motion-choreographer encoder table; the scene blueprint stays
#   provider-agnostic (see adapter-contract.md § Blueprint → provider translation).

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="higgsfield"

# Map preset → audio capability. Conservative defaults; tuning table
# lives alongside the prompt library so creators can extend without
# touching this adapter.
higgsfield_audio_for_preset() {
  case "${1:-}" in
    mix|burst|dvd) printf 'none' ;;
    cinematic|talk) printf 'native' ;;
    *) printf 'none' ;;
  esac
}

# Override capability handling so `capability --preset <name>` answers
# per-preset before falling through to the generic helper.
aiv_higgsfield_capability() {
  local preset=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --preset) preset="${2:-}"; shift 2 ;;
      *) shift ;;
    esac
  done
  if [ -n "${preset}" ]; then
    printf '{"audio":"%s","preset":"%s"}\n' \
      "$(higgsfield_audio_for_preset "${preset}")" "${preset}"
    return 0
  fi
  printf '{"audio":"per-model","presets":["mix","burst","dvd","cinematic","talk"],"speak":true}\n'
}

# --- live helpers -----------------------------------------------------
# Higgsfield API (authoritative contract — official higgsfield-js SDK):
#   base   https://platform.higgsfield.ai
#   auth   Authorization: Key <KEY_ID>:<KEY_SECRET>  (api-key + api-key-secret)
#   upload POST /api/v1/upload_file  (multipart)        -> hosted image URL
#   submit POST /v1/image2video/dop                     -> { request_id, status_url }
#   poll   GET  /requests/<id>/status                   -> { status, video:{url} }
# Fields tagged ASSUMED are documented-best-effort and verified on the
# first live smoke (this adapter has no captured smoke trace yet).
HF_BASE_DEFAULT="https://platform.higgsfield.ai"

_hf_secret() {
  _aiv_xpath "(/ai-video/provider[@id='${ADAPTER_ID}']|/ai-video/extra/provider[@id='${ADAPTER_ID}'])/api-key-secret"
}

# Documented base; honour AIV_ENDPOINT only when it points at the
# platform host (the XML default api.higgsfield.ai/v1 is not the SDK base).
_hf_base() {
  case "${AIV_ENDPOINT:-}" in
    *platform.higgsfield.ai*) printf '%s' "${AIV_ENDPOINT%/}" | sed -E 's#/v1/?$##' ;;
    *) printf '%s' "${HF_BASE_DEFAULT}" ;;
  esac
}

_hf_auth() {
  local secret; secret="$(_hf_secret)"
  [ -n "${secret}" ] || aiv_die 6 "${ADAPTER_ID}: api-key-secret missing in agents/.ai-video.xml"
  command -v aiv_redact_register >/dev/null 2>&1 && aiv_redact_register "${secret}"
  printf 'Authorization: Key %s:%s' "${AIV_KEY}" "${secret}"
}

# image2video needs a DoP video model; the XML default may carry an
# image model (e.g. higgsfield-soul) — fall back to dop-turbo and warn.
_hf_model() {
  case "${AIV_MODEL:-}" in
    *dop*|*turbo*) printf '%s' "${AIV_MODEL}" ;;
    *) printf 'dop-turbo'
       printf '%s: XML model "%s" is not a DoP video model; using dop-turbo for image2video\n' \
         "${ADAPTER_ID}" "${AIV_MODEL:-unset}" >&2 ;;
  esac
}

aiv_cmd_submit() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  local stdin_json base auth model ref img_url prompt req resp http body rid
  stdin_json="$(cat)"
  base="$(_hf_base)"; auth="$(_hf_auth)"; model="$(_hf_model)"

  # image2video must animate a still — require ref_images[0].
  ref="$(printf '%s' "${stdin_json}" | jq -r '.ref_images[0] // empty')"
  [ -n "${ref}" ] || aiv_die 7 "${ADAPTER_ID}: image2video requires ref_images[0] (the still to animate)"

  case "${ref}" in
    http://*|https://*) img_url="${ref}" ;;
    *)
      case "${ref}" in /*) : ;; *) ref="$(pwd)/${ref}" ;; esac
      [ -f "${ref}" ] || aiv_die 7 "${ADAPTER_ID}: ref image not found: ${ref}"
      # Upload local still -> hosted URL. Multipart field name ASSUMED 'file'.
      local up up_code up_body
      up="$(curl -sS -w '\n%{http_code}' -X POST "${base}/api/v1/upload_file" \
        -H "${auth}" -F "file=@${ref}")" \
        || aiv_die 8 "${ADAPTER_ID}: upload_file curl failed"
      up_code="$(printf '%s' "${up}" | tail -n1)"; up_body="$(printf '%s' "${up}" | sed '$d')"
      case "${up_code}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: upload HTTP ${up_code}: $(printf '%s' "${up_body}" | head -c 200)" ;; esac
      img_url="$(printf '%s' "${up_body}" | jq -r '.url // .image_url // .file_url // .data.url // empty')"
      [ -n "${img_url}" ] || aiv_die 8 "${ADAPTER_ID}: no URL in upload response (got: $(printf '%s' "${up_body}" | head -c 200))"
      ;;
  esac

  # DoP wants a camera-movement prompt, not the full scene prose.
  prompt="$(printf '%s' "${stdin_json}" | jq -r '
    [.prompt.camera, .prompt.action, .prompt.mood]
    | map(select(. != null and . != "")) | join(". ")')"
  [ -n "${prompt}" ] || prompt="Cinematic camera movement"

  # Live API wraps the request in a "params" object (verified: a flat
  # body returns 422 'body.params required'; params requires prompt +
  # input_images). model lives inside params.
  req="$(jq -n --arg m "${model}" --arg p "${prompt}" --arg u "${img_url}" \
    '{params:{model:$m, prompt:$p, input_images:[{type:"image_url", image_url:$u}]}}')"

  resp="$(curl -sS -w '\n%{http_code}' -X POST "${base}/v1/image2video/dop" \
    -H "${auth}" -H "Content-Type: application/json" --data-binary "${req}")" \
    || aiv_die 8 "${ADAPTER_ID}: image2video curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: submit HTTP ${http}: $(printf '%s' "${body}" | jq -r '.detail // .error // .message // "unknown"' 2>/dev/null | head -c 300)" ;; esac

  rid="$(printf '%s' "${body}" | jq -r '.request_id // .generation_id // .id // empty')"
  [ -n "${rid}" ] || aiv_die 8 "${ADAPTER_ID}: no request_id in submit response (got: $(printf '%s' "${body}" | head -c 200))"
  jq -n --arg id "${rid}" '{job_id:$id}'
}

# Reconstruct the status URL from the request id (status_url also returned by submit).
_hf_status_json() {
  local job_id="${1}" base auth resp http body
  base="$(_hf_base)"; auth="$(_hf_auth)"
  resp="$(curl -sS -w '\n%{http_code}' -X GET "${base}/requests/${job_id}/status" -H "${auth}")" \
    || aiv_die 8 "${ADAPTER_ID}: status curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: status HTTP ${http}" ;; esac
  printf '%s' "${body}"
}

aiv_cmd_poll() {
  local job_id="${1:-}"
  [ -n "${job_id}" ] || aiv_die 2 "${ADAPTER_ID}: poll <job_id> required"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  local st; st="$(_hf_status_json "${job_id}" | jq -r '.status // empty')"
  case "${st}" in
    completed|done|success)          printf '{"status":"done"}\n' ;;
    queued)                          printf '{"status":"queued"}\n' ;;
    in_progress|running|processing)  printf '{"status":"running"}\n' ;;
    failed|nsfw|canceled|cancelled)  printf '{"status":"failed","reason":"%s"}\n' "${st}" ;;
    *)                               printf '{"status":"running","raw":"%s"}\n' "${st:-unknown}" ;;
  esac
}

aiv_cmd_fetch() {
  local job_id="${1:-}"
  [ -n "${job_id}" ] || aiv_die 2 "${ADAPTER_ID}: fetch <job_id> required"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  local body url out
  body="$(_hf_status_json "${job_id}")"
  url="$(printf '%s' "${body}" | jq -r '.video.url // .results.raw.url // .video_url // (.images[0].url) // empty')"
  [ -n "${url}" ] || aiv_die 8 "${ADAPTER_ID}: no video url in status (status=$(printf '%s' "${body}" | jq -r '.status // "?"'))"
  out="${AIV_OUT:-}"; [ -n "${out}" ] || out="$(mktemp -t aiv-hf-XXXXXX).mp4"
  curl -sS -L -o "${out}" "${url}" || aiv_die 8 "${ADAPTER_ID}: download failed: ${url}"
  case "${out}" in /*) : ;; *) out="$(pwd)/${out}" ;; esac
  jq -n --arg p "${out}" '{video_path:$p, audio_embedded:false}'
}

# aiv_cmd_speak — audio-driven lip-sync. Stdin JSON:
#   {input_image: <url>, input_audio: <wav url>, prompt: <string>}
# Animates the portrait's mouth to the supplied vocal WAV via
# POST /v1/speak/higgsfield. Returns {job_id}; poll/fetch are shared.
# Image + audio MUST be public URLs (the platform upload endpoint is
# WAF-gated for non-browser clients). Audio must be WAV.
aiv_cmd_speak() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"
  local stdin_json base auth img aud prompt req resp http body rid
  stdin_json="$(cat)"
  base="$(_hf_base)"; auth="$(_hf_auth)"
  img="$(printf '%s' "${stdin_json}" | jq -r '.input_image // .image_url // (.ref_images[0]?) // empty')"
  aud="$(printf '%s' "${stdin_json}" | jq -r '.input_audio // .audio_url // empty')"
  prompt="$(printf '%s' "${stdin_json}" | jq -r 'if (.prompt|type)=="string" then .prompt else empty end')"
  [ -n "${prompt}" ] || prompt="sing the line with force, mouth moving precisely to the words"
  [ -n "${img}" ] || aiv_die 7 "${ADAPTER_ID}: speak requires input_image (public URL)"
  [ -n "${aud}" ] || aiv_die 7 "${ADAPTER_ID}: speak requires input_audio (public WAV URL)"
  case "${img}" in http://*|https://*) : ;; *) aiv_die 7 "${ADAPTER_ID}: speak input_image must be a public URL (local upload is WAF-gated)" ;; esac
  case "${aud}" in http://*|https://*) : ;; *) aiv_die 7 "${ADAPTER_ID}: speak input_audio must be a public WAV URL" ;; esac
  req="$(jq -n --arg i "${img}" --arg a "${aud}" --arg p "${prompt}" \
    '{params:{input_image:{type:"image_url",image_url:$i},input_audio:{type:"audio_url",audio_url:$a},prompt:$p}}')"
  resp="$(curl -sS -w '\n%{http_code}' -X POST "${base}/v1/speak/higgsfield" \
    -H "${auth}" -H "Content-Type: application/json" --data-binary "${req}")" \
    || aiv_die 8 "${ADAPTER_ID}: speak curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: speak HTTP ${http}: $(printf '%s' "${body}" | jq -r '.detail // .error // .message // "unknown"' 2>/dev/null | head -c 300)" ;; esac
  rid="$(printf '%s' "${body}" | jq -r '.id // .request_id // empty')"
  [ -n "${rid}" ] || aiv_die 8 "${ADAPTER_ID}: speak: no request_id (got: $(printf '%s' "${body}" | head -c 200))"
  jq -n --arg id "${rid}" '{job_id:$id}'
}

# Custom dispatch: capability + speak handled here; submit/poll/fetch/
# run/dry-run fall through to the common router.
sub="${1:-}"
if [ "${sub}" = "capability" ]; then
  shift
  aiv_higgsfield_capability "$@"
  exit 0
fi
if [ "${sub}" = "speak" ]; then
  shift
  aiv_cmd_speak "$@"
  exit 0
fi
aiv_dispatch "${ADAPTER_ID}" "per-model" "$@"
