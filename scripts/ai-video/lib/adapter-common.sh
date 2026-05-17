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

# aiv_dispatch <adapter-id> <capability> "$@" — generic subcommand router.
# Adapters override individual subcommands by defining bash functions
# named `aiv_cmd_submit` / `aiv_cmd_poll` / `aiv_cmd_fetch` / `aiv_cmd_run`
# BEFORE calling aiv_dispatch. Anything not overridden falls through to
# a stub that exits non-zero with a clear message.
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
    submit)
      declare -F aiv_cmd_submit >/dev/null \
        && aiv_cmd_submit "$@" \
        || aiv_die 5 "${adapter}: submit not implemented"
      ;;
    poll)
      declare -F aiv_cmd_poll >/dev/null \
        && aiv_cmd_poll "$@" \
        || aiv_die 5 "${adapter}: poll not implemented"
      ;;
    fetch)
      declare -F aiv_cmd_fetch >/dev/null \
        && aiv_cmd_fetch "$@" \
        || aiv_die 5 "${adapter}: fetch not implemented"
      ;;
    run)
      declare -F aiv_cmd_run >/dev/null \
        && aiv_cmd_run "$@" \
        || aiv_die 5 "${adapter}: run not implemented"
      ;;
    "")
      aiv_die 2 "${adapter}: subcommand required (capability|dry-run|submit|poll|fetch|run)"
      ;;
    *)
      aiv_die 2 "${adapter}: unknown subcommand '${sub}'"
      ;;
  esac
}
