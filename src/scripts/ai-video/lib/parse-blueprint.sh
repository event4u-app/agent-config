#!/usr/bin/env bash
# parse-blueprint.sh — read a 12-block Cinematic Scene Blueprint
# from stdin (or a file arg) and emit adapter-contract JSON on
# stdout. Pure POSIX-compatible bash (no associative arrays, runs
# on macOS bash 3.2); jq required for JSON safety.
#
# Schema: src/skills/scene-expander/scene-blueprint.schema.yaml
# Contract: scripts/media/lib/adapter-contract.md
#
# Usage:
#   parse-blueprint.sh < prompt.txt > blueprint.json
#   parse-blueprint.sh prompt.txt > blueprint.json
#
# Optional CONTINUITY block — how this scene joins the PREVIOUS one:
#
#   CONTINUITY: cut         hard cut (default; the value assumed when the
#                           block is absent, so every existing blueprint
#                           keeps its exact meaning)
#   CONTINUITY: handoff     this scene's ref_images[0] is the extracted last
#                           frame of the PREVIOUS scene's rendered clip, not
#                           its own still — so the two clips must render
#                           sequentially
#   CONTINUITY: connector   handoff plus one extra generated clip bridging the
#                           two, which needs a probed end_frame:true on both
#                           adjacent models (seam-plan.sh gates it)
#
# The value is emitted as the top-level `continuity` key. An unknown value is
# a parse error naming the value — never a silent downgrade to `cut`, because a
# caller who asked for continuity and got a cut has no way to see it. The seam
# plan (which boundaries hand off, the generation count, the sequential trade)
# is printed by the sibling `seam-plan.sh` over an ordered list of these JSONs;
# this script parses ONE scene and knows nothing about its neighbours.
#
# Exit codes:
#   0   valid blueprint, JSON emitted on stdout
#   2   missing required block — name on stderr
#   3   parse error (unknown block, malformed DURATION, unknown CONTINUITY)

set -euo pipefail

command -v jq >/dev/null 2>&1 || {
  echo "parse-blueprint: jq required" >&2
  exit 3
}

# A file argument is opened; with no argument the ALREADY-OPEN stdin is
# inherited rather than re-opened through /dev/stdin. Re-opening it is what the
# documented `parse-blueprint.sh < prompt.txt` form used to do, and it is not
# portable: on a Linux CI runner whose stdin is a pipe supplied by the test
# harness, `/dev/stdin` is not openable and the script died with
# "No such device or address" — the documented interface was broken on the one
# platform nothing had exercised it on. `exec` keeps the readable-path check
# meaningful for the argument form while leaving fd 0 untouched otherwise.
input="${1:-}"
if [ -n "$input" ]; then
  [ -r "$input" ] || { echo "parse-blueprint: cannot read $input" >&2; exit 3; }
  exec < "$input"
fi

V_STYLE=""; V_SUBJECT=""; V_ENVIRONMENT=""; V_ACTION=""
V_CAMERA=""; V_LENS=""; V_LIGHTING=""; V_MOOD=""
V_DIALOGUE=""; V_AMBIENT_SOUND=""; V_DURATION=""; V_NEGATIVE=""
V_CONTINUITY=""

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
      STYLE|SUBJECT|ENVIRONMENT|ACTION|CAMERA|LENS|LIGHTING|MOOD|DIALOGUE|AMBIENT_SOUND|DURATION|NEGATIVE|CONTINUITY)
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
done

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

# CONTINUITY is optional; absent means `cut`, which is what every blueprint
# written before this block existed meant. An unknown value is refused with the
# value named rather than downgraded to `cut`.
V_CONTINUITY="$(printf '%s' "$V_CONTINUITY" | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]')"
[ -n "$V_CONTINUITY" ] || V_CONTINUITY="cut"
case "$V_CONTINUITY" in
  cut|handoff|connector) ;;
  *)
    echo "parse-blueprint: unknown CONTINUITY value: $V_CONTINUITY (expected cut|handoff|connector)" >&2
    exit 3
    ;;
esac

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
  --arg continuity   "$V_CONTINUITY" \
  '{
    prompt: {
      style: $style, subject: $subject, environment: $environment,
      action: $action, camera: $camera, lens: $lens,
      lighting: $lighting, mood: $mood
    },
    audio: { dialogue: $dialogue, ambient: $ambient, enable_native_audio: $native },
    duration: $duration,
    negative: $negative,
    continuity: $continuity,
    requires: { audio_native: $native }
  }'
