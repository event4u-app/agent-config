#!/usr/bin/env bash
# scripts/smoke/skills.sh — skills-tier smoke (step-11 Phase 3 Step 5).
#
# Picks 5 random skills (deterministic seed = epoch day) from
# .agent-src.uncondensed/skills/*/SKILL.md and asserts:
#   1. SKILL.md exists.
#   2. Frontmatter parses + validates against scripts/schemas/skill.schema.json.
#   3. `name:` field matches the parent directory name.
#   4. Total skill count ≥ EXPECTED_MIN_SKILLS (regression lock against
#      accidental directory removal).
#
# Runtime ceiling: 30 s.
# Output: table by default, baseline line on stdout last; SMOKE_QUIET=1
# suppresses the table.
# Contract: docs/contracts/smoke-contracts.md § 3.4

set -euo pipefail

EXPECTED_MIN_SKILLS=205
SAMPLE_SIZE=5

quiet="${SMOKE_QUIET:-0}"
log() { [ "$quiet" = "1" ] || printf '%s\n' "$*"; }

result=$(node_modules/.bin/tsx -e '
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  parse_frontmatter,
  load_schema,
  validate,
  apply_schema_defaults,
} from "./src/scripts/validate_frontmatter.ts";
import { artefact_roots } from "./src/scripts/_lib/agent_src.ts";

// ADR-017: walk every source root, collect skill dirs by logical name.
// First root wins on collision (legacy > core > packs per agent_src).
const skillsByName = new Map();
for (const srcRoot of artefact_roots()) {
  const sd = join(srcRoot, "skills");
  if (!existsSync(sd)) continue;
  for (const name of readdirSync(sd).sort()) {
    const d = join(sd, name);
    if (!statSync(d).isDirectory()) continue;
    const skillFile = join(d, "SKILL.md");
    if (existsSync(skillFile) && !skillsByName.has(name)) {
      skillsByName.set(name, skillFile);
    }
  }
}
const skills = [...skillsByName.keys()].sort();
const total = skills.length;
console.log(`TOTAL_SKILLS=${total}`);

// Deterministic seed = epoch day → same sample within 24h, drifts daily.
const seed = Math.floor(Date.now() / 1000 / 86400);
// Seeded PRNG (mulberry32) → deterministic Fisher-Yates shuffle, take first N.
let s = seed >>> 0;
const rand = () => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pool = [...skills];
for (let i = pool.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rand() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}
const sample = pool.slice(0, Math.min(5, total));

const schema = load_schema("skill");

const failures = [];
for (const name of sample) {
  const path = skillsByName.get(name);
  const text = readFileSync(path, "utf-8");
  const [fm] = parse_frontmatter(text);
  if (fm === null) {
    failures.push(`${name}: no frontmatter`);
    continue;
  }
  // Inject schema defaults before validating: artefacts may omit a field
  // equal to its default (abstraction-reduction), injected at read time.
  apply_schema_defaults(fm, schema);
  const errs = validate(fm, schema);
  if (errs.length) {
    for (const e of errs) failures.push(`${name}: ${e.format()}`);
    continue;
  }
  const declared = fm.name;
  if (declared !== name) {
    failures.push(`${name}: name field=\"${declared}\" ≠ directory=\"${name}\"`);
  }
}

console.log(`SAMPLE=${sample.join(",")}`);
console.log(`SAMPLE_PASS=${sample.length - failures.length}`);
console.log(`SAMPLE_TOTAL=${sample.length}`);
for (const f of failures) console.log(`  FAIL: ${f}`);
')

TOTAL_SKILLS=$(echo "$result" | grep '^TOTAL_SKILLS=' | cut -d= -f2)
SAMPLE=$(echo "$result" | grep '^SAMPLE=' | cut -d= -f2)
SAMPLE_PASS=$(echo "$result" | grep '^SAMPLE_PASS=' | cut -d= -f2)
SAMPLE_TOTAL=$(echo "$result" | grep '^SAMPLE_TOTAL=' | cut -d= -f2)
FAILS=$(echo "$result" | grep -c '^  FAIL:' || true)

log "## Skills smoke"
log ""
log "| Check | Value |"
log "|---|---:|"
log "| Total skills | $TOTAL_SKILLS (≥ $EXPECTED_MIN_SKILLS) |"
log "| Sample size | $SAMPLE_TOTAL |"
log "| Sample (epoch-day seed) | $SAMPLE |"
log "| Sample pass | $SAMPLE_PASS/$SAMPLE_TOTAL |"

exit_code=0
if [ "$TOTAL_SKILLS" -lt "$EXPECTED_MIN_SKILLS" ]; then
  echo "❌ skill count $TOTAL_SKILLS < $EXPECTED_MIN_SKILLS (unexpected deletion?)"
  exit_code=1
fi
if [ "$FAILS" -gt 0 ]; then
  echo "❌ sample failures:"
  echo "$result" | grep '^  FAIL:'
  exit_code=1
fi

log ""
echo "BASELINE: $TOTAL_SKILLS skills · $SAMPLE_PASS/$SAMPLE_TOTAL random sample passes (seed=epoch-day)"

exit $exit_code
