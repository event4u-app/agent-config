#!/usr/bin/env bash
# seam-plan.sh — print the seam plan for an ordered chain of scene JSONs.
#
# `parse-blueprint.sh` parses ONE scene and emits its `continuity` value (how
# that scene joins the PREVIOUS one). Nothing there can see a chain, so nothing
# there can answer the two questions an operator needs BEFORE any spend:
#
#   - which boundaries hand off and which cut (a handoff forces the two clips
#     to render sequentially — the chain loses all parallelism);
#   - how many generations the chain costs (N, or up to 2N-1 with connectors).
#
# This script answers both, reads nothing but local files, and calls no
# provider. Pure POSIX-compatible bash (no associative arrays, runs on macOS
# bash 3.2); jq required.
#
# Usage:
#   seam-plan.sh <scene-1.json> <scene-2.json> [...]
#                [--capabilities-dir <dir>]
#                [--json]
#
#   Scene JSONs are given in RENDER ORDER — the argument order IS the chain.
#   `--capabilities-dir` defaults to this script's `model-capabilities/`
#   sibling; it is a flag so a fixture tree can be planned without touching
#   the shipped manifests.
#   `--json` emits the machine shape instead of the human plan.
#
# The connector gate (`null` is never `true`):
#   A `connector` boundary generates an extra clip conditioned on an end frame,
#   so BOTH adjacent models must report a probed `end_frame: true` in their
#   capability manifest. Anything else — `false`, `null`, a missing `end_frame`
#   key, a missing model entry, a missing manifest, or a scene that does not
#   name its adapter/model at all — REFUSES, naming the model. An unknown
#   capability is not a usable capability, and a connector silently downgraded
#   to a handoff is a generation the operator did not approve.
#
# Exit codes:
#   0   plan printed
#   2   usage error, or a refused plan (first-scene continuity, connector gate)
#   3   tool missing
#   7   unreadable / invalid scene JSON
set -euo pipefail

_sp_die() { local code="$1"; shift; printf 'seam-plan: %s\n' "$*" >&2; exit "${code}"; }

command -v jq >/dev/null 2>&1 || _sp_die 3 "jq required"

HERE="$(cd "$(dirname "$0")" && pwd)"
CAP_DIR="${HERE}/model-capabilities"
AS_JSON=0
# Scene paths go to a line-delimited temp file rather than into one
# space-separated string: re-splitting a string on IFS would break the moment a
# project path contains a space, which on macOS it routinely does.
SCENE_LIST="$(mktemp -t aiv-seam-plan-XXXXXX)"
trap 'rm -f "${SCENE_LIST}"' EXIT

while [ "$#" -gt 0 ]; do
  case "$1" in
    --capabilities-dir) CAP_DIR="${2:-}"; shift 2 ;;
    --json) AS_JSON=1; shift ;;
    -h|--help)
      sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    --*) _sp_die 2 "unknown flag '$1'" ;;
    *) printf '%s\n' "$1" >> "${SCENE_LIST}"; shift ;;
  esac
done

N="$(wc -l < "${SCENE_LIST}" | tr -d ' ')"
[ "${N}" -ge 1 ] || _sp_die 2 "usage: seam-plan.sh <scene-1.json> <scene-2.json> [...] [--capabilities-dir <dir>] [--json]"

# --- read the chain -----------------------------------------------------------
# Parallel positional lists (bash 3.2 has no associative arrays): one
# newline-separated record per scene, `label<TAB>continuity<TAB>adapter<TAB>model`.
CHAIN=""
while IFS= read -r scene_file; do
  [ -n "${scene_file}" ] || continue
  [ -r "${scene_file}" ] || _sp_die 7 "scene JSON not readable: ${scene_file}"
  jq -e 'type == "object"' "${scene_file}" >/dev/null 2>&1 \
    || _sp_die 7 "scene JSON must be an object: ${scene_file}"
  label="$(basename "${scene_file}")"
  label="${label%.json}"
  # A missing `continuity` means `cut` — the value every blueprint written
  # before the block existed meant.
  cont="$(jq -r '.continuity // "cut"' "${scene_file}")"
  case "${cont}" in
    cut|handoff|connector) ;;
    *) _sp_die 7 "scene ${label}: unknown continuity value '${cont}' (expected cut|handoff|connector)" ;;
  esac
  adapter="$(jq -r '.adapter // ""' "${scene_file}")"
  model="$(jq -r '.model_id // ""' "${scene_file}")"
  CHAIN="${CHAIN}${label}	${cont}	${adapter}	${model}
"
done < "${SCENE_LIST}"

_sp_field() { # _sp_field <index-1-based> <field-1-based>
  printf '%s' "${CHAIN}" | sed -n "$1p" | cut -f"$2"
}

# --- refusal: a non-cut continuity on the first scene -------------------------
first_label="$(_sp_field 1 1)"
first_cont="$(_sp_field 1 2)"
if [ "${first_cont}" != "cut" ]; then
  _sp_die 2 "scene ${first_label} declares continuity=${first_cont} but has no previous scene to hand off from — the first scene of a chain is always a cut"
fi

