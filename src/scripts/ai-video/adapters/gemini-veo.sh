#!/usr/bin/env bash
# gemini-veo.sh — Google Gemini Veo video generation adapter.
#
# Capability: audio=native. Veo accepts dialogue + ambient sound blocks
# and returns a muxed MP4. Async API: submit → poll (predictLongRunning)
# → fetch. The orchestrator drives all three subcommands; this script
# never auto-retries.
#
# Lifecycle: stable — promoted 2026-06-10 (maintainer-authorized): 10/10 live
# renders succeeded (veo-3.0-generate-001) at ~$1.60/render (4s × $0.40/s),
# 4s h264 MP4 with native AAC audio, ~40–70s round-trip. Traces + artifacts
# are LOCAL-ONLY operator evidence under agents/reference/ai-video/smoke-traces/
# (gitignored). Operational caveat: daily quota ≈ 10 renders/day on the
# validated tier — batch pipelines must budget for it (HTTP 429 pre-submit,
# no spend).
#
# Live API (Gemini API, documented-best-effort — fields tagged ASSUMED
# are verified on the first live smoke):
#   base   https://generativelanguage.googleapis.com/v1beta
#   auth   x-goog-api-key: <API_KEY>
#   submit POST {base}/models/{model}:predictLongRunning
#          {"instances":[{"prompt":"…"}],"parameters":{…}}
#          -> {"name":"models/<model>/operations/<op_id>"}
#   poll   GET  {base}/{operation_name}
#          -> {"done":bool, "response":{…}} | {"done":true,"error":{…}}
#   fetch  re-GET the done operation; download
#          response.generateVideoResponse.generatedSamples[0].video.uri
#          (the file URI requires the same x-goog-api-key header).
#
# job_id = the operation name (`models/<model>/operations/<op_id>`) so
# poll/fetch stay STATELESS. Re-validated as untrusted input on every
# poll/fetch — see _veo_validate_op_name.
#
# Duration: Veo 3 renders fixed-length clips (8s default; durationSeconds
# 4|6|8 ASSUMED accepted on veo-3.0 GA — stdin `duration` is clamped to
# that enum and passed best-effort; a rejected parameter surfaces as a
# submit HTTP error, never silently).
#
# Contract: scripts/ai-video/lib/adapter-contract.md (v2 — trust
# boundary: downloads via aiv_fetch_url, returned paths via
# aiv_validate_artifact_path).
# Provider: top-level <provider id="gemini-veo" kind="video"> in
# agents/.ai-video.xml. Kill-switch: <enabled>false</enabled> on the
# provider block refuses every network subcommand.
# Encoder note: provider-specific prompt grammar comes from the
#   motion-choreographer encoder table; the scene blueprint stays
#   provider-agnostic (see adapter-contract.md § Blueprint → provider translation).

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="gemini-veo"
VEO_BASE_DEFAULT="https://generativelanguage.googleapis.com/v1beta"

_veo_base() {
  case "${AIV_ENDPOINT:-}" in
    *generativelanguage.googleapis.com*) printf '%s' "${AIV_ENDPOINT%/}" ;;
    *) printf '%s' "${VEO_BASE_DEFAULT}" ;;
  esac
}

_veo_auth() {
  printf 'x-goog-api-key: %s' "${AIV_KEY}"
}

# Refuse every network subcommand when the operator flipped the provider
# kill-switch (<enabled>false</enabled>) in agents/.ai-video.xml.
_veo_assert_enabled() {
  [ "$(aiv_provider_enabled "${ADAPTER_ID}")" = "true" ] \
    || aiv_die 6 "${ADAPTER_ID}: provider disabled via <enabled>false</enabled> in agents/.ai-video.xml"
}

