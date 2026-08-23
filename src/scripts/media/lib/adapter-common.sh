#!/usr/bin/env bash
# adapter-common.sh — shared boilerplate sourced by every media adapter
# (video under scripts/ai-video/adapters/; image under scripts/ai-image/
# adapters/ from Phase A.2 on). Lives in the neutral scripts/media/lib/
# substrate so both domains depend on it without a cross-domain reference.
# Keeps individual adapters thin and makes the contract surface (subcommand
# dispatch, dry-run plumbing, stdout shape) uniform across providers.
#
# Sourced; never executed directly. Strict-mode flags are the caller's
# responsibility (every adapter starts with `set -euo pipefail`).
#
# NAMING: the AIV_* exports below are the historical names. The MEDIA_*
# aliases are the forward-looking, domain-neutral surface — new (image)
# adapters SHOULD source via the MEDIA_* names. The AIV_*→MEDIA_* rename
# of the internals is deferred to a follow-up (road-to-image-brand-typography
# Phase A); both name sets stay live until then.

if [ -n "${AIV_ADAPTER_COMMON_LOADED:-}" ]; then
  return 0 2>/dev/null || exit 0
fi
AIV_ADAPTER_COMMON_LOADED=1

# Resolve the substrate dir from this file's location (scripts/media/lib).
# Adapters source us via `$(dirname "$0")/../../media/lib/adapter-common.sh`.
_aiv_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
. "${_aiv_lib_dir}/redact.sh"
# shellcheck source=/dev/null
. "${_aiv_lib_dir}/load-config.sh"

# AIV_LIB_DIR is the *adapter domain's* resource dir (model-capabilities/,
# comfyui-*), resolved relative to the calling adapter ($0) — those
# resources stay in scripts/<domain>/lib/, NOT in the shared substrate.
# Falls back to the substrate dir for non-adapter callers (smoke harness,
# direct sourcing in tests) that never read domain resources.
AIV_LIB_DIR="$(cd "$(dirname "$0")/../lib" 2>/dev/null && pwd || printf '%s' "${_aiv_lib_dir}")"
# Shared substrate + fixtures live with this file (scripts/media/lib).
MEDIA_LIB_DIR="${_aiv_lib_dir}"
AIV_FIXTURE_ROOT="${_aiv_lib_dir}/fixtures"
MEDIA_FIXTURE_ROOT="${AIV_FIXTURE_ROOT}"
export AIV_LIB_DIR MEDIA_LIB_DIR AIV_FIXTURE_ROOT MEDIA_FIXTURE_ROOT

# Per-adapter run telemetry (success / cost / latency — local-only
# JSONL, best-effort, AIV_TELEMETRY=false kill-switch).
# shellcheck source=/dev/null
. "${_aiv_lib_dir}/telemetry.sh"

# aiv_die <exit-code> <message> — write redacted message to stderr.
aiv_die() {
  local code="${1:-1}"; shift || true
  printf 'adapter: %s\n' "$*" | aiv_redact_stream >&2
  exit "${code}"
}

# aiv_require_cmd <cmd> [<cmd> ...] — fail fast on missing dependency.
aiv_require_cmd() {
  local cmd
  for cmd in "$@"; do
    command -v "${cmd}" >/dev/null 2>&1 \
      || aiv_die 3 "required tool not found: ${cmd}"
  done
}

# aiv_emit_dry_run <adapter-id> — print contract-shaped stdout JSON
# pointing at the adapter's fixture directory. Used by every adapter's
# `dry-run` subcommand.
aiv_emit_dry_run() {
  local adapter="${1:-}"
  [ -n "${adapter}" ] || aiv_die 3 "aiv_emit_dry_run: adapter id required"
  local fixture_dir="${AIV_FIXTURE_ROOT}/${adapter}"
  local result="${fixture_dir}/result.json"
  if [ ! -f "${result}" ]; then
    aiv_die 3 "fixture missing: ${result}"
  fi
  cat "${result}"
}

