#!/usr/bin/env bash
# probe-audio.sh — turn a song file into a deterministic, network-free
# JSON summary the `song-to-script` skill maps to scenes:
#
#   {"duration": <seconds>,
#    "method": "silence" | "rms" | "interval",
#    "warning": "<present only for the interval fallback>",
#    "sections": [{"start":0.0,"end":12.5,"energy":0.41,"label":"intro"}, ...]}
#
# HONEST FRAMING (AI-council design review, 2026-05-30): this is energy /
# silence segmentation, NOT beat detection or musical analysis. Modern
# masters are brick-walled (near-constant RMS), so a real cut structure
# is often absent. The probe therefore degrades through three methods and
# always reports which one produced the anchors:
#
#   1. silence  — ffmpeg silencedetect found real quiet gaps → true cuts.
#   2. rms      — no usable silence; greedy-merge per-window RMS energy.
#   3. interval — track is structurally flat (brick-walled / sustained):
#                 fall back to fixed-interval cuts and SET `warning` so the
#                 caller (and the operator) knows timing is not musical.
#
# Sections are cut anchors, never a transcription. For beat-accurate cuts
# the operator passes `--scene-durations` to /video:from-song instead.
#
# Usage:
#   probe-audio.sh <song-file> [--window <seconds>] [--interval <seconds>]
#                              [--silence-db <dB>] [--silence-min <seconds>]
#
#   --window       RMS analysis window (default 3)
#   --interval     fixed-interval fallback section length (default 15)
#   --silence-db   silencedetect noise floor (default -30)
#   --silence-min  silencedetect minimum gap to count as a boundary (default 0.5)
#
# Exit codes:
#   0  JSON written to stdout
#   2  usage / file missing
#   3  required tool missing (ffprobe / ffmpeg)
#   4  no audio stream in the file
#
# Runtime requirements (trust boundary — AI-council note 2026-06-02):
#   - ffmpeg + ffprobe on PATH (enforced, exit 3).
#   - POSIX awk. Both GNU awk (CI/Linux) and BSD awk (macOS) are supported;
#     the window arrays are passed via ENVIRON, not -v, because BSD awk
#     rejects literal newlines in a -v value. The honesty invariant
#     (interval <=> warning) is regression-guarded by
#     tests/test_probe_audio.py::test_corpus_sweep_honesty_invariant.

set -euo pipefail

die() { printf 'probe-audio: %s\n' "$2" >&2; exit "$1"; }

[ "$#" -ge 1 ] || die 2 "usage: $0 <song-file> [--window <s>] [--interval <s>] [--silence-db <dB>] [--silence-min <s>]"

song="$1"; shift || true
window=3
interval=15
silence_db=-30
silence_min=0.5
while [ "$#" -gt 0 ]; do
  case "$1" in
    --window)      window="${2:-3}";       shift 2 ;;
    --interval)    interval="${2:-15}";     shift 2 ;;
    --silence-db)  silence_db="${2:--30}";  shift 2 ;;
    --silence-min) silence_min="${2:-0.5}"; shift 2 ;;
    *) die 2 "unknown arg: $1" ;;
  esac
done

[ -f "${song}" ] || die 2 "file not found: ${song}"
command -v ffprobe >/dev/null 2>&1 || die 3 "ffprobe not found"
command -v ffmpeg  >/dev/null 2>&1 || die 3 "ffmpeg not found"

# --- 1. duration + audio-stream check ----------------------------------
duration="$(ffprobe -v error -select_streams a:0 \
  -show_entries format=duration -of default=nk=1:nw=1 "${song}" 2>/dev/null || true)"
[ -n "${duration}" ] || die 4 "no audio stream in: ${song}"

# --- 2. per-window RMS energy via astats --------------------------------
# Slice the track into <window>-second chunks; read mean RMS level (dB),
# normalise to 0..1 where -60dB→0 and 0dB→1. These energies feed BOTH the
# rms-merge method and the per-section labelling of every method.
n_windows="$(awk -v d="${duration}" -v w="${window}" 'BEGIN{
  n = int(d / w); if (n * w < d) n++; if (n < 1) n = 1; print n }')"

win_starts=""; win_energy=""
i=0
while [ "${i}" -lt "${n_windows}" ]; do
  start="$(awk -v i="${i}" -v w="${window}" 'BEGIN{printf "%.3f", i*w}')"
  rms_db="$(ffmpeg -hide_banner -nostats -ss "${start}" -t "${window}" -i "${song}" \
    -af astats=metadata=1:reset=1 -f null - 2>&1 \
    | awk -F': ' '/RMS level dB/ {v=$2} END{print v}')"
  case "${rms_db}" in ""|*inf*|*nan*) rms_db=-60 ;; esac
  norm="$(awk -v x="${rms_db}" 'BEGIN{
    v=(x+60)/60; if(v<0)v=0; if(v>1)v=1; printf "%.3f", v }')"
  win_starts="${win_starts}${start}\n"
  win_energy="${win_energy}${norm}\n"
  i=$((i + 1))
done

