#!/usr/bin/env bash
# ideogram.sh — Ideogram text-in-image adapter (logos / banners / typographic art).
#
# Capability: audio=none (still image). Ideogram is the text-in-image default
# (road-to-image-brand-typography decision 6) — strong glyph rendering for
# logos and banners where raster models garble text.
#
# Lifecycle: experimental — scaffold tier. dry-run plumbing only; the live
# submit/poll/fetch round-trip is NOT wired (no maintainer-captured smoke
# trace yet). Promotion to stable requires a real-API smoke trace under
# agents/reference/ai-image/smoke-traces/ per provider-lifecycle-discipline.
#
# Live API (Ideogram v1 — ASSUMED shape, to be verified before promotion):
#   base   https://api.ideogram.ai
#   auth   Api-Key: <API_KEY>
#   submit POST {base}/generate {"image_request":{"prompt":"…","model":"V_2",
#          "aspect_ratio":"ASPECT_1_1","magic_prompt_option":"AUTO"}}
#          -> {data:[{url, is_image_safe}]}  (synchronous)
#   fetch  GET <data[].url> -> PNG bytes (download via the trust boundary)
#
# Contract: scripts/media/lib/adapter-contract.md (v2 — trust boundary:
# downloads via aiv_fetch_url, returned paths via aiv_validate_artifact_path).
# Provider registry + the live wiring land with pack-ai-image (A.2 pack + A.3).

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

ADAPTER_ID="ideogram"

_ideogram_not_wired() {
  aiv_die 5 "${ADAPTER_ID}: live ${1} not wired (scaffold tier — dry-run only). \
A maintainer-captured smoke trace promotes this adapter; see provider-lifecycle-discipline."
}

aiv_cmd_submit() { _ideogram_not_wired submit; }
aiv_cmd_poll()   { _ideogram_not_wired poll; }
aiv_cmd_fetch()  { _ideogram_not_wired fetch; }

aiv_dispatch "${ADAPTER_ID}" "none" "$@"
