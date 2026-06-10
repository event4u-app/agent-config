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
# Lifecycle: stable — promoted 2026-06-10 (maintainer-authorized): live
# image2video round-trip validated 1/1 — 5.4s h264 1168x768, ~5.3min
# render, full presigned-upload flow. Contract re-read from the official
# higgsfield-js SDK after three honest failures exposed wrong ASSUMED
# shapes (auth headers, upload route, poll route — all fixed). Raw trace
# is local-only operator evidence (smoke-traces/, gitignored).
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
# Higgsfield API (authoritative contract — read from the official
# higgsfield-js SDK source 2026-06-10: src/client.ts, src/models/JobSet.ts,
# src/types.ts; the previous Authorization/upload/poll shapes were wrong):
#   base   https://platform.higgsfield.ai
#   auth   TWO headers: hf-api-key: <KEY_ID> + hf-secret: <KEY_SECRET>
#   upload POST /files/generate-upload-url {content_type}
#            -> {upload_url, public_url}; PUT bytes to upload_url,
#            reference public_url in the request
#   submit POST /v1/image2video/dop {params:{…}} -> JobSet {id, jobs:[…]}
#   poll   GET  /v1/job-sets/<id> -> {jobs:[{status, results:{raw:{url}}}]}
#   status enum: queued|in_progress|completed|failed|nsfw|canceled
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

# SDK auth = two headers (hf-api-key + hf-secret), NOT an Authorization
# combo — verified against higgsfield-js src/client.ts.
_hf_auth() {
  printf 'hf-api-key: %s' "${AIV_KEY}"
}

_hf_auth2() {
  local secret; secret="$(_hf_secret)"
  [ -n "${secret}" ] || aiv_die 6 "${ADAPTER_ID}: api-key-secret missing in agents/.ai-video.xml"
  command -v aiv_redact_register >/dev/null 2>&1 && aiv_redact_register "${secret}"
  printf 'hf-secret: %s' "${secret}"
}

