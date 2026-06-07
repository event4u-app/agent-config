#!/usr/bin/env bash
# replicate.sh — Replicate multiplexer adapter: one adapter, many models.
#
# Capability: per-model. Replicate exposes ONE uniform predictions API
# over many video models (Veo, Kling, Wan, LTX, Hunyuan, …). The model
# is selected via the optional top-level `model_id` stdin key
# (`owner/name` shape, overrides the XML <default-model>); per-model
# capabilities live in lib/model-capabilities/replicate.json and are
# surfaced via `capability --model <id>`.
#
# Predictions API (documented-best-effort — fields tagged ASSUMED are
# verified on the first live smoke; no captured smoke trace yet):
#   base   https://api.replicate.com/v1
#   auth   Authorization: Bearer <API_KEY>
#   submit POST {base}/models/{owner}/{name}/predictions  -> { id, urls:{get} }
#   poll   GET  {base}/predictions/<id>                   -> { status, output }
#   fetch  GET  {base}/predictions/<id>                   -> output url(s)
# Unlike fal, poll/fetch need only the prediction id, so the job_id is
# the raw prediction id (validated as untrusted input on every call).
# poll/fetch are STATELESS — no side-channel state file.
#
# Contract: scripts/ai-video/lib/adapter-contract.md (v2 — trust
# boundary: downloads via aiv_fetch_url, returned paths via
# aiv_validate_artifact_path).
# Provider: top-level <provider id="replicate" kind="video"> in
# agents/.ai-video.xml. Kill-switch: <enabled>false</enabled> on the
# provider block refuses every network subcommand.
#
# Lifecycle: experimental — structural shape conformant; no maintainer
# real-API smoke trace captured yet. See docs/contracts/provider-lifecycle.md
# for promotion criteria. The agent must surface this tier and ask
# before defaulting to this adapter.

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="replicate"
RPL_BASE_DEFAULT="https://api.replicate.com/v1"
RPL_MANIFEST="${AIV_LIB_DIR}/model-capabilities/replicate.json"

_rpl_base() {
  case "${AIV_ENDPOINT:-}" in
    *api.replicate.com*) printf '%s' "${AIV_ENDPOINT%/}" ;;
    *) printf '%s' "${RPL_BASE_DEFAULT}" ;;
  esac
}

_rpl_auth() {
  printf 'Authorization: Bearer %s' "${AIV_KEY}"
}

_rpl_assert_enabled() {
  [ "$(aiv_provider_enabled "${ADAPTER_ID}")" = "true" ] \
    || aiv_die 6 "${ADAPTER_ID}: provider disabled via <enabled>false</enabled> in agents/.ai-video.xml"
}

