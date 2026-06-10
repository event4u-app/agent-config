#!/usr/bin/env bash
# kling.sh — Kuaishou Kling motion-tuned video generation adapter.
#
# Capability: audio=none by default (Kling current generation does not
# emit native audio); the orchestrator muxes operator-supplied dialogue
# / ambient at stitch time. Max duration is model-dependent; clip-time
# clamping happens in motion-choreographer (it tunes the prompt to fit).
#
# Lifecycle: stable — promoted 2026-06-10 (maintainer-authorized): live
# round-trip validated 1/1 (5.04s h264 720p, video-only as expected,
# ~$1.40 kling-v2-master 5s std; ~2.3min render). JWT keypair auth
# reference-verified. Raw trace is local-only operator evidence
# (agents/reference/ai-video/smoke-traces/, gitignored).
# See docs/contracts/provider-lifecycle.md for tier semantics.
#
# Auth: Kling has NO single API token. The console issues an
# AccessKey + SecretKey pair (<access-key>/<secret-key> in
# agents/.ai-video.xml); every request carries a short-lived HS256 JWT
# signed locally from that pair:
#   header  {"alg":"HS256","typ":"JWT"}
#   payload {"iss":<access-key>,"exp":now+1800,"nbf":now-5}
#   Authorization: Bearer <jwt>
#
# Live API (documented-best-effort — fields tagged ASSUMED are verified
# on the first live smoke):
#   base   https://api.klingai.com/v1   (from XML <endpoint>)
#   submit POST {base}/videos/text2video
#          {"model_name","prompt","negative_prompt","duration":"5"|"10",
#           "aspect_ratio","mode":"std"} -> {code:0,data:{task_id}}
#   poll   GET  {base}/videos/text2video/{task_id}
#          -> data.task_status: submitted|processing|succeed|failed
#   fetch  re-GET; download data.task_result.videos[0].url (CDN link).
#
# job_id = the provider task_id; re-validated as untrusted input on
# every poll/fetch (charset whitelist, no traversal).
#
# Contract: scripts/ai-video/lib/adapter-contract.md (v2 — trust
# boundary: downloads via aiv_fetch_url, returned paths via
# aiv_validate_artifact_path).
# Provider: top-level <provider id="kling" kind="video"> in
# agents/.ai-video.xml. Kill-switch: <enabled>false</enabled>.
# Encoder note: provider-specific prompt grammar comes from the
#   motion-choreographer encoder table; the scene blueprint stays
#   provider-agnostic (see adapter-contract.md § Blueprint → provider translation).

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="kling"
KLING_MAX_DURATION="${KLING_MAX_DURATION:-10}"

_kling_assert_enabled() {
  [ "$(aiv_provider_enabled "${ADAPTER_ID}")" = "true" ] \
    || aiv_die 6 "${ADAPTER_ID}: provider disabled via <enabled>false</enabled> in agents/.ai-video.xml"
}

_kling_require_keypair() {
  [ "$(aiv_keypair_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: access-key/secret-key pair missing in agents/.ai-video.xml (Kling uses AccessKey+SecretKey, not an API token)"
}

# _kling_b64url — base64url-encode stdin (no padding), JWT-style.
_kling_b64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

# _kling_jwt — mint the short-lived HS256 JWT from the keypair. Echoes
# the token; registers it with the redactor so it never leaks to logs.
_kling_jwt() {
  local now header payload signing_input sig jwt
  now="$(date +%s)"
  header='{"alg":"HS256","typ":"JWT"}'
  payload="$(jq -nc --arg iss "${AIV_ACCESS_KEY}" \
    --argjson exp "$((now + 1800))" --argjson nbf "$((now - 5))" \
    '{iss:$iss, exp:$exp, nbf:$nbf}')"
  signing_input="$(printf '%s' "${header}" | _kling_b64url).$(printf '%s' "${payload}" | _kling_b64url)"
  sig="$(printf '%s' "${signing_input}" \
    | openssl dgst -sha256 -hmac "${AIV_SECRET_KEY}" -binary | _kling_b64url)"
  jwt="${signing_input}.${sig}"
  command -v aiv_redact_register >/dev/null 2>&1 && aiv_redact_register "${jwt}"
  printf '%s' "${jwt}"
}

# _kling_validate_task_id <id> — task ids are tainted input (provider
# response / orchestrator replay). Charset whitelist, no traversal.
# Sets KLING_TASK_ID (global; not command-substituted so aiv_die's exit
# reaches the caller).
_kling_validate_task_id() {
  KLING_TASK_ID="${1:-}"
  [ -n "${KLING_TASK_ID}" ] || aiv_die 2 "${ADAPTER_ID}: job_id (task_id) required"
  printf '%s' "${KLING_TASK_ID}" | grep -Eq '^[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal task_id: ${KLING_TASK_ID}"
}

# _kling_model_rate_usd <model> <duration> — modeled per-clip USD for
# cost_estimate (documented-best-effort; ASSUMED until the live smoke +
# the provider invoice confirm). Unknown models → empty ("unknown").
_kling_model_rate_usd() {
  local model="${1:-}" dur="${2:-5}" per5=""
  case "${model}" in
    kling-v2*) per5='1.40' ;;
    kling-v1*) per5='0.35' ;;
    *)         per5='' ;;
  esac
  [ -n "${per5}" ] || { printf ''; return 0; }
  if [ "${dur}" = "10" ]; then
    jq -n --argjson r "${per5}" '$r * 2'
  else
    printf '%s' "${per5}"
  fi
}