# --- end_frame lookup ---------------------------------------------------------
# Returns the literal manifest value, or `null` for every kind of not-knowing:
# missing manifest, missing model entry, missing key, unnamed model. Phase 1's
# schema keys may not exist yet, so a missing key is read defensively — it is
# indistinguishable from `null` on purpose.
_sp_end_frame() { # _sp_end_frame <adapter> <model>
  local adapter="$1" model="$2" file
  if [ -z "${adapter}" ] || [ -z "${model}" ]; then printf 'null'; return 0; fi
  case "${adapter}" in
    */*|..|.|"") printf 'null'; return 0 ;;
  esac
  file="${CAP_DIR}/${adapter}.json"
  [ -r "${file}" ] || { printf 'null'; return 0; }
  # `// null` would be WRONG here: jq's alternative operator treats `false` as
  # absent, so a probed `end_frame: false` would be reported as `null` and the
  # refusal message would name the wrong reason. `has` distinguishes them.
  jq -r --arg m "${model}" \
    '(.models[$m] // {}) | (if has("end_frame") then .end_frame else null end) | tostring' \
    "${file}" 2>/dev/null || printf 'null'
}

# --- walk the seams -----------------------------------------------------------
handoff_count=0
connector_count=0
cut_count=0
PLAN_LINES=""
SEAM_JSON="[]"
refusals=""

i=2
while [ "${i}" -le "${N}" ]; do
  prev=$((i - 1))
  from_label="$(_sp_field "${prev}" 1)"
  to_label="$(_sp_field "${i}" 1)"
  cont="$(_sp_field "${i}" 2)"

  case "${cont}" in
    cut) cut_count=$((cut_count + 1)) ;;
    handoff) handoff_count=$((handoff_count + 1)) ;;
    connector)
      connector_count=$((connector_count + 1))
      from_adapter="$(_sp_field "${prev}" 3)"; from_model="$(_sp_field "${prev}" 4)"
      to_adapter="$(_sp_field "${i}" 3)";     to_model="$(_sp_field "${i}" 4)"
      from_ef="$(_sp_end_frame "${from_adapter}" "${from_model}")"
      to_ef="$(_sp_end_frame "${to_adapter}" "${to_model}")"
      for side in from to; do
        if [ "${side}" = "from" ]; then
          ef="${from_ef}"; m="${from_model}"; a="${from_adapter}"; s="${from_label}"
        else
          ef="${to_ef}"; m="${to_model}"; a="${to_adapter}"; s="${to_label}"
        fi
        if [ "${ef}" != "true" ]; then
          [ -n "${m}" ] || m="<unnamed model>"
          [ -n "${a}" ] || a="<unnamed adapter>"
          refusals="${refusals}connector refused at seam ${prev}->${i} (${from_label} -> ${to_label}): scene ${s} model '${m}' (adapter ${a}) reports end_frame=${ef} — a connector needs a probed end_frame:true on both sides, and null is not true
"
        fi
      done
      ;;
  esac

  PLAN_LINES="${PLAN_LINES}  seam ${prev}->${i} (${from_label} -> ${to_label}): ${cont}
"
  SEAM_JSON="$(printf '%s' "${SEAM_JSON}" | jq \
    --arg from "${from_label}" --arg to "${to_label}" --arg mode "${cont}" \
    --argjson index "${prev}" \
    '. + [{index: $index, from: $from, to: $to, mode: $mode}]')"
  i=$((i + 1))
done

if [ -n "${refusals}" ]; then
  printf '%s' "${refusals}" | while IFS= read -r line; do
    [ -n "${line}" ] && printf 'seam-plan: %s\n' "${line}" >&2
  done
  exit 2
fi

# --- generation count ---------------------------------------------------------
# Each scene is one generation; each connector seam adds one bridging clip. A
# chain where EVERY boundary is a connector costs 2N-1, which is the number the
# operator has to see before approving spend.
GENS=$((N + connector_count))
GENS_NOTE=""
if [ "${N}" -gt 1 ] && [ "${connector_count}" -eq $((N - 1)) ]; then
  GENS_NOTE=" (2N-1)"
fi

SEQUENTIAL=false
if [ $((handoff_count + connector_count)) -gt 0 ]; then SEQUENTIAL=true; fi

if [ "${AS_JSON}" -eq 1 ]; then
  printf '%s' "${SEAM_JSON}" | jq \
    --argjson scenes "${N}" --argjson gens "${GENS}" \
    --argjson handoff "${handoff_count}" --argjson connector "${connector_count}" \
    --argjson cut "${cut_count}" --argjson sequential "${SEQUENTIAL}" \
    '{scenes: $scenes, seams: ., handoff: $handoff, connector: $connector,
      cut: $cut, sequential: $sequential, gens: $gens}'
  exit 0
fi

printf 'seam-plan: scenes=%d seams=%d cut=%d handoff=%d connector=%d sequential=%s\n' \
  "${N}" "$((N > 0 ? N - 1 : 0))" "${cut_count}" "${handoff_count}" "${connector_count}" "${SEQUENTIAL}"
printf '%s' "${PLAN_LINES}"
if [ "${SEQUENTIAL}" = "true" ]; then
  printf 'seam-plan: handoff/connector seams render SEQUENTIALLY — the chain loses parallelism\n'
fi
printf 'gens: %d%s\n' "${GENS}" "${GENS_NOTE}"
