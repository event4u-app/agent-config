#!/bin/bash
set -eu
V2="$(cd "$(dirname "$0")" && pwd)"
REPO=/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/.claude/worktrees/graph-that-wins
B="$REPO/internal/bench/code-graph"
rm -f "$V2/out/calibration.json"
for g in ls-human uo-human ls-partial uo-partial; do
  python3 "$V2/build_blind_prompt.py" "$g" "$B/check-v3-2026-11-05" "$B/truth-v3-2026-11-05.yaml" "$B/corpus-v3-2026-11-05.yaml" "$V2/../../oracle-work" "$V2/out"
done