# _veo_validate_op_name <job_id> — operation names are tainted input
# (returned by the provider on submit, replayed by the orchestrator on
# poll/fetch). Whitelist the documented shape, no traversal, no empty
# segment. Sets VEO_OP (global) — deliberately NOT echoed/command-
# substituted so aiv_die's exit reaches the caller (a $() subshell would
# swallow it).
_veo_validate_op_name() {
  VEO_OP="${1:-}"
  [ -n "${VEO_OP}" ] || aiv_die 2 "${ADAPTER_ID}: job_id (operation name) required"
  printf '%s' "${VEO_OP}" | grep -Eq '^models/[A-Za-z0-9._-]+/operations/[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal operation name: ${VEO_OP}"
}

# _veo_model_rate_usd_per_s <model> — modeled per-second USD rate for
# cost_estimate (documented-best-effort; ASSUMED until the live smoke +
# the provider invoice confirm). Unknown models → empty (cost "unknown").
_veo_model_rate_usd_per_s() {
  case "${1:-}" in
    veo-3.0-fast*) printf '0.15' ;;
    veo-3.0*)      printf '0.40' ;;
    veo-2.0*)      printf '0.35' ;;
    *)             printf '' ;;
  esac
}

# _veo_op_json <operation_name> — GET the long-running operation; echoes
# the raw body.
_veo_op_json() {
  local op="${1}" base resp http body
  base="$(_veo_base)"
  resp="$(curl -sS -w '\n%{http_code}' -X GET "${base}/${op}" -H "$(_veo_auth)")" \
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
  _veo_assert_enabled
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  local stdin_json model base req resp http body op dur rate cost
  stdin_json="$(cat)"
  # Validate required prompt blocks early so a bad blueprint fails
  # before any network call would happen.
  printf '%s' "${stdin_json}" | jq -e '.prompt.subject and .prompt.action' >/dev/null \
    || aiv_die 3 "${ADAPTER_ID}: stdin JSON missing required prompt.subject / prompt.action"

  model="${AIV_MODEL:-veo-3.0-generate-001}"
  base="$(_veo_base)"

  # stdin duration → Veo durationSeconds enum {4,6,8} (clamp, ASSUMED).
  dur="$(printf '%s' "${stdin_json}" | jq -r '
    if .duration == null then 8
    elif .duration <= 4 then 4
    elif .duration <= 6 then 6
    else 8 end')"

  # Contract prompt blocks -> one Veo prompt string. Optional keys map
  # best-effort (negativePrompt, seed: ASSUMED accepted) and are dropped
  # when absent. ref_images (image-to-video) is NOT wired yet — text-to-
  # video only; an extension wires instances[0].image with inline bytes.
  req="$(printf '%s' "${stdin_json}" | jq --argjson dur "${dur}" '{
    instances: [{
      prompt: ([.prompt.style, .prompt.subject, .prompt.environment,
                .prompt.action, .prompt.camera, .prompt.lens,
                .prompt.lighting, .prompt.mood]
               | map(select(. != null and . != "")) | join(". "))
    }],
    parameters: ({durationSeconds: $dur}
      + (if .aspect then {aspectRatio: .aspect} else {} end)
      + (if .seed   then {seed: .seed}          else {} end)
      + (if (.negative // []) | length > 0
           then {negativePrompt: (.negative | join(", "))} else {} end))
  }')"

  resp="$(curl -sS -w '\n%{http_code}' -X POST "${base}/models/${model}:predictLongRunning" \
    -H "$(_veo_auth)" -H "Content-Type: application/json" \
    --data-binary "${req}")" \
    || aiv_die 8 "${ADAPTER_ID}: submit curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: submit HTTP ${http}: $(printf '%s' "${body}" | jq -r '.error.message // .error.status // "unknown"' 2>/dev/null | head -c 300)" ;; esac

  op="$(printf '%s' "${body}" | jq -r '.name // empty')"
  [ -n "${op}" ] || aiv_die 8 "${ADAPTER_ID}: no operation name in submit response (got: $(printf '%s' "${body}" | head -c 200))"
  _veo_validate_op_name "${op}"

  # cost_estimate: modeled rate × requested seconds; unknown model rate
  # → "unknown" (contract v2: unpriceable is "unknown", never 0).
  rate="$(_veo_model_rate_usd_per_s "${model}")"
  if [ -n "${rate}" ]; then
    cost="$(jq -n --argjson r "${rate}" --argjson d "${dur}" '$r * $d')"
    jq -n --arg id "${op}" --argjson c "${cost}" \
      '{job_id:$id, status:"queued", cost_estimate:$c}'
  else
    jq -n --arg id "${op}" '{job_id:$id, status:"queued", cost_estimate:"unknown"}'
  fi
}

