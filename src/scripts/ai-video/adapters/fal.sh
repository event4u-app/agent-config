#!/usr/bin/env bash
# fal.sh — fal.ai multiplexer adapter: one adapter, many video models.
#
# Capability: per-model. fal.ai exposes ONE uniform async queue API over
# dozens of video models (Kling, Wan2.2, LTX-2, Veo, Hunyuan, …). The
# model is selected via the optional top-level `model_id` stdin key
# (overrides the XML <default-model>); per-model capabilities live in
# lib/model-capabilities/fal.json and are surfaced via
# `capability --model <id>`.
#
# Lifecycle: experimental — structural shape conformant; no maintainer
# real-API smoke trace captured yet. See docs/contracts/provider-lifecycle.md
# for promotion criteria. The agent must surface this tier and ask
# before defaulting to this adapter.
#
# Queue API (documented-best-effort — fields tagged ASSUMED are verified
# on the first live smoke; this adapter has no captured smoke trace yet):
#   base   https://queue.fal.run
#   auth   Authorization: Key <API_KEY>
#   submit POST {base}/{model_id}                          -> { request_id }
#   poll   GET  {base}/{app_id}/requests/<id>/status       -> { status }
#   fetch  GET  {base}/{app_id}/requests/<id>              -> { video:{url} }
# where app_id is the first two segments of the model path (ASSUMED:
# queue status/result endpoints address the app, not the full model
# subpath — e.g. submit to fal-ai/kling-video/v2/master/text-to-video,
# poll on fal-ai/kling-video/requests/<id>/status).
#
# job_id encoding: `<model_id>::<request_id>` so poll/fetch stay
# STATELESS (no side-channel state file; every poll call is
# independent). Both segments are re-validated as untrusted input on
# every poll/fetch — see _fal_split_job_id.
#
# Contract: scripts/ai-video/lib/adapter-contract.md (v2 — trust
# boundary: downloads via aiv_fetch_url, returned paths via
# aiv_validate_artifact_path).
# Provider: top-level <provider id="fal" kind="video"> in
# agents/.ai-video.xml. Kill-switch: <enabled>false</enabled> on the
# provider block refuses every network subcommand.

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="fal"
FAL_BASE_DEFAULT="https://queue.fal.run"
FAL_MANIFEST="${AIV_LIB_DIR}/model-capabilities/fal.json"

_fal_base() {
  case "${AIV_ENDPOINT:-}" in
    *queue.fal.run*) printf '%s' "${AIV_ENDPOINT%/}" ;;
    *) printf '%s' "${FAL_BASE_DEFAULT}" ;;
  esac
}

_fal_auth() {
  printf 'Authorization: Key %s' "${AIV_KEY}"
}

# Refuse every network subcommand when the operator flipped the provider
# kill-switch (<enabled>false</enabled>) in agents/.ai-video.xml.
_fal_assert_enabled() {
  [ "$(aiv_provider_enabled "${ADAPTER_ID}")" = "true" ] \
    || aiv_die 6 "${ADAPTER_ID}: provider disabled via <enabled>false</enabled> in agents/.ai-video.xml"
}

