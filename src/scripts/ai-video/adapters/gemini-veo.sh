#!/usr/bin/env bash
# gemini-veo.sh — Google Gemini Veo video generation adapter.
#
# Capability: audio=native. Veo accepts dialogue + ambient sound blocks
# and returns a muxed MP4. Async API: submit → poll (predictLongRunning)
# → fetch. The orchestrator drives all three subcommands; this script
# never auto-retries.
#
# Contract: scripts/ai-video/lib/adapter-contract.md
# Provider: top-level <provider id="gemini-veo" kind="video"> in
# agents/.ai-video.xml.
#
# Lifecycle: experimental — structural shape conformant; no maintainer
# real-API smoke trace captured yet. See docs/contracts/provider-lifecycle.md
# for promotion criteria. The agent must surface this tier and ask
# before defaulting to this adapter.

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="gemini-veo"

# Submit: read contract JSON from stdin, return {job_id, status:"queued"}.
aiv_cmd_submit() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  local stdin_json
  stdin_json="$(cat)"
  # Validate required prompt blocks early so a bad blueprint fails
  # before any network call would happen.
  printf '%s' "${stdin_json}" | jq -e '.prompt.subject and .prompt.action' >/dev/null \
    || aiv_die 3 "${ADAPTER_ID}: stdin JSON missing required prompt.subject / prompt.action"

  aiv_die 9 "${ADAPTER_ID}: live submit not yet wired (predictLongRunning endpoint requires per-key wiring)"
}

# Poll: check long-running operation status. Stub returns "done" so the
# stitcher path is exercisable end-to-end in dry-run; live mode is
# wired by the orchestrator once a real job_id exists.
aiv_cmd_poll() {
  local job_id="${1:-}"
  [ -n "${job_id}" ] || aiv_die 2 "${ADAPTER_ID}: poll <job_id> required"
  aiv_assert_dryrun
  aiv_die 9 "${ADAPTER_ID}: live poll not yet wired (job=${job_id})"
}

# Fetch: download the muxed MP4. Live mode is stubbed; dry-run returns
# the fixture path with audio_embedded=true.
aiv_cmd_fetch() {
  local job_id="${1:-}"
  [ -n "${job_id}" ] || aiv_die 2 "${ADAPTER_ID}: fetch <job_id> required"
  aiv_assert_dryrun
  aiv_die 9 "${ADAPTER_ID}: live fetch not yet wired (job=${job_id})"
}

aiv_dispatch "${ADAPTER_ID}" "native" "$@"