# aiv_capability <flag> — print the capability JSON for `--help`-style
# discovery: `{"audio": "native|none|per-model"}`.
aiv_capability() {
  local flag="${1:-none}"
  printf '{"audio":"%s"}\n' "${flag}"
}

# aiv_assert_dryrun — refuse to run a network path unless the caller
# explicitly opted in (AIV_DRYRUN=false set in this turn).
aiv_assert_dryrun() {
  case "${AIV_DRYRUN:-true}" in
    false|FALSE|0|no|NO) return 0 ;;
    *) aiv_die 4 "live call refused: AIV_DRYRUN=${AIV_DRYRUN:-true}; use dry-run subcommand or set AIV_DRYRUN=false" ;;
  esac
}

# -- Model-capabilities manifests -------------------------------------------
# Per-model capabilities live in <domain>/lib/model-capabilities/<adapter>.json
# (schema v2 — see that directory's README). AIV_MODEL_CAPS_DIR overrides the
# directory: the frame-lock probe and the test suite point the reader at a
# fixture manifest instead of writing into the tracked one.
aiv_manifest_path() {
  printf '%s/%s.json' \
    "${AIV_MODEL_CAPS_DIR:-${AIV_LIB_DIR}/model-capabilities}" "${1}"
}

# aiv_warn_unverified <adapter> <model> <manifest> — an entry without a
# captured smoke trace carries verified:false and must never be trusted
# silently (model-capabilities/README.md § verified).
# NB: jq `//` treats false as falsy — the null check is explicit so a
# present-but-unverified entry is not misreported as absent.
aiv_warn_unverified() {
  local adapter="${1}" model="${2}" manifest="${3}" verified
  [ -f "${manifest}" ] || return 0
  verified="$(jq -r --arg m "${model}" \
    '.models[$m] | if . == null then "absent" elif .verified == true then "true" else "false" end' \
    "${manifest}" 2>/dev/null || true)"
  case "${verified}" in
    true) : ;;
    absent) printf '%s: model %s not in model-capabilities manifest — capabilities unknown\n' \
          "${adapter}" "${model}" >&2 ;;
    *) printf '%s: model %s capabilities are UNVERIFIED (no smoke trace) — durations/cost are documented-best-effort\n' \
          "${adapter}" "${model}" >&2 ;;
  esac
}

# aiv_assert_frame_coherent <adapter> <model> <manifest> — an entry claiming
# end_frame:true while start_frame is not true is INCOHERENT: a model that
# cannot open on a supplied frame cannot close on one either. Refuse the entry
# rather than hand it to a planner (schema v2, model-capabilities/README.md).
aiv_assert_frame_coherent() {
  local adapter="${1}" model="${2}" manifest="${3}" bad
  [ -f "${manifest}" ] || return 0
  bad="$(jq -r --arg m "${model}" \
    '.models[$m] // {} | if .end_frame == true and .start_frame != true then "1" else "" end' \
    "${manifest}" 2>/dev/null || true)"
  [ -z "${bad}" ] || aiv_die 3 "${adapter}: model-capabilities entry for ${model} is incoherent — end_frame:true with start_frame not true; a model that cannot open on a supplied frame cannot close on one (see lib/model-capabilities/README.md § Schema v2)"
}

# aiv_manifest_capability <adapter> <default-audio> "$@" — shared
# manifest-backed `capability`. Without --model it prints the adapter's
# declared audio flag, byte-identical to the pre-manifest surface. With
# --model it answers from the manifest and refuses an id the manifest does
# not carry, rather than returning a default that would read as an answer.
aiv_manifest_capability() {
  local adapter="${1}" default_audio="${2}"; shift 2
  local model="" manifest
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --model) model="${2:-}"; shift 2 ;;
      *) shift ;;
    esac
  done
  if [ -z "${model}" ]; then
    aiv_capability "${default_audio}"
    return 0
  fi
  aiv_require_cmd jq
  manifest="$(aiv_manifest_path "${adapter}")"
  [ -f "${manifest}" ] || aiv_die 3 "${adapter}: manifest missing: ${manifest}"
  jq -e --arg m "${model}" '.models[$m]' "${manifest}" >/dev/null 2>&1 \
    || aiv_die 7 "${adapter}: model not in manifest: ${model}"
  aiv_assert_frame_coherent "${adapter}" "${model}" "${manifest}"
  aiv_warn_unverified "${adapter}" "${model}" "${manifest}"
  aiv_capability_recheck "${adapter}" "${model}" "${manifest}"
}