# Poll: check the long-running operation. Stateless — the operation name
# IS the job_id.
aiv_cmd_poll() {
  local job_id="${1:-}" op body done_flag err
  _veo_validate_op_name "${job_id}"; op="${VEO_OP}"
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  aiv_assert_dryrun
  _veo_assert_enabled
  body="$(_veo_op_json "${op}")" || exit $?
  done_flag="$(printf '%s' "${body}" | jq -r '.done // false')"
  err="$(printf '%s' "${body}" | jq -r '.error.message // empty')"
  if [ -n "${err}" ]; then
    jq -n --arg r "${err}" '{status:"failed", reason:$r}'
  elif [ "${done_flag}" = "true" ]; then
    printf '{"status":"done"}\n'
  else
    printf '{"status":"running"}\n'
  fi
}

# Fetch: re-read the done operation, download the muxed MP4 through the
# v2 trust boundary (aiv_fetch_url size-cap/timeout + auth header;
# aiv_validate_artifact_path against the scope root).
aiv_cmd_fetch() {
  local job_id="${1:-}" op body url dest root out
  _veo_validate_op_name "${job_id}"; op="${VEO_OP}"
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  aiv_assert_dryrun
  _veo_assert_enabled
  body="$(_veo_op_json "${op}")" || exit $?
  [ "$(printf '%s' "${body}" | jq -r '.done // false')" = "true" ] \
    || aiv_die 8 "${ADAPTER_ID}: fetch before operation done (poll first): ${op}"

  url="$(printf '%s' "${body}" | jq -r '
    .response.generateVideoResponse.generatedSamples[0].video.uri
    // .response.generatedVideos[0].video.uri // empty')"
  if [ -z "${url}" ]; then
    # Surface RAI filtering honestly instead of a bare "no url".
    local rai
    rai="$(printf '%s' "${body}" | jq -r '
      .response.generateVideoResponse.raiMediaFilteredReasons[0] // empty')"
    [ -n "${rai}" ] && aiv_die 8 "${ADAPTER_ID}: render filtered by provider safety (RAI): ${rai}"
    aiv_die 8 "${ADAPTER_ID}: no video uri in done operation (got: $(printf '%s' "${body}" | jq -c '.response // {}' | head -c 200))"
  fi

  # Trust boundary (contract v2): write into the scene-scoped dir when the
  # orchestrator scoped us (AIV_PROJECT_DIR + AIV_SCENE_ID), else AIV_OUT,
  # else a temp dir.
  local op_id="${op##*/}"
  if [ -n "${AIV_PROJECT_DIR:-}" ] && [ -n "${AIV_SCENE_ID:-}" ]; then
    dest="$(aiv_scene_dir "${AIV_PROJECT_DIR}" "${AIV_SCENE_ID}")/scene-${op_id}.mp4"
    root="${AIV_PROJECT_DIR}"
  elif [ -n "${AIV_OUT:-}" ]; then
    dest="${AIV_OUT}"
    root="$(dirname "${AIV_OUT}")"
  else
    root="$(mktemp -d -t aiv-veo-XXXXXX)"
    dest="${root}/scene-${op_id}.mp4"
  fi
  AIV_FETCH_HEADER="$(_veo_auth)" aiv_fetch_url "${url}" "${dest}" >/dev/null
  out="$(aiv_validate_artifact_path "${root}" "${dest}")"
  jq -n --arg p "${out}" '{video_path:$p, audio_embedded:true}'
}

aiv_dispatch "${ADAPTER_ID}" "native" "$@"
