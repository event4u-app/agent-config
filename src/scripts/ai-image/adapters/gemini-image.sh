#!/usr/bin/env bash
# gemini-image.sh — Google Gemini image-generation adapter (Nano Banana family + Imagen 4).
#
# Capability: audio=none (still image). General-purpose image generation
# (road-to-image-brand-typography decision 6). Distinct from the `gemini-veo`
# VIDEO adapter — different endpoint, different model family.
#
# Cost: pay-per-image, low tier (~$0.03-0.04 / image for Imagen 4; Nano Banana
# family varies). Reference as-of 2026-06 — verify at ai.google.dev/gemini-api/docs/pricing;
# prices/models are Reference, re-checked on cadence, never frozen.
#
# Lifecycle: experimental — scaffold tier. dry-run plumbing only; the live
# submit/poll/fetch round-trip is NOT wired (no maintainer-captured smoke
# trace yet). Promotion to stable requires a real-API smoke trace under
# agents/reference/ai-image/smoke-traces/ per provider-lifecycle-discipline.
#
# Live API (Gemini / Imagen — ASSUMED shape, to be verified before promotion):
#   base   https://generativelanguage.googleapis.com/v1beta
#   auth   x-goog-api-key: <API_KEY>
#   submit POST {base}/models/{model}:generateContent  (Nano Banana family)
#          or  {base}/models/imagen-4.0:predict        (Imagen 4)
#          -> inline base64 image data (synchronous)
#   fetch  decode the inline data to a PNG through the trust boundary
#
# Contract: scripts/media/lib/adapter-contract.md (v2 — trust boundary:
# downloads via aiv_fetch_url, returned paths via aiv_validate_artifact_path).
# Provider registry + the live wiring land with pack-ai-image (A.2 pack + A.3).

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

ADAPTER_ID="gemini-image"

_gemini_image_not_wired() {
  aiv_die 5 "${ADAPTER_ID}: live ${1} not wired (scaffold tier — dry-run only). \
A maintainer-captured smoke trace promotes this adapter; see provider-lifecycle-discipline."
}

aiv_cmd_submit() { _gemini_image_not_wired submit; }
aiv_cmd_poll()   { _gemini_image_not_wired poll; }
aiv_cmd_fetch()  { _gemini_image_not_wired fetch; }

aiv_dispatch "${ADAPTER_ID}" "none" "$@"
