#!/usr/bin/env bash
# musetalk.sh — MuseTalk-class LOCAL lip-sync adapter: the offline (MIT)
# alternative to the hosted sync.so post-process. One rendered clip plus
# one audio line in, a lip-synced clip out — no network, no spend.
#
# Capability: audio=native — the returned clip embeds the driving audio
# line (dropping its track at mux would desync the mouth; the
# orchestrator keeps lip-sync scenes' native audio per /video:from-song
# Step 9.1).
#
# Lifecycle: experimental — wrapper is structurally conformant; no
# maintainer trace against a real MuseTalk install captured yet. See
# docs/contracts/provider-lifecycle.md for promotion criteria.
# Encoder note: provider-specific prompt grammar comes from the
#   motion-choreographer encoder table; the scene blueprint stays
#   provider-agnostic (see adapter-contract.md § Blueprint → provider translation).
#
# Kind: lipsync, LOCAL variant (adapter-contract.md v2 § Local providers
# — local-source rule). Unlike the hosted syncso adapter (https-only
# inputs the provider must fetch), this engine reads LOCAL files:
#   {"video_path":"/abs/scene.mp4", "audio_path":"/abs/line.wav",
#    "model_id":"musetalk-1.5"}
# Both paths are validated (project-scoped when the orchestrator scoped
# us) before they reach the engine.
#
# Backend: local-cli ("skill suite, not an app" — the OPERATOR installs
# MuseTalk, https://github.com/TMElyralab/MuseTalk, MIT). The wrapped
# entry point is configurable via MUSETALK_CMD (default `musetalk`)
# because MuseTalk installs vary (repo checkout + python -m vs. a
# packaged console script). Contract with the wrapped CLI
# (documented-best-effort, verified on the first live trace):
#   $MUSETALK_CMD --video <in.mp4> --audio <in.wav> --output <out.mp4>
# A missing CLI exits 3 with the install hint. Local inference has no
# spend and runs as the synchronous `run` subcommand (contract v2 allows
# collapsing submit/poll/fetch for synchronous backends).
#
# Sparse-budget discipline: same machine-readable lipsync_budget block
# as syncso (lib/model-capabilities/musetalk.json) — local inference is
# free but the QUALITY argument for sparseness is unchanged (singing
# lip-sync degrades fast off frontal close-ups). The orchestrator
# enforces the budget BEFORE invoking this adapter.
#
# cost_estimate: a local render is a KNOWN 0.0 (ADR-060 cost semantics).
#
# Provider block (agents/.ai-video.xml):
#   <provider id="musetalk" kind="lipsync">
#     <lifecycle>experimental</lifecycle>
#     <enabled>true</enabled>
#   </provider>
# Kill-switch: <enabled>false</enabled> refuses `run` (exit 6).

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

ADAPTER_ID="musetalk"
# Budget + capability data: lib/model-capabilities/musetalk.json — read
# by the ORCHESTRATOR (sparse-budget gate) and the contract tests, not
# by this wrapper.

_musetalk_assert_enabled() {
  [ "$(aiv_provider_enabled "${ADAPTER_ID}")" = "true" ] \
    || aiv_die 6 "${ADAPTER_ID}: provider disabled via <enabled>false</enabled> in agents/.ai-video.xml"
}

# _musetalk_validate_local <path> <label> — local-source rule: the input
# is a local file, validated against the project scope when set.
_musetalk_validate_local() {
  local path="${1:-}" label="${2:-path}"
  [ -n "${path}" ] || aiv_die 7 "${ADAPTER_ID}: ${label} required (local file — this is the offline lip-sync path)"
  case "${path}" in
    https://*|http://*) aiv_die 7 "${ADAPTER_ID}: ${label} is a URL — the local engine reads files; use the hosted syncso adapter for URL inputs" ;;
  esac
  if [ -n "${AIV_PROJECT_DIR:-}" ]; then
    path="$(aiv_validate_artifact_path "${AIV_PROJECT_DIR}" "${path}")"
  fi
  [ -f "${path}" ] || aiv_die 7 "${ADAPTER_ID}: ${label} not found: ${path}"
  printf '%s' "${path}"
}

# Synchronous local inference — the collapsed `run` (submit/poll/fetch).
# Local inference has no spend, but `run` still honours AIV_DRYRUN
# (contract v2 live-call safety): preview mode must stay strictly
# offline — minutes of GPU inference are not a preview either. The
# orchestrator sets AIV_DRYRUN=false on the confirmed commit path.
aiv_cmd_run() {
  aiv_assert_dryrun
  aiv_require_cmd jq
  aiv_load_provider "${ADAPTER_ID}" >/dev/null 2>&1 || true
  _musetalk_assert_enabled
  local cli="${MUSETALK_CMD:-musetalk}"
  command -v "${cli}" >/dev/null 2>&1 \
    || aiv_die 3 "${ADAPTER_ID}: '${cli}' CLI not found — install MuseTalk (MIT, github.com/TMElyralab/MuseTalk) and/or point MUSETALK_CMD at its entry script, or disable the provider with <enabled>false</enabled>"

  local stdin_json video audio dest root out
  stdin_json="$(cat)"
  video="$(_musetalk_validate_local "$(printf '%s' "${stdin_json}" | jq -r '.video_path // empty')" video_path)"
  audio="$(_musetalk_validate_local "$(printf '%s' "${stdin_json}" | jq -r '.audio_path // empty')" audio_path)"

  if [ -n "${AIV_PROJECT_DIR:-}" ] && [ -n "${AIV_SCENE_ID:-}" ]; then
    dest="$(aiv_scene_dir "${AIV_PROJECT_DIR}" "${AIV_SCENE_ID}")/lipsync-local.mp4"
    root="${AIV_PROJECT_DIR}"
  elif [ -n "${AIV_OUT:-}" ]; then
    dest="${AIV_OUT}"
    root="$(dirname "${AIV_OUT}")"
  else
    root="$(mktemp -d -t aiv-musetalk-XXXXXX)"
    dest="${root}/lipsync-local.mp4"
  fi

  if ! "${cli}" --video "${video}" --audio "${audio}" --output "${dest}" >&2; then
    aiv_die 75 "${ADAPTER_ID}: inference failed (transient — caller may retry once or fall back to the dop motion path)"
  fi
  [ -f "${dest}" ] || aiv_die 75 "${ADAPTER_ID}: engine exited 0 but produced no output at ${dest}"
  out="$(aiv_validate_artifact_path "${root}" "${dest}")"
  jq -n --arg p "${out}" '{video_path:$p, audio_embedded:true, cost_estimate:0.0}'
}

aiv_dispatch "${ADAPTER_ID}" "native" "$@"
