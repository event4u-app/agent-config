#!/usr/bin/env bash
#
# Verify the rule-13 split proposal WITHOUT applying it.
#
# Checks the five properties the `rule-13-amendment` blocker turns on, in the
# order a reviewer would want them:
#
#   1. the patch applies cleanly to the template at HEAD
#   2. the patch is PURELY ADDITIVE — zero deletion lines. This is the strongest
#      available form of "the prohibition half stays byte-identical": nothing
#      anywhere in the file is removed or changed, so the five prohibition
#      sentences cannot have moved by a character.
#   3. the prohibition block hashes to the pinned sha256 before AND after
#   4. the applied result carries 28 numbered rules (up from 27) and rule 28
#      carries the non-goal sentence verbatim
#   5. no rule number appears twice. The count in 4 cannot see a collision —
#      two rules both numbered 27 still total 28 — and a collision is exactly
#      what went wrong on 2026-09-13, so it gets its own assertion. Observed
#      RED 2026-09-14 against a copy renumbering the new rule back to 27:
#      check 5 fails and check 4 passes, which is the whole reason it exists.
#
# REBASED 2026-09-14. The counts above read 27-up-from-26 until today, and the
# patch no longer applied at all. `088f98fc2` / `5ed431b04` (2026-09-13) added a
# DIFFERENT rule 27 to the template — `## Decisions` — hours after this proposal
# was cut, so hunk 3's tail context had moved and the new rule's number
# collided. The patch is re-cut onto the moved base and the release-holds rule
# is renumbered 27 -> 28, with its two cross-references (rule 13's "per rule 28"
# and rule 20's "(rule 28)") moved with it. The semantic content is unchanged
# and still purely additive; the prohibition block still hashes to the same pin.
# The number was always positional, never load-bearing.
#
# Applies to a scratch copy under a temp dir; the working tree is never touched.
#
# Usage, from the repository root:
#   bash agents/evidence/analysis/release-holds-rule-13-split-verify.sh
#
# An optional first argument names a different patch file. That exists so the
# checks can be seen RED on a deliberately tampered copy — a check never observed
# failing has unknown sensitivity.
#
# Observed reading, 2026-09-13, on a copy whose context line "and tag decisions
# belong to the user" was turned into a delete+add pair rewriting "user" to
# "maintainer": checks 2 and the after-hash go RED, exit 1. The APPLY check stays
# green, and that is the finding, not a flaw — a tampered patch is still a valid
# patch, which is exactly why "it applies" is not the property that matters here
# and why checks 2 and 3 exist.
#
# Exit 0 means the proposal is what it says it is. It does NOT mean the split is
# approved — that is the owner decision the blocker records.
set -u

PATCH="${1:-agents/evidence/analysis/release-holds-rule-13-split.patch}"
PATCH_ABS="$(cd "$(dirname "$PATCH")" && pwd)/$(basename "$PATCH")"
TEMPLATE='src/agent-src/templates/roadmaps.md'
PIN='5827d0e4b5a1c88e7d646e7157fed36564890a5aaa5f2e33c0007ad77b9ed407'
NON_GOAL='roadmap *incompleteness* is never a release condition'
fail=0

note() { printf '%-5s %s\n' "$1" "$2"; }

# 1 — applies cleanly
if git apply --check "$PATCH_ABS" 2>/dev/null; then
  note 'OK' 'patch applies cleanly to the template at HEAD'
else
  note 'FAIL' 'patch does not apply to the template at HEAD'
  fail=1
fi

# 2 — purely additive
dels=$(grep '^-' "$PATCH_ABS" | grep -vc '^--- ' || true)
if [ "$dels" = '0' ]; then
  note 'OK' 'patch is purely additive — 0 deletion lines'
else
  note 'FAIL' "patch carries $dels deletion line(s); the split must add only"
  fail=1
fi

# 3 + 4 — hash and shape, on a scratch copy
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/src/agent-src/templates"
cp "$TEMPLATE" "$tmp/$TEMPLATE"

prohibition_sha() {
  sed -n '/^13\. \*\*No tags, releases, or version numbers\.\*\*/,/^    This is enforced by \[`scope-control`\]/p' "$1" \
    | shasum -a 256 | cut -d' ' -f1
}

before=$(prohibition_sha "$TEMPLATE")
if [ "$before" = "$PIN" ]; then
  note 'OK' "prohibition block at HEAD matches the pin ($PIN)"
else
  note 'FAIL' "prohibition block at HEAD is $before, pin is $PIN"
  fail=1
fi

if (cd "$tmp" && git apply "$PATCH_ABS" 2>/dev/null); then
  after=$(prohibition_sha "$tmp/$TEMPLATE")
  if [ "$after" = "$PIN" ]; then
    note 'OK' 'prohibition block is byte-identical after the split'
  else
    note 'FAIL' "prohibition block changed to $after after the split"
    fail=1
  fi

  rules=$(grep -cE '^[0-9]+\. \*\*' "$tmp/$TEMPLATE" || true)
  if [ "$rules" = '28' ]; then
    note 'OK' 'numbered rules read 28 after the split (27 before)'
  else
    note 'FAIL' "numbered rules read $rules after the split, expected 28"
    fail=1
  fi

  # The count above cannot see a DUPLICATE number — two rules both called 27
  # would still total 28. Assert the sequence instead, which is the property
  # the 2026-09-13 collision actually broke.
  dupes=$(grep -oE '^[0-9]+\. \*\*' "$tmp/$TEMPLATE" | sort | uniq -d | tr -d '\n')
  if [ -z "$dupes" ]; then
    note 'OK' 'no duplicate rule number after the split'
  else
    note 'FAIL' "duplicate rule number(s) after the split: $dupes"
    fail=1
  fi

  if grep -qF "$NON_GOAL" "$tmp/$TEMPLATE"; then
    note 'OK' 'rule 28 carries the non-goal sentence verbatim'
  else
    note 'FAIL' 'rule 28 does not carry the non-goal sentence'
    fail=1
  fi
else
  note 'FAIL' 'could not apply the patch to the scratch copy'
  fail=1
fi

if [ "$fail" = '0' ]; then
  printf '\n✅  rule-13 split proposal verified. Approval is still the owner decision.\n'
else
  printf '\n❌  rule-13 split proposal did NOT verify.\n'
fi
exit "$fail"
