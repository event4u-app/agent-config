#!/usr/bin/env bash
# video-qa.sh — measure a video stream and print one JSON object, the video
# sibling of audio-qa.sh. Report only: it never changes the file.
#
#   {"duration": <s>, "width": <px>, "height": <px>, "fps": <n>, "frames": <n>,
#    "cuts": [{"frame", "t", "score"}] | null,
#    "camera_motion": {"method", "mean_px", "median_px", "max_px", "verdict"} | null,
#    "luma_jumps": [{"frame", "t", "delta"}] | null,
#    "freezes": [{"start", "end"}] | null,
#    "blur": {"mean", "max"} | null, "block": {"mean", "max"} | null,
#    "rois": [{"roi", "ssim_min", "ssim_min_frame", "freezes"}],
#    "background": {"grid", "changed_cells", "max_diff"} | null,
#    "checks": {"<check>": "ran" | "skipped: <why>"}}
#
# With --seam <b>, the file is clip A and the reading adds
#   "seam": {"grid", "ssim", "changed_cells", "luma_delta"}
# comparing the last frame of A with the first frame of B.
#
# Sources: `scdet` (cuts), `deshake`'s per-frame global-motion log (camera
# motion — `mestimate` keeps its vectors as opaque frame side data no filter
# prints, and `vidstabdetect` is missing from common builds, so the native
# block matcher that does print is the primary path), `signalstats` YAVG jumps
# with no cut within 2 frames, `freezedetect`, `blurdetect`, `blockdetect`,
# per-ROI `ssim` between consecutive frames, and, on a static shot, the
# `tmedian` background of each half compared with `blend=difference` over a
# cell grid (a moving object is not in either median; a swapped patch is).
# Every filter is probed first: a missing one makes its check
# "skipped: <filter> unavailable" and its value null — never a pass, never zero.
#
# Usage:
#   video-qa.sh <file> [--roi x,y,w,h]... [--grid <c>x<r>] [--luma-jump <dY>]
#               [--cut-threshold <n>] [--seam <clip-b>]
#
# Exit codes:
#   0  JSON written to stdout
#   2  usage / file missing / ROI outside the frame
#   3  required tool missing (ffmpeg / ffprobe)
#   4  no video stream in the file

set -euo pipefail

usage() {
    sed -n '2,37p' "$0" | sed 's/^# \{0,1\}//' >&2
    exit 2
}

[[ $# -ge 1 ]] || usage
file="$1"; shift
rois=()
grid="8x8"
luma_jump="12"
cut_threshold="10"
seam=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --roi) rois+=("${2:?--roi needs x,y,w,h}"); shift 2 ;;
        --grid) grid="${2:?--grid needs <c>x<r>}"; shift 2 ;;
        --luma-jump) luma_jump="${2:?--luma-jump needs a value}"; shift 2 ;;
        --cut-threshold) cut_threshold="${2:?--cut-threshold needs a value}"; shift 2 ;;
        --seam) seam="${2:?--seam needs a second clip}"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "video-qa: unknown option $1" >&2; exit 2 ;;
    esac
done

num_re='^[0-9]+([.][0-9]+)?$'
[[ "$luma_jump" =~ $num_re && "$cut_threshold" =~ $num_re ]] || { echo "video-qa: --luma-jump / --cut-threshold must be numbers" >&2; exit 2; }
[[ "$grid" =~ ^([1-9][0-9]?)x([1-9][0-9]?)$ ]] || { echo "video-qa: --grid $grid: expected <c>x<r>" >&2; exit 2; }
grid_c="${BASH_REMATCH[1]}"; grid_r="${BASH_REMATCH[2]}"
(( grid_c <= 26 )) || { echo "video-qa: --grid has at most 26 columns" >&2; exit 2; }

