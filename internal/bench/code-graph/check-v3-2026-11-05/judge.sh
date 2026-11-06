#!/bin/bash
# usage: judge.sh <group> [prefix]  — runs the two council providers on judge-<group>.md,
# sequentially, each in an empty directory with no repository to read.
set -u
TC="$(cd "$(dirname "$0")" && pwd)"
G="$1"; PFX="${2:-council}"
EMPTY="$TC/empty"; mkdir -p "$EMPTY"
PROMPT="$TC/judge-$G.md"
[ "$PFX" = round2 ] && PROMPT="$TC/round2-$G.md"
codex exec -s read-only --skip-git-repo-check --ephemeral -C "$EMPTY" \
  -c model_reasoning_effort=medium -o "$TC/$PFX-$G.openai.txt" - < "$PROMPT" > "$TC/$PFX-$G.openai.log" 2>&1
echo "openai exit $?"
(cd "$EMPTY" && claude -p --output-format text < "$PROMPT" > "$TC/$PFX-$G.anthropic.txt" 2> "$TC/$PFX-$G.anthropic.log")
echo "anthropic exit $?"
python3 - "$TC" "$G" "$PFX" <<'EOF'
import json, sys
tc, g, p = sys.argv[1:]
json.dump({'responses': [{'provider': prov, 'text': open(f'{tc}/{p}-{g}.{prov}.txt').read()} for prov in ('anthropic', 'openai')]},
          open(f'{tc}/{p}-{g}.json', 'w'), indent=1)
EOF
