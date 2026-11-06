#!/bin/bash
# Re-run the Google judge on one edge prompt whose first reply was empty (a tool call was
# denied in headless mode). The prompt is unchanged except for a leading no-tools line.
set -u
V21="$(cd "$(dirname "$0")" && pwd)"
n="$1"
cd "$V21/empty" || exit 1
agy -p "Answer from the text below only; you need no tools and no files.

$(cat "$V21/edge-prompt-$n.md")" --model gemini-3.8-flash-medium --print-timeout 0 \
  > "$V21/edge-rulings-$n.google.txt" 2> "$V21/edge-rulings-$n.google.log"
echo "exit $?"
python3 - "$V21" "$n" <<'EOF'
import json, sys
d, n = sys.argv[1:]
json.dump({'responses': [{'provider': p, 'text': open(f'{d}/edge-rulings-{n}.{p}.txt').read()} for p in ('openai', 'google')],
           'note': 'google re-run once: first reply empty (headless tool denial); prompt prefixed with a no-tools line'},
          open(f'{d}/edge-rulings-{n}.json', 'w'), indent=1)
EOF
