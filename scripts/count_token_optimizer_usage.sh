#!/usr/bin/env bash
# Token-Optimizer telemetry counter.
#
# Per `road-to-token-optimization.md` P1.4: counts uncommented TELEMETRY
# lines inside the token-optimizer skill body. Each consult bumps a line.
# Decision rule: <5 consults / 2 weeks → P3.1 sunset audit fires.
#
# Output: 7-day count, 30-day count, total. Stdout only, no side effects.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$REPO_ROOT/.agent-src.uncompressed/skills/token-optimizer/SKILL.md"

if [[ ! -f "$SKILL" ]]; then
    echo "ERROR: $SKILL not found" >&2
    exit 1
fi

# Active TELEMETRY lines = those NOT inside an HTML comment.
# Pattern: lines that contain "TELEMETRY: consulted=" and start with neither "<!--" nor whitespace.
total=$(grep -cE '^TELEMETRY: consulted=' "$SKILL" || true)

today_epoch=$(date -u +%s)
seven_days_ago=$(( today_epoch - 7 * 86400 ))
thirty_days_ago=$(( today_epoch - 30 * 86400 ))

count_since() {
    local cutoff="$1"
    local n=0
    while IFS= read -r line; do
        # Extract the ISO timestamp after "consulted="
        ts=$(echo "$line" | sed -nE 's/^TELEMETRY: consulted=\[?([0-9TZ:+\-]+)\]?.*/\1/p')
        [[ -z "$ts" ]] && continue
        # Convert ISO → epoch (BSD `date -j` on macOS, GNU `date -d` on Linux)
        epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s 2>/dev/null \
            || date -u -d "$ts" +%s 2>/dev/null \
            || echo 0)
        if [[ "$epoch" -ge "$cutoff" ]]; then
            n=$(( n + 1 ))
        fi
    done < <(grep -E '^TELEMETRY: consulted=' "$SKILL" || true)
    echo "$n"
}

count_7d=$(count_since "$seven_days_ago")
count_30d=$(count_since "$thirty_days_ago")

echo "token-optimizer consults:"
echo "  last  7 days: $count_7d"
echo "  last 30 days: $count_30d"
echo "  total active: $total"
echo ""
echo "Decision rule: <5 consults / 2 weeks sustained → P3.1 sunset audit."
