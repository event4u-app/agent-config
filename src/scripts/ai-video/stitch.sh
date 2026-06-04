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
#               [--crossfade <seconds>]
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

set -euo pipefail

# shellcheck source=lib/adapter-common.sh
. "$(dirname "$0")/lib/adapter-common.sh"

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
  || aiv_die 2 "usage: stitch.sh <manifest.json> <output.mp4> [--skip-scene <id>] [--abort-on-missing|--continue] [--crossfade <s>]"
[ -r "${MANIFEST}" ] || aiv_die 2 "manifest not readable: ${MANIFEST}"
shift 2 || true

SKIP_IDS=""
MISSING_POLICY="abort"
CROSSFADE=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-scene) SKIP_IDS="${SKIP_IDS} ${2:-}"; shift 2 ;;
    --abort-on-missing) MISSING_POLICY="abort"; shift ;;
    --continue) MISSING_POLICY="continue"; shift ;;
    --crossfade) CROSSFADE="${2:-}"; shift 2 ;;
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

  # For clips without embedded audio that ship a sibling track, mux
  # via ffmpeg into a tmp file before concat. Pure pass-through for
  # the embedded-audio case.
  if [ "${audio_embedded}" = "false" ] && [ -n "${audio_path}" ] && [ -f "${audio_path}" ]; then
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

if [ -n "${CROSSFADE}" ]; then
  printf 'stitch: crossfade=%ss requested — passing through ffmpeg xfade filter not yet implemented (concat path used)\n' \
    "${CROSSFADE}" >&2
fi

ffmpeg -loglevel error -y -f concat -safe 0 -i "${CONCAT_LIST}" \
  -c copy "${OUTPUT}" >/dev/null \
  || aiv_die 8 "ffmpeg concat failed (manifest=${MANIFEST}, output=${OUTPUT})"

printf '{"output":"%s","scenes":%d,"missing":%d}\n' "${OUTPUT}" "${count}" "${missing}"
