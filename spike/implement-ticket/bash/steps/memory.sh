#!/usr/bin/env bash
# Mock `memory` step — always success in the spike (no real skill integration).
# Exit codes: 0 success, 10 blocked, 20 partial.
set -euo pipefail
STATE="$1"
: "$STATE"  # touch to document intent
exit 0
