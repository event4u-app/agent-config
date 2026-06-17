#!/usr/bin/env bash
# recraft.sh — Recraft vector / SVG image adapter (true <path> logos + icons).
#
# Capability: audio=none (still image / vector). The vector path
# (road-to-image-brand-typography decision 1): raster-only models can't emit
# usable logos, so recraft produces genuine `<path>` SVG for brand marks and
# icons. The LLM-authored-SVG path (simple marks) is a separate skill, not this
# adapter.
#
# Cost: pay-per-image / vector, low-mid tier (~$0.04-0.08 / image).
# Reference as-of 2026-06 — verify at recraft.ai pricing;
# prices/models are Reference, re-checked on cadence, never frozen.
#
# Lifecycle: experimental — scaffold tier. dry-run plumbing only; the live
# submit/fetch round-trip is NOT wired (no maintainer-captured smoke trace
# yet). Promotion to stable requires a real-API smoke trace under
# agents/reference/ai-image/smoke-traces/ per provider-lifecycle-discipline.
#
# Live API (Recraft v1 — ASSUMED shape, to be verified before promotion):
#   base   https://external.api.recraft.ai/v1
#   auth   Authorization: Bearer <API_KEY>
#   submit POST {base}/images/generations
#          {"prompt":"…","style":"vector_illustration","model":"recraftv3",
#           "response_format":"url"} -> {data:[{url}]}  (synchronous; SVG/PNG)
#   fetch  GET <data[].url> -> SVG bytes (download via the trust boundary)
#
# Contract: scripts/media/lib/adapter-contract.md (v2 — trust boundary:
# downloads via aiv_fetch_url, returned paths via aiv_validate_artifact_path).
# Provider registry + the live wiring land with pack-ai-image (A.2 pack + A.3).

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

ADAPTER_ID="recraft"

_recraft_not_wired() {
  aiv_die 5 "${ADAPTER_ID}: live ${1} not wired (scaffold tier — dry-run only). \
A maintainer-captured smoke trace promotes this adapter; see provider-lifecycle-discipline."
}

aiv_cmd_submit() { _recraft_not_wired submit; }
aiv_cmd_poll()   { _recraft_not_wired poll; }
aiv_cmd_fetch()  { _recraft_not_wired fetch; }

aiv_dispatch "${ADAPTER_ID}" "none" "$@"