# _kling_task_json <task_id> — GET the task; echoes the raw body after
# asserting transport + provider `code` success.
_kling_task_json() {
  local task_id="${1}" base resp http body code
  base="${AIV_ENDPOINT%/}"
  resp="$(curl -sS -w '\n%{http_code}' -X GET "${base}/videos/text2video/${task_id}" \
    -H "Authorization: Bearer $(_kling_jwt)")" \
    || aiv_die 8 "${ADAPTER_ID}: poll curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: poll HTTP ${http}: $(printf '%s' "${body}" | jq -r '.message // "unknown"' 2>/dev/null | head -c 300)" ;; esac
  code="$(printf '%s' "${body}" | jq -r '.code // 0')"
  [ "${code}" = "0" ] || aiv_die 8 "${ADAPTER_ID}: provider error code ${code}: $(printf '%s' "${body}" | jq -r '.message // "unknown"' | head -c 300)"
  printf '%s' "${body}"
}

# Submit: read contract JSON from stdin, return {job_id, status:"queued",
# cost_estimate?}.
aiv_cmd_submit() {
  aiv_require_cmd curl jq openssl
  aiv_load_provider "${ADAPTER_ID}"
  aiv_assert_dryrun
  _kling_assert_enabled
  _kling_require_keypair

  local stdin_json duration model base req resp http body code task_id dur_s rate
  stdin_json="$(cat)"
  printf '%s' "${stdin_json}" | jq -e '.prompt.subject and .prompt.action' >/dev/null \
    || aiv_die 3 "${ADAPTER_ID}: stdin JSON missing required prompt.subject / prompt.action"

  duration="$(printf '%s' "${stdin_json}" | jq -r '.duration // empty')"
  if [ -n "${duration}" ]; then
    awk -v d="${duration}" -v m="${KLING_MAX_DURATION}" \
      'BEGIN { if (d+0 > m+0) exit 1; exit 0 }' \
      || aiv_die 3 "${ADAPTER_ID}: duration ${duration}s exceeds model max ${KLING_MAX_DURATION}s"
  fi
  # Kling accepts the duration enum {"5","10"} (string). Clamp upward.
  dur_s="$(printf '%s' "${stdin_json}" | jq -r 'if .duration == null then "5" elif .duration <= 5 then "5" else "10" end')"

  model="${AIV_MODEL:-kling-v2-master}"
  base="${AIV_ENDPOINT%/}"

  # Contract prompt blocks -> one Kling prompt string; optional keys map
  # best-effort (negative_prompt, aspect_ratio; mode "std": ASSUMED).
  req="$(printf '%s' "${stdin_json}" | jq --arg model "${model}" --arg dur "${dur_s}" '{
    model_name: $model,
    mode: "std",
    duration: $dur,
    prompt: ([.prompt.style, .prompt.subject, .prompt.environment,
              .prompt.action, .prompt.camera, .prompt.lens,
              .prompt.lighting, .prompt.mood]
             | map(select(. != null and . != "")) | join(". "))
  }
  + (if .aspect then {aspect_ratio: .aspect} else {} end)
  + (if (.negative // []) | length > 0
       then {negative_prompt: (.negative | join(", "))} else {} end)')"

  resp="$(curl -sS -w '\n%{http_code}' -X POST "${base}/videos/text2video" \
    -H "Authorization: Bearer $(_kling_jwt)" -H "Content-Type: application/json" \
    --data-binary "${req}")" \
    || aiv_die 8 "${ADAPTER_ID}: submit curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: submit HTTP ${http}: $(printf '%s' "${body}" | jq -r '.message // "unknown"' 2>/dev/null | head -c 300)" ;; esac
  code="$(printf '%s' "${body}" | jq -r '.code // 0')"
  [ "${code}" = "0" ] || aiv_die 8 "${ADAPTER_ID}: provider error code ${code}: $(printf '%s' "${body}" | jq -r '.message // "unknown"' | head -c 300)"

  task_id="$(printf '%s' "${body}" | jq -r '.data.task_id // empty')"
  [ -n "${task_id}" ] || aiv_die 8 "${ADAPTER_ID}: no task_id in submit response (got: $(printf '%s' "${body}" | head -c 200))"
  _kling_validate_task_id "${task_id}"

  rate="$(_kling_model_rate_usd "${model}" "${dur_s}")"
  if [ -n "${rate}" ]; then
    jq -n --arg id "${KLING_TASK_ID}" --argjson c "${rate}" \
      '{job_id:$id, status:"queued", cost_estimate:$c}'
  else
    jq -n --arg id "${KLING_TASK_ID}" '{job_id:$id, status:"queued", cost_estimate:"unknown"}'
  fi
}

