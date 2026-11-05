#!/bin/bash
# Re-ask the Google judge for the one item it skipped in uo-human.
V2="$(cd "$(dirname "$0")" && pwd)"
cd "$V2/empty" || exit 1
agy -p "$(cat "$V2/out/reask-prompt-uo-human.md")" --model gemini-3.8-flash-medium --print-timeout 0 \
  > "$V2/out/reask-uo-human.google.txt" 2> "$V2/out/reask-uo-human.google.log"
echo "exit $?"
