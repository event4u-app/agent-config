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
#               [--skip-scene <id> ...]
#               [--abort-on-missing | --continue]
#
# NOT a flag: --crossfade. It is parsed and REFUSED (exit 2). See
# "Refused flags" below — it is listed so a caller who read the old
# usage line gets an error instead of a hard cut.
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
  || aiv_die 2 "usage: stitch.sh <manifest.json> <output.mp4> [--skip-scene <id>] [--abort-on-missing|--continue]"
[ -r "${MANIFEST}" ] || aiv_die 2 "manifest not readable: ${MANIFEST}"
shift 2 || true

SKIP_IDS=""
MISSING_POLICY="abort"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-scene) SKIP_IDS="${SKIP_IDS} ${2:-}"; shift 2 ;;
    --abort-on-missing) MISSING_POLICY="abort"; shift ;;
    --continue) MISSING_POLICY="continue"; shift ;;
    --crossfade)
      # Refused HERE — before the dry-run branch, before ffmpeg, before any
      # output. The old code warned after the dry-run exit and then concatenated
      # anyway, so a caller asking for a crossfade got a hard cut and exit 0.
      aiv_die 2 "stitch.sh: --crossfade is not implemented and will not be silently downgraded. The output path is 'ffmpeg -f concat -c copy', and stream copy precludes any filtergraph, so xfade/acrossfade require a re-encode path this script does not have. Re-run without --crossfade for a hard-cut concat, or open a roadmap item for the re-encode path."
      ;;
    *) aiv_die 2 "stitch.sh: unknown flag '$1'" ;;
  esac
done

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
  else
    printf "file '%s'\n" "${clip_path}" >> "${CONCAT_LIST}"
  fi
  count=$((count + 1))
done <<EOF
$(jq -c "${SCENES_JQ}" "${MANIFEST}")
EOF

[ "${count}" -gt 0 ] || aiv_die 7 "stitch: no usable clips after manifest scan (missing=${missing}, skipped via --skip-scene)"

if [ "${DRYRUN_FLAG}" -eq 1 ]; then
  printf 'stitch: dry-run plan (output=%s, scenes=%d):\n' "${OUTPUT}" "${count}" >&2
  printf '%b' "${plan}" >&2
  printf '{"output":"%s","scenes":%d,"missing":0,"dry_run":true}\n' "${OUTPUT}" "${count}"
  exit 0
fi

ffmpeg -loglevel error -y -f concat -safe 0 -i "${CONCAT_LIST}" \
  -c copy "${OUTPUT}" >/dev/null \
  || aiv_die 8 "ffmpeg concat failed (manifest=${MANIFEST}, output=${OUTPUT})"

printf '{"output":"%s","scenes":%d,"missing":%d}\n' "${OUTPUT}" "${count}" "${missing}"
