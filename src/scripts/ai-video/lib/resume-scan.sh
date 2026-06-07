#!/usr/bin/env bash
# resume-scan.sh — resume-from-last-green-artifact scan (ADR-059).
#
# Filesystem-as-state: the scene directory IS the state. No central
# checkpoint.json exists by design (ADR-059 §1) — this scan derives the
# resume plan from the per-scene sentinels:
#
#   <project>/scenes/<id>/prompt.json   render input + input_sha256
#   <project>/scenes/<id>/final.mp4     existence (validated) = green
#   <project>/scenes/<id>/error.json    existence = failed
#   <project>/scenes/<id>/cost.json     spend record (summed for report)
#
# Classification per scene (ADR-059 §2 — input-hash equality is the
# single invalidation rule):
#   green    artifact present + validated, no error.json, stored
#            input_sha256 matches the recomputed hash of prompt.json
#            (tamper check) AND — when --plan is given — the plan's
#            expected hash for this scene.
#   stale    artifact present but the hash check failed (prompt edited,
#            provider/model switched, script re-derived, hand-tampered).
#            Re-render; never reuse unverifiable state.
#   failed   error.json present.
#   missing  in the plan but no green artifact on disk.
#
# Usage:
#   resume-scan.sh scan <project-dir> [--plan <plan.json>]
#     plan.json: [{"scene_id":"0001","input_sha256":"<hex>"}, …]
#     stdout: {"scenes":[{scene_id,state,reason?,charged_usd?}],
#              "green":N,"stale":N,"failed":N,"missing":N,
#              "spent_usd":X.YZ}
#
#   resume-scan.sh hash [< prompt.json]
#     Canonical input hash: jq -S over prompt.json with the
#     input_sha256 field removed, SHA-256 over the canonical bytes.
#     BOTH the render path (when stamping input_sha256) and this scan
#     use this one canonicalization — one source of truth.
#
# Cleanup is explicit, never ambient (ADR-059 §4):
#   resume-scan.sh clean <project-dir>
#     Removes failed-scene residue (error.json + partial *.tmp.* files)
#     so the next run re-renders those scenes. Never touches green
#     artifacts; whole-project deletion stays the operator's manual rm.
#
# Trust boundary: every consumed path is validated against the project
# root via aiv_validate_artifact_path (contract v2); illegal scene-dir
# names are skipped with a stderr warning, never followed.
#
# Exit codes: 0 ok · 2 usage · 3 tool missing · 7 invalid input.

set -euo pipefail

# shellcheck source=adapter-common.sh
. "$(dirname "$0")/adapter-common.sh"

_rs_sha256() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | cut -d' ' -f1
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | cut -d' ' -f1
  else
    aiv_die 3 "resume-scan: need shasum or sha256sum"
  fi
}

# Canonical input hash — the ONE canonicalization (ADR-059 §2).
_rs_hash() {
  aiv_require_cmd jq
  jq -S 'del(.input_sha256)' | _rs_sha256
}

