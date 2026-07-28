#!/bin/bash
# Deterministic rtk savings measurement — fixed command corpus, raw vs rtk-wrapped.
# Byte counts of combined stdout+stderr; token estimate = bytes/4.
cd "$(git rev-parse --show-toplevel)"
commands=(
  "git status"
  "git log --oneline -50"
  "git log -10"
  "git diff --stat HEAD~5..HEAD"
  "git branch -a"
  "ls -la src/scripts"
  "npm ls --depth=0"
  "git show --stat HEAD"
)
printf "%-32s %10s %10s %8s\n" "command" "raw_bytes" "rtk_bytes" "saving%"
total_raw=0; total_rtk=0
for cmd in "${commands[@]}"; do
  raw=$(eval "$cmd" 2>&1 | wc -c | tr -d ' ')
  rtk=$(eval "rtk $cmd" 2>&1 | wc -c | tr -d ' ')
  total_raw=$((total_raw+raw)); total_rtk=$((total_rtk+rtk))
  pct=$(awk -v r="$raw" -v k="$rtk" 'BEGIN{ if (r==0) print "n/a"; else printf "%.1f", (1-k/r)*100 }')
  printf "%-32s %10s %10s %8s\n" "$cmd" "$raw" "$rtk" "$pct"
done
pct=$(awk -v r="$total_raw" -v k="$total_rtk" 'BEGIN{printf "%.1f", (1-k/r)*100}')
echo "----"
echo "TOTAL raw=$total_raw rtk=$total_rtk overall_saving=${pct}%"