# -- Decay markers (recheck_by) ----------------------------------------------
# A vendor capability is a DATED OBSERVATION, not a permanent fact: endpoints
# have gained and lost frame conditioning inside weeks, so a manifest entry
# verified once is evidence about the past presented as the present unless it
# carries its own expiry. Same idiom as `keep-beta-until` in
# docs/contracts/skill-bundled-assets.md.
#
# The date is DERIVED, never stored twice: the entry's `smoke_trace` id resolves
# to a row in agents/evidence/ai-video/trace-index.json, whose `captured_at`
# plus AIV_TRACE_RECHECK_DAYS is the recheck date. One constant, shared with
# lint_adapter_tier's staleness window and with the `recheck_by` stamp
# smoke-trace.sh writes into every trace — so a change moves every side or none.
#
# Why not read `recheck_by` straight out of the trace: the traces are local-only
# by a deliberate decision (d7f5d5d3c, reaffirmed by council 2026-08-23) and are
# absent from every clone. The index is the reviewer-reachable projection, and it
# carries five fields by design; `captured_at` is one of them and the arithmetic
# is free, so nothing needs widening.
AIV_TRACE_INDEX_REL="agents/evidence/ai-video/trace-index.json"

# aiv_capability_recheck <adapter> <model> <manifest> — emit the capability JSON
# with `verified_at` / `recheck_by` appended, and warn on stderr past the date.
# An entry with no `smoke_trace` gets both as null: unknown, never "fresh".
aiv_capability_recheck() {
  local adapter="${1}" model="${2}" manifest="${3}"
  local root trace_id index captured recheck days today

  days="${AIV_TRACE_RECHECK_DAYS:-180}"
  # Walk up for the index rather than counting `..` segments. AIV_LIB_DIR is
  # `src/scripts/<domain>/lib` when an adapter is the entry point and
  # `src/scripts/media/lib` when the common file resolves itself, so a fixed
  # depth is right for one caller and silently wrong for the other — which is
  # exactly how this landed with `verified_at: null` on a traced model the
  # first time.
  index="${AIV_TRACE_INDEX:-}"
  if [ -z "${index}" ]; then
    root="${AIV_LIB_DIR}"
    while [ -n "${root}" ] && [ "${root}" != "/" ]; do
      if [ -f "${root}/${AIV_TRACE_INDEX_REL}" ]; then
        index="${root}/${AIV_TRACE_INDEX_REL}"
        break
      fi
      root="$(dirname "${root}")"
    done
  fi

  trace_id="$(jq -r --arg m "${model}" '.models[$m].smoke_trace // empty' "${manifest}" 2>/dev/null || true)"
  captured=""
  if [ -n "${trace_id}" ] && [ -f "${index}" ]; then
    captured="$(jq -r --arg t "${trace_id}" 'map(select(.trace_id == $t)) | .[0].captured_at // empty' "${index}" 2>/dev/null || true)"
  fi

  recheck=""
  if [ -n "${captured}" ]; then
    recheck="$(CAP="${captured}" D="${days}" node -e '
      const iso = process.env.CAP.replace(/T(\d{2})-(\d{2})-(\d{2})Z$/, "T$1:$2:$3Z");
      const t = new Date(iso);
      if (Number.isNaN(t.getTime())) { process.stdout.write(""); process.exit(0); }
      t.setUTCDate(t.getUTCDate() + Number(process.env.D));
      process.stdout.write(t.toISOString().slice(0, 10));
    ' 2>/dev/null || true)"
  fi

  if [ -n "${recheck}" ]; then
    today="$(date -u +%Y-%m-%d)"
    # String comparison is correct for ISO dates and needs no date parsing.
    if [ "${today}" \> "${recheck}" ]; then
      printf '%s: model %s was verified %s and its recheck-by date %s has PASSED — re-probe before trusting the capability; a vendor may have changed the endpoint since\n' \
        "${adapter}" "${model}" "${captured%T*}" "${recheck}" >&2
    fi
  fi

  jq --arg m "${model}" \
     --arg va "${captured%T*}" --arg rb "${recheck}" \
    '.models[$m]
     | {audio: (if .audio_sync then "native" else "none" end), model: $m}
       + .
       + {verified_at: (if $va == "" then null else $va end),
          recheck_by:  (if $rb == "" then null else $rb end)}' \
    "${manifest}"
}

