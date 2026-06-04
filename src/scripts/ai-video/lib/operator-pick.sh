#!/usr/bin/env bash
# operator-pick.sh — best-of-N selection checkpoint invoked after image
# render by /video:from-script and /video:scene. Renders a thumbnail
# contact-sheet PNG of the candidates under a scene, then waits for the
# operator to write <project>/scenes/<id>/selection.json.
#
# Dry-run mode (AIV_DRYRUN=true, default) auto-picks candidate 1 and
# writes the same selection.json so smoke tests stay unattended.
#
# Usage:
#   operator-pick.sh <project-dir> <scene-id>
#
# Inputs:
#   <project-dir>/scenes/<scene-id>/candidates/*.png   (N>=1 image files)
#
# Outputs (stdout, one path per line so callers can capture both):
#   sheet=<project-dir>/scenes/<scene-id>/contact-sheet.png
#   selected=<absolute path to locked image>
#
# Exit codes:
#   0   selection.json present, locked image path emitted
#   2   missing candidates directory or empty
#   3   selection.json malformed or names an unknown candidate
#   4   operator declined (selection.json absent in live mode)

set -euo pipefail

if [ "$#" -ne 2 ]; then
  printf 'operator-pick: usage: %s <project-dir> <scene-id>\n' "$0" >&2
  exit 2
fi

project_dir="$1"
scene_id="$2"
scene_dir="${project_dir}/scenes/${scene_id}"
cand_dir="${scene_dir}/candidates"
sheet="${scene_dir}/contact-sheet.png"
sel_file="${scene_dir}/selection.json"

if [ ! -d "${cand_dir}" ]; then
  printf 'operator-pick: missing candidate dir: %s\n' "${cand_dir}" >&2
  exit 2
fi

# Collect candidates in deterministic order (lexical). Portable to
# macOS bash 3.2 — no `mapfile`.
candidates=()
while IFS= read -r _p; do
  candidates+=("${_p}")
done < <(find "${cand_dir}" -maxdepth 1 -type f -name '*.png' | LC_ALL=C sort)
if [ "${#candidates[@]}" -eq 0 ]; then
  printf 'operator-pick: no candidate PNGs under %s\n' "${cand_dir}" >&2
  exit 2
fi

# Build the contact-sheet PNG via ffmpeg. ceil(sqrt(N)) columns.
n="${#candidates[@]}"
cols=1
while [ $((cols * cols)) -lt "${n}" ]; do cols=$((cols + 1)); done

# ffmpeg's `tile` filter needs an input concat; use `-pattern_type glob`.
if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -y -loglevel error \
    -pattern_type glob -i "${cand_dir}/*.png" \
    -filter_complex "tile=${cols}x0:padding=8:margin=16" \
    "${sheet}" || {
      printf 'operator-pick: ffmpeg tile failed; falling back to first candidate as sheet\n' >&2
      cp "${candidates[0]}" "${sheet}"
    }
else
  # ffmpeg absent (e.g. minimal CI). Copy the first candidate as the sheet.
  cp "${candidates[0]}" "${sheet}"
fi

# Dry-run: auto-select candidate 1 and write selection.json verbatim so
# downstream resume reads it identically to a real operator pick.
if [ "${AIV_DRYRUN:-true}" = "true" ]; then
  first="$(basename "${candidates[0]}")"
  cat > "${sel_file}" <<JSON
{
  "selected": "${first}",
  "reason": "auto-selected by operator-pick.sh (AIV_DRYRUN=true)"
}
JSON
fi

# Wait-loop is not appropriate here — the caller (command file) decides
# whether to poll or hand back. We assert selection.json exists and
# resolve it; if missing in live mode, we exit non-zero so the caller
# can pause and re-invoke.
if [ ! -f "${sel_file}" ]; then
  printf 'operator-pick: selection.json absent; write %s with {"selected":"<filename>"} and re-run\n' "${sel_file}" >&2
  exit 4
fi

# Read selection.json (jq required — already a hard dep for adapters).
if ! command -v jq >/dev/null 2>&1; then
  printf 'operator-pick: jq is required\n' >&2
  exit 3
fi
selected_name="$(jq -r '.selected // empty' "${sel_file}")"
if [ -z "${selected_name}" ]; then
  printf 'operator-pick: selection.json missing "selected" field\n' >&2
  exit 3
fi

selected_path="${cand_dir}/${selected_name}"
if [ ! -f "${selected_path}" ]; then
  printf 'operator-pick: selected candidate not found: %s\n' "${selected_path}" >&2
  exit 3
fi

# Also write a stable locked.png symlink/copy at the scene root so the
# motion step can resolve the locked image without re-reading selection.json.
locked="${scene_dir}/locked.png"
cp -f "${selected_path}" "${locked}"

printf 'sheet=%s\n' "${sheet}"
printf 'selected=%s\n' "${locked}"
