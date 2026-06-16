#!/usr/bin/env bash
# flux.sh — Black Forest Labs FLUX photoreal image adapter.
#
# Capability: audio=none (still image). Photorealism path
# (road-to-image-brand-typography decision 6). Reached via the fal / replicate
# multiplexers to start (their hosted FLUX endpoints) — a direct BFL endpoint
# is an optional later wiring.
#
# Lifecycle: experimental — scaffold tier. dry-run plumbing only; the live
# submit/poll/fetch round-trip is NOT wired (routes through fal/replicate once
# the pack-ai-image registry exists). Promotion to stable requires a
# maintainer-captured smoke trace under agents/reference/ai-image/smoke-traces/
# per provider-lifecycle-discipline.
#
# Live path (ASSUMED — to be verified before promotion):
#   via fal:       fal-ai/flux-pro / fal-ai/flux/dev    (see fal.sh multiplexer)
#   via replicate: black-forest-labs/flux-* model slugs (see replicate.sh)
#   submit -> hosted job id -> poll -> fetch PNG through the trust boundary
#
# Contract: scripts/media/lib/adapter-contract.md (v2 — trust boundary:
# downloads via aiv_fetch_url, returned paths via aiv_validate_artifact_path).
# Provider registry + the live wiring land with pack-ai-image (A.2 pack + A.3).

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

ADAPTER_ID="flux"

_flux_not_wired() {
  aiv_die 5 "${ADAPTER_ID}: live ${1} not wired (scaffold tier — dry-run only; \
routes via fal/replicate once the pack-ai-image registry exists). \
See provider-lifecycle-discipline."
}

aiv_cmd_submit() { _flux_not_wired submit; }
aiv_cmd_poll()   { _flux_not_wired poll; }
aiv_cmd_fetch()  { _flux_not_wired fetch; }

aiv_dispatch "${ADAPTER_ID}" "none" "$@"
