#!/bin/bash
# Check v2 judges: OpenAI (codex exec, medium) and Google (agy, gemini-3.8-flash-medium),
# sequentially, each in an empty directory with no repository. usage: judge_v2.sh [prefix] [groups...]
set -u
V2="$(cd "$(dirname "$0")" && pwd)"
OUT="$V2/out"; EMPTY="$V2/empty"; mkdir -p "$EMPTY"
PFX="${1:-rulings}"; shift || true
GROUPS_="${*:-ls-human uo-human ls-partial uo-partial}"
for g in $GROUPS_; do
  P="$OUT/judge-prompt-$g.md"; [ "$PFX" = round2 ] && P="$OUT/round2-prompt-$g.md"
  [ -f "$P" ] || continue
  codex exec -s read-only --skip-git-repo-check --ephemeral -C "$EMPTY" \
    -c model_reasoning_effort=medium -o "$OUT/$PFX-$g.openai.txt" - < "$P" > "$OUT/$PFX-$g.openai.log" 2>&1
  echo "$g openai exit $?"
  (cd "$EMPTY" && agy -p "$(cat "$P")" --model gemini-3.8-flash-medium --print-timeout 0 \
    > "$OUT/$PFX-$g.google.txt" 2> "$OUT/$PFX-$g.google.log")
  echo "$g google exit $?"
  python3 - "$OUT" "$g" "$PFX" <<'EOF'
import json, sys
out, g, p = sys.argv[1:]
json.dump({'responses': [{'provider': prov, 'text': open(f'{out}/{p}-{g}.{prov}.txt').read()} for prov in ('openai', 'google')]},
          open(f'{out}/{p}-{g}.json', 'w'), indent=1)
EOF
done
