#!/usr/bin/env bash
# audio-qa.sh — measure an audio track (or a film's audio stream) and print
# one JSON object. Report only: it never changes the file.
#
#   {"duration": <s>, "channels": <n>,
#    "integrated_lufs": <LUFS|null>, "true_peak_dbtp": <dBTP|null>, "lra": <LU|null>,
#    "silence_spans": [{"start": <s>, "end": <s>}, ...],
#    "mono_fold_loss_db": <dB|null>}
#
# Sources: ffmpeg `ebur128=peak=true` (integrated loudness, loudness range,
# true peak) and `silencedetect`. Mono-fold loss is the stereo integrated
# loudness minus the loudness of the (L+R)/2 downmix played on both channels:
# identical channels lose 0 dB, uncorrelated ones about 3 dB, and material in
# antiphase cancels — on a phone speaker, this number is how much of it does.
# `null` means the measurement could not be taken, never zero: integrated
# loudness and true peak below the -70 LUFS gate, and loudness range on a
# track shorter than 6 s (its 3 s short-term windows have nothing to range
# over, and the number ffmpeg prints there is the windows ramping up).
#
# Usage:
#   audio-qa.sh <file> [--silence-db <dB>] [--silence-min <seconds>]
#
# Exit codes:
#   0  JSON written to stdout
#   2  usage / file missing
#   3  required tool missing (ffmpeg / ffprobe)
#   4  no audio stream in the file

set -euo pipefail

usage() {
    sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//' >&2
    exit 2
}

[[ $# -ge 1 ]] || usage
file="$1"; shift
silence_db="-50"
silence_min="0.5"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --silence-db) silence_db="${2:?--silence-db needs a value}"; shift 2 ;;
        --silence-min) silence_min="${2:?--silence-min needs a value}"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "audio-qa: unknown option $1" >&2; exit 2 ;;
    esac
done

[[ -f "$file" ]] || { echo "audio-qa: file not found: $file" >&2; exit 2; }
command -v ffmpeg >/dev/null 2>&1 || { echo "audio-qa: ffmpeg not on PATH" >&2; exit 3; }
command -v ffprobe >/dev/null 2>&1 || { echo "audio-qa: ffprobe not on PATH" >&2; exit 3; }

channels="$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of csv=p=0 "$file" | head -n1)"
[[ -n "$channels" ]] || { echo "audio-qa: no audio stream in $file" >&2; exit 4; }
duration="$(ffprobe -v error -select_streams a:0 -show_entries stream=duration -of csv=p=0 "$file" | head -n1)"
if [[ -z "$duration" || "$duration" == "N/A" ]]; then
    duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$file" | head -n1)"
fi

# The ebur128 summary block: "I: -23.0 LUFS", "LRA: 4.1 LU", "Peak: -1.2 dBFS".
# A value of -70 LUFS (or -inf) is the gate's floor and is reported as null.
summary() {
    ffmpeg -hide_banner -nostats -i "$file" -map a:0 $1 -af "$2" -f null - 2>&1 \
        | awk '/Summary:/ { s = 1 } s'
}
pick() {
    awk -v key="$1" '$1 == key { v = $2 } END { if (v == "" || v == "-inf" || v + 0 <= -70) print "null"; else print v }'
}

stereo="$(summary "" "ebur128=peak=true")"
lufs="$(printf '%s\n' "$stereo" | pick "I:")"
lra="$(printf '%s\n' "$stereo" | pick "LRA:")"
if [[ "$lufs" == "null" ]] || awk -v d="$duration" 'BEGIN { exit !(d < 6) }'; then lra="null"; fi
peak="$(printf '%s\n' "$stereo" | pick "Peak:")"

mono_loss="null"
if [[ "$channels" -ge 2 && "$lufs" != "null" ]]; then
    mono="$(summary "" "pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1,ebur128" | pick "I:")"
    if [[ "$mono" == "null" ]]; then
        # The downmix fell below the gate: everything cancelled.
        mono_loss="$(awk -v s="$lufs" 'BEGIN { printf "%.1f", s + 70 }')"
    else
        mono_loss="$(awk -v s="$lufs" -v m="$mono" 'BEGIN { d = s - m; if (d < 0) d = 0; printf "%.1f", d }')"
    fi
fi

spans="$(
    ffmpeg -hide_banner -nostats -i "$file" -map a:0 \
        -af "silencedetect=noise=${silence_db}dB:d=${silence_min}" -f null - 2>&1 \
        | awk -v dur="$duration" '
            /silence_start:/ { for (i = 1; i <= NF; i++) if ($i == "silence_start:") st = $(i + 1); open = 1 }
            /silence_end:/   { for (i = 1; i <= NF; i++) if ($i == "silence_end:") en = $(i + 1)
                               out = out sep sprintf("{\"start\":%.3f,\"end\":%.3f}", st, en); sep = ","; open = 0 }
            END { if (open) out = out sep sprintf("{\"start\":%.3f,\"end\":%.3f}", st, dur); print "[" out "]" }'
)"

printf '{"duration":%.3f,"channels":%d,"integrated_lufs":%s,"true_peak_dbtp":%s,"lra":%s,"silence_spans":%s,"mono_fold_loss_db":%s}\n' \
    "$duration" "$channels" "$lufs" "$peak" "$lra" "$spans" "$mono_loss"
