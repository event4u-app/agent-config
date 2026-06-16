#!/usr/bin/env bash
# ingest-song.sh — song-link ingest: Suno / Udio / YouTube / any
# yt-dlp-supported page → a local audio file the /video:from-song
# pipeline can consume. Convenience input only — the pipeline's ground
# truth stays the LOCAL file this script produces (probe + transcript
# run on real bytes, per media-sync-ground-truth).
#
# Backend: local-cli ("skill suite, not an app") — wraps the
# OPERATOR-installed `yt-dlp` (pip install yt-dlp) + ffmpeg for the
# audio extraction. Missing tool → exit 3 with the install hint.
#
# Rights note (surfaced on every run, never silent): downloading from a
# platform is subject to that platform's terms AND the operator's
# rights in the track. This script does not and cannot verify either —
# the downstream media-governance input gate (voice-cloning /
# recognisable-commercial-song checks in /video:from-song Step 2) still
# fires on the ingested file.
#
# Usage:
#   ingest-song.sh <https-url> <dest-dir> [--force]
#     stdout: {"audio_path": "<dest-dir>/song.m4a", "source": "<url-host>"}
#
# Safety:
#   - https URLs only; charset-validated (no quotes/control chars —
#     the URL lands in argv and redacted logs).
#   - Download capped at aiv_max_artifact_bytes (default 512 MiB) via
#     yt-dlp --max-filesize; runaway streams fail closed.
#   - Output path is fixed (<dest-dir>/song.m4a) — no provider-
#     controlled filename reaches the filesystem. Existing output is
#     refused unless --force (never a silent overwrite).
#
# Exit codes: 0 ok · 2 usage · 3 tool missing · 7 invalid input ·
# 75 transient download failure (caller may retry).

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

_ingest_validate_url() {
  local url="${1:-}"
  [ -n "${url}" ] || aiv_die 2 "ingest-song: url required"
  case "${url}" in
    https://*) : ;;
    *) aiv_die 7 "ingest-song: https URLs only (got: ${url})" ;;
  esac
  case "${url}" in
    *"'"* | *'`'* | *'$('* | *'"'* | *' '*)
      aiv_die 7 "ingest-song: illegal character in url" ;;
  esac
  if [ "$(printf '%s' "${url}" | tr -d '[:cntrl:]')" != "${url}" ]; then
    aiv_die 7 "ingest-song: control character in url"
  fi
  printf '%s' "${url}"
}

url="$(_ingest_validate_url "${1:-}")"
dest_dir="${2:-}"
[ -n "${dest_dir}" ] || aiv_die 2 "usage: ingest-song.sh <https-url> <dest-dir> [--force]"
force=false
[ "${3:-}" = "--force" ] && force=true

mkdir -p "${dest_dir}" || aiv_die 7 "ingest-song: cannot create ${dest_dir}"
dest="${dest_dir%/}/song.m4a"
if [ -f "${dest}" ] && [ "${force}" != "true" ]; then
  aiv_die 7 "ingest-song: ${dest} already exists — pass --force to overwrite (never silent)"
fi

aiv_require_cmd yt-dlp ffmpeg jq

host="$(printf '%s' "${url}" | sed -E 's#^https://([^/]+).*#\1#')"
printf 'ingest-song: rights note — downloading from %s is subject to the platform terms and YOUR rights in the track; the media-governance gate still runs on the ingested file\n' \
  "${host}" >&2

# Fixed output name: no provider-controlled filename touches the FS.
# Size cap fails closed; -x extracts the audio stream to m4a.
if ! yt-dlp --no-playlist -x --audio-format m4a \
     --max-filesize "$(aiv_max_artifact_bytes)" \
     -o "${dest_dir%/}/song.%(ext)s" "${url}" >&2; then
  aiv_die 75 "ingest-song: download failed (transient — retry, or download manually and pass the local file)"
fi
[ -f "${dest}" ] || aiv_die 75 "ingest-song: yt-dlp exited 0 but ${dest} is missing"

# Confirm it is real audio before handing it to the pipeline.
ffprobe -loglevel error -select_streams a:0 -show_entries stream=codec_type \
  -of csv=p=0 "${dest}" 2>/dev/null | grep -q audio \
  || aiv_die 7 "ingest-song: downloaded file has no audio stream: ${dest}"

jq -n --arg p "${dest}" --arg s "${host}" '{audio_path:$p, source:$s}'