# _rpl_validate_model_id <model_id> — `owner/name` (optionally a third
# version segment). Tainted input: whitelist charset, no traversal.
_rpl_validate_model_id() {
  local mid="${1:-}"
  [ -n "${mid}" ] || aiv_die 7 "${ADAPTER_ID}: model_id required (stdin model_id or XML <default-model>)"
  printf '%s' "${mid}" | grep -Eq '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)?$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal model_id (expected owner/name): ${mid}"
  case "/${mid}/" in
    */../*|*/./*) aiv_die 7 "${ADAPTER_ID}: illegal model_id: ${mid}" ;;
  esac
  printf '%s' "${mid}"
}

# _rpl_validate_prediction_id <id> — prediction ids are tainted input on
# poll/fetch (they land in the request URL).
_rpl_validate_prediction_id() {
  local pid="${1:-}"
  [ -n "${pid}" ] || aiv_die 2 "${ADAPTER_ID}: job_id required"
  printf '%s' "${pid}" | grep -Eq '^[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal prediction id"
  printf '%s' "${pid}"
}

_rpl_resolve_model() {
  local mid
  mid="$(printf '%s' "${1}" | jq -r '.model_id // empty')"
  [ -n "${mid}" ] || mid="${AIV_MODEL:-}"
  _rpl_validate_model_id "${mid}"
}

_rpl_warn_unverified() {
  local mid="${1}" verified
  [ -f "${RPL_MANIFEST}" ] || return 0
  # NB: jq `//` treats false as falsy — use an explicit null check so a
  # present-but-unverified entry is not misreported as absent.
  verified="$(jq -r --arg m "${mid}" \
    '.models[$m] | if . == null then "absent" elif .verified == true then "true" else "false" end' \
    "${RPL_MANIFEST}" 2>/dev/null)"
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
  _rpl_assert_enabled
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  local stdin_json model base req resp http body pid
  stdin_json="$(cat)"
  printf '%s' "${stdin_json}" | jq -e '.prompt.subject and .prompt.action' >/dev/null \
    || aiv_die 3 "${ADAPTER_ID}: stdin JSON missing required prompt.subject / prompt.action"

  model="$(_rpl_resolve_model "${stdin_json}")"
  _rpl_warn_unverified "${model}"
  base="$(_rpl_base)"

  # Contract prompt blocks -> one prompt string inside `input`; the
  # per-model input differences are documented in
  # lib/model-capabilities/README.md. ASSUMED field names per model are
  # verified on the first live smoke.
  req="$(printf '%s' "${stdin_json}" | jq '{input: ({
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
       then {image: .ref_images[0]}                        else {} end))}')"

  resp="$(curl -sS -w '\n%{http_code}' -X POST "${base}/models/${model}/predictions" \
    -H "$(_rpl_auth)" -H "Content-Type: application/json" \
    --data-binary "${req}")" \
    || aiv_die 8 "${ADAPTER_ID}: submit curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: submit HTTP ${http}: $(printf '%s' "${body}" | jq -r '.detail // .error // .title // "unknown"' 2>/dev/null | head -c 300)" ;; esac

  pid="$(printf '%s' "${body}" | jq -r '.id // empty')"
  [ -n "${pid}" ] || aiv_die 8 "${ADAPTER_ID}: no prediction id in submit response (got: $(printf '%s' "${body}" | head -c 200))"
  jq -n --arg id "${pid}" '{job_id:$id, status:"queued"}'
}

_rpl_prediction_json() {
  local pid="${1}" base resp http body
  base="$(_rpl_base)"
  resp="$(curl -sS -w '\n%{http_code}' -X GET "${base}/predictions/${pid}" -H "$(_rpl_auth)")" \
    || aiv_die 8 "${ADAPTER_ID}: prediction curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: prediction HTTP ${http}" ;; esac
  printf '%s' "${body}"
}

aiv_cmd_poll() {
  local pid
  pid="$(_rpl_validate_prediction_id "${1:-}")"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _rpl_assert_enabled
  local st
  st="$(_rpl_prediction_json "${pid}" | jq -r '.status // empty')"
  case "${st}" in
    succeeded)            printf '{"status":"done"}\n' ;;
    starting)             printf '{"status":"queued"}\n' ;;
    processing)           printf '{"status":"running"}\n' ;;
    failed|canceled)      printf '{"status":"failed","reason":"%s"}\n' "${st}" ;;
    *)                    printf '{"status":"running","raw":"%s"}\n' "${st:-unknown}" ;;
  esac
}

aiv_cmd_fetch() {
  local pid
  pid="$(_rpl_validate_prediction_id "${1:-}")"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _rpl_assert_enabled
  local body url dest root out
  body="$(_rpl_prediction_json "${pid}")"
  # output is a url string, an array of urls, or an object with a url.
  url="$(printf '%s' "${body}" | jq -r '.output
    | if type=="string" then .
      elif type=="array" then .[0]
      elif type=="object" then (.url // .video // empty)
      else empty end')"
  [ -n "${url}" ] || aiv_die 8 "${ADAPTER_ID}: no output url in prediction (status=$(printf '%s' "${body}" | jq -r '.status // "?"'))"

  # Trust boundary (contract v2): scene-scoped dest when the orchestrator
  # scoped us, download via aiv_fetch_url, validate the final path.
  if [ -n "${AIV_PROJECT_DIR:-}" ] && [ -n "${AIV_SCENE_ID:-}" ]; then
    dest="$(aiv_scene_dir "${AIV_PROJECT_DIR}" "${AIV_SCENE_ID}")/scene-${pid}.mp4"
    root="${AIV_PROJECT_DIR}"
  elif [ -n "${AIV_OUT:-}" ]; then
    dest="${AIV_OUT}"
    root="$(dirname "${AIV_OUT}")"
  else
    root="$(mktemp -d -t aiv-rpl-XXXXXX)"
    dest="${root}/scene-${pid}.mp4"
  fi
  aiv_fetch_url "${url}" "${dest}" >/dev/null
  out="$(aiv_validate_artifact_path "${root}" "${dest}")"
  jq -n --arg p "${out}" '{video_path:$p, audio_embedded:false}'
}

# Capability: per-model, answered from the model-capabilities manifest.
aiv_rpl_capability() {
  local model=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --model) model="${2:-}"; shift 2 ;;
      *) shift ;;
    esac
  done
  if [ -n "${model}" ]; then
    aiv_require_cmd jq
    _rpl_validate_model_id "${model}" >/dev/null
    [ -f "${RPL_MANIFEST}" ] || aiv_die 3 "${ADAPTER_ID}: manifest missing: ${RPL_MANIFEST}"
    jq -e --arg m "${model}" '.models[$m]' "${RPL_MANIFEST}" >/dev/null 2>&1 \
      || aiv_die 7 "${ADAPTER_ID}: model not in manifest: ${model}"
    _rpl_warn_unverified "${model}"
    jq --arg m "${model}" \
      '.models[$m] | {audio: (if .audio_sync then "native" else "none" end), model: $m} + .' \
      "${RPL_MANIFEST}"
    return 0
  fi
  if [ -f "${RPL_MANIFEST}" ] && command -v jq >/dev/null 2>&1; then
    jq '{audio:"per-model", models: (.models | keys)}' "${RPL_MANIFEST}"
  else
    printf '{"audio":"per-model"}\n'
  fi
}

sub="${1:-}"
if [ "${sub}" = "capability" ]; then
  shift
  aiv_rpl_capability "$@"
  exit 0
fi
aiv_dispatch "${ADAPTER_ID}" "per-model" "$@"
