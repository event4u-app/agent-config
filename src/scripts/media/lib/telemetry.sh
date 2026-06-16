#!/usr/bin/env bash
# telemetry.sh — per-adapter run telemetry (success / cost / latency) to
# inform later promotion decisions (provider-lifecycle-discipline:
# experimental → stable needs evidence, not vibes).
#
# LOCAL-ONLY by construction: appends JSONL to
# agents/runtime/state/ai-video-telemetry.jsonl (the gitignored runtime
# layer — never committed, never uploaded). A record carries ONLY:
# timestamp, adapter id, subcommand, status (ok | exit_<code>),
# duration_ms, optional cost_usd. No prompts, no URLs, no paths, no
# keys — nothing the privacy floor cares about.
#
# Best-effort by contract: telemetry MUST NEVER break an adapter run —
# every failure path here swallows the error (`|| true`). Kill-switch:
# AIV_TELEMETRY=false disables recording entirely.
#
# Sink resolution:
#   1. AIV_TELEMETRY_FILE set → append there (tests, custom setups).
#   2. ./agents/runtime exists in CWD → append to
#      agents/runtime/state/ai-video-telemetry.jsonl.
#   3. Otherwise: skip silently (never litter an arbitrary CWD).
#
# Usage (sourced — adapter-common.sh wires it into aiv_dispatch):
#   aiv_telemetry_record <adapter> <subcommand> <status> <duration_ms> [cost_usd]
#
# Usage (CLI):
#   telemetry.sh record <adapter> <subcommand> <status> <duration_ms> [cost_usd]
#   telemetry.sh summary [<file>]
#     → per-adapter aggregate: runs, ok-rate, avg duration, total cost.

if [ -n "${AIV_TELEMETRY_LOADED:-}" ]; then
  return 0 2>/dev/null || exit 0
fi
AIV_TELEMETRY_LOADED=1

aiv_now_ms() {
  # macOS ships bash 3.2 (no EPOCHREALTIME) and a date without %N —
  # perl Time::HiRes is present on macOS + every mainstream Linux;
  # fall back to whole seconds when even perl is missing.
  if command -v perl >/dev/null 2>&1; then
    perl -MTime::HiRes=time -e 'printf("%d", time()*1000)' 2>/dev/null && return 0
  fi
  printf '%d' "$(( $(date +%s) * 1000 ))"
}

_aiv_telemetry_sink() {
  if [ -n "${AIV_TELEMETRY_FILE:-}" ]; then
    printf '%s' "${AIV_TELEMETRY_FILE}"
  elif [ -d "agents/runtime" ]; then
    printf '%s' "agents/runtime/state/ai-video-telemetry.jsonl"
  else
    printf ''
  fi
}

# aiv_telemetry_record <adapter> <subcommand> <status> <duration_ms> [cost_usd]
# Append one JSONL record. NEVER fails the caller.
aiv_telemetry_record() {
  case "${AIV_TELEMETRY:-true}" in
    false|FALSE|0|no|NO) return 0 ;;
  esac
  local adapter="${1:-}" sub="${2:-}" status="${3:-}" dur="${4:-}" cost="${5:-}"
  [ -n "${adapter}" ] && [ -n "${sub}" ] && [ -n "${status}" ] || return 0
  local sink
  sink="$(_aiv_telemetry_sink)"
  [ -n "${sink}" ] || return 0
  mkdir -p "$(dirname "${sink}")" 2>/dev/null || return 0
  # Sanitize: identifiers only, numbers numeric — a hostile value can
  # not break the JSONL shape.
  printf '%s' "${adapter}${sub}" | grep -Eq '^[A-Za-z0-9._-]+$' || return 0
  printf '%s' "${status}" | grep -Eq '^[A-Za-z0-9_]+$' || return 0
  printf '%s' "${dur}" | grep -Eq '^[0-9]+$' || dur=0
  if [ -n "${cost}" ]; then
    printf '%s' "${cost}" | grep -Eq '^[0-9]+(\.[0-9]+)?$' || cost=""
  fi
  {
    printf '{"ts":"%s","adapter":"%s","subcommand":"%s","status":"%s","duration_ms":%s' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${adapter}" "${sub}" "${status}" "${dur}"
    [ -n "${cost}" ] && printf ',"cost_usd":%s' "${cost}"
    printf '}\n'
  } >> "${sink}" 2>/dev/null || true
  return 0
}

_aiv_telemetry_summary() {
  local file="${1:-$(_aiv_telemetry_sink)}"
  if [ -z "${file}" ] || [ ! -f "${file}" ]; then
    printf '{"adapters":{},"note":"no telemetry recorded yet"}\n'
    return 0
  fi
  command -v jq >/dev/null 2>&1 || { echo "telemetry: jq required for summary" >&2; return 3; }
  jq -s '{
    adapters: (group_by(.adapter) | map({
      key: .[0].adapter,
      value: {
        runs: length,
        ok: (map(select(.status == "ok")) | length),
        ok_rate: ((map(select(.status == "ok")) | length) / length * 100 | floor / 100),
        avg_duration_ms: ((map(.duration_ms) | add / length) | floor),
        total_cost_usd: (map(.cost_usd // 0) | add)
      }
    }) | from_entries)
  }' "${file}"
}

# CLI mode — sourced use never reaches this block.
if [ "${BASH_SOURCE[0]:-}" = "${0}" ]; then
  set -euo pipefail
  cmd="${1:-}"
  case "${cmd}" in
    record)  shift; aiv_telemetry_record "$@" ;;
    summary) shift || true; _aiv_telemetry_summary "$@" ;;
    *) echo "usage: telemetry.sh {record <adapter> <sub> <status> <dur_ms> [cost] | summary [<file>]}" >&2; exit 2 ;;
  esac
fi