# --- 3. silencedetect boundaries ----------------------------------------
# Real quiet gaps split the track at musically-meaningful points far more
# reliably than RMS deltas on a compressed master. Collect the midpoints
# of detected silences as candidate section boundaries.
sil_bounds="$(ffmpeg -hide_banner -nostats -i "${song}" \
  -af "silencedetect=noise=${silence_db}dB:d=${silence_min}" -f null - 2>&1 \
  | awk '
      /silence_start/ { for(i=1;i<=NF;i++) if($i=="silence_start:") s=$(i+1) }
      /silence_end/   { for(i=1;i<=NF;i++) if($i=="silence_end:")   { e=$(i+1); printf "%.3f\n", (s+e)/2 } }
    ' 2>/dev/null || true)"
# Trailing \n so `wc -l` counts the last line: command substitution strips
# the trailing newline, and two boundaries without it count as one.
n_sil="$(printf '%s\n' "${sil_bounds}" | sed '/^$/d' | wc -l | tr -d ' ')"

# --- 4. choose method + build section boundaries ------------------------
# A method needs >= 3 sections (>= 2 internal boundaries) to count as
# "structure found"; otherwise degrade to the next method.
method=""
boundaries=""   # internal cut points (excluding 0 and duration)

if [ "${n_sil}" -ge 2 ]; then
  method="silence"
  boundaries="$(printf '%s\n' "${sil_bounds}" | sed '/^$/d' \
    | awk -v d="${duration}" '$1>0.5 && $1<d-0.5' | sort -n | uniq)"
fi

if [ -z "${method}" ]; then
  # greedy-merge adjacent RMS windows; keep a boundary on energy delta > 0.12
  rms_bounds="$(paste <(printf '%b' "${win_starts}") <(printf '%b' "${win_energy}") \
    | awk -v d="${duration}" '
        { st[NR]=$1; en[NR]=$2; cnt=NR }
        END {
          prev=en[1]
          for(k=2;k<=cnt;k++){
            if ((en[k]-prev>0.12)||(prev-en[k]>0.12)) { if(st[k]>0.5 && st[k]<d-0.5) print st[k] }
            prev=en[k]
          }
        }')"
  n_rms="$(printf '%s\n' "${rms_bounds}" | sed '/^$/d' | wc -l | tr -d ' ')"
  if [ "${n_rms}" -ge 2 ]; then
    method="rms"
    boundaries="$(printf '%s\n' "${rms_bounds}" | sed '/^$/d' | sort -n | uniq)"
  fi
fi

warning=""
if [ -z "${method}" ]; then
  method="interval"
  warning="track is structurally flat (no usable silence or energy structure); sections are fixed ${interval}s intervals, not musical cuts"
  boundaries="$(awk -v d="${duration}" -v iv="${interval}" 'BEGIN{
    for(t=iv; t<d-0.5; t+=iv) printf "%.3f\n", t }')"
fi

# --- 5. assemble sections, label, emit JSON -----------------------------
# Boundaries → [0, b1, b2, ..., duration] section edges. Energy per section
# = mean of the RMS windows whose start falls inside it.
printf '%s' "${boundaries}" \
  | sed '/^$/d' \
  | _PROBE_WINS="$(printf '%b' "${win_starts}")" _PROBE_ENS="$(printf '%b' "${win_energy}")" \
    awk -v d="${duration}" -v method="${method}" -v warning="${warning}" '
    BEGIN {
      # Read the window arrays from the environment, not -v: BSD awk (macOS)
      # rejects literal newlines inside a -v value ("newline in string"),
      # while GNU awk (CI/Linux) tolerates them. ENVIRON is POSIX and
      # portable across both. (Surfaced 2026-06-02 once ffmpeg landed on a
      # macOS authoring host — CI on gawk never hit it.)
      nw=split(ENVIRON["_PROBE_WINS"], ws, "\n"); split(ENVIRON["_PROBE_ENS"], es, "\n")
      # build edges
      ne=0; edges[ne++]=0
    }
    { edges[ne++]=$1+0 }
    END {
      edges[ne++]=d+0
      # mean energy across all windows for relative labelling
      sum=0; c=0
      for(k=1;k<=nw;k++){ if(ws[k]!=""){ sum+=es[k]; c++ } }
      mean=(c?sum/c:0)
      printf "{\"duration\": %.3f, \"method\": \"%s\"", d, method
      if (warning != "") { gsub(/"/,"\\\"",warning); printf ", \"warning\": \"%s\"", warning }
      printf ", \"sections\": ["
      segs=ne-1
      for(j=0;j<segs;j++){
        s=edges[j]; e=edges[j+1]
        # mean energy of windows starting within [s,e)
        es_sum=0; es_c=0
        for(k=1;k<=nw;k++){ if(ws[k]!=""){ if(ws[k]+0>=s && ws[k]+0<e){ es_sum+=es[k]; es_c++ } } }
        energy=(es_c?es_sum/es_c:mean)
        if (j==0) label="intro"
        else if (j==segs-1) label=(energy<mean?"outro":"drop")
        else if (energy>=mean+0.10) label="drop"
        else if (energy<=mean-0.10) label="breakdown"
        else label="build"
        sep=(j<segs-1)?",":""
        printf "{\"start\": %.3f, \"end\": %.3f, \"energy\": %.3f, \"label\": \"%s\"}%s", s, e, energy, label, sep
      }
      print "]}"
    }'