[[ -f "$file" ]] || { echo "video-qa: file not found: $file" >&2; exit 2; }
[[ -z "$seam" || -f "$seam" ]] || { echo "video-qa: file not found: $seam" >&2; exit 2; }
command -v ffmpeg >/dev/null 2>&1 || { echo "video-qa: ffmpeg not on PATH" >&2; exit 3; }
command -v ffprobe >/dev/null 2>&1 || { echo "video-qa: ffprobe not on PATH" >&2; exit 3; }

tmp="$(mktemp -d "${TMPDIR:-/tmp}/video-qa.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

filters="$(ffmpeg -hide_banner -filters 2>/dev/null | awk '{ print $2 }')"
has() { grep -qx "$1" <<<"$filters"; }

# Every input is opened under the file,pipe whitelist, as media_bundle does.
IN=(-protocol_whitelist 'file,pipe')

# --- format -------------------------------------------------------------------
probe() {
    ffprobe -v error "${IN[@]}" -select_streams v:0 -count_frames \
        -show_entries stream=width,height,avg_frame_rate,r_frame_rate,nb_read_frames:format=duration \
        -of default=noprint_wrappers=1 "$1" 2>/dev/null
}
field() { awk -F= -v k="$1" '$1 == k { print $2; exit }'; }
rate() { awk -F/ '{ if ($2 + 0 > 0) printf "%.6g", $1 / $2; else if ($1 + 0 > 0) printf "%.6g", $1; }'; }

info="$(probe "$file")"
width="$(field width <<<"$info")"
[[ -n "$width" ]] || { echo "video-qa: no video stream in $file" >&2; exit 4; }
height="$(field height <<<"$info")"
fps="$(field avg_frame_rate <<<"$info" | rate)"
[[ -n "$fps" ]] || fps="$(field r_frame_rate <<<"$info" | rate)"
[[ -n "$fps" ]] || fps="0"
frames="$(field nb_read_frames <<<"$info")"
[[ "$frames" =~ ^[0-9]+$ ]] || frames="0"
duration="$(field duration <<<"$info")"
[[ "$duration" =~ ^[0-9.]+$ ]] || duration="0"

checks=()
check() { checks+=("\"$1\":\"$2\""); }
check format ran

for roi in ${rois[@]+"${rois[@]}"}; do
    [[ "$roi" =~ ^([0-9]+),([0-9]+),([1-9][0-9]*),([1-9][0-9]*)$ ]] || { echo "video-qa: --roi $roi: expected x,y,w,h" >&2; exit 2; }
    if (( BASH_REMATCH[1] + BASH_REMATCH[3] > width || BASH_REMATCH[2] + BASH_REMATCH[4] > height )); then
        echo "video-qa: --roi $roi reaches outside the ${width}x${height} frame" >&2; exit 2
    fi
done

cell_name() { awk -v i="$1" -v c="$2" 'BEGIN { printf "%c%d", 65 + (i % c), int(i / c) + 1 }'; }

# Raw gray bytes of a <grid_c>x<grid_r> difference image → JSON cell list + max.
cells_over() {
    od -An -tu1 -v | tr -s ' \n' '\n' | awk -v c="$grid_c" -v thr="$1" '
        NF { v = $1 + 0; if (v > max) max = v; if (v >= thr) { out = out sep sprintf("\"%c%d\"", 65 + (i % c), int(i / c) + 1); sep = "," } i++ }
        END { printf "[%s] %d\n", out, max + 0 }'
}
CELL_DIFF=16

