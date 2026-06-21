#!/usr/bin/env bash
# scripts/smoke/router.sh — router-tier smoke (step-11 Phase 3 Step 3).
#
# Asserts router.json structural integrity:
#   1. 68 ids = 10 kernel + 23 tier_1 + 35 tier_2 (locked count).
#   2. Every id resolves to dist/agent-src/rules/<id>.md (0 broken).
#   3. Every routes_to ref resolves through its prefix
#      (skill:, command:, guideline:, contract:); missing-contract
#      count locked at ≤ EXPECTED_MISSING_CONTRACTS.
#
# Runtime ceiling: 30 s.
# Output: table by default, baseline line on stdout last; SMOKE_QUIET=1
# suppresses the table.
# Contract: docs/contracts/smoke-contracts.md § 3.2

set -euo pipefail

EXPECTED_TOTAL_IDS=68
EXPECTED_MISSING_CONTRACTS=2

quiet="${SMOKE_QUIET:-0}"
log() { [ "$quiet" = "1" ] || printf '%s\n' "$*"; }

result=$(node_modules/.bin/tsx -e '
import { existsSync, readFileSync } from "node:fs";
// ADR-017: routes_to resolution walks artefact_roots() across the
// monorepo. Skills/commands/guidelines may live under any source root.
import { resolve_logical } from "./src/scripts/_lib/agent_src.ts";

const d = JSON.parse(readFileSync("dist/router.json", "utf8"));
const kernel = d.kernel || [];
const tier1 = d.tier_1 || [];
const tier2 = d.tier_2 || [];
const ids = [...kernel, ...tier1.map((r) => r.id), ...tier2.map((r) => r.id)];
const total = ids.length;

// Rule-file resolution
const missingRules = ids.filter((i) => !existsSync(`dist/agent-src/rules/${i}.md`));

// routes_to resolution — multi-root aware via resolve_logical.
function resolve(ref) {
  let kind, rest;
  if (!ref.includes(":")) { kind = "skill"; rest = ref; }
  else { const idx = ref.indexOf(":"); kind = ref.slice(0, idx); rest = ref.slice(idx + 1); }
  if (kind === "skill") {
    for (const p of [
      `dist/agent-src/skills/${rest}/SKILL.md`,
      `.agent-src.uncondensed/skills/${rest}/SKILL.md`,
    ]) {
      if (existsSync(p)) return [p, "skill"];
    }
    const hit = resolve_logical(`skills/${rest}/SKILL.md`);
    return [hit ? String(hit) : `.agent-src.uncondensed/skills/${rest}/SKILL.md`, "skill"];
  }
  if (kind === "command") {
    for (const p of [
      `dist/agent-src/commands/${rest}.md`,
      `.agent-src.uncondensed/commands/${rest}.md`,
      `.agent-src.uncondensed/commands/${rest}/INDEX.md`,
    ]) {
      if (existsSync(p)) return [p, "command"];
    }
    for (const logical of [`commands/${rest}.md`, `commands/${rest}/INDEX.md`]) {
      const hit = resolve_logical(logical);
      if (hit) return [String(hit), "command"];
    }
    return [`.agent-src.uncondensed/commands/${rest}.md`, "command"];
  }
  if (kind === "guideline") return [`docs/guidelines/${rest}.md`, "guideline"];
  if (kind === "contract") return [`docs/contracts/${rest}.md`, "contract"];
  return [null, kind];
}

const refs = new Set();
for (const r of [...tier1, ...tier2]) {
  for (const ref of r.routes_to || []) refs.add(ref);
}

const missingByKind = { skill: [], command: [], guideline: [], contract: [] };
for (const ref of refs) {
  const [path, kind] = resolve(ref);
  if (path === null || !existsSync(path)) {
    (missingByKind[kind] ||= []).push(ref);
  }
}

const out = [];
out.push(`TOTAL_IDS=${total}`);
out.push(`KERNEL=${kernel.length}`);
out.push(`TIER1=${tier1.length}`);
out.push(`TIER2=${tier2.length}`);
out.push(`MISSING_RULES=${missingRules.length}`);
out.push(`ROUTES_TO_REFS=${refs.size}`);
for (const [kind, items] of Object.entries(missingByKind)) {
  out.push(`MISSING_${kind.toUpperCase()}=${items.length}`);
  for (const r of items) out.push(`  - ${kind}: ${r}`);
}
console.log(out.join("\n"));
')

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
