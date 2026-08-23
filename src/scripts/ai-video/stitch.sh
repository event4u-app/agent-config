#!/usr/bin/env bash
# stitch.sh — ffmpeg-based clip concatenator for /video:* pipelines.
#
# Drives the cut from <project>/manifest.json (an ordered array of
# `{scene_id, clip_path, audio_embedded, audio_path?, duration}`).
# Pass-through for audio_embedded=true; ffmpeg mux for audio_embedded
# =false; operator-supplied bed for video-only clips.
#
# Usage:
#   stitch.sh <manifest.json> <output.mp4>
#               [--mode cut|handoff]
#               [--xfade <seconds>]
#               [--skip-scene <id> ...]
#               [--abort-on-missing | --continue]
#
# Modes:
#   --mode cut       (DEFAULT) `ffmpeg -f concat -c copy`. Stream copy, no
#                    generation loss, no filtergraph. Byte-for-byte the
#                    behaviour this script has always had; passing the flag
#                    explicitly changes nothing.
#   --mode handoff   Re-encode path (`libx264 -crf 20 -g 8 +faststart -an`)
#                    for continuity chains, where clip i+1 was conditioned on
#                    the rendered last frame of clip i. Video only: `-an`
#                    DROPS every audio track, which is stated on stderr on
#                    every run rather than discovered in the output.
#
#   --xfade <s>      Only valid with `--mode handoff`; ceiling 0.25 s. A short
#                    fade applied ONLY at seams whose manifest row says
#                    `continuity: handoff|connector` — insurance against a
#                    visible pop, never a transition effect. Cut seams in the
#                    same run stay hard cuts. Offsets are computed from
#                    ffprobe'd durations, not from the manifest's declared
#                    ones: the accumulated-length-minus-fade arithmetic is the
#                    classic trap here and a declared duration that is 40 ms
#                    off silently shifts every later seam.
#
# NOT a flag: --crossfade. It is parsed and REFUSED (exit 2) in EVERY mode.
# See "Refused flags" below — it is listed so a caller who read the old usage
# line gets an error instead of a hard cut. `--mode handoff --xfade <s>` is
# the supported way to ask for a fade.
#
# port_invariants — what must survive a re-implementation:
#   1. hard-cut default — `--mode cut` is the default and stream-copies
#      (`-c copy`); a port that re-encodes by default has changed the output
#      of every existing caller without telling anyone.
#   2. refusal over silent downgrade — an unimplemented or out-of-bounds
#      request exits non-zero BEFORE any work, and never falls through to a
#      near-miss (`--crossfade`, `--xfade` above 0.25 s, `--xfade` in cut
#      mode, an unknown flag, a missing clip). Reporting success for output
#      the caller did not ask for is the one failure this script exists to
#      not have.
#   3. handoff frame = rendered frame — a handoff seam joins clips where the
#      later one was conditioned on the earlier one's RENDERED last frame,
#      never on its own still. A port that re-conditions from the source
#      still produces a plausible-looking chain that does not actually
#      continue the shot.
#   Contract: docs/contracts/skill-bundled-assets.md § Port invariants.
#
# Failure semantics:
#   - Missing clip → fail loud with scene_id and re-render hint
#     unless --skip-scene <id> drops the clip from the cut or
#     --continue is passed (the dropped scenes are written to stderr).
#   - --abort-on-missing is the default.
#   - Adapter-failure rollback contract: a failed adapter writes
#     <project>/scenes/<id>/error.json; stitch.sh checks for that
#     file alongside the clip and surfaces it instead of an opaque
#     ffmpeg error.
#
# Refused flags:
#   --crossfade <seconds> — accepted by the parser, then REFUSED with
#     exit 2 before any work. It used to print "not yet implemented"
#     to stderr and fall straight through to the plain concat, so the
#     script reported success (exit 0, success JSON) while delivering a
#     hard cut. Worse, the notice sat AFTER the dry-run exit, and
#     AIV_DRYRUN defaults to true — so in the default mode the flag was
#     accepted in total silence.
#     A crossfade is not a small addition here: the output path is
#     `-f concat -c copy`, and stream copy precludes any filtergraph, so
#     xfade/acrossfade need a re-encode path that does not exist. It was
#     also never reachable from a governed surface: /video:stitch passes
#     only --skip-scene and --continue and rejects anything else. So the
#     honest state is a refusal, not a silent downgrade and not a
#     filtergraph shipped into a script with no test harness.
#     The re-encode path this refusal used to ask for now exists as
#     `--mode handoff` (+ optional `--xfade <s>`), with a test harness
#     under tests/scripts/. The refusal stays: `--crossfade` named a
#     transition on the stream-copy path, which is still impossible.

