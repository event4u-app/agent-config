#!/usr/bin/env bash
# openai-images.sh — image generation adapter (DALL-E / gpt-image-1).
#
# Capability: audio=none (still images only — motion handled by a
# downstream video adapter). Ref-image and seed reuse are passed
# through verbatim so character-consistency can lock a face across
# scenes by reusing the same seed.
#
# Contract: scripts/ai-video/lib/adapter-contract.md
# Provider: top-level <provider id="openai-images" kind="image"> in
# agents/.ai-video.xml.

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="openai-images"

aiv_cmd_run() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  # Read contract stdin JSON; compose a single text prompt from the
  # eight prose blocks. Ref-image + seed are passed verbatim.
  local stdin_json prompt seed ref_first
  stdin_json="$(cat)"
  prompt="$(printf '%s' "${stdin_json}" | jq -r '
    [.prompt.style, .prompt.subject, .prompt.environment, .prompt.action,
     .prompt.camera, .prompt.lens, .prompt.lighting, .prompt.mood]
    | map(select(. != null and . != ""))
    | join(". ")
  ')"
  seed="$(printf '%s' "${stdin_json}" | jq -r '.seed // empty')"
  ref_first="$(printf '%s' "${stdin_json}" | jq -r '.ref_images[0] // empty')"

  # Live mode is implementation-scaffolded: we do NOT yet POST to the
  # OpenAI Images API from inside this adapter. The cost-floor gate
  # (Phase 5 Step 6) refuses live mode unless the operator explicitly
  # confirms in-turn; this branch surfaces a clear stub error so the
  # contract surface stays stable while the live path is wired later.
  aiv_die 9 "${ADAPTER_ID}: live mode not yet wired (prompt=${#prompt} chars, seed=${seed:-unset}, ref=${ref_first:-none})"
}

aiv_cmd_submit() { aiv_cmd_run "$@"; }
aiv_cmd_fetch()  { aiv_cmd_run "$@"; }
aiv_cmd_poll()   { printf '{"status":"done"}\n'; }

aiv_dispatch "${ADAPTER_ID}" "none" "$@"
