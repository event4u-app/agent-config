#!/bin/bash
# Context round: each judge re-rules only its own UNSURE edges, with more context.
set -u
V21="$(cd "$(dirname "$0")" && pwd)"
EMPTY="$V21/empty"; mkdir -p "$EMPTY"
for P in "$V21"/context-prompt-*.md; do
  b="$(basename "$P" .md)"; b="${b#context-prompt-}"   # <prefix>.<provider>
  out="$V21/context-rulings-$b.txt"
  [ -f "$out" ] && continue
  case "$b" in
    *.openai) codex exec -s read-only --skip-git-repo-check --ephemeral -C "$EMPTY" \
                -c model_reasoning_effort=medium -o "$out" - < "$P" > "$out.log" 2>&1 ;;
    *.google) (cd "$EMPTY" && agy -p "Answer from the text below only; you need no tools and no files.

$(cat "$P")" --model gemini-3.8-flash-medium --print-timeout 0 > "$out" 2> "$out.log") ;;
  esac
  echo "$b exit $?"
done
