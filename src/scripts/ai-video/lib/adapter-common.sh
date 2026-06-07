#!/usr/bin/env bash
# adapter-common.sh — shared boilerplate sourced by every adapter under
# scripts/ai-video/adapters/. Keeps individual adapters thin and makes
# the contract surface (subcommand dispatch, dry-run plumbing, stdout
# shape) uniform across providers.
#
# Sourced; never executed directly. Strict-mode flags are the caller's
# responsibility (every adapter starts with `set -euo pipefail`).

if [ -n "${AIV_ADAPTER_COMMON_LOADED:-}" ]; then
  return 0 2>/dev/null || exit 0
fi
AIV_ADAPTER_COMMON_LOADED=1

# Resolve the lib dir from this file's location so adapters can source
# us via the canonical `$(dirname "$0")/../lib/...` path.
_aiv_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
. "${_aiv_lib_dir}/redact.sh"
# shellcheck source=/dev/null
. "${_aiv_lib_dir}/load-config.sh"

AIV_LIB_DIR="${_aiv_lib_dir}"
AIV_FIXTURE_ROOT="${_aiv_lib_dir}/fixtures"
export AIV_LIB_DIR AIV_FIXTURE_ROOT

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
aiv_fetch_url() {
  local url="${1:-}" dest="${2:-}" cap="${3:-}"
  [ -n "${url}" ] && [ -n "${dest}" ] || aiv_die 10 "aiv_fetch_url: url and dest required"
  [ -n "${cap}" ] || cap="$(aiv_max_artifact_bytes)"
  aiv_require_cmd curl
  if ! curl --fail --silent --show-error --location \
       --max-filesize "${cap}" --max-time "${AIV_FETCH_TIMEOUT:-120}" \
       --output "${dest}" "${url}" 2>&1 | aiv_redact_stream >&2; then
    aiv_die 11 "aiv_fetch_url: download failed or exceeded ${cap} bytes: ${url}"
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
    submit|poll|fetch|run)
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
