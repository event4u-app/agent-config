#!/bin/bash
# Phase 10.7 baseline measurement: post-consistency task ci subset.
TASKS="counts-check check-index check-router check-condensation check-condensed-paths check-refs check-token-optimizer-freshness check-portability check-examples-shape lint-roadmap-complexity check-public-links check-public-catalog-links check-command-count lint-no-new-atomic-commands check-cluster-patterns lint-rule-interactions lint-load-context check-context-paths check-no-roadmap-refs check-council-references lint-one-off-age check-ownership-matrix check-reply-consistency check-iron-law-prominence check-always-budget check-one-off-location validate-schema lint-rule-budget lint-skills lint-rule-tiers lint-handoffs lint-hook-manifest lint-showcase-sessions lint-marketplace"

echo "=== MINIMAL ==="
AGENT_SCRIPT_VERBOSITY=minimal task $TASKS 2>&1 > /tmp/ci-min.log
ML=$(wc -l < /tmp/ci-min.log | tr -d ' ')
MC=$(wc -c < /tmp/ci-min.log | tr -d ' ')
echo "MINIMAL: lines=$ML chars=$MC"

echo ""
echo "=== VERBOSE ==="
AGENT_SCRIPT_VERBOSITY=verbose task $TASKS 2>&1 > /tmp/ci-vrb.log
VL=$(wc -l < /tmp/ci-vrb.log | tr -d ' ')
VC=$(wc -c < /tmp/ci-vrb.log | tr -d ' ')
echo "VERBOSE: lines=$VL chars=$VC"

echo ""
python3 -c "
ml=$ML; vl=$VL; mc=$MC; vc=$VC
dl=(vl-ml)/vl*100 if vl else 0
dc=(vc-mc)/vc*100 if vc else 0
print(f'Lines: {ml} -> {vl}, reduction={dl:.1f}% (target >=40%)')
print(f'Chars: {mc} -> {vc}, reduction={dc:.1f}%')
print('verdict:', 'MET' if dl >= 40 else f'MISSED ({dl:.1f}% < 40%)')
"