# --- seam mode ----------------------------------------------------------------
if [[ -n "$seam" ]]; then
    binfo="$(probe "$seam")"
    [[ -n "$(field width <<<"$binfo")" ]] || { echo "video-qa: no video stream in $seam" >&2; exit 4; }
    ffmpeg -v error -y -sseof -3 "${IN[@]}" -i "$file" -an -update 1 "$tmp/last.png"
    ffmpeg -v error -y "${IN[@]}" -i "$seam" -an -frames:v 1 -vf "scale=${width}:${height}" "$tmp/first.png"
    ssim="null"; cells="null"; luma="null"
    if has ssim; then
        ssim="$(ffmpeg -hide_banner -nostats -i "$tmp/last.png" -i "$tmp/first.png" -lavfi "[0:v][1:v]ssim" -f null - 2>&1 \
            | awk '/SSIM/ { for (i = 1; i <= NF; i++) if ($i ~ /^All:/) { sub("All:", "", $i); v = $i } } END { print (v == "" ? "null" : v) }')"
        check seam_ssim ran
    else check seam_ssim "skipped: ssim unavailable"; fi
    if has blend; then
        read -r cells _ < <(ffmpeg -v error -i "$tmp/last.png" -i "$tmp/first.png" -filter_complex \
            "[0:v]format=gray[a];[1:v]format=gray[b];[a][b]blend=all_mode=difference,scale=${grid_c}:${grid_r}:flags=area" \
            -frames:v 1 -f rawvideo -pix_fmt gray - | cells_over "$CELL_DIFF")
        check seam_cells ran
    else check seam_cells "skipped: blend unavailable"; fi
    if has signalstats; then
        luma="$(ffmpeg -hide_banner -nostats -i "$tmp/last.png" -i "$tmp/first.png" -filter_complex \
            "[0:v]signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-[x];[1:v]signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-[y];[x][y]hstack" \
            -f null - 2>/dev/null | awk -F= '/YAVG/ { v[n++] = $2 } END { if (n == 2) printf "%.3f", v[1] - v[0]; else print "null" }')"
        check seam_luma ran
    else check seam_luma "skipped: signalstats unavailable"; fi
    printf '{"duration":%.3f,"width":%d,"height":%d,"fps":%s,"frames":%d,"seam":{"grid":"%s","ssim":%s,"changed_cells":%s,"luma_delta":%s},"checks":{%s}}\n' \
        "$duration" "$width" "$height" "$fps" "$frames" "$grid" "$ssim" "$cells" "$luma" "$(IFS=,; echo "${checks[*]}")"
    exit 0
fi

