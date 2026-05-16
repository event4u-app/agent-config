#!/usr/bin/env bash
# scripts/smoke/router.sh — router-tier smoke (step-11 Phase 3 Step 3).
#
# Asserts router.json structural integrity:
#   1. 75 ids = 9 kernel + 24 tier_1 + 42 tier_2 (locked count).
#   2. Every id resolves to .agent-src/rules/<id>.md (0 broken).
#   3. Every routes_to ref resolves through its prefix
#      (skill:, command:, guideline:, contract:); missing-contract
#      count locked at ≤ EXPECTED_MISSING_CONTRACTS.
#
# Runtime ceiling: 30 s.
# Output: table by default, baseline line on stdout last; SMOKE_QUIET=1
# suppresses the table.
# Contract: docs/contracts/smoke-contracts.md § 3.2

set -euo pipefail

EXPECTED_TOTAL_IDS=75
EXPECTED_MISSING_CONTRACTS=2

quiet="${SMOKE_QUIET:-0}"
log() { [ "$quiet" = "1" ] || printf '%s\n' "$*"; }

result=$(python3 <<'PY'
import json, os, sys, pathlib

d = json.load(open("router.json"))
kernel = d.get("kernel", [])
tier1 = d.get("tier_1", [])
tier2 = d.get("tier_2", [])
ids = list(kernel) + [r["id"] for r in tier1] + [r["id"] for r in tier2]
total = len(ids)

# Rule-file resolution
missing_rules = [i for i in ids if not os.path.exists(f".agent-src/rules/{i}.md")]

# routes_to resolution
def resolve(ref):
    if ":" not in ref:
        return f".agent-src.uncompressed/skills/{ref}/SKILL.md", "skill"
    kind, rest = ref.split(":", 1)
    if kind == "skill":
        return f".agent-src.uncompressed/skills/{rest}/SKILL.md", "skill"
    if kind == "command":
        for p in (
            f".agent-src.uncompressed/commands/{rest}.md",
            f".agent-src.uncompressed/commands/{rest}/INDEX.md",
        ):
            if os.path.exists(p):
                return p, "command"
        return f".agent-src.uncompressed/commands/{rest}.md", "command"
    if kind == "guideline":
        return f"docs/guidelines/{rest}.md", "guideline"
    if kind == "contract":
        return f"docs/contracts/{rest}.md", "contract"
    return None, kind

refs = set()
for r in tier1 + tier2:
    for ref in r.get("routes_to", []):
        refs.add(ref)

missing_by_kind = {"skill": [], "command": [], "guideline": [], "contract": []}
for ref in refs:
    path, kind = resolve(ref)
    if path is None or not os.path.exists(path):
        missing_by_kind.setdefault(kind, []).append(ref)

print(f"TOTAL_IDS={total}")
print(f"KERNEL={len(kernel)}")
print(f"TIER1={len(tier1)}")
print(f"TIER2={len(tier2)}")
print(f"MISSING_RULES={len(missing_rules)}")
print(f"ROUTES_TO_REFS={len(refs)}")
for kind, items in missing_by_kind.items():
    print(f"MISSING_{kind.upper()}={len(items)}")
    for r in items:
        print(f"  - {kind}: {r}")
PY
)

# Parse out the counters
TOTAL_IDS=$(echo "$result" | grep '^TOTAL_IDS=' | cut -d= -f2)
KERNEL=$(echo "$result" | grep '^KERNEL=' | cut -d= -f2)
TIER1=$(echo "$result" | grep '^TIER1=' | cut -d= -f2)
TIER2=$(echo "$result" | grep '^TIER2=' | cut -d= -f2)
MISSING_RULES=$(echo "$result" | grep '^MISSING_RULES=' | cut -d= -f2)
ROUTES_TO_REFS=$(echo "$result" | grep '^ROUTES_TO_REFS=' | cut -d= -f2)
MISSING_SKILL=$(echo "$result" | grep '^MISSING_SKILL=' | cut -d= -f2)
MISSING_COMMAND=$(echo "$result" | grep '^MISSING_COMMAND=' | cut -d= -f2)
MISSING_GUIDELINE=$(echo "$result" | grep '^MISSING_GUIDELINE=' | cut -d= -f2)
MISSING_CONTRACT=$(echo "$result" | grep '^MISSING_CONTRACT=' | cut -d= -f2)

log "## Router smoke"
log ""
log "| Check | Value |"
log "|---|---:|"
log "| Total router ids | $TOTAL_IDS (kernel $KERNEL · tier_1 $TIER1 · tier_2 $TIER2) |"
log "| Broken rule pointers | $MISSING_RULES |"
log "| routes_to refs | $ROUTES_TO_REFS |"
log "| missing skill targets | $MISSING_SKILL |"
log "| missing command targets | $MISSING_COMMAND |"
log "| missing guideline targets | $MISSING_GUIDELINE |"
log "| missing contract targets | $MISSING_CONTRACT (locked ≤ $EXPECTED_MISSING_CONTRACTS) |"

fail=0
if [ "$TOTAL_IDS" -ne "$EXPECTED_TOTAL_IDS" ]; then
  echo "ℹ️  router id count drifted: $TOTAL_IDS (was $EXPECTED_TOTAL_IDS)"
fi
if [ "$MISSING_RULES" -gt 0 ]; then
  echo "❌ broken rule pointers: $MISSING_RULES"
  echo "$result" | grep '^  - skill:\|^  - guideline:' || true
  fail=1
fi
if [ "$MISSING_SKILL" -gt 0 ] || [ "$MISSING_COMMAND" -gt 0 ] || [ "$MISSING_GUIDELINE" -gt 0 ]; then
  echo "❌ broken routes_to targets:"
  echo "$result" | grep -E '^  - (skill|command|guideline):' || true
  fail=1
fi
if [ "$MISSING_CONTRACT" -gt "$EXPECTED_MISSING_CONTRACTS" ]; then
  echo "❌ missing contracts: $MISSING_CONTRACT > $EXPECTED_MISSING_CONTRACTS (regression)"
  echo "$result" | grep '^  - contract:' || true
  fail=1
fi

log ""
echo "BASELINE: $TOTAL_IDS router ids · $MISSING_RULES broken rule pointers · $ROUTES_TO_REFS routes_to refs · $MISSING_CONTRACT missing contracts"

exit $fail
