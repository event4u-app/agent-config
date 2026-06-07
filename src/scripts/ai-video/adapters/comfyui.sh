#!/usr/bin/env bash
# comfyui.sh — local ComfyUI multiplexer adapter: the local-free render
# path for GPU users (Wan2.2 TI2V-5B default template, LTX-2 for
# audio-sync). Sandbox model locked by ADR-060 — read it before touching
# the live path.
#
# Capability: per-model (wan22-ti2v-5b = silent video, ltx-2 = audio
# native). Model selected via the optional top-level `model_id` stdin key
# (overrides the XML <default-model>); per-model capabilities live in
# lib/model-capabilities/comfyui.json (`capability --model <id>`).
#
# Lifecycle: experimental — structural shape conformant; no maintainer
# smoke trace against a real containerized ComfyUI captured yet. See
# docs/contracts/provider-lifecycle.md for promotion criteria.
#
# Sandbox posture (ADR-060 §1 — container-primary, remote escape hatch):
#   - The documented install path is a containerized ComfyUI:
#     read-only image, --cap-drop ALL --cap-add SYS_NICE, models volume
#     read-only, per-project artifacts volume as the only writable
#     surface, --network none at generation time
#     (COMFYUI_ALLOW_NETWORK=true only for model-download sessions).
#     Example run line:
#       docker run --rm --gpus all --read-only \
#         --cap-drop ALL --cap-add SYS_NICE --network none \
#         -v "$MODELS_DIR":/models:ro -v "$PROJECT_DIR":/artifacts \
#         -p 127.0.0.1:8188:8188 <comfyui-image>
#   - A LOOPBACK endpoint (http://127.0.0.1:* / http://localhost:*) is
#     assumed to be that container. Any other endpoint is the remote
#     escape hatch: the operator owns its isolation and MUST mark the
#     provider block with <unsandboxed>accepted</unsandboxed> — the
#     adapter refuses otherwise (exit 6). macOS has no CUDA: the
#     container path is reference-only there; remote is the macOS path.
#
# Shipped templates only (ADR-060 §3): the workflow graph comes from
# lib/comfyui-templates/<template>.json named by the model manifest.
# Operator-supplied workflow JSONs are rejected by construction (there
# is no input that accepts one). Parameter substitution is jq-only
# (JSON-safe); numeric slots are charset-validated.
#
# Pinned-node allowlist (ADR-060 §2): every class_type in the resolved
# graph must appear in lib/comfyui-nodes.allowlist.json
# (core_class_types or a pinned custom_nodes entry) — defense in depth
# against template tampering. Unknown node → exit 7, named. No bypass
# flag exists.
#
# HTTP API (documented-best-effort — verified on first live smoke):
#   submit POST {base}/prompt   {"prompt": <graph>}      -> { prompt_id }
#   poll   GET  {base}/history/<prompt_id>               -> {} until done
#   fetch  GET  {base}/history/<prompt_id> -> outputs -> /view download
#   upload POST {base}/upload/image (multipart)          -> { name }
#
# cost_estimate: a local render is a KNOWN 0.0 (no provider charge) —
# distinct from an omitted estimate (unknown); ADR-060 §5.
#
# Contract: scripts/ai-video/lib/adapter-contract.md (v2 + the
# local-source rule: a kind="local" provider consumes validated local
# input paths; the https-only rule is for hosted providers that must
# fetch the bytes).
# Provider block (agents/.ai-video.xml):
#   <provider id="comfyui" kind="video">
#     <lifecycle>experimental</lifecycle>
#     <enabled>true</enabled>
#     <endpoint>http://127.0.0.1:8188</endpoint>
#     <default-model>wan22-ti2v-5b</default-model>
#   </provider>
# Kill-switch: <enabled>false</enabled> refuses every network subcommand.

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="comfyui"
COMFYUI_BASE_DEFAULT="http://127.0.0.1:8188"
COMFYUI_MANIFEST="${AIV_LIB_DIR}/model-capabilities/comfyui.json"
COMFYUI_ALLOWLIST="${AIV_LIB_DIR}/comfyui-nodes.allowlist.json"

_comfyui_base() {
  case "${AIV_ENDPOINT:-}" in
    http://*|https://*) printf '%s' "${AIV_ENDPOINT%/}" ;;
    *) printf '%s' "${COMFYUI_BASE_DEFAULT}" ;;
  esac
}

