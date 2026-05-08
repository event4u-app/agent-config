#!/bin/bash
# Phase 10.7 baseline — runs only verbosity-aware patched-script tasks.
# Skips broken-on-dirty-tree tasks (consistency, check-index, validate-schema).
# This subset is what actually demonstrates the --quiet effect.
TASKS="check-compressed-paths check-refs check-portability lint-roadmap-complexity check-public-catalog-links check-command-count check-cluster-patterns lint-rule-interactions lint-load-context check-context-paths check-no-roadmap-refs check-council-references lint-one-off-age check-reply-consistency check-iron-law-prominence check-always-budget check-one-off-location lint-rule-budget lint-skills lint-rule-tiers lint-handoffs lint-marketplace lint-examples"

run() {
  local label=$1
  local level=$2
  local out=$3
  AGENT_SCRIPT_VERBOSITY=$level task $TASKS > "$out" 2>&1
  local lines=$(wc -l < "$out" | tr -d ' ')
  local chars=$(wc -c < "$out" | tr -d ' ')
  echo "$label: lines=$lines chars=$chars"
}

echo "=== MINIMAL ==="
run "MINIMAL" minimal /tmp/ci-min.log
echo ""
echo "=== VERBOSE ==="
run "VERBOSE" verbose /tmp/ci-vrb.log

ML=$(wc -l < /tmp/ci-min.log | tr -d ' ')
MC=$(wc -c < /tmp/ci-min.log | tr -d ' ')
VL=$(wc -l < /tmp/ci-vrb.log | tr -d ' ')
VC=$(wc -c < /tmp/ci-vrb.log | tr -d ' ')

echo ""
python3 -c "
ml=$ML; vl=$VL; mc=$MC; vc=$VC
dl=(vl-ml)/vl*100 if vl else 0
dc=(vc-mc)/vc*100 if vc else 0
print(f'Lines: {ml} -> {vl}, reduction={dl:.1f}% (target >=40%)')
print(f'Chars: {mc} -> {vc}, reduction={dc:.1f}%')
print('verdict:', 'MET' if dl >= 40 else f'MISSED ({dl:.1f}% < 40%)')
"
