#!/usr/bin/env bash
# whisperx.sh — reference lyrics adapter: word-level timestamps + per-line
# speaker (forced alignment + diarization), backed by an operator-installed
# `whisperx` CLI (https://github.com/m-bain/whisperX — installed via pip by
# the OPERATOR; the suite ships only this wrapper, never the ML deps).
#
# Class: lyrics (filter-shape, synchronous `analyze`).
# Contract: scripts/ai-video/lib/audio-adapter-contract.md (v1).
#
# Lifecycle: experimental — wrapper is structurally conformant; no
# maintainer trace against a real whisperx install captured yet. See
# docs/contracts/provider-lifecycle.md for promotion criteria.
#
# Ground truth (media-sync-ground-truth Iron Law): the emitted timing is
# VERBATIM whisperx output — this adapter never re-times, merges, or
# invents lines. `speaker` is the raw diarization label (SPEAKER_00, …)
# or "?" when diarization is unavailable or a line mixes speakers; the
# adapter NEVER guesses a name. Mapping labels → cast names is the
# song-to-script skill's job (operator roster); unmatched stays "?".
#
# Backend: local-cli. No network, no spend → `analyze` runs under the
# AIV_DRYRUN=true default; a missing CLI exits 3 with the install hint
# (config failure → the orchestrator hard-fails rather than silently
# degrading when this provider is enabled).
#
# Provider block (agents/.ai-video.xml):
#   <provider id="whisperx" kind="lyrics">
#     <lifecycle>experimental</lifecycle>
#     <enabled>true</enabled>
#   </provider>
# Kill-switch: <enabled>false</enabled> refuses `analyze` (exit 6).

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

ADAPTER_ID="whisperx"

_whisperx_assert_enabled() {
  [ "$(aiv_provider_enabled "${ADAPTER_ID}")" = "true" ] \
    || aiv_die 6 "${ADAPTER_ID}: provider disabled via <enabled>false</enabled> in agents/.ai-video.xml"
}

# analyze — run the local whisperx CLI (JSON output, word alignment,
# diarization when the operator's install supports it) and map its
# output to the contract shape.
aiv_cmd_analyze() {
  aiv_require_cmd jq
  aiv_load_provider "${ADAPTER_ID}" >/dev/null 2>&1 || true
  _whisperx_assert_enabled
  command -v whisperx >/dev/null 2>&1 \
    || aiv_die 3 "${ADAPTER_ID}: 'whisperx' CLI not found — install it (pip install whisperx) or disable the provider with <enabled>false</enabled>"

  local stdin_json audio_path language out_dir result
  stdin_json="$(cat)"
  audio_path="$(printf '%s' "${stdin_json}" | jq -r '.audio_path // empty' 2>/dev/null)" \
    || aiv_die 7 "${ADAPTER_ID}: malformed stdin JSON"
  [ -n "${audio_path}" ] || aiv_die 7 "${ADAPTER_ID}: audio_path required on stdin"
  [ -f "${audio_path}" ] || aiv_die 7 "${ADAPTER_ID}: audio file not found: ${audio_path}"
  language="$(printf '%s' "${stdin_json}" | jq -r '.language // empty')"

  out_dir="$(mktemp -d "${TMPDIR:-/tmp}/aiv-whisperx.XXXXXX")"
  trap 'rm -rf "${out_dir}"' EXIT

  # --diarize requires the operator's HF token setup; run without it
  # when unavailable — speakers then come back absent and every line is
  # emitted with speaker "?" (never a guessed name).
  local -a args
  args=("${audio_path}" --output_dir "${out_dir}" --output_format json)
  [ -n "${language}" ] && args+=(--language "${language}")
  if [ "${WHISPERX_DIARIZE:-true}" != "false" ] && [ -n "${HF_TOKEN:-}" ]; then
    args+=(--diarize)
  fi

  if ! whisperx "${args[@]}" >&2; then
    aiv_die 75 "${ADAPTER_ID}: whisperx run failed (transient — caller may retry or fall back)"
  fi

  result="$(find "${out_dir}" -name '*.json' -type f | head -1)"
  [ -n "${result}" ] || aiv_die 75 "${ADAPTER_ID}: whisperx produced no result JSON"

  # whisperx JSON: {segments:[{start,end,text,speaker?,words:[{word,start,end,speaker?}]}], language}
  # Contract: lines[].speaker = raw label or "?" — a segment without a
  # speaker, or whose words carry >1 distinct label, maps to "?".
  jq '{
    schema: 1,
    source: "whisperx",
    language: (.language // "unknown"),
    lines: [ (.segments // [])[] | {
      start: .start,
      end: .end,
      text: (.text | gsub("^\\s+|\\s+$"; "")),
      speaker: (
        ([.words[]?.speaker] + [.speaker] | map(select(. != null)) | unique) as $sp
        | if ($sp | length) == 1 then $sp[0] else "?" end
      )
    } ],
    words: [ (.segments // [])[].words[]? | {
      start: (.start // null),
      end: (.end // null),
      word: .word,
      speaker: (.speaker // "?")
    } ]
  }' "${result}" \
    || aiv_die 75 "${ADAPTER_ID}: whisperx result JSON did not match the expected shape"
}

aiv_audio_capability() {
  printf '{"kind":"lyrics","provides":["lines","words","speakers"],"backend":"local-cli"}\n'
}

aiv_audio_dry_run() {
  local fixture="${AIV_FIXTURE_ROOT}/${ADAPTER_ID}/transcript.json"
  [ -f "${fixture}" ] || aiv_die 3 "fixture missing: ${fixture}"
  cat "${fixture}"
}

# Dispatch — filter-shape contract (analyze | capability | dry-run);
# fail-closed on anything else (exit 2, named error).
sub="${1:-}"
case "${sub}" in
  analyze)    shift; aiv_cmd_analyze "$@" ;;
  capability) aiv_audio_capability ;;
  dry-run)    aiv_audio_dry_run ;;
  "")         aiv_die 2 "${ADAPTER_ID}: subcommand required (analyze|capability|dry-run)" ;;
  *)          aiv_die 2 "${ADAPTER_ID}: unknown subcommand: ${sub}" ;;
esac