# -- end_image gate (adapter-contract.md § end_image) ------------------------
# `end_image` asks the provider to CLOSE the clip on a supplied frame. An
# adapter may honour it only when the submitted model's manifest entry answers
# end_frame:true; `null` means unknown, and unknown is never treated as true.
# Refusal over silent downgrade: dropping the image renders something the
# caller did not ask for and bills for it — the same register stitch.sh uses
# when it refuses --crossfade instead of quietly hard-cutting.
AIV_EXIT_END_FRAME_UNSUPPORTED=12

# aiv_assert_end_frame_supported <adapter> <stdin-json> — no-op unless stdin
# carries a non-null end_image; otherwise refuse with exit 12 naming the model
# and the field. Model resolution is deliberately conservative (stdin
# model_id, else AIV_MODEL): an unresolvable model is an unproven capability,
# and unproven refuses.
aiv_assert_end_frame_supported() {
  local adapter="${1}" stdin_json="${2}" model manifest end_frame
  command -v jq >/dev/null 2>&1 || return 0
  printf '%s' "${stdin_json}" \
    | jq -e 'type == "object" and has("end_image") and (.end_image != null)' \
      >/dev/null 2>&1 || return 0

  model="$(printf '%s' "${stdin_json}" | jq -r '.model_id // empty' 2>/dev/null || true)"
  [ -n "${model}" ] || model="${AIV_MODEL:-}"
  [ -n "${model}" ] || model="<unresolved>"
  manifest="$(aiv_manifest_path "${adapter}")"

  end_frame="null"
  if [ -f "${manifest}" ]; then
    end_frame="$(jq -r --arg m "${model}" \
      '.models[$m] // {} | .end_frame | if . == null then "null" else tostring end' \
      "${manifest}" 2>/dev/null || printf 'null')"
  fi
  if [ "${end_frame}" = "true" ]; then
    aiv_assert_frame_coherent "${adapter}" "${model}" "${manifest}"
    return 0
  fi
  aiv_die "${AIV_EXIT_END_FRAME_UNSUPPORTED}" \
    "${adapter}: end_image submitted for model ${model}, whose model-capabilities entry answers end_frame=${end_frame} (null means unknown, and unknown is never treated as true). The image is refused, never dropped — re-submit without end_image, choose a model whose end_frame is a probed true, or probe this one. See media/lib/adapter-contract.md § end_image."
}

# -- Trust boundary (adapter-contract.md v2) --------------------------------
# Provider-returned artifact paths and downloads are UNTRUSTED input. The
# three helpers below are the enforcement surface the live submit/poll/fetch
# path MUST route through, so an adapter physically cannot return /etc/passwd,
# a symlink that escapes the project, or a runaway multi-GB stream.

# aiv_max_artifact_bytes — hard size cap for a single fetched artifact.
# Default 512 MiB; override via AIV_MAX_ARTIFACT_BYTES.
aiv_max_artifact_bytes() {
  printf '%s\n' "${AIV_MAX_ARTIFACT_BYTES:-536870912}"
}

