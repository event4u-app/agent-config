#!/usr/bin/env bash
# parse-blueprint.sh — read a 12-block Cinematic Scene Blueprint
# from stdin (or a file arg) and emit adapter-contract JSON on
# stdout. Pure POSIX-compatible bash (no associative arrays, runs
# on macOS bash 3.2); jq required for JSON safety.
#
# Schema: .agent-src.uncondensed/skills/scene-expander/scene-blueprint.schema.yaml
# Contract: scripts/media/lib/adapter-contract.md
#
# Usage:
#   parse-blueprint.sh < prompt.txt > blueprint.json
#   parse-blueprint.sh prompt.txt > blueprint.json
#
# Exit codes:
#   0   valid blueprint, JSON emitted on stdout
#   2   missing required block — name on stderr
#   3   parse error (unknown block, malformed DURATION, etc.)

set -euo pipefail

command -v jq >/dev/null 2>&1 || {
  echo "parse-blueprint: jq required" >&2
  exit 3
}

input="${1:-/dev/stdin}"
[ -r "$input" ] || { echo "parse-blueprint: cannot read $input" >&2; exit 3; }

V_STYLE=""; V_SUBJECT=""; V_ENVIRONMENT=""; V_ACTION=""
V_CAMERA=""; V_LENS=""; V_LIGHTING=""; V_MOOD=""
V_DIALOGUE=""; V_AMBIENT_SOUND=""; V_DURATION=""; V_NEGATIVE=""

append_to() {
  local name="$1"; local line="$2"
  local cur; eval "cur=\${$name}"
  if [ -z "$cur" ]; then
    eval "$name=\$line"
  else
    eval "$name=\"\${$name}
\$line\""
  fi
}

set_var() {
  eval "$1=\$2"
}

current=""
while IFS= read -r line || [ -n "$line" ]; do
  stripped="$(printf '%s' "$line" | sed -E 's/^[[:space:]]*//; s/^\*\*//; s/\*\*[[:space:]]*$//')"
  label="$(printf '%s' "$stripped" | sed -nE 's/^([A-Z][A-Z ]+)[[:space:]]*:.*$/\1/p')"
  if [ -n "$label" ]; then
    key="$(printf '%s' "$label" | tr ' ' '_' | tr '[:lower:]' '[:upper:]')"
    case "$key" in
      STYLE|SUBJECT|ENVIRONMENT|ACTION|CAMERA|LENS|LIGHTING|MOOD|DIALOGUE|AMBIENT_SOUND|DURATION|NEGATIVE)
        current="V_$key"
        rest="$(printf '%s' "$stripped" | sed -E "s/^${label}[[:space:]]*:[[:space:]]*//")"
        set_var "$current" "$rest"
        continue
        ;;
    esac
  fi
  if [ -n "$current" ] && [ -n "$line" ]; then
    append_to "$current" "$line"
  fi
done < "$input"

for short in STYLE SUBJECT ENVIRONMENT ACTION CAMERA LENS LIGHTING MOOD DURATION NEGATIVE; do
  eval "v=\$V_$short"
  if [ -z "$v" ]; then
    echo "parse-blueprint: missing required block: $short" >&2
    exit 2
  fi
done

if ! printf '%s' "$V_DURATION" | grep -Eq '^[0-9]+(\.[0-9])?$'; then
  echo "parse-blueprint: DURATION not numeric: $V_DURATION" >&2
  exit 3
fi

negative_json="$(printf '%s' "$V_NEGATIVE" | tr ',\n' '\n\n' | sed '/^[[:space:]]*$/d' | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//' | jq -R . | jq -s .)"

to_array_or_null() {
  if [ -z "$1" ]; then
    printf '%s' "null"
  else
    printf '%s\n' "$1" | sed '/^[[:space:]]*$/d' | jq -R . | jq -s .
  fi
}
dialogue_json="$(to_array_or_null "$V_DIALOGUE")"
ambient_json="$(to_array_or_null "$V_AMBIENT_SOUND")"

audio_native=false
if [ "$dialogue_json" != "null" ] || [ "$ambient_json" != "null" ]; then
  audio_native=true
fi

jq -n \
  --arg style       "$V_STYLE" \
  --arg subject     "$V_SUBJECT" \
  --arg environment "$V_ENVIRONMENT" \
  --arg action      "$V_ACTION" \
  --arg camera      "$V_CAMERA" \
  --arg lens        "$V_LENS" \
  --arg lighting    "$V_LIGHTING" \
  --arg mood        "$V_MOOD" \
  --argjson dialogue "$dialogue_json" \
  --argjson ambient  "$ambient_json" \
  --argjson duration "$V_DURATION" \
  --argjson negative "$negative_json" \
  --argjson native   "$audio_native" \
  '{
    prompt: {
      style: $style, subject: $subject, environment: $environment,
      action: $action, camera: $camera, lens: $lens,
      lighting: $lighting, mood: $mood
    },
    audio: { dialogue: $dialogue, ambient: $ambient, enable_native_audio: $native },
    duration: $duration,
    negative: $negative,
    requires: { audio_native: $native }
  }'
