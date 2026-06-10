#!/usr/bin/env bash
# sora.sh — OpenAI Sora structural-prompt video adapter.
#
# Capability: audio=native. Sora-class models produce muxed MP4 with
# dialogue + ambient sound; we pass the audio block straight through.
# Structural-prompt path informed by upstream `awesome-sora-prompts`
# (attribution in agents/reference/ai-video/prompts/cinematic-blueprint.md).
#
# Contract: scripts/ai-video/lib/adapter-contract.md
# Provider: top-level <provider id="sora" kind="video"> in
# agents/.ai-video.xml.
#
# Lifecycle: experimental — structural-prompt path conformant; no
# maintainer real-API smoke trace captured yet. See
# docs/contracts/provider-lifecycle.md for promotion criteria. The
# agent must surface this tier and ask before defaulting to this
# adapter.
# Encoder note: provider-specific prompt grammar comes from the
#   motion-choreographer encoder table; the scene blueprint stays
#   provider-agnostic (see adapter-contract.md § Blueprint → provider translation).

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="sora"

aiv_cmd_submit() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  local stdin_json
  stdin_json="$(cat)"
  # Sora's structural-prompt path expects all eight blocks present;
  # fail loud if the blueprint parser dropped any.
  printf '%s' "${stdin_json}" \
    | jq -e '.prompt.style and .prompt.subject and .prompt.environment and
             .prompt.action and .prompt.camera and .prompt.lens and
             .prompt.lighting and .prompt.mood' >/dev/null \
    || aiv_die 3 "${ADAPTER_ID}: stdin JSON missing one or more required prompt blocks"

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

aiv_dispatch "${ADAPTER_ID}" "native" "$@"