# aiv_validate_artifact_path <root> <path> — canonicalize <path> and assert it
# resolves INSIDE <root>. Echoes the canonical absolute path on success;
# aiv_die 10 on any violation. Rejects: empty path, injection/control chars
# (newline, single quote, backtick, command-sub), a symlink artifact, a
# parent-traversal that escapes <root>, and a missing parent directory.
aiv_validate_artifact_path() {
  local root="${1:-}" path="${2:-}"
  [ -n "${root}" ] || aiv_die 10 "validate_artifact_path: scope root required"
  [ -n "${path}" ] || aiv_die 10 "validate_artifact_path: empty artifact path (untrusted provider output)"

  # Injection guard — these characters would break out of ffmpeg's concat
  # list (`file '...'`) or a redacted log line.
  case "${path}" in
    *"'"* | *'`'* | *'$('*)
      aiv_die 10 "validate_artifact_path: illegal character in artifact path (injection guard)" ;;
  esac
  if [ "$(printf '%s' "${path}" | tr -d '[:cntrl:]')" != "${path}" ]; then
    aiv_die 10 "validate_artifact_path: control character in artifact path"
  fi

  local real_root
  real_root="$(cd "${root}" 2>/dev/null && pwd -P)" \
    || aiv_die 10 "validate_artifact_path: scope root not a directory: ${root}"

  # A symlink artifact is rejected outright — its target is provider-controlled.
  [ -L "${path}" ] && aiv_die 10 "validate_artifact_path: symlink artifacts are not allowed: ${path}"

  # Canonicalize the PARENT (resolving any symlinked dirs) and re-attach the
  # basename, so a not-yet-created live-fetch target still validates.
  local parent base real_parent real_path
  parent="$(dirname "${path}")"
  base="$(basename "${path}")"
  case "${base}" in
    .. | .) aiv_die 10 "validate_artifact_path: illegal basename: ${base}" ;;
  esac
  real_parent="$(cd "${parent}" 2>/dev/null && pwd -P)" \
    || aiv_die 10 "validate_artifact_path: parent dir missing: ${parent}"
  real_path="${real_parent}/${base}"

  case "${real_path}" in
    "${real_root}"/* | "${real_root}") printf '%s\n' "${real_path}" ;;
    *) aiv_die 10 "validate_artifact_path: path escapes scope root: ${path} not under ${root}" ;;
  esac
}

# aiv_scene_dir <project_dir> <scene_id> — create and echo the scene-scoped
# output dir. Live fetch writes artifacts here, then validates the result.
aiv_scene_dir() {
  local project="${1:-}" scene="${2:-}"
  [ -n "${project}" ] && [ -n "${scene}" ] \
    || aiv_die 10 "aiv_scene_dir: project dir and scene id required"
  case "${scene}" in
    */* | .. | . | *"'"*) aiv_die 10 "aiv_scene_dir: illegal scene id: ${scene}" ;;
  esac
  local dir="${project}/scenes/${scene}"
  mkdir -p "${dir}" || aiv_die 10 "aiv_scene_dir: cannot create ${dir}"
  printf '%s\n' "${dir}"
}

# aiv_fetch_url <url> <dest> [max_bytes] — download <url> into <dest> with a
# hard size cap (aiv_max_artifact_bytes) and timeout (AIV_FETCH_TIMEOUT,
# default 120s). Live `fetch` MUST route downloads through this helper so a
# hostile or runaway response cannot exhaust disk. Echoes <dest> on success.
# Optional: AIV_FETCH_HEADER carries ONE auth header for providers whose
# artifact URIs require it (e.g. Gemini file downloads need x-goog-api-key).
# Empty/unset = no header — existing callers are unchanged. The header value
# is never echoed; registered keys are redacted from any curl stderr.
aiv_fetch_url() {
  local url="${1:-}" dest="${2:-}" cap="${3:-}"
  [ -n "${url}" ] && [ -n "${dest}" ] || aiv_die 10 "aiv_fetch_url: url and dest required"
  [ -n "${cap}" ] || cap="$(aiv_max_artifact_bytes)"
  aiv_require_cmd curl
  if [ -n "${AIV_FETCH_HEADER:-}" ]; then
    if ! curl --fail --silent --show-error --location \
         --max-filesize "${cap}" --max-time "${AIV_FETCH_TIMEOUT:-120}" \
         -H "${AIV_FETCH_HEADER}" \
         --output "${dest}" "${url}" 2>&1 | aiv_redact_stream >&2; then
      aiv_die 11 "aiv_fetch_url: download failed or exceeded ${cap} bytes: ${url}"
    fi
  else
    if ! curl --fail --silent --show-error --location \
         --max-filesize "${cap}" --max-time "${AIV_FETCH_TIMEOUT:-120}" \
         --output "${dest}" "${url}" 2>&1 | aiv_redact_stream >&2; then
      aiv_die 11 "aiv_fetch_url: download failed or exceeded ${cap} bytes: ${url}"
    fi
  fi
  printf '%s\n' "${dest}"
}

