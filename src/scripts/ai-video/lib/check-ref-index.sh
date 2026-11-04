#!/usr/bin/env bash
# check-ref-index.sh — refuse a prompt that cites an input image the run does
# not supply. A prompt saying "the woman from Bild 5" with two inputs renders
# against a reference that does not exist, and no provider says so.
#
#   check-ref-index.sh <input-count> [<prompt-file>|-]
#
#   <input-count>  number of reference images sent with the prompt (>= 0).
#   <prompt-file>  the prompt text; stdin when omitted or "-".
#
# A citation is one of the explicit reference forms, case-insensitive, with an
# optional "#": `@imageN`, `image N`, `Bild N`, `Frame N`, `reference N`. The
# form must not be glued to a preceding letter or digit and the number must not
# run into a following letter, so "24 frames", "frame 24fps" and "myimage 9"
# are prose, not citations. Every line citing an index above <input-count> is
# reported on stderr with its line number.
#
# Exit codes: 0 every citation resolves · 2 usage · 7 an index exceeds the
# input count.
#
# Called by the prompt-validator skill before its prose checks.

set -euo pipefail

die() { printf 'check-ref-index: %s\n' "$2" >&2; exit "$1"; }

[ "$#" -ge 1 ] || die 2 "usage: $0 <input-count> [<prompt-file>|-]"
count="$1"
case "${count}" in ''|*[!0-9]*) die 2 "input count must be a non-negative integer, got '${count}'" ;; esac
src="${2:--}"
[ "${src}" = "-" ] || [ -f "${src}" ] || die 2 "prompt file not found: ${src}"

awk -v max="${count}" '
  {
    rest = tolower($0); orig = $0; off = 0
    while (match(rest, /(^|[^a-z0-9_])@?(image|bild|frame|reference) ?#?[0-9]+([^a-z0-9_]|$)/)) {
      hit = substr(rest, RSTART, RLENGTH)
      num = hit; gsub(/[^0-9]/, "", num)
      if (num + 0 > max + 0) {
        cite = substr(orig, off + RSTART, RLENGTH)
        gsub(/^[^@A-Za-z]+|[^0-9]+$/, "", cite)
        printf "check-ref-index: line %d: cites %s but only %d input(s) supplied: %s\n", NR, cite, max, orig > "/dev/stderr"
        bad = 1
      }
      off += RSTART + RLENGTH - 2
      rest = substr(rest, RSTART + RLENGTH - 1)
    }
  }
  END { exit bad ? 7 : 0 }
' "${src}"
