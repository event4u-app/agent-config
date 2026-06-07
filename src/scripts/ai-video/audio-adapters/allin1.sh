#!/usr/bin/env bash
# allin1.sh — reference audio-analysis adapter: BPM + beats + downbeats +
# named sections in one pass, backed by an operator-installed `allin1`
# CLI (https://github.com/mir-aidj/all-in-one — installed via pip by the
# OPERATOR; the suite ships only this wrapper, never the ML deps).
#
# Class: audio-analysis (filter-shape, synchronous `analyze`).
# Contract: scripts/ai-video/lib/audio-adapter-contract.md (v1).
#
# Lifecycle: experimental — wrapper is structurally conformant; no
# maintainer trace against a real allin1 install captured yet. See
# docs/contracts/provider-lifecycle.md for promotion criteria.
#
# Backend: local-cli. allin1 separates stems internally (demucs) and
# returns beats/downbeats/segments for the full mix — the optional
# stdin `stem` hint is accepted and ignored. No network, no spend, so
# `analyze` runs under the AIV_DRYRUN=true default; a missing CLI
# exits 3 with the install hint (contract § fallback semantics: that
# is a CONFIG failure — the orchestrator hard-fails instead of
# silently degrading to probe-audio.sh when this provider is enabled).
#
# Provider block (agents/.ai-video.xml):
#   <provider id="allin1" kind="audio-analysis">
#     <lifecycle>experimental</lifecycle>
#     <enabled>true</enabled>
#   </provider>
# Kill-switch: <enabled>false</enabled> refuses `analyze` (exit 6).

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="allin1"

_allin1_assert_enabled() {
  [ "$(aiv_provider_enabled "${ADAPTER_ID}")" = "true" ] \
    || aiv_die 6 "${ADAPTER_ID}: provider disabled via <enabled>false</enabled> in agents/.ai-video.xml"
}

# _allin1_read_audio_path — parse + validate stdin {audio_path}. The
# path is operator-supplied (not provider-returned) but still checked:
# must exist and carry an audio stream before any exec.
_allin1_read_audio_path() {
  local stdin_json audio_path
  stdin_json="$(cat)"
  audio_path="$(printf '%s' "${stdin_json}" | jq -r '.audio_path // empty' 2>/dev/null)" \
    || aiv_die 7 "${ADAPTER_ID}: malformed stdin JSON"
  [ -n "${audio_path}" ] || aiv_die 7 "${ADAPTER_ID}: audio_path required on stdin"
  [ -f "${audio_path}" ] || aiv_die 7 "${ADAPTER_ID}: audio file not found: ${audio_path}"
  if command -v ffprobe >/dev/null 2>&1; then
    ffprobe -v error -select_streams a:0 -show_entries format=duration \
      -of default=nk=1:nw=1 "${audio_path}" >/dev/null 2>&1 \
      || aiv_die 7 "${ADAPTER_ID}: no audio stream in: ${audio_path}"
  fi
  printf '%s' "${audio_path}"
}

# analyze — run the local allin1 CLI and map its JSON to the contract
# shape. allin1 writes ./struct/<name>.json by default; we direct it to
# a temp dir and read the single result file. Output mapping:
#   allin1: {bpm, beats:[...], downbeats:[...], segments:[{start,end,label}]}
#   contract: {schema, source, bpm, beats, downbeats, sections:[{start,end,label}]}
aiv_cmd_analyze() {
  aiv_require_cmd jq
  aiv_load_provider "${ADAPTER_ID}" >/dev/null 2>&1 || true
  _allin1_assert_enabled
  command -v allin1 >/dev/null 2>&1 \
    || aiv_die 3 "${ADAPTER_ID}: 'allin1' CLI not found — install it (pip install allin1) or disable the provider with <enabled>false</enabled>"

  local audio_path out_dir result
  audio_path="$(_allin1_read_audio_path)"
  out_dir="$(mktemp -d "${TMPDIR:-/tmp}/aiv-allin1.XXXXXX")"
  trap 'rm -rf "${out_dir}"' EXIT

  # Local exec, no network: tolerated under the AIV_DRYRUN default
  # (contract v1 — dry-run gates SPEND, local analysis has none).
  if ! allin1 --out-dir "${out_dir}" "${audio_path}" >&2; then
    aiv_die 75 "${ADAPTER_ID}: allin1 run failed (transient — caller may retry or fall back to probe-audio.sh)"
  fi

  result="$(find "${out_dir}" -name '*.json' -type f | head -1)"
  [ -n "${result}" ] || aiv_die 75 "${ADAPTER_ID}: allin1 produced no result JSON"

  jq '{
    schema: 1,
    source: "allin1",
    bpm: (.bpm // 0),
    beats: (.beats // []),
    downbeats: (.downbeats // []),
    sections: [ (.segments // [])[] | {start: .start, end: .end, label: .label} ]
  }' "${result}" \
    || aiv_die 75 "${ADAPTER_ID}: allin1 result JSON did not match the expected shape"
}

aiv_audio_capability() {
  printf '{"kind":"audio-analysis","provides":["bpm","beats","downbeats","sections"],"backend":"local-cli"}\n'
}

aiv_audio_dry_run() {
  local fixture="${AIV_FIXTURE_ROOT}/${ADAPTER_ID}/analysis.json"
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
