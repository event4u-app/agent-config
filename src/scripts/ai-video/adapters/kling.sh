#!/usr/bin/env bash
# kling.sh — Kuaishou Kling motion-tuned video generation adapter.
#
# Capability: audio=none by default (Kling current generation does not
# emit native audio); the orchestrator muxes operator-supplied dialogue
# / ambient at stitch time. Max duration is model-dependent; clip-time
# clamping happens in motion-choreographer (it tunes the prompt to fit).
#
# Contract: scripts/ai-video/lib/adapter-contract.md
# Provider: top-level <provider id="kling" kind="video"> in
# agents/.ai-video.xml.
#
# Lifecycle: experimental — async submit/poll/fetch contract conformant;
# no maintainer real-API smoke trace captured yet. See
# docs/contracts/provider-lifecycle.md for promotion criteria. The agent
# must surface this tier and ask before defaulting to this adapter.
# Encoder note: provider-specific prompt grammar comes from the
#   motion-choreographer encoder table; the scene blueprint stays
#   provider-agnostic (see adapter-contract.md § Blueprint → provider translation).

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="kling"
KLING_MAX_DURATION="${KLING_MAX_DURATION:-10}"

aiv_cmd_submit() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  local stdin_json duration
  stdin_json="$(cat)"
  duration="$(printf '%s' "${stdin_json}" | jq -r '.duration // empty')"
  if [ -n "${duration}" ]; then
    awk -v d="${duration}" -v m="${KLING_MAX_DURATION}" \
      'BEGIN { if (d+0 > m+0) exit 1; exit 0 }' \
      || aiv_die 3 "${ADAPTER_ID}: duration ${duration}s exceeds model max ${KLING_MAX_DURATION}s"
  fi

  aiv_die 9 "${ADAPTER_ID}: live submit not yet wired (max duration ${KLING_MAX_DURATION}s honored)"
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

aiv_dispatch "${ADAPTER_ID}" "none" "$@"