_comfyui_assert_enabled() {
  [ "$(aiv_provider_enabled "${ADAPTER_ID}")" = "true" ] \
    || aiv_die 6 "${ADAPTER_ID}: provider disabled via <enabled>false</enabled> in agents/.ai-video.xml"
}

# Sandbox posture gate (ADR-060 §1). Loopback = the shipped container.
# Anything else is the remote escape hatch and needs the explicit
# operator-owned-risk marker <unsandboxed>accepted</unsandboxed>.
_comfyui_assert_posture() {
  local base unsandboxed
  base="$(_comfyui_base)"
  case "${base}" in
    http://127.0.0.1|http://127.0.0.1:*|http://localhost|http://localhost:*)
      return 0 ;;
  esac
  unsandboxed="$(_aiv_xpath "(/ai-video/provider[@id='${ADAPTER_ID}']|/ai-video/extra/provider[@id='${ADAPTER_ID}'])/unsandboxed")"
  if [ "${unsandboxed}" = "accepted" ]; then
    printf '%s: non-loopback endpoint %s — remote escape hatch active; isolation is the OPERATOR'\''s responsibility (ADR-060)\n' \
      "${ADAPTER_ID}" "${base}" >&2
    return 0
  fi
  aiv_die 6 "${ADAPTER_ID}: endpoint ${base} is not the loopback container and the provider block lacks <unsandboxed>accepted</unsandboxed> — see docs/decisions/ADR-060-comfyui-sandbox-model.md"
}

_comfyui_validate_model_id() {
  local mid="${1:-}"
  [ -n "${mid}" ] || aiv_die 7 "${ADAPTER_ID}: model_id required (stdin model_id or XML <default-model>)"
  printf '%s' "${mid}" | grep -Eq '^[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal model_id: ${mid}"
  printf '%s' "${mid}"
}

_comfyui_validate_job_id() {
  local jid="${1:-}"
  [ -n "${jid}" ] || aiv_die 2 "${ADAPTER_ID}: job_id required"
  printf '%s' "${jid}" | grep -Eq '^[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal job_id: ${jid}"
  printf '%s' "${jid}"
}

_comfyui_resolve_model() {
  local mid
  mid="$(printf '%s' "${1}" | jq -r '.model_id // empty')"
  [ -n "${mid}" ] || mid="${AIV_MODEL:-wan22-ti2v-5b}"
  _comfyui_validate_model_id "${mid}"
}

