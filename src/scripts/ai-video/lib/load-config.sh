#!/usr/bin/env bash
# scripts/ai-video/lib/load-config.sh — provider config loader for /video:*.
#
# Parses agents/.ai-video.xml with xmllint --xpath and surfaces a single
# provider's settings as AIV_KEY / AIV_ENDPOINT / AIV_MODEL / AIV_DRYRUN
# env vars to its caller. The key is NEVER echoed — status output is only
# `present` or `missing`.
#
# Usage (sourced):
#
#   . scripts/ai-video/lib/load-config.sh
#   aiv_load_provider gemini-veo
#   echo "key: $(aiv_key_status)"     # → present | missing
#   echo "endpoint: $AIV_ENDPOINT"
#   echo "dryrun: $AIV_DRYRUN"
#
# Usage (CLI status check, no key echoed):
#
#   bash scripts/ai-video/lib/load-config.sh status gemini-veo
#   → provider=gemini-veo key=present dryrun=true model=veo-3.0-generate-001
#
# Defaults:
#   - AIV_DRYRUN defaults to `true` when not set in XML
#   - AIV_DRYRUN can be overridden by the AIV_DRYRUN env var set by caller
#   - missing file is non-fatal in `status` mode (prints all-missing line)

set -u

AIV_CONFIG_PATH="${AIV_CONFIG_PATH:-agents/.ai-video.xml}"

_aiv_xpath() {
  # $1 = xpath expression; reads from $AIV_CONFIG_PATH
  # Returns text content or empty string. Never errors on missing path.
  if [ ! -f "${AIV_CONFIG_PATH}" ]; then
    printf ''
    return 0
  fi
  if ! command -v xmllint >/dev/null 2>&1; then
    printf ''
    return 0
  fi
  xmllint --xpath "string(${1})" "${AIV_CONFIG_PATH}" 2>/dev/null || printf ''
}

aiv_default_image_provider() {
  _aiv_xpath '/ai-video/default-image-provider'
}

aiv_default_video_provider() {
  _aiv_xpath '/ai-video/default-video-provider'
}

aiv_load_provider() {
  local pid="${1:-}"
  if [ -z "${pid}" ]; then
    echo "aiv_load_provider: provider id required" >&2
    return 2
  fi

  # Resolve from the top-level <provider> blocks OR the <extra> slot.
  local base="(/ai-video/provider[@id='${pid}']|/ai-video/extra/provider[@id='${pid}'])"

  AIV_PROVIDER_ID="${pid}"
  AIV_KEY="$(_aiv_xpath "${base}/api-key")"
  # Keypair-auth providers (e.g. Kling: JWT signed from AccessKey+SecretKey)
  # carry <access-key>/<secret-key> instead of <api-key>. Empty for others.
  AIV_ACCESS_KEY="$(_aiv_xpath "${base}/access-key")"
  AIV_SECRET_KEY="$(_aiv_xpath "${base}/secret-key")"
  AIV_ENDPOINT="$(_aiv_xpath "${base}/endpoint")"
  AIV_MODEL="$(_aiv_xpath "${base}/default-model")"
  AIV_KIND="$(_aiv_xpath "${base}/@kind")"

  local dryrun_xml
  dryrun_xml="$(_aiv_xpath "${base}/dry-run")"
  # Caller-set AIV_DRYRUN takes precedence; otherwise XML; otherwise true.
  if [ -n "${AIV_DRYRUN:-}" ]; then
    : # respect caller
  elif [ -n "${dryrun_xml}" ]; then
    AIV_DRYRUN="${dryrun_xml}"
  else
    AIV_DRYRUN="true"
  fi
  export AIV_DRYRUN

  # Tuning fields — adapters read these directly when present.
  AIV_TUNING_ASPECT="$(_aiv_xpath "${base}/tuning/aspect")"
  AIV_TUNING_FPS="$(_aiv_xpath "${base}/tuning/fps")"
  AIV_TUNING_MAX_DURATION="$(_aiv_xpath "${base}/tuning/max-duration")"
  AIV_TUNING_AUDIO_NATIVE="$(_aiv_xpath "${base}/tuning/audio-native")"
  AIV_TUNING_PRESET="$(_aiv_xpath "${base}/tuning/preset")"
  AIV_TUNING_QUALITY="$(_aiv_xpath "${base}/tuning/quality")"
  AIV_TUNING_BEST_OF_N="$(_aiv_xpath "${base}/tuning/best-of-n")"
  export AIV_TUNING_ASPECT AIV_TUNING_FPS AIV_TUNING_MAX_DURATION \
    AIV_TUNING_AUDIO_NATIVE AIV_TUNING_PRESET AIV_TUNING_QUALITY \
    AIV_TUNING_BEST_OF_N

  # Register keys with redact.sh if loaded — adapters always source both.
  if command -v aiv_redact_register >/dev/null 2>&1; then
    aiv_redact_register "${AIV_KEY}"
    [ -n "${AIV_ACCESS_KEY}" ] && aiv_redact_register "${AIV_ACCESS_KEY}"
    [ -n "${AIV_SECRET_KEY}" ] && aiv_redact_register "${AIV_SECRET_KEY}"
  fi

  return 0
}