# _hf_validate_job_id <id> — job-set ids are tainted input (provider
# response / orchestrator replay); they land in the request URL. Sets
# HF_JOB_ID (global; not command-substituted so aiv_die exits propagate).
_hf_validate_job_id() {
  HF_JOB_ID="${1:-}"
  [ -n "${HF_JOB_ID}" ] || aiv_die 2 "${ADAPTER_ID}: job_id required"
  printf '%s' "${HF_JOB_ID}" | grep -Eq '^[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal job_id: ${HF_JOB_ID}"
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

  local stdin_json base auth auth2 model ref img_url prompt req resp http body rid
  stdin_json="$(cat)"
  base="$(_hf_base)"; auth="$(_hf_auth)"; auth2="$(_hf_auth2)"; model="$(_hf_model)"

  # image2video must animate a still — require ref_images[0].
  ref="$(printf '%s' "${stdin_json}" | jq -r '.ref_images[0] // empty')"
  [ -n "${ref}" ] || aiv_die 7 "${ADAPTER_ID}: image2video requires ref_images[0] (the still to animate)"

  case "${ref}" in
    http://*|https://*) img_url="${ref}" ;;
    *)
      case "${ref}" in /*) : ;; *) ref="$(pwd)/${ref}" ;; esac
      [ -f "${ref}" ] || aiv_die 7 "${ADAPTER_ID}: ref image not found: ${ref}"
      # Upload local still via the SDK's presigned flow:
      # POST /files/generate-upload-url -> {upload_url, public_url};
      # PUT the bytes; reference public_url.
      local ctype up up_code up_body upload_url put_code
      case "${ref}" in
        *.png|*.PNG) ctype="image/png" ;;
        *.webp)      ctype="image/webp" ;;
        *)           ctype="image/jpeg" ;;
      esac
      # Content sniff beats extension when they disagree (artifacts may
      # carry provider-side names like .mp4 for a PNG payload).
      if command -v file >/dev/null 2>&1; then
        case "$(file -b --mime-type "${ref}" 2>/dev/null)" in
          image/png)  ctype="image/png" ;;
          image/jpeg) ctype="image/jpeg" ;;
          image/webp) ctype="image/webp" ;;
        esac
      fi
      up="$(curl -sS -w '\n%{http_code}' -X POST "${base}/files/generate-upload-url" \
        -H "${auth}" -H "${auth2}" -H "Content-Type: application/json" \
        --data-binary "$(jq -nc --arg t "${ctype}" '{content_type:$t}')")" \
        || aiv_die 8 "${ADAPTER_ID}: generate-upload-url curl failed"
      up_code="$(printf '%s' "${up}" | tail -n1)"; up_body="$(printf '%s' "${up}" | sed '$d')"
      case "${up_code}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: generate-upload-url HTTP ${up_code}: $(printf '%s' "${up_body}" | head -c 200)" ;; esac
      upload_url="$(printf '%s' "${up_body}" | jq -r '.upload_url // empty')"
      img_url="$(printf '%s' "${up_body}" | jq -r '.public_url // empty')"
      { [ -n "${upload_url}" ] && [ -n "${img_url}" ]; } \
        || aiv_die 8 "${ADAPTER_ID}: no upload_url/public_url in response (got: $(printf '%s' "${up_body}" | head -c 200))"
      put_code="$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "${upload_url}" \
        -H "Content-Type: ${ctype}" --data-binary "@${ref}")" \
        || aiv_die 8 "${ADAPTER_ID}: presigned PUT curl failed"
      case "${put_code}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: presigned PUT HTTP ${put_code}" ;; esac
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
    -H "${auth}" -H "${auth2}" -H "Content-Type: application/json" --data-binary "${req}")" \
    || aiv_die 8 "${ADAPTER_ID}: image2video curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: submit HTTP ${http}: $(printf '%s' "${body}" | jq -r '.detail // .error // .message // "unknown"' 2>/dev/null | head -c 300)" ;; esac

  # Response is a JobSet {id, jobs:[…]} (SDK models/JobSet.ts); the
  # job-set id is the poll handle.
  rid="$(printf '%s' "${body}" | jq -r '.id // .request_id // empty')"
  [ -n "${rid}" ] || aiv_die 8 "${ADAPTER_ID}: no job-set id in submit response (got: $(printf '%s' "${body}" | head -c 200))"
  _hf_validate_job_id "${rid}"
  jq -n --arg id "${HF_JOB_ID}" '{job_id:$id, status:"queued"}'
}

# Poll handle is the job-set id: GET /v1/job-sets/{id} (SDK JobSet.pollingUrl).
_hf_status_json() {
  local job_id="${1}" base auth auth2 resp http body
  base="$(_hf_base)"; auth="$(_hf_auth)"; auth2="$(_hf_auth2)"
  resp="$(curl -sS -w '\n%{http_code}' -X GET "${base}/v1/job-sets/${job_id}" \
    -H "${auth}" -H "${auth2}")" \
    || aiv_die 8 "${ADAPTER_ID}: status curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: status HTTP ${http}: $(printf '%s' "${body}" | jq -r '.detail // "unknown"' 2>/dev/null | head -c 200)" ;; esac
  printf '%s' "${body}"
}

aiv_cmd_poll() {
  _hf_validate_job_id "${1:-}"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  local body st
  body="$(_hf_status_json "${HF_JOB_ID}")" || exit $?
  st="$(printf '%s' "${body}" | jq -r '.jobs[0].status // .status // empty')"
  case "${st}" in
    completed|done|success)          printf '{"status":"done"}\n' ;;
    queued)                          printf '{"status":"queued"}\n' ;;
    in_progress|running|processing)  printf '{"status":"running"}\n' ;;
    failed|nsfw|canceled|cancelled)  printf '{"status":"failed","reason":"%s"}\n' "${st}" ;;
    *)                               printf '{"status":"running","raw":"%s"}\n' "${st:-unknown}" ;;
  esac
}

aiv_cmd_fetch() {
  _hf_validate_job_id "${1:-}"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  local body url dest root out
  body="$(_hf_status_json "${HF_JOB_ID}")" || exit $?
  # Result lives on the job (SDK types.ts: Results = {raw:{url}, min:{url}}).
  url="$(printf '%s' "${body}" | jq -r '
    .jobs[0].results.raw.url // .jobs[0].results.min.url
    // .video.url // .video_url // empty')"
  [ -n "${url}" ] || aiv_die 8 "${ADAPTER_ID}: no video url in job-set (status=$(printf '%s' "${body}" | jq -r '.jobs[0].status // .status // "?"'))"

  # Trust boundary (contract v2): scene-scoped dir > AIV_OUT > temp dir;
  # download via aiv_fetch_url (size cap + timeout), validate the path.
  if [ -n "${AIV_PROJECT_DIR:-}" ] && [ -n "${AIV_SCENE_ID:-}" ]; then
    dest="$(aiv_scene_dir "${AIV_PROJECT_DIR}" "${AIV_SCENE_ID}")/scene-${HF_JOB_ID}.mp4"
    root="${AIV_PROJECT_DIR}"
  elif [ -n "${AIV_OUT:-}" ]; then
    dest="${AIV_OUT}"
    root="$(dirname "${AIV_OUT}")"
  else
    root="$(mktemp -d -t aiv-hf-XXXXXX)"
    dest="${root}/scene-${HF_JOB_ID}.mp4"
  fi
  aiv_fetch_url "${url}" "${dest}" >/dev/null
  out="$(aiv_validate_artifact_path "${root}" "${dest}")"
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
  local stdin_json base auth auth2 img aud prompt req resp http body rid
  stdin_json="$(cat)"
  base="$(_hf_base)"; auth="$(_hf_auth)"; auth2="$(_hf_auth2)"
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
    -H "${auth}" -H "${auth2}" -H "Content-Type: application/json" --data-binary "${req}")" \
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