# _comfyui_template_path <model_id> — shipped templates only (ADR-060 §3):
# the manifest names the template; anything else fails closed.
_comfyui_template_path() {
  local mid="${1}" rel
  [ -f "${COMFYUI_MANIFEST}" ] || aiv_die 3 "${ADAPTER_ID}: manifest missing: ${COMFYUI_MANIFEST}"
  rel="$(jq -r --arg m "${mid}" '.models[$m].template // empty' "${COMFYUI_MANIFEST}")"
  [ -n "${rel}" ] || aiv_die 7 "${ADAPTER_ID}: model not in manifest (shipped templates only): ${mid}"
  case "${rel}" in
    comfyui-templates/*.json) : ;;
    *) aiv_die 7 "${ADAPTER_ID}: manifest template path outside comfyui-templates/: ${rel}" ;;
  esac
  [ -f "${AIV_LIB_DIR}/${rel}" ] || aiv_die 3 "${ADAPTER_ID}: template missing: ${AIV_LIB_DIR}/${rel}"
  printf '%s' "${AIV_LIB_DIR}/${rel}"
}

_comfyui_warn_unverified() {
  local mid="${1}" verified
  [ -f "${COMFYUI_MANIFEST}" ] || return 0
  verified="$(jq -r --arg m "${mid}" \
    '.models[$m] | if . == null then "absent" elif .verified == true then "true" else "false" end' \
    "${COMFYUI_MANIFEST}" 2>/dev/null)"
  case "${verified}" in
    true) : ;;
    absent) printf '%s: model %s not in model-capabilities manifest — capabilities unknown\n' \
          "${ADAPTER_ID}" "${mid}" >&2 ;;
    *) printf '%s: model %s capabilities are UNVERIFIED (no smoke trace) — graph/durations are documented-best-effort\n' \
          "${ADAPTER_ID}" "${mid}" >&2 ;;
  esac
}

# _comfyui_assert_allowlisted <graph_json> — ADR-060 §2 hard-refuse:
# every class_type must be core or a pinned custom node. No bypass flag.
_comfyui_assert_allowlisted() {
  local graph="${1}" unknown
  [ -f "${COMFYUI_ALLOWLIST}" ] || aiv_die 3 "${ADAPTER_ID}: node allowlist missing: ${COMFYUI_ALLOWLIST}"
  unknown="$(printf '%s' "${graph}" | jq -r --slurpfile al "${COMFYUI_ALLOWLIST}" '
    ($al[0].core_class_types + ([$al[0].custom_nodes[]?.class_types[]?])) as $allowed
    | [.[] | .class_type] | unique | map(select(. as $c | $allowed | index($c) | not)) | join(", ")')"
  [ -z "${unknown}" ] \
    || aiv_die 7 "${ADAPTER_ID}: workflow references non-allowlisted node(s): ${unknown} — pin them in lib/comfyui-nodes.allowlist.json (ADR-060: no bypass flag)"
}

# Submit: contract stdin JSON -> substituted shipped template -> POST /prompt.
aiv_cmd_submit() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _comfyui_assert_enabled
  _comfyui_assert_posture

  local stdin_json model template base
  stdin_json="$(cat)"
  printf '%s' "${stdin_json}" | jq -e '.prompt.subject and .prompt.action' >/dev/null \
    || aiv_die 3 "${ADAPTER_ID}: stdin JSON missing required prompt.subject / prompt.action"
  model="$(_comfyui_resolve_model "${stdin_json}")"
  _comfyui_warn_unverified "${model}"
  template="$(_comfyui_template_path "${model}")"
  base="$(_comfyui_base)"

  # Numeric slots — charset-validated (generalized tainted-input rule).
  local seed duration fps frames aspect width height
  seed="$(printf '%s' "${stdin_json}" | jq -r '.seed // 0')"
  printf '%s' "${seed}" | grep -Eq '^[0-9]+$' || aiv_die 7 "${ADAPTER_ID}: illegal seed: ${seed}"
  duration="$(printf '%s' "${stdin_json}" | jq -r '.duration // 4')"
  printf '%s' "${duration}" | grep -Eq '^[0-9]+(\.[0-9]+)?$' || aiv_die 7 "${ADAPTER_ID}: illegal duration: ${duration}"
  fps="$(jq -r '._meta.fps // 24' "${template}")"
  frames="$(printf '%s %s' "${duration}" "${fps}" | awk '{printf "%d", ($1 * $2) + 1}')"
  aspect="$(printf '%s' "${stdin_json}" | jq -r '.aspect // "16:9"')"
  width="$(jq -r --arg a "${aspect}" '._meta.aspect_map[$a].width // empty' "${template}")"
  height="$(jq -r --arg a "${aspect}" '._meta.aspect_map[$a].height // empty' "${template}")"
  [ -n "${width}" ] && [ -n "${height}" ] \
    || aiv_die 7 "${ADAPTER_ID}: aspect ${aspect} not supported by template $(basename "${template}")"

  # Optional ref image — local-source rule: validate the LOCAL path
  # (project-scoped when the orchestrator scoped us), then upload it to
  # the container via /upload/image.
  local ref_image ref_name=""
  ref_image="$(printf '%s' "${stdin_json}" | jq -r '.ref_images[0] // empty')"
  if [ -n "${ref_image}" ]; then
    if [ -n "${AIV_PROJECT_DIR:-}" ]; then
      ref_image="$(aiv_validate_artifact_path "${AIV_PROJECT_DIR}" "${ref_image}")"
    fi
    [ -f "${ref_image}" ] || aiv_die 7 "${ADAPTER_ID}: ref image not found: ${ref_image}"
    local up_resp up_http up_body
    up_resp="$(curl -sS -w '\n%{http_code}' -X POST "${base}/upload/image" \
      -F "image=@${ref_image}" -F "overwrite=true")" \
      || aiv_die 8 "${ADAPTER_ID}: ref-image upload failed"
    up_http="$(printf '%s' "${up_resp}" | tail -n1)"; up_body="$(printf '%s' "${up_resp}" | sed '$d')"
    case "${up_http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: upload HTTP ${up_http}" ;; esac
    ref_name="$(printf '%s' "${up_body}" | jq -r '.name // empty')"
    [ -n "${ref_name}" ] || aiv_die 8 "${ADAPTER_ID}: no name in upload response"
  fi

  # Build the graph: jq-only substitution (JSON-safe). Without a ref
  # image the LoadImage node is REMOVED and start_image references with
  # it (pure text-to-video latent).
  local prompt_text negative graph
  prompt_text="$(printf '%s' "${stdin_json}" | jq -r '[.prompt.style, .prompt.subject,
    .prompt.environment, .prompt.action, .prompt.camera, .prompt.lens,
    .prompt.lighting, .prompt.mood] | map(select(. != null and . != "")) | join(". ")')"
  negative="$(printf '%s' "${stdin_json}" | jq -r '(.negative // []) | join(", ")')"

  graph="$(jq -c \
    --arg prompt "${prompt_text}" --arg negative "${negative}" \
    --arg ref "${ref_name}" \
    --argjson seed "${seed}" --argjson width "${width}" \
    --argjson height "${height}" --argjson frames "${frames}" '
    .prompt
    | with_entries(.value.inputs |= with_entries(
        if   .value == "{{PROMPT}}"    then .value = $prompt
        elif .value == "{{NEGATIVE}}"  then .value = $negative
        elif .value == "{{SEED}}"      then .value = $seed
        elif .value == "{{WIDTH}}"     then .value = $width
        elif .value == "{{HEIGHT}}"    then .value = $height
        elif .value == "{{FRAMES}}"    then .value = $frames
        elif .value == "{{REF_IMAGE}}" then .value = $ref
        else . end))
    | if $ref == "" then
        (to_entries | map(select(.value.class_type == "LoadImage") | .key)) as $drop
        | with_entries(select(.key as $k | $drop | index($k) | not))
        | with_entries(.value.inputs |= with_entries(
            select((.value | type != "array") or (.value[0] as $t | $drop | index($t) | not))))
      else . end' "${template}")"
  _comfyui_assert_allowlisted "${graph}"

  local resp http body jid
  resp="$(curl -sS -w '\n%{http_code}' -X POST "${base}/prompt" \
    -H "Content-Type: application/json" \
    --data-binary "$(jq -nc --argjson g "${graph}" '{prompt: $g}')")" \
    || aiv_die 8 "${ADAPTER_ID}: submit curl failed — is the containerized ComfyUI running? (exit 3 hint: start the container per the ADR-060 run line)"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: submit HTTP ${http}: $(printf '%s' "${body}" | jq -r '.error.message // .error // "unknown"' 2>/dev/null | head -c 300)" ;; esac

  jid="$(printf '%s' "${body}" | jq -r '.prompt_id // empty')"
  [ -n "${jid}" ] || aiv_die 8 "${ADAPTER_ID}: no prompt_id in submit response (got: $(printf '%s' "${body}" | head -c 200))"
  _comfyui_validate_job_id "${jid}" >/dev/null
  jq -n --arg id "${jid}" '{job_id:$id, status:"queued"}'
}

_comfyui_history_json() {
  local jid="${1}" base resp http body
  base="$(_comfyui_base)"
  resp="$(curl -sS -w '\n%{http_code}' -X GET "${base}/history/${jid}")" \
    || aiv_die 8 "${ADAPTER_ID}: history curl failed"
  http="$(printf '%s' "${resp}" | tail -n1)"; body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http}" in 2*) : ;; *) aiv_die 8 "${ADAPTER_ID}: history HTTP ${http}" ;; esac
  printf '%s' "${body}"
}

aiv_cmd_poll() {
  local jid
  jid="$(_comfyui_validate_job_id "${1:-}")"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _comfyui_assert_enabled
  _comfyui_assert_posture
  local body entry
  body="$(_comfyui_history_json "${jid}")"
  entry="$(printf '%s' "${body}" | jq -c --arg id "${jid}" '.[$id] // empty')"
  if [ -z "${entry}" ]; then
    printf '{"status":"running"}\n'
    return 0
  fi
  if printf '%s' "${entry}" | jq -e '.status.status_str == "error"' >/dev/null 2>&1; then
    printf '{"status":"failed","reason":"comfyui execution error"}\n'
  elif printf '%s' "${entry}" | jq -e '(.outputs // {}) | length > 0' >/dev/null 2>&1; then
    printf '{"status":"done"}\n'
  else
    printf '{"status":"running"}\n'
  fi
}

aiv_cmd_fetch() {
  local jid
  jid="$(_comfyui_validate_job_id "${1:-}")"
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  _comfyui_assert_enabled
  _comfyui_assert_posture

  local body fileref filename subfolder ftype base dest root out audio_native
  body="$(_comfyui_history_json "${jid}")"
  fileref="$(printf '%s' "${body}" | jq -c --arg id "${jid}" '
    .[$id].outputs // {} | [.[] | (.videos // .gifs // .images // [])[]] | .[0] // empty')"
  [ -n "${fileref}" ] || aiv_die 8 "${ADAPTER_ID}: no output artifact in history for job ${jid}"
  filename="$(printf '%s' "${fileref}" | jq -r '.filename // empty')"
  subfolder="$(printf '%s' "${fileref}" | jq -r '.subfolder // ""')"
  ftype="$(printf '%s' "${fileref}" | jq -r '.type // "output"')"
  [ -n "${filename}" ] || aiv_die 8 "${ADAPTER_ID}: output entry without filename"
  # Provider-returned names are tainted — same charset rule as job ids,
  # path separators allowed only in subfolder segments.
  printf '%s' "${filename}" | grep -Eq '^[A-Za-z0-9._-]+$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal output filename: ${filename}"
  printf '%s' "${subfolder}" | grep -Eq '^[A-Za-z0-9._/-]*$' \
    || aiv_die 7 "${ADAPTER_ID}: illegal output subfolder: ${subfolder}"
  case "/${subfolder}/" in */../*) aiv_die 7 "${ADAPTER_ID}: illegal output subfolder: ${subfolder}" ;; esac

  base="$(_comfyui_base)"
  if [ -n "${AIV_PROJECT_DIR:-}" ] && [ -n "${AIV_SCENE_ID:-}" ]; then
    dest="$(aiv_scene_dir "${AIV_PROJECT_DIR}" "${AIV_SCENE_ID}")/scene-${jid}.mp4"
    root="${AIV_PROJECT_DIR}"
  elif [ -n "${AIV_OUT:-}" ]; then
    dest="${AIV_OUT}"
    root="$(dirname "${AIV_OUT}")"
  else
    root="$(mktemp -d -t aiv-comfyui-XXXXXX)"
    dest="${root}/scene-${jid}.mp4"
  fi
  aiv_fetch_url "${base}/view?filename=${filename}&subfolder=${subfolder}&type=${ftype}" "${dest}" >/dev/null
  out="$(aiv_validate_artifact_path "${root}" "${dest}")"

  # audio_embedded per model manifest (ltx-2 = audio native). The model
  # is not encoded in the job id (single endpoint, stateless poll), so
  # answer from the configured default — the orchestrator knows the
  # model it submitted and may override downstream.
  audio_native="$(jq -r --arg m "${AIV_MODEL:-wan22-ti2v-5b}" \
    '.models[$m].audio_sync // false' "${COMFYUI_MANIFEST}" 2>/dev/null || printf 'false')"
  jq -n --arg p "${out}" --argjson a "${audio_native}" \
    '{video_path:$p, audio_embedded:$a, cost_estimate:0.0}'
}

# Capability: per-model — same manifest pattern as fal/replicate.
aiv_comfyui_capability() {
  local model=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --model) model="${2:-}"; shift 2 ;;
      *) shift ;;
    esac
  done
  if [ -n "${model}" ]; then
    aiv_require_cmd jq
    _comfyui_validate_model_id "${model}" >/dev/null
    [ -f "${COMFYUI_MANIFEST}" ] || aiv_die 3 "${ADAPTER_ID}: manifest missing: ${COMFYUI_MANIFEST}"
    jq -e --arg m "${model}" '.models[$m]' "${COMFYUI_MANIFEST}" >/dev/null 2>&1 \
      || aiv_die 7 "${ADAPTER_ID}: model not in manifest: ${model}"
    _comfyui_warn_unverified "${model}"
    jq --arg m "${model}" \
      '.models[$m] | {audio: (if .audio_sync then "native" else "none" end), model: $m} + .' \
      "${COMFYUI_MANIFEST}"
    return 0
  fi
  if [ -f "${COMFYUI_MANIFEST}" ] && command -v jq >/dev/null 2>&1; then
    jq '{audio:"per-model", models: (.models | keys)}' "${COMFYUI_MANIFEST}"
  else
    printf '{"audio":"per-model"}\n'
  fi
}

sub="${1:-}"
if [ "${sub}" = "capability" ]; then
  shift
  aiv_comfyui_capability "$@"
  exit 0
fi
aiv_dispatch "${ADAPTER_ID}" "per-model" "$@"
