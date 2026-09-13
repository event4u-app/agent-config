#!/usr/bin/env bash
#
# Reproduce the Phase 0.2 exposure row of
# `agents/roadmaps/road-to-release-holds-that-refuse.md` at any git ref.
#
# A roadmap is MID-FLIGHT when it carries at least one `- [x]` and at least one
# `- [ ]` — it has started and has not finished, which is the state a release
# hold exists to describe. Counts are over every checkbox line in the file, the
# same population `update_roadmap_progress` aggregates.
#
# Reads objects with `git show <ref>:<path>` rather than materialising a tree:
# `.gitattributes` carries `/agents export-ignore`, so `git archive` would yield
# a silently empty, zero-hit result here.
#
# Usage, from the repository root:
#   bash agents/evidence/analysis/release-holds-exposure-row.sh HEAD
#   bash agents/evidence/analysis/release-holds-exposure-row.sh 15.0.0
#
# Readings taken 2026-09-13 and recorded in
# `agents/evidence/analysis/release-holds-phase-0-2026-09-13.md`:
#   HEAD 7182f5d07 -> active=14  mid-flight=1
#   15.0.0 c86131ad7 -> active=7  mid-flight=3
set -u

REF="${1:-HEAD}"
mid=0
total=0

for f in $(git ls-tree --name-only "${REF}:agents/roadmaps" | grep '\.md$'); do
  body=$(git show "${REF}:agents/roadmaps/${f}")
  done_n=$(printf '%s\n' "$body" | grep -cE '^[[:space:]]*- \[x\]' || true)
  open_n=$(printf '%s\n' "$body" | grep -cE '^[[:space:]]*- \[ \]' || true)
  tag='-'
  if [ "$done_n" -gt 0 ] && [ "$open_n" -gt 0 ]; then
    tag='MID-FLIGHT'
    mid=$((mid + 1))
  fi
  total=$((total + 1))
  printf '%-56s done=%-4s open=%-4s %s\n' "$f" "$done_n" "$open_n" "$tag"
done

printf '\nREF=%s  active=%s  mid-flight=%s\n' "$REF" "$total" "$mid"