# Poll: stateless — the task_id IS the job_id.
aiv_cmd_poll() {
  _kling_validate_task_id "${1:-}"
  aiv_require_cmd curl jq openssl
  aiv_load_provider "${ADAPTER_ID}"
  aiv_assert_dryrun
  _kling_assert_enabled
  _kling_require_keypair
  local body st msg
  body="$(_kling_task_json "${KLING_TASK_ID}")" || exit $?
  st="$(printf '%s' "${body}" | jq -r '.data.task_status // empty')"
  case "${st}" in
    succeed)              printf '{"status":"done"}\n' ;;
    submitted)            printf '{"status":"queued"}\n' ;;
    processing)           printf '{"status":"running"}\n' ;;
    failed)
      msg="$(printf '%s' "${body}" | jq -r '.data.task_status_msg // "failed"' | head -c 200)"
      jq -n --arg r "${msg}" '{status:"failed", reason:$r}' ;;
    *)                    printf '{"status":"running","raw":"%s"}\n' "${st:-unknown}" ;;
  esac
}

# Fetch: re-read the succeeded task, download the MP4 through the v2
# trust boundary (size-cap fetch + path validation).
aiv_cmd_fetch() {
  _kling_validate_task_id "${1:-}"
  aiv_require_cmd curl jq openssl
  aiv_load_provider "${ADAPTER_ID}"
  aiv_assert_dryrun
  _kling_assert_enabled
  _kling_require_keypair
  local body st url dest root out
  body="$(_kling_task_json "${KLING_TASK_ID}")" || exit $?
  st="$(printf '%s' "${body}" | jq -r '.data.task_status // empty')"
  [ "${st}" = "succeed" ] \
    || aiv_die 8 "${ADAPTER_ID}: fetch before task succeed (status=${st:-unknown}; poll first)"

  url="$(printf '%s' "${body}" | jq -r '.data.task_result.videos[0].url // empty')"
  [ -n "${url}" ] || aiv_die 8 "${ADAPTER_ID}: no video url in succeeded task (got: $(printf '%s' "${body}" | jq -c '.data.task_result // {}' | head -c 200))"

  if [ -n "${AIV_PROJECT_DIR:-}" ] && [ -n "${AIV_SCENE_ID:-}" ]; then
    dest="$(aiv_scene_dir "${AIV_PROJECT_DIR}" "${AIV_SCENE_ID}")/scene-${KLING_TASK_ID}.mp4"
    root="${AIV_PROJECT_DIR}"
  elif [ -n "${AIV_OUT:-}" ]; then
    dest="${AIV_OUT}"
    root="$(dirname "${AIV_OUT}")"
  else
    root="$(mktemp -d -t aiv-kling-XXXXXX)"
    dest="${root}/scene-${KLING_TASK_ID}.mp4"
  fi
  aiv_fetch_url "${url}" "${dest}" >/dev/null
  out="$(aiv_validate_artifact_path "${root}" "${dest}")"
  jq -n --arg p "${out}" '{video_path:$p, audio_embedded:false}'
}

aiv_dispatch "${ADAPTER_ID}" "none" "$@"