set -euo pipefail

# shellcheck source=../media/lib/adapter-common.sh
. "$(dirname "$0")/../media/lib/adapter-common.sh"

aiv_require_cmd jq

DRYRUN="${AIV_DRYRUN:-true}"
case "${DRYRUN}" in
  false|FALSE|0|no|NO) DRYRUN_FLAG=0 ;;
  *) DRYRUN_FLAG=1 ;;
esac
[ "${DRYRUN_FLAG}" -eq 0 ] && aiv_require_cmd ffmpeg

MANIFEST="${1:-}"
OUTPUT="${2:-}"
[ -n "${MANIFEST}" ] && [ -n "${OUTPUT}" ] \
  || aiv_die 2 "usage: stitch.sh <manifest.json> <output.mp4> [--mode cut|handoff] [--xfade <seconds>] [--skip-scene <id>] [--abort-on-missing|--continue]"
[ -r "${MANIFEST}" ] || aiv_die 2 "manifest not readable: ${MANIFEST}"
shift 2 || true

SKIP_IDS=""
MISSING_POLICY="abort"
MODE="cut"
XFADE=""
XFADE_MAX="0.25"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-scene) SKIP_IDS="${SKIP_IDS} ${2:-}"; shift 2 ;;
    --abort-on-missing) MISSING_POLICY="abort"; shift ;;
    --continue) MISSING_POLICY="continue"; shift ;;
    --mode) MODE="${2:-}"; shift 2 ;;
    --xfade) XFADE="${2:-}"; shift 2 ;;
    --crossfade)
      # Refused HERE — before the dry-run branch, before ffmpeg, before any
      # output. The old code warned after the dry-run exit and then concatenated
      # anyway, so a caller asking for a crossfade got a hard cut and exit 0.
      aiv_die 2 "stitch.sh: --crossfade is not implemented and will not be silently downgraded. The output path of --mode cut is 'ffmpeg -f concat -c copy', and stream copy precludes any filtergraph, so xfade/acrossfade cannot exist there. Re-run without --crossfade for a hard-cut concat, or use '--mode handoff --xfade <seconds>' (ceiling ${XFADE_MAX}s) for the re-encode path, which applies the fade only at seams whose manifest row says continuity: handoff|connector."
      ;;
    *) aiv_die 2 "stitch.sh: unknown flag '$1'" ;;
  esac
done

case "${MODE}" in
  cut|handoff) ;;
  *) aiv_die 2 "stitch.sh: unknown --mode '${MODE}' (expected cut|handoff)" ;;
esac

if [ -n "${XFADE}" ]; then
  # Refused, never ignored: an --xfade the run cannot honour would otherwise
  # deliver a hard cut and report success — the exact shape of the --crossfade
  # defect above.
  [ "${MODE}" = "handoff" ] \
    || aiv_die 2 "stitch.sh: --xfade requires '--mode handoff' — the cut path is 'ffmpeg -f concat -c copy' and stream copy precludes a filtergraph. Re-run with --mode handoff, or drop --xfade for a hard-cut concat."
  printf '%s' "${XFADE}" | grep -Eq '^[0-9]+(\.[0-9]+)?$' \
    || aiv_die 2 "stitch.sh: --xfade must be a non-negative number of seconds, got '${XFADE}'"
  awk -v x="${XFADE}" -v m="${XFADE_MAX}" 'BEGIN { exit !(x > 0 && x <= m) }' \
    || aiv_die 2 "stitch.sh: --xfade ${XFADE}s is outside the allowed range (0 < s <= ${XFADE_MAX}) — a longer fade is a transition effect, not seam insurance"
