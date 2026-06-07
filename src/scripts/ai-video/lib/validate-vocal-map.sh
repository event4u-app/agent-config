#!/usr/bin/env bash
# validate-vocal-map.sh — enforce the media-sync-ground-truth Iron Law in
# code: lyric TIMING and TEXT in <project>/vocal-map.json must derive from
# the transcribed audio (the lyrics adapter / whisper transcript), never
# from a brief, a story skeleton, or a guessed time-stretch. Ambiguous
# singers must be surfaced as "?" — never silently guessed.
#
#   validate-vocal-map.sh <vocal-map.json> <transcript.json>
#                         [--tolerance <seconds>] [--roster "<A,B,C>"]
#
#   <vocal-map.json>   [{start, end, text, singer}] — the map the operator
#                      signs off before any paid render.
#   <transcript.json>  the lyrics-adapter output (audio-adapter-contract v1:
#                      {lines:[{start,end,text,speaker}]}) OR a bare
#                      {segments:[{start,end,text}]} verbose_json transcript.
#   --tolerance        max |Δstart| / |Δend| per line vs. the transcript
#                      (default 0.25 s — re-timed lines fail).
#   --roster           optional comma-separated cast list; when given,
#                      every singer must be in the roster or "?".
#
# Checks (all must pass; first failure reported with the offending line):
#   1. Shape — array of {start,end,text,singer}; start < end; non-empty
#      text; singer present (string, may be "?"); entries sorted, non-
#      overlapping.
#   2. Provenance — every map line matches a transcript line: identical
#      normalized text AND timing within --tolerance. A map line with no
#      transcript counterpart is brief-derived → REJECTED.
#   3. Roster — when --roster is given, singer ∈ roster ∪ {"?"}.
#
# Exit codes: 0 valid · 2 usage · 3 jq missing · 7 validation failure.
#
# Consumed by /video:from-song Step 6a (sign-off gate) — the gate runs
# this validator BEFORE showing the map for operator approval, so a
# skeleton-derived map can never reach a paid render.

set -euo pipefail

die() { printf 'validate-vocal-map: %s\n' "$2" >&2; exit "$1"; }

[ "$#" -ge 2 ] || die 2 "usage: $0 <vocal-map.json> <transcript.json> [--tolerance <s>] [--roster \"A,B,C\"]"

map_file="$1"; transcript_file="$2"; shift 2
tolerance=0.25
roster=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --tolerance) tolerance="${2:-0.25}"; shift 2 ;;
    --roster)    roster="${2:-}";        shift 2 ;;
    *) die 2 "unknown arg: $1" ;;
  esac
done

command -v jq >/dev/null 2>&1 || die 3 "jq not found"
[ -f "${map_file}" ]        || die 2 "vocal map not found: ${map_file}"
[ -f "${transcript_file}" ] || die 2 "transcript not found: ${transcript_file}"

jq -e 'type == "array"' "${map_file}" >/dev/null 2>&1 \
  || die 7 "vocal map must be a JSON array of {start,end,text,singer}"

# Single jq pass: normalize both sides, run all three checks, emit the
# first failure as a human-readable line on stdout (captured below).
result="$(jq -n --slurpfile map "${map_file}" --slurpfile tr "${transcript_file}" \
  --arg tol "${tolerance}" --arg roster "${roster}" '
  def norm: gsub("^\\s+|\\s+$"; "") | gsub("\\s+"; " ") | ascii_downcase;
  ($tol | tonumber) as $T
  | ($roster | if . == "" then [] else split(",") | map(norm) end) as $R
  | ($map[0]) as $M
  | ($tr[0] | (.lines // .segments // [])
      | map({start, end, text: (.text | norm)})) as $L
  | if ($M | length) == 0 then "ok: empty map (no lip-sync lines)"
    else
      ( # 1. shape
        [ $M | to_entries[]
          | .key as $i | .value as $e
          | if   ($e | type) != "object"            then "line \($i): not an object"
            elif ($e.start? | type) != "number"     then "line \($i): start missing or not a number"
            elif ($e.end?   | type) != "number"     then "line \($i): end missing or not a number"
            elif $e.start >= $e.end                 then "line \($i): start >= end"
            elif (($e.text? // "") | norm) == ""    then "line \($i): empty text"
            elif ($e.singer? | type) != "string" or $e.singer == ""
                                                    then "line \($i): singer missing — use \"?\" for ambiguous, never omit"
            else empty end ] +
        [ range(1; $M | length) as $i
          | if $M[$i].start < $M[$i-1].end - 0.001
            then "line \($i): overlaps previous line (map must be sorted, non-overlapping)"
            else empty end ] +
        ( # 2. provenance — transcript is the only allowed source
          [ $M | to_entries[]
            | .key as $i | .value as $e
            | (($e.text // "") | norm) as $t
            | ( [ $L[] | select(.text == $t
                  and ((.start - $e.start) | fabs) <= $T
                  and ((.end   - $e.end)   | fabs) <= $T) ] ) as $hit
            | if ($hit | length) == 0 then
                ( [ $L[] | select(.text == $t) ] ) as $textonly
                | if ($textonly | length) > 0
                  then "line \($i) (\"\($e.text)\"): re-timed — transcript has this text at \($textonly[0].start)-\($textonly[0].end)s, map says \($e.start)-\($e.end)s (tolerance \($T)s). Timing comes from the transcript, never a stretch."
                  else "line \($i) (\"\($e.text)\"): not in the transcript — brief-derived lyrics are forbidden (media-sync-ground-truth)"
                  end
              else empty end ] ) +
        ( # 3. roster
          if ($R | length) == 0 then []
          else [ $M | to_entries[]
            | .key as $i | .value as $e
            | (($e.singer // "") | norm) as $s
            | if $s == "?" or ($R | index($s)) != null then empty
              else "line \($i): singer \"\($e.singer)\" not in roster (\($roster)) — use a cast name or \"?\""
              end ]
          end )
      ) as $errors
      | if ($errors | length) == 0
        then "ok: \($M | length) lines, all transcript-derived"
        else $errors[0] end
    end
')" || die 7 "validation crashed — malformed JSON input"

result="$(printf '%s' "${result}" | jq -r .)"
case "${result}" in
  ok:*) printf 'validate-vocal-map: %s\n' "${result}"; exit 0 ;;
  *)    die 7 "${result}" ;;
esac