aiv_key_status() {
  # Any value carrying the REPLACE-ME marker is a template placeholder —
  # regardless of the prefix shape (`fal-REPLACE-ME`, `r8_REPLACE-ME`, …).
  case "${AIV_KEY:-}" in
    ""|*"REPLACE-ME"*) printf 'missing' ;;
    *) printf 'present' ;;
  esac
}

# aiv_keypair_status — `present` only when BOTH halves of an
# AccessKey/SecretKey pair are set and neither is a template placeholder.
aiv_keypair_status() {
  case "${AIV_ACCESS_KEY:-}" in ""|*"REPLACE-ME"*) printf 'missing'; return 0 ;; esac
  case "${AIV_SECRET_KEY:-}" in ""|*"REPLACE-ME"*) printf 'missing'; return 0 ;; esac
  printf 'present'
}

# aiv_provider_enabled <provider-id> — operator kill-switch. Reads the
# optional <enabled> element on the provider block; only an explicit
# `false` disables (missing element = enabled, so existing configs keep
# working). Adapters check this before any network subcommand so the
# operator can take a misbehaving provider out of rotation without
# editing every procedure that names it.
aiv_provider_enabled() {
  local pid="${1:-}" val
  if [ -z "${pid}" ]; then
    printf 'false'
    return 0
  fi
  val="$(_aiv_xpath "(/ai-video/provider[@id='${pid}']|/ai-video/extra/provider[@id='${pid}'])/enabled")"
  case "${val}" in
    false|FALSE|0|no|NO) printf 'false' ;;
    *) printf 'true' ;;
  esac
}

# CLI mode — only `status <provider-id>` is supported; never echoes the key.
if [ "${BASH_SOURCE[0]:-}" = "${0}" ]; then
  cmd="${1:-}"
  case "${cmd}" in
    status)
      pid="${2:-}"
      if [ -z "${pid}" ]; then
        echo "usage: load-config.sh status <provider-id>" >&2
        exit 2
      fi
      aiv_load_provider "${pid}" >/dev/null
      # Keypair-auth providers report the pair; single-key providers the key.
      key_field="$(aiv_key_status)"
      if [ -n "${AIV_ACCESS_KEY:-}${AIV_SECRET_KEY:-}" ]; then
        key_field="$(aiv_keypair_status) (access+secret pair)"
      fi
      printf 'provider=%s key=%s dryrun=%s model=%s endpoint=%s kind=%s\n' \
        "${AIV_PROVIDER_ID}" \
        "${key_field}" \
        "${AIV_DRYRUN:-true}" \
        "${AIV_MODEL:-}" \
        "${AIV_ENDPOINT:-}" \
        "${AIV_KIND:-}"
      ;;
    defaults)
      printf 'default-image-provider=%s\n' "$(aiv_default_image_provider)"
      printf 'default-video-provider=%s\n' "$(aiv_default_video_provider)"
      ;;
    "")
      echo "usage: load-config.sh {status <id> | defaults}" >&2
      exit 2
      ;;
    *)
      echo "load-config.sh: unknown subcommand '${cmd}'" >&2
      exit 2
      ;;
  esac
fi