# _aiv_dispatch_timed <adapter> <sub> "$@" — run aiv_cmd_<sub> in a
# subshell, record success/latency/cost telemetry (best-effort), then
# propagate stdout, stderr, and the exit code unchanged. The subshell
# is what lets a failing subcommand (aiv_die exits) still produce a
# telemetry record without altering the adapter's observable contract.
# `capability` and `dry-run` are NOT timed — offline, byte-exact
# fixture output stays untouched.
_aiv_dispatch_timed() {
  local adapter="${1}" sub="${2}"; shift 2
  local fn="aiv_cmd_${sub//-/_}"
  declare -F "${fn}" >/dev/null || aiv_die 5 "${adapter}: ${sub} not implemented"
  local start_ms end_ms rc=0 out cost=""
  start_ms="$(aiv_now_ms)"
  out="$( ( "${fn}" "$@" ) )" || rc=$?
  end_ms="$(aiv_now_ms)"
  if [ "${rc}" -eq 0 ] && [ -n "${out}" ] && command -v jq >/dev/null 2>&1; then
    cost="$(printf '%s' "${out}" | jq -r '.cost_estimate // empty' 2>/dev/null || true)"
  fi
  aiv_telemetry_record "${adapter}" "${sub}" \
    "$([ "${rc}" -eq 0 ] && printf 'ok' || printf 'exit_%d' "${rc}")" \
    "$(( end_ms - start_ms ))" "${cost}" || true
  [ -n "${out}" ] && printf '%s\n' "${out}"
  return "${rc}"
}

# aiv_dispatch <adapter-id> <capability> "$@" — generic subcommand router.
# Adapters override individual subcommands by defining bash functions
# named `aiv_cmd_submit` / `aiv_cmd_poll` / `aiv_cmd_fetch` / `aiv_cmd_run`
# BEFORE calling aiv_dispatch. Anything not overridden falls through to
# a stub that exits non-zero with a clear message. Network-bound
# subcommands route through _aiv_dispatch_timed for run telemetry.
aiv_dispatch() {
  local adapter="${1:-}"; shift || true
  local cap="${1:-none}"; shift || true
  local sub="${1:-}"; shift || true
  case "${sub}" in
    capability)
      aiv_capability "${cap}"
      ;;
    dry-run)
      aiv_emit_dry_run "${adapter}"
      ;;
    submit|run)
      # These two are the only subcommands that consume the contract stdin, so
      # they are the only ones the end_image gate can read. A here-string (not
      # a pipe) re-feeds the bytes: a pipe would run the dispatcher in a
      # subshell and, for an adapter that exits without draining stdin, turn a
      # clean EPIPE into the pipeline's exit code. Skipped on a tty, where
      # there is nothing to read and today's behaviour is an immediate refusal
      # rather than a block.
      if [ -t 0 ]; then
        _aiv_dispatch_timed "${adapter}" "${sub}" "$@"
      else
        local _aiv_stdin
        _aiv_stdin="$(cat)"
        aiv_assert_end_frame_supported "${adapter}" "${_aiv_stdin}"
        _aiv_dispatch_timed "${adapter}" "${sub}" "$@" <<< "${_aiv_stdin}"
      fi
      ;;
    poll|fetch)
      _aiv_dispatch_timed "${adapter}" "${sub}" "$@"
      ;;
    "")
      aiv_die 2 "${adapter}: subcommand required (capability|dry-run|submit|poll|fetch|run)"
      ;;
    *)
      aiv_die 2 "${adapter}: unknown subcommand '${sub}'"
      ;;
  esac
}