fi

# The plan/success JSON gains a `mode` key ONLY in handoff mode. Even an
# additive key changes the stdout every existing caller reads, and "cut behaves
# as it does today" is the invariant that path is held to. Absent means cut.
MODE_JSON=""
if [ "${MODE}" = "handoff" ]; then
  MODE_JSON=',"mode":"handoff"'
  printf 'stitch: --mode handoff RE-ENCODES (libx264 -crf 20 -g 8 +faststart -an) — the cut path stream-copies. Audio is dropped by -an; mux a bed afterwards if the chain needs one.\n' >&2
  [ "${DRYRUN_FLAG}" -eq 0 ] && aiv_require_cmd ffprobe
fi

skip_match() {
  local id="$1" s
  for s in ${SKIP_IDS}; do
    [ "${s}" = "${id}" ] && return 0
  done
  return 1
}

PROJECT_DIR="$(cd "$(dirname "${MANIFEST}")" && pwd)"
WORK_DIR="$(mktemp -d -t aiv-stitch-XXXXXX)"
trap 'rm -rf "${WORK_DIR}"' EXIT
CONCAT_LIST="${WORK_DIR}/concat.txt"
: > "${CONCAT_LIST}"
# Ordered `<continuity>\t<validated path>` rows — the handoff filtergraph needs
# to know WHICH seams may fade, and the concat demuxer list cannot carry that.
# Written only in handoff mode, so the cut path is untouched.
SEQ_LIST="${WORK_DIR}/seq.tsv"
: > "${SEQ_LIST}"

# Accept both bare-array manifests and the documented object shape
# (`{ "scenes": [...] }`). Field names tolerate the legacy
# `scene_id` / `clip_path` keys and the example `id` / `expected_clip`.
SCENES_JQ='if type == "array" then .[] else .scenes[] end'

