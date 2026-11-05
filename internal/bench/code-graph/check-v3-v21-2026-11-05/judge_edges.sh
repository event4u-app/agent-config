#!/bin/bash
# Check v2.1 edge judges: OpenAI (codex exec, medium) and Google (agy, gemini-3.8-flash-medium),
# sequentially, in an empty directory, over every edge-prompt-*.md chunk not yet ruled.
set -u
V21="$(cd "$(dirname "$0")" && pwd)"
EMPTY="$V21/empty"; mkdir -p "$EMPTY"
for P in "$V21"/edge-prompt-*.md; do
  n="$(basename "$P" .md)"; n="${n#edge-prompt-}"
  [ -f "$V21/edge-rulings-$n.json" ] && continue
  codex exec -s read-only --skip-git-repo-check --ephemeral -C "$EMPTY" \
    -c model_reasoning_effort=medium -o "$V21/edge-rulings-$n.openai.txt" - < "$P" > "$V21/edge-rulings-$n.openai.log" 2>&1
  echo "$n openai exit $?"
  (cd "$EMPTY" && agy -p "$(cat "$P")" --model gemini-3.8-flash-medium --print-timeout 0 \
    > "$V21/edge-rulings-$n.google.txt" 2> "$V21/edge-rulings-$n.google.log")
  echo "$n google exit $?"
  python3 - "$V21" "$n" <<'EOF'
import json, sys
d, n = sys.argv[1:]
json.dump({'responses': [{'provider': p, 'text': open(f'{d}/edge-rulings-{n}.{p}.txt').read()} for p in ('openai', 'google')]},
          open(f'{d}/edge-rulings-{n}.json', 'w'), indent=1)
EOF
done
