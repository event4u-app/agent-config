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
# Lifecycle: experimental — capability-discovery path conformant; no
# maintainer real-API smoke trace captured yet. See
# docs/contracts/provider-lifecycle.md for promotion criteria. The
# agent must surface this tier and ask before defaulting to this
# adapter.

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
  printf '{"audio":"per-model","presets":["mix","burst","dvd","cinematic","talk"]}\n'
}

aiv_cmd_submit() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"
  aiv_die 9 "${ADAPTER_ID}: live submit not yet wired"
}

aiv_cmd_poll() {
  local job_id="${1:-}"
  [ -n "${job_id}" ] || aiv_die 2 "${ADAPTER_ID}: poll <job_id> required"
  aiv_assert_dryrun
  aiv_die 9 "${ADAPTER_ID}: live poll not yet wired (job=${job_id})"
}

aiv_cmd_fetch() {
  local job_id="${1:-}"
  [ -n "${job_id}" ] || aiv_die 2 "${ADAPTER_ID}: fetch <job_id> required"
  aiv_assert_dryrun
  aiv_die 9 "${ADAPTER_ID}: live fetch not yet wired (job=${job_id})"
}

# Custom dispatch with capability override; falls back to the common
# router for every other subcommand.
sub="${1:-}"
if [ "${sub}" = "capability" ]; then
  shift
  aiv_higgsfield_capability "$@"
  exit 0
fi
aiv_dispatch "${ADAPTER_ID}" "per-model" "$@"