count=0
missing=0
plan=""
while IFS= read -r row; do
  [ -n "${row}" ] || continue
  scene_id="$(printf '%s' "${row}" | jq -r '.scene_id // .id')"
  clip_path="$(printf '%s' "${row}" | jq -r '.clip_path // .expected_clip')"
  audio_embedded="$(printf '%s' "${row}" | jq -r '.audio_embedded // false')"
  audio_path="$(printf '%s' "${row}" | jq -r '.audio_path // empty')"
  continuity="cut"
  if [ "${MODE}" = "handoff" ]; then
    continuity="$(printf '%s' "${row}" | jq -r '.continuity // "cut"')"
    case "${continuity}" in
      cut|handoff|connector) ;;
      *) aiv_die 2 "stitch.sh: scene=${scene_id} unknown continuity '${continuity}' (expected cut|handoff|connector)" ;;
    esac
  fi

  case "${clip_path}" in
    /*) ;;
    *) clip_path="${PROJECT_DIR}/${clip_path}" ;;
  esac

  if skip_match "${scene_id}"; then
    printf 'stitch: skip scene=%s (operator --skip-scene)\n' "${scene_id}" >&2
    continue
  fi

  if [ "${DRYRUN_FLAG}" -eq 1 ]; then
    plan="${plan}${scene_id}\taudio_embedded=${audio_embedded}\t${clip_path}\n"
    count=$((count + 1))
    continue
  fi

  if [ ! -f "${clip_path}" ]; then
    err_json="${PROJECT_DIR}/scenes/${scene_id}/error.json"
    if [ -f "${err_json}" ]; then
      printf 'stitch: scene=%s adapter-error: ' "${scene_id}" >&2
      jq -r '"adapter=\(.adapter) exit=\(.exit_code) user_action=\(.user_action)"' "${err_json}" >&2
    fi
    if [ "${MISSING_POLICY}" = "continue" ]; then
      printf 'stitch: continue past missing scene=%s clip=%s (re-render or --skip-scene next time)\n' \
        "${scene_id}" "${clip_path}" >&2
      missing=$((missing + 1))
      continue
    fi
    aiv_die 7 "missing clip for scene=${scene_id} at ${clip_path} (re-render the scene, pass --skip-scene ${scene_id}, or use --continue)"
  fi

  # Trust boundary (adapter-contract.md v2): clip_path comes from the
  # adapter's fetch output and is untrusted. Reject anything that escapes
  # the project dir, is a symlink, or carries concat-injection characters
  # before it reaches ffmpeg or the `file '...'` concat list.
  clip_path="$(aiv_validate_artifact_path "${PROJECT_DIR}" "${clip_path}")"

  # For clips without embedded audio that ship a sibling track, mux
  # via ffmpeg into a tmp file before concat. Pure pass-through for
  # the embedded-audio case.
  if [ "${audio_embedded}" = "false" ] && [ -n "${audio_path}" ] && [ -f "${audio_path}" ]; then
    audio_path="$(aiv_validate_artifact_path "${PROJECT_DIR}" "${audio_path}")"
    muxed="${WORK_DIR}/${scene_id}.mp4"
    ffmpeg -loglevel error -y -i "${clip_path}" -i "${audio_path}" \
      -c:v copy -c:a aac -shortest "${muxed}" >/dev/null \
      || aiv_die 8 "ffmpeg mux failed for scene=${scene_id}"
    printf "file '%s'\n" "${muxed}" >> "${CONCAT_LIST}"
    if [ "${MODE}" = "handoff" ]; then
      printf '%s\t%s\n' "${continuity}" "${muxed}" >> "${SEQ_LIST}"
    fi
  else
    printf "file '%s'\n" "${clip_path}" >> "${CONCAT_LIST}"
    if [ "${MODE}" = "handoff" ]; then
      printf '%s\t%s\n' "${continuity}" "${clip_path}" >> "${SEQ_LIST}"
    fi
  fi
  count=$((count + 1))
done <<EOF
$(jq -c "${SCENES_JQ}" "${MANIFEST}")
EOF

[ "${count}" -gt 0 ] || aiv_die 7 "stitch: no usable clips after manifest scan (missing=${missing}, skipped via --skip-scene)"

if [ "${DRYRUN_FLAG}" -eq 1 ]; then
  printf 'stitch: dry-run plan (output=%s, scenes=%d):\n' "${OUTPUT}" "${count}" >&2
  printf '%b' "${plan}" >&2
  printf '{"output":"%s","scenes":%d,"missing":0,"dry_run":true%s}\n' \
    "${OUTPUT}" "${count}" "${MODE_JSON}"
  exit 0
fi

# The re-encode settings are one constant, used by both handoff branches, so a
# port cannot drift them apart.
HANDOFF_VCODEC="libx264"
HANDOFF_ARGS="-crf 20 -g 8 -pix_fmt yuv420p -movflags +faststart -an"

_probe_duration() {
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null \
    | head -1
}

if [ "${MODE}" = "handoff" ]; then
  seq_count="$(wc -l < "${SEQ_LIST}" | tr -d ' ')"
  [ "${seq_count}" -gt 0 ] || aiv_die 7 "stitch: handoff mode found no usable clips"

  if [ -z "${XFADE}" ] || [ "${seq_count}" -eq 1 ]; then
    # No fade requested (or nothing to fade across): the seams stay hard cuts,
    # the only difference from --mode cut is the re-encode. Same concat demuxer,
    # so clip order and skip handling are shared with the cut path.
    # shellcheck disable=SC2086
    ffmpeg -loglevel error -y -f concat -safe 0 -i "${CONCAT_LIST}" \
      -c:v "${HANDOFF_VCODEC}" ${HANDOFF_ARGS} "${OUTPUT}" >/dev/null \
      || aiv_die 8 "ffmpeg handoff re-encode failed (manifest=${MANIFEST}, output=${OUTPUT})"
  else
    # Filtergraph path. Every input is normalised to the FIRST clip's frame
    # rate and to yuv420p/SAR 1 — xfade refuses mismatched inputs, and a
    # mismatch here would surface as an opaque filter error rather than as the
    # source-clip problem it is.
    first_clip="$(sed -n '1p' "${SEQ_LIST}" | cut -f2)"
    rate="$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate \
      -of csv=p=0 "${first_clip}" 2>/dev/null | head -1)"
    [ -n "${rate}" ] || aiv_die 8 "stitch: cannot read frame rate of ${first_clip}"

    ff_inputs=""
    filter=""
    i=0
    while [ "${i}" -lt "${seq_count}" ]; do
      line_no=$((i + 1))
      p="$(sed -n "${line_no}p" "${SEQ_LIST}" | cut -f2)"
      ff_inputs="${ff_inputs} -i ${p}"
      filter="${filter}[${i}:v]fps=${rate},format=yuv420p,setsar=1,settb=AVTB[n${i}];"
      i=$((i + 1))
    done

    acc_label="[n0]"
    acc_dur="$(_probe_duration "$(sed -n '1p' "${SEQ_LIST}" | cut -f2)")"
    [ -n "${acc_dur}" ] || aiv_die 8 "stitch: cannot read duration of the first clip"
    faded=0
    i=1
    while [ "${i}" -lt "${seq_count}" ]; do
      line_no=$((i + 1))
      cont="$(sed -n "${line_no}p" "${SEQ_LIST}" | cut -f1)"
      p="$(sed -n "${line_no}p" "${SEQ_LIST}" | cut -f2)"
      dur="$(_probe_duration "${p}")"
      [ -n "${dur}" ] || aiv_die 8 "stitch: cannot read duration of ${p}"
      if [ "${cont}" = "handoff" ] || [ "${cont}" = "connector" ]; then
        # offset = accumulated length so far MINUS the fade; the fade eats the
        # tail of the accumulated stream, so the total shortens by exactly one
        # xfade per faded seam.
        offset="$(awk -v a="${acc_dur}" -v x="${XFADE}" 'BEGIN { printf "%.6f", a - x }')"
        awk -v o="${offset}" 'BEGIN { exit !(o > 0) }' \
          || aiv_die 7 "stitch: --xfade ${XFADE}s does not fit before seam ${i} (accumulated length ${acc_dur}s)"
        filter="${filter}${acc_label}[n${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset}[x${i}];"
        acc_dur="$(awk -v a="${acc_dur}" -v d="${dur}" -v x="${XFADE}" 'BEGIN { printf "%.6f", a + d - x }')"
        faded=$((faded + 1))
      else
        filter="${filter}${acc_label}[n${i}]concat=n=2:v=1:a=0[x${i}];"
        acc_dur="$(awk -v a="${acc_dur}" -v d="${dur}" 'BEGIN { printf "%.6f", a + d }')"
      fi
      acc_label="[x${i}]"
      i=$((i + 1))
    done
    filter="${filter%;}"

    printf 'stitch: handoff filtergraph — %d clip(s), %d faded seam(s) at %ss, %d hard cut(s)\n' \
      "${seq_count}" "${faded}" "${XFADE}" "$((seq_count - 1 - faded))" >&2

    # shellcheck disable=SC2086
    ffmpeg -loglevel error -y ${ff_inputs} -filter_complex "${filter}" \
      -map "${acc_label}" -c:v "${HANDOFF_VCODEC}" ${HANDOFF_ARGS} "${OUTPUT}" >/dev/null \
      || aiv_die 8 "ffmpeg handoff xfade failed (manifest=${MANIFEST}, output=${OUTPUT})"
  fi
else
  ffmpeg -loglevel error -y -f concat -safe 0 -i "${CONCAT_LIST}" \
    -c copy "${OUTPUT}" >/dev/null \
    || aiv_die 8 "ffmpeg concat failed (manifest=${MANIFEST}, output=${OUTPUT})"
fi

printf '{"output":"%s","scenes":%d,"missing":%d%s}\n' \
  "${OUTPUT}" "${count}" "${missing}" "${MODE_JSON}"