# _fal_validate_model_id <model_id> — model ids are tainted input (stdin
# or job_id). Whitelist: path-shaped segments of [A-Za-z0-9._-], no
# leading slash, no parent traversal, no empty segment.
_fal_validate_model_id() {
  local mid="${1:-}"
  [ -n "${mid}" ] || aiv_die 7 "${ADAPTER_ID}: model_id required (stdin model_id or XML <default-model>)"
  printf '%s' "${mid}" | grep -Eq '^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal model_id: ${mid}"
  case "/${mid}/" in
    */../*|*/./*) aiv_die 7 "${ADAPTER_ID}: illegal model_id: ${mid}" ;;
  esac
  printf '%s' "${mid}"
}

# _fal_app_id <model_id> — queue status/result endpoints address the app
# (first two path segments), not the full model subpath. ASSUMED;
# verified on the first live smoke.
_fal_app_id() {
  printf '%s' "${1}" | cut -d/ -f1-2
}

# _fal_split_job_id <job_id> — decode `<model_id>::<request_id>` and
# re-validate both segments as untrusted input. Sets FAL_MODEL_ID and
# FAL_REQUEST_ID.
_fal_split_job_id() {
  local job="${1:-}"
  [ -n "${job}" ] || aiv_die 2 "${ADAPTER_ID}: job_id required"
  case "${job}" in
    *::*) : ;;
    *) aiv_die 7 "${ADAPTER_ID}: malformed job_id (expected <model_id>::<request_id>): ${job}" ;;
  esac
  FAL_MODEL_ID="$(_fal_validate_model_id "${job%%::*}")"
  FAL_REQUEST_ID="${job#*::}"
  printf '%s' "${FAL_REQUEST_ID}" | grep -Eq '^[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal request_id in job_id"
}

# _fal_resolve_model <stdin_json> — stdin `model_id` wins over the XML
# <default-model>; both validated.
_fal_resolve_model() {
  local mid
  mid="$(printf '%s' "${1}" | jq -r '.model_id // empty')"
  [ -n "${mid}" ] || mid="${AIV_MODEL:-}"
  _fal_validate_model_id "${mid}"
}

# _fal_warn_unverified <model_id> — model-capabilities entries without a
# captured smoke trace carry verified:false; never trust them silently.
_fal_warn_unverified() {
  local mid="${1}" verified
  [ -f "${FAL_MANIFEST}" ] || return 0
  # NB: jq `//` treats false as falsy — use an explicit null check so a
  # present-but-unverified entry is not misreported as absent.
  verified="$(jq -r --arg m "${mid}" \
    '.models[$m] | if . == null then "absent" elif .verified == true then "true" else "false" end' \
    "${FAL_MANIFEST}" 2>/dev/null)"
  case "${verified}" in
    true) : ;;
    absent) printf '%s: model %s not in model-capabilities manifest — capabilities unknown\n' \
          "${ADAPTER_ID}" "${mid}" >&2 ;;
    *) printf '%s: model %s capabilities are UNVERIFIED (no smoke trace) — durations/cost are documented-best-effort\n' \
          "${ADAPTER_ID}" "${mid}" >&2 ;;
  esac
}

# Submit: read contract JSON from stdin, return {job_id, status:"queued"}.
aiv_cmd_submit() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _fal_assert_enabled
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  local stdin_json model base req resp http body rid
  stdin_json="$(cat)"
  printf '%s' "${stdin_json}" | jq -e '.prompt.subject and .prompt.action' >/dev/null \
    || aiv_die 3 "${ADAPTER_ID}: stdin JSON missing required prompt.subject / prompt.action"

  model="$(_fal_resolve_model "${stdin_json}")"
  _fal_warn_unverified "${model}"
  base="$(_fal_base)"

  # Contract prompt blocks -> one fal prompt string; the per-model input
  # differences (duration enums, aspect_ratio names) are documented in
  # lib/model-capabilities/README.md. Optional keys map best-effort and
  # are dropped when absent (fal models reject unknown fields: ASSUMED
  # tolerated — verified on first live smoke).
  req="$(printf '%s' "${stdin_json}" | jq '{
    prompt: ([.prompt.style, .prompt.subject, .prompt.environment,
              .prompt.action, .prompt.camera, .prompt.lens,
              .prompt.lighting, .prompt.mood]
             | map(select(. != null and . != "")) | join(". ")),
  }
  + (if .duration   then {duration: .duration}             else {} end)
  + (if .aspect     then {aspect_ratio: .aspect}           else {} end)
  + (if .seed       then {seed: .seed}                     else {} end)
  + (if (.negative // []) | length > 0
       then {negative_prompt: (.negative | join(", "))}    else {} end)
  + (if (.ref_images // []) | length > 0
       then {image_url: .ref_images[0]}                    else {} end)')"

  resp="$(curl -sS -w '\n%{http_code}' -X POST "${base}/${model}" \
    -H "$(_fal_auth)" -H "Content-Type: application/json" \
    --data-binary "${req}")" \
    || aiv_die 8 "${ADAPTER_ID}: submit curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: submit HTTP ${http}: $(printf '%s' "${body}" | jq -r '.detail // .error // .message // "unknown"' 2>/dev/null | head -c 300)" ;; esac

  rid="$(printf '%s' "${body}" | jq -r '.request_id // .requestId // empty')"
  [ -n "${rid}" ] || aiv_die 8 "${ADAPTER_ID}: no request_id in submit response (got: $(printf '%s' "${body}" | head -c 200))"
  jq -n --arg id "${model}::${rid}" '{job_id:$id, status:"queued"}'
}

_fal_status_json() {
  # $1 = app_id, $2 = request_id; echoes the raw status/result body.
  local path="${1}" base resp http body
  base="$(_fal_base)"
  resp="$(curl -sS -w '\n%{http_code}' -X GET "${base}/${path}" -H "$(_fal_auth)")" \
    || aiv_die 8 "${ADAPTER_ID}: status curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: status HTTP ${http}" ;; esac
  printf '%s' "${body}"
}

aiv_cmd_poll() {
  local job_id="${1:-}"
  _fal_split_job_id "${job_id}"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _fal_assert_enabled
  local app st
  app="$(_fal_app_id "${FAL_MODEL_ID}")"
  st="$(_fal_status_json "${app}/requests/${FAL_REQUEST_ID}/status" \
    | jq -r '.status // empty')"
  case "${st}" in
    COMPLETED|completed)             printf '{"status":"done"}\n' ;;
    IN_QUEUE|queued)                 printf '{"status":"queued"}\n' ;;
    IN_PROGRESS|in_progress)         printf '{"status":"running"}\n' ;;
    FAILED|failed|ERROR|error)       printf '{"status":"failed","reason":"%s"}\n' "${st}" ;;
    *)                               printf '{"status":"running","raw":"%s"}\n' "${st:-unknown}" ;;
  esac
}

aiv_cmd_fetch() {
  local job_id="${1:-}"
  _fal_split_job_id "${job_id}"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _fal_assert_enabled
  local app body url dest root out
  app="$(_fal_app_id "${FAL_MODEL_ID}")"
  body="$(_fal_status_json "${app}/requests/${FAL_REQUEST_ID}")"
  url="$(printf '%s' "${body}" | jq -r '.video.url // .videos[0].url // .output.url // empty')"
  [ -n "${url}" ] || aiv_die 8 "${ADAPTER_ID}: no video url in result (status=$(printf '%s' "${body}" | jq -r '.status // "?"'))"

  # Trust boundary (contract v2): write into the scene-scoped dir when the
  # orchestrator scoped us (AIV_PROJECT_DIR + AIV_SCENE_ID), else AIV_OUT,
  # else a temp dir. Download via aiv_fetch_url (size cap + timeout) and
  # validate the final path against its scope root.
  if [ -n "${AIV_PROJECT_DIR:-}" ] && [ -n "${AIV_SCENE_ID:-}" ]; then
    dest="$(aiv_scene_dir "${AIV_PROJECT_DIR}" "${AIV_SCENE_ID}")/scene-${FAL_REQUEST_ID}.mp4"
    root="${AIV_PROJECT_DIR}"
  elif [ -n "${AIV_OUT:-}" ]; then
    dest="${AIV_OUT}"
    root="$(dirname "${AIV_OUT}")"
  else
    root="$(mktemp -d -t aiv-fal-XXXXXX)"
    dest="${root}/scene-${FAL_REQUEST_ID}.mp4"
  fi
  aiv_fetch_url "${url}" "${dest}" >/dev/null
  out="$(aiv_validate_artifact_path "${root}" "${dest}")"
  jq -n --arg p "${out}" '{video_path:$p, audio_embedded:false}'
}

# Capability: per-model. `capability --model <id>` answers from the
# model-capabilities manifest (audio_sync -> audio native|none) and
# carries the verified flag so consumers never over-trust
# documented-best-effort entries.
aiv_fal_capability() {
  local model=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --model) model="${2:-}"; shift 2 ;;
      *) shift ;;
    esac
  done
  if [ -n "${model}" ]; then
    aiv_require_cmd jq
    _fal_validate_model_id "${model}" >/dev/null
    [ -f "${FAL_MANIFEST}" ] || aiv_die 3 "${ADAPTER_ID}: manifest missing: ${FAL_MANIFEST}"
    jq -e --arg m "${model}" '.models[$m]' "${FAL_MANIFEST}" >/dev/null 2>&1 \
      || aiv_die 7 "${ADAPTER_ID}: model not in manifest: ${model}"
    _fal_warn_unverified "${model}"
    jq --arg m "${model}" \
      '.models[$m] | {audio: (if .audio_sync then "native" else "none" end), model: $m} + .' \
      "${FAL_MANIFEST}"
    return 0
  fi
  if [ -f "${FAL_MANIFEST}" ] && command -v jq >/dev/null 2>&1; then
    jq '{audio:"per-model", models: (.models | keys)}' "${FAL_MANIFEST}"
  else
    printf '{"audio":"per-model"}\n'
  fi
}

# Custom dispatch: capability handled here (per-model manifest lookup);
# everything else falls through to the common router.
sub="${1:-}"
if [ "${sub}" = "capability" ]; then
  shift
  aiv_fal_capability "$@"
  exit 0
fi
aiv_dispatch "${ADAPTER_ID}" "per-model" "$@"