# --- one metadata pass: cuts, luma, blur, block ---------------------------------
chain=()
has scdet && chain+=("scdet=threshold=${cut_threshold}")
has signalstats && chain+=("signalstats")
has blurdetect && chain+=("blurdetect")
has blockdetect && chain+=("blockdetect")
meta="$tmp/meta.txt"
: >"$meta"
if [[ ${#chain[@]} -gt 0 ]]; then
    ffmpeg -hide_banner -nostats -v error "${IN[@]}" -i "$file" -an \
        -vf "$(IFS=,; echo "${chain[*]}"),metadata=mode=print:file=${meta//:/\\:}" -f null - </dev/null
fi
per_frame() {
    # frame index, pts_time, value of key $1 — one line per frame that carries it
    awk -v key="$1" '
        /^frame:/ { split($1, a, ":"); f = a[2]; for (i = 1; i <= NF; i++) if ($i ~ /^pts_time:/) { split($i, b, ":"); t = b[2] } }
        index($0, key "=") == 1 { print f, t, substr($0, length(key) + 2) }' "$meta"
}
# A flat frame gives blurdetect nothing to measure (nan): that frame is unmeasured, not zero.
stats() { awk '$3 ~ /^-?[0-9.]+([eE][-+]?[0-9]+)?$/ { s += $3; if (n == 0 || $3 > m) m = $3; n++ } END { if (n == 0) print "null"; else printf "{\"mean\":%.3f,\"max\":%.3f}", s / n, m }'; }

cuts="null"
if has scdet; then
    cuts="[$(per_frame lavfi.scd.time | awk '{ print $1 }' | while read -r f; do
        per_frame lavfi.scd.score | awk -v f="$f" '$1 == f { printf "{\"frame\":%d,\"t\":%.3f,\"score\":%.3f}\n", $1, $2, $3 }'
    done | paste -sd, -)]"
    check cuts ran
else check cuts "skipped: scdet unavailable"; fi

luma_jumps="null"
if ! has signalstats; then check luma_jumps "skipped: signalstats unavailable"
elif ! has scdet; then check luma_jumps "skipped: scdet unavailable"
else
    cut_frames="$(per_frame lavfi.scd.time | awk '{ printf "%s ", $1 }')"
    luma_jumps="$(per_frame lavfi.signalstats.YAVG | awk -v thr="$luma_jump" -v cuts="$cut_frames" '
        BEGIN { n = split(cuts, c, " ") }
        { if (seen) { d = $3 - prev; if (d < 0) d = -d
              if (d >= thr) { near = 0; for (i = 1; i <= n; i++) if (c[i] != "" && (c[i] - $1 <= 2 && $1 - c[i] <= 2)) near = 1
                  if (!near) { out = out sep sprintf("{\"frame\":%d,\"t\":%.3f,\"delta\":%.3f}", $1, $2, d); sep = "," } } }
          prev = $3; seen = 1 }
        END { printf "[%s]", out }')"
    check luma_jumps ran
fi

blur="null"; block="null"
if has blurdetect; then blur="$(per_frame lavfi.blur | stats)"; check blur ran; else check blur "skipped: blurdetect unavailable"; fi
if has blockdetect; then block="$(per_frame lavfi.block | stats)"; check block ran; else check block "skipped: blockdetect unavailable"; fi

# --- camera motion --------------------------------------------------------------
camera="null"
verdict=""
if has deshake; then
    log="$tmp/deshake.log"
    ffmpeg -hide_banner -nostats -v error "${IN[@]}" -i "$file" -an -vf "deshake=filename=${log//:/\\:}" -f null - </dev/null
    camera="$(awk -F', *' 'NR > 2 { x = $1 + 0; y = $4 + 0; m = sqrt(x * x + y * y); v[n++] = m; s += m; if (m > mx) mx = m }
        END { if (n == 0) { print "null"; exit }
              for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) if (v[j] < v[i]) { t = v[i]; v[i] = v[j]; v[j] = t }
              med = (n % 2) ? v[int(n / 2)] : (v[n / 2 - 1] + v[n / 2]) / 2
              printf "{\"method\":\"deshake\",\"mean_px\":%.3f,\"median_px\":%.3f,\"max_px\":%.3f,\"verdict\":\"%s\"}", s / n, med, mx, (med >= 0.5 ? "moving" : "static") }' "$log")"
    [[ "$camera" == "null" ]] || verdict="$(sed -E 's/.*"verdict":"([a-z]+)".*/\1/' <<<"$camera")"
    check camera_motion ran
else check camera_motion "skipped: deshake unavailable"; fi

# --- freezes --------------------------------------------------------------------
freeze_list() {
    awk -v dur="$duration" '
        /freeze_start:/ { for (i = 1; i <= NF; i++) if ($i == "lavfi.freezedetect.freeze_start:") st = $(i + 1); open = 1 }
        /freeze_end:/   { for (i = 1; i <= NF; i++) if ($i == "lavfi.freezedetect.freeze_end:") en = $(i + 1)
                          out = out sep sprintf("{\"start\":%.3f,\"end\":%.3f}", st, en); sep = ","; open = 0 }
        END { if (open) out = out sep sprintf("{\"start\":%.3f,\"end\":%.3f}", st, dur); printf "[%s]", out }'
}
freezes="null"
if has freezedetect; then
    freezes="$(ffmpeg -hide_banner -nostats "${IN[@]}" -i "$file" -an -vf "freezedetect=n=-60dB:d=0.5" -f null - 2>&1 </dev/null | freeze_list)"
    check freezes ran
else check freezes "skipped: freezedetect unavailable"; fi

