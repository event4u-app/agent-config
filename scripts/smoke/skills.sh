#!/usr/bin/env bash
# scripts/smoke/skills.sh — skills-tier smoke (step-11 Phase 3 Step 5).
#
# Picks 5 random skills (deterministic seed = epoch day) from
# .agent-src.uncompressed/skills/*/SKILL.md and asserts:
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

result=$(python3 <<'PY'
import os, sys, time, hashlib, pathlib, glob
sys.path.insert(0, "scripts")
from validate_frontmatter import parse_frontmatter, load_schema, validate
from _lib.agent_src import artefact_roots

# ADR-017: walk every source root, collect skill dirs by logical name.
# First root wins on collision (legacy > core > packs per agent_src).
skills_by_name: dict[str, str] = {}
for src_root in artefact_roots():
    sd = src_root / "skills"
    if not sd.exists():
        continue
    for d in sorted(sd.iterdir()):
        if not d.is_dir():
            continue
        if (d / "SKILL.md").exists() and d.name not in skills_by_name:
            skills_by_name[d.name] = str(d / "SKILL.md")
skills = sorted(skills_by_name.keys())
total = len(skills)
print(f"TOTAL_SKILLS={total}")

# Deterministic seed = epoch day → same sample within 24h, drifts daily.
seed = int(time.time() // 86400)
import random
rng = random.Random(seed)
sample = rng.sample(skills, min(5, total))

schema = load_schema("skill")

failures = []
for name in sample:
    path = skills_by_name[name]
    text = open(path, encoding="utf-8").read()
    fm, _ = parse_frontmatter(text)
    if fm is None:
        failures.append(f"{name}: no frontmatter")
        continue
    errs = validate(fm, schema)
    if errs:
        for e in errs:
            failures.append(f"{name}: {e.format()}")
        continue
    declared = fm.get("name")
    if declared != name:
        failures.append(f"{name}: name field='{declared}' ≠ directory='{name}'")

print(f"SAMPLE={','.join(sample)}")
print(f"SAMPLE_PASS={len(sample) - len([f for f in failures])}")
print(f"SAMPLE_TOTAL={len(sample)}")
for f in failures:
    print(f"  FAIL: {f}")
PY
)

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