_rs_scan() {
  aiv_require_cmd jq
  local project="${1:-}" plan=""
  [ -n "${project}" ] || aiv_die 2 "usage: resume-scan.sh scan <project-dir> [--plan <plan.json>]"
  [ -d "${project}" ] || aiv_die 7 "resume-scan: project dir not found: ${project}"
  shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --plan) plan="${2:-}"; shift 2 ;;
      *) aiv_die 2 "resume-scan: unknown flag '$1'" ;;
    esac
  done
  if [ -n "${plan}" ]; then
    [ -r "${plan}" ] || aiv_die 7 "resume-scan: plan not readable: ${plan}"
    jq -e 'type == "array"' "${plan}" >/dev/null 2>&1 \
      || aiv_die 7 "resume-scan: plan must be a JSON array of {scene_id, input_sha256}"
  fi

  local project_abs
  project_abs="$(cd "${project}" && pwd -P)"

  local rows="[]" scene_dir scene_id stored recomputed expected state reason charged clip
  if [ -d "${project_abs}/scenes" ]; then
    for scene_dir in "${project_abs}"/scenes/*/; do
      [ -d "${scene_dir}" ] || continue
      scene_id="$(basename "${scene_dir}")"
      case "${scene_id}" in
        *[!A-Za-z0-9._-]*|..|.)
          printf 'resume-scan: skipping illegal scene dir name: %s\n' "${scene_id}" >&2
          continue ;;
      esac

      state="" reason="" charged="null"

      if [ -f "${scene_dir}error.json" ]; then
        state="failed"
        reason="$(jq -r '"adapter=\(.adapter // "?") exit=\(.exit_code // "?") user_action=\(.user_action // "?")"' \
          "${scene_dir}error.json" 2>/dev/null || printf 'error.json unreadable')"
      else
        # Green-marker resolution: final.mp4, else the clip field
        # recorded in prompt.json (adapter-emitted name) — ADR-059 §1.
        clip="${scene_dir}final.mp4"
        if [ ! -f "${clip}" ] && [ -f "${scene_dir}prompt.json" ]; then
          clip="$(jq -r '.clip_path // empty' "${scene_dir}prompt.json" 2>/dev/null || true)"
          case "${clip}" in
            "") clip="${scene_dir}final.mp4" ;;
            /*) : ;;
            *) clip="${scene_dir}${clip}" ;;
          esac
        fi

        if [ -f "${clip}" ] && [ -f "${scene_dir}prompt.json" ]; then
          # Trust boundary — the clip must live under the project root.
          if ! aiv_validate_artifact_path "${project_abs}" "${clip}" >/dev/null 2>&1; then
            state="stale"; reason="artifact path failed validation (trust boundary)"
          else
            stored="$(jq -r '.input_sha256 // empty' "${scene_dir}prompt.json" 2>/dev/null || true)"
            recomputed="$(_rs_hash < "${scene_dir}prompt.json")"
            if [ -z "${stored}" ]; then
              state="stale"; reason="no input_sha256 stamped — never reuse unverifiable state (ADR-059)"
            elif [ "${stored}" != "${recomputed}" ]; then
              state="stale"; reason="prompt.json hash mismatch (edited or tampered)"
            elif [ -n "${plan}" ]; then
              expected="$(jq -r --arg id "${scene_id}" \
                'map(select(.scene_id == $id)) | (.[0].input_sha256 // empty)' "${plan}")"
              if [ -z "${expected}" ]; then
                state="green"; reason="not in plan (kept — plan does not name it)"
              elif [ "${expected}" = "${stored}" ]; then
                state="green"
              else
                state="stale"; reason="input changed vs current plan (re-render)"
              fi
            else
              state="green"
            fi
          fi
        else
          state="missing"; reason="no green artifact on disk"
        fi
      fi

      if [ -f "${scene_dir}cost.json" ]; then
        charged="$(jq -r '.charged_usd // null' "${scene_dir}cost.json" 2>/dev/null || printf 'null')"
      fi

      rows="$(printf '%s' "${rows}" | jq \
        --arg id "${scene_id}" --arg st "${state}" --arg rs "${reason}" \
        --argjson ch "${charged}" \
        '. + [{scene_id:$id, state:$st}
              + (if $rs == "" then {} else {reason:$rs} end)
              + (if $ch == null then {} else {charged_usd:$ch} end)]')"
    done
  fi

  # Plan entries with no scene dir at all → missing.
  if [ -n "${plan}" ]; then
    rows="$(jq --argjson rows "${rows}" '
      reduce .[] as $p ($rows;
        if (map(select(.scene_id == $p.scene_id)) | length) == 0
        then . + [{scene_id: $p.scene_id, state: "missing",
                   reason: "scene dir absent"}]
        else . end)' "${plan}")"
  fi

  printf '%s' "${rows}" | jq '{
    scenes: .,
    green:   (map(select(.state == "green"))   | length),
    stale:   (map(select(.state == "stale"))   | length),
    failed:  (map(select(.state == "failed"))  | length),
    missing: (map(select(.state == "missing")) | length),
    spent_usd: (map(.charged_usd // 0) | add // 0)
  }'
}

_rs_clean() {
  local project="${1:-}"
  [ -n "${project}" ] || aiv_die 2 "usage: resume-scan.sh clean <project-dir>"
  [ -d "${project}" ] || aiv_die 7 "resume-scan: project dir not found: ${project}"
  local project_abs scene_dir removed=0
  project_abs="$(cd "${project}" && pwd -P)"
  if [ -d "${project_abs}/scenes" ]; then
    for scene_dir in "${project_abs}"/scenes/*/; do
      [ -d "${scene_dir}" ] || continue
      if [ -f "${scene_dir}error.json" ]; then
        rm -f "${scene_dir}error.json"
        removed=$((removed + 1))
      fi
      # Partial atomic-write / download residue only — never a rendered clip.
      find "${scene_dir}" -maxdepth 1 -name '*.tmp.*' -type f -delete 2>/dev/null || true
    done
  fi
  printf '{"cleaned_failed_scenes":%d}\n' "${removed}"
}

sub="${1:-}"
case "${sub}" in
  scan)  shift; _rs_scan "$@" ;;
  hash)  shift || true; _rs_hash ;;
  clean) shift; _rs_clean "$@" ;;
  "")    aiv_die 2 "resume-scan: subcommand required (scan|hash|clean)" ;;
  *)     aiv_die 2 "resume-scan: unknown subcommand: ${sub}" ;;
esac
