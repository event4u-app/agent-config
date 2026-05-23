#!/usr/bin/env bash
# scripts/smoke/kernel.sh — kernel-tier smoke (step-11 Phase 3 Step 2).
#
# Asserts:
#   1. router.json lists exactly 10 kernel rules.
#   2. Every kernel rule file exists at .agent-src/rules/<id>.md.
#   3. 9 of 10 carry at least one Iron-Law fenced block.
#      agent-authority is the dispatch index, exempt from the fence
#      requirement (docs/contracts/smoke-contracts.md § 3.1).
#   4. Kernel-bucket char budget breaches ≤ EXPECTED_BREACHES.
#
# Runtime ceiling: 30 s.
# Output: table by default, baseline line on stdout last; SMOKE_QUIET=1
# suppresses the table.
# Contract: docs/contracts/smoke-contracts.md

set -euo pipefail

EXPECTED_KERNEL_COUNT=10
EXPECTED_FENCE_CARRIERS=9
EXPECTED_BREACHES=2
EXEMPT_FROM_FENCE="agent-authority"

quiet="${SMOKE_QUIET:-0}"
fail=0

log() { [ "$quiet" = "1" ] || printf '%s\n' "$*"; }

# 1. kernel ids from router.json
kernel_ids=$(python3 -c '
import json
d = json.load(open("dist/router.json"))
print("\n".join(d.get("kernel", [])))
')
kernel_count=$(printf '%s\n' "$kernel_ids" | grep -c .)

log "## Kernel smoke"
log ""
log "| Check | Value |"
log "|---|---:|"
log "| router.json kernel count | $kernel_count |"

if [ "$kernel_count" -ne "$EXPECTED_KERNEL_COUNT" ]; then
  echo "❌ kernel count: $kernel_count (expected $EXPECTED_KERNEL_COUNT)"
  fail=1
fi

# 2. every kernel rule has a file
missing=0
for id in $kernel_ids; do
  if [ ! -f ".agent-src/rules/$id.md" ]; then
    echo "❌ missing rule file: .agent-src/rules/$id.md"
    missing=$((missing + 1))
  fi
done
log "| Rule files present | $((kernel_count - missing))/$kernel_count |"
if [ "$missing" -gt 0 ]; then fail=1; fi

# 3. count Iron-Law fences per rule
fence_carriers=0
for id in $kernel_ids; do
  if printf ' %s ' "$EXEMPT_FROM_FENCE" | grep -q " $id "; then
    continue
  fi
  if [ -f ".agent-src/rules/$id.md" ]; then
    fences=$(awk 'BEGIN{c=0;open=0} /^```/{ if(open==0){c++;open=1}else{open=0} } END{print c}' ".agent-src/rules/$id.md")
    if [ "$fences" -ge 1 ]; then
      fence_carriers=$((fence_carriers + 1))
    else
      echo "❌ no Iron-Law fence in .agent-src/rules/$id.md"
      fail=1
    fi
  fi
done
log "| Iron-Law fence carriers | $fence_carriers/$((kernel_count - 1)) |"

if [ "$fence_carriers" -lt "$EXPECTED_FENCE_CARRIERS" ]; then
  echo "❌ fence carriers: $fence_carriers (expected $EXPECTED_FENCE_CARRIERS)"
  fail=1
fi

# 4. kernel char-budget breach count (advisory: locked at current measured)
breach_count=0
if python3 scripts/measure_rule_budget.py --kernel-budget-check >/tmp/kernel-budget.$$ 2>&1; then
  breach_count=0
else
  breach_count=$(grep -c "^  - " /tmp/kernel-budget.$$ || true)
fi
rm -f /tmp/kernel-budget.$$
log "| Kernel-budget breaches | $breach_count (locked ≤ $EXPECTED_BREACHES) |"

if [ "$breach_count" -gt "$EXPECTED_BREACHES" ]; then
  echo "❌ kernel budget breaches: $breach_count > $EXPECTED_BREACHES (regression)"
  fail=1
fi

# Baseline line — last line of stdout for CI summary parsing.
log ""
echo "BASELINE: $kernel_count kernel rules · $fence_carriers carry Iron-Law fences · 1 dispatch index · $breach_count budget breach(es)"

exit $fail
