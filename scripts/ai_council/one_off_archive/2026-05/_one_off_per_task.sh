#!/bin/bash
TASKS=(
  check-compressed-paths
  check-refs
  check-portability
  lint-roadmap-complexity
  check-public-catalog-links
  check-command-count
  check-cluster-patterns
  lint-rule-interactions
  lint-load-context
  check-context-paths
  check-no-roadmap-refs
  check-council-references
  lint-one-off-age
  check-reply-consistency
  check-iron-law-prominence
  check-always-budget
  check-one-off-location
  lint-rule-budget
  lint-skills
  lint-rule-tiers
  lint-handoffs
  lint-marketplace
  check-examples-shape
)
totalmin=0
totalvrb=0
totaldelta=0
for t in "${TASKS[@]}"; do
  m=$(AGENT_SCRIPT_VERBOSITY=minimal task "$t" 2>&1 | wc -l | tr -d ' ')
  v=$(AGENT_SCRIPT_VERBOSITY=verbose task "$t" 2>&1 | wc -l | tr -d ' ')
  d=$((v - m))
  totalmin=$((totalmin + m))
  totalvrb=$((totalvrb + v))
  totaldelta=$((totaldelta + d))
  printf "%-35s min=%-5s vrb=%-5s d=%s\n" "$t" "$m" "$v" "$d"
done
echo ""
echo "TOTAL: min=$totalmin vrb=$totalvrb delta=$totaldelta"
python3 -c "print(f'reduction: {($totalvrb - $totalmin)/$totalvrb*100:.1f}%' if $totalvrb else '')"