# --- regions of interest ----------------------------------------------------------
roi_json=()
if [[ ${#rois[@]} -gt 0 ]]; then
    if has ssim; then check roi_ssim ran; else check roi_ssim "skipped: ssim unavailable"; fi
    if has freezedetect; then check roi_freeze ran; else check roi_freeze "skipped: freezedetect unavailable"; fi
fi
for roi in ${rois[@]+"${rois[@]}"}; do
    IFS=, read -r rx ry rw rh <<<"$roi"
    crop="crop=${rw}:${rh}:${rx}:${ry}"
    smin="null"; sframe="null"; rfz="null"
    if has ssim; then
        read -r smin sframe < <(ffmpeg -hide_banner -nostats -v error "${IN[@]}" -i "$file" -an -filter_complex \
            "[0:v]${crop},split[a][b];[a]trim=start_frame=1,setpts=PTS-STARTPTS[a1];[b]setpts=PTS-STARTPTS[b1];[a1][b1]ssim=stats_file=-" \
            -f null - </dev/null | awk '{ for (i = 1; i <= NF; i++) { if ($i ~ /^n:/) { sub("n:", "", $i); n = $i } if ($i ~ /^All:/) { sub("All:", "", $i); v = $i + 0 } }
                if (!seen || v < m) { m = v; f = n; seen = 1 } }
                END { if (seen) printf "%.4f %d\n", m, f; else print "null null" }')
    fi
    if has freezedetect; then
        # A frozen region of a lossy encode still carries codec noise above -60 dB
        # (measured: a mpeg4 q:v 8 encode hides it); -40 dB holds the freeze and a
        # moving region stays clear even at -30 dB.
        rfz="$(ffmpeg -hide_banner -nostats "${IN[@]}" -i "$file" -an -vf "${crop},freezedetect=n=-40dB:d=0.5" -f null - 2>&1 </dev/null | freeze_list)"
    fi
    roi_json+=("{\"roi\":\"$roi\",\"ssim_min\":$smin,\"ssim_min_frame\":$sframe,\"freezes\":$rfz}")
done

# --- background permanence on a static shot -------------------------------------
background="null"
if ! has tmedian || ! has blend; then check background "skipped: tmedian or blend unavailable"
elif [[ "$verdict" != "static" ]]; then
    if [[ "$verdict" == "moving" ]]; then check background "skipped: camera moving — background permanence needs a static shot"
    else check background "skipped: camera motion unknown"; fi
elif [[ "$cuts" != "null" && "$cuts" != "[]" ]]; then check background "skipped: cut present — the halves are different shots"
elif (( frames < 6 )); then check background "skipped: fewer than 6 frames"
else
    half=$(( frames / 2 ))
    radius=$(( (half - 1) / 2 )); (( radius > 127 )) && radius=127
    pick=$(( (half - 2 * radius - 1) / 2 ))
    median="tmedian=radius=${radius},select='eq(n\\,${pick})',setpts=PTS-STARTPTS"
    read -r bcells bmax < <(ffmpeg -v error "${IN[@]}" -i "$file" -an -filter_complex \
        "[0:v]format=gray,split[x][y];[x]trim=start_frame=0:end_frame=${half},setpts=PTS-STARTPTS,${median}[a];[y]trim=start_frame=${half}:end_frame=$(( 2 * half )),setpts=PTS-STARTPTS,${median}[b];[a][b]blend=all_mode=difference,scale=${grid_c}:${grid_r}:flags=area" \
        -frames:v 1 -f rawvideo -pix_fmt gray - </dev/null | cells_over "$CELL_DIFF")
    background="{\"grid\":\"$grid\",\"changed_cells\":$bcells,\"max_diff\":$bmax}"
    check background ran
fi

printf '{"duration":%.3f,"width":%d,"height":%d,"fps":%s,"frames":%d,"cuts":%s,"camera_motion":%s,"luma_jumps":%s,"freezes":%s,"blur":%s,"block":%s,"rois":[%s],"background":%s,"checks":{%s}}\n' \
    "$duration" "$width" "$height" "$fps" "$frames" "$cuts" "$camera" "$luma_jumps" "$freezes" "$blur" "$block" \
    "$(IFS=,; echo "${roi_json[*]-}")" "$background" "$(IFS=,; echo "${checks[*]}")"
