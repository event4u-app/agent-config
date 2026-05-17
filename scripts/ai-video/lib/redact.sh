#!/usr/bin/env bash
# scripts/ai-video/lib/redact.sh — secret-scrubbing helper for /video:* adapters.
#
# Sourced by every adapter under scripts/ai-video/adapters/*.sh. Provides
# two helpers:
#
#   aiv_redact_register <secret>   — register a string to scrub (idempotent)
#   aiv_redact <text>              — print text with every registered
#                                    secret replaced by ***REDACTED***
#
# Iron Law: an API key must never reach stdout/stderr verbatim. Adapters
# pipe every network response, curl error, and trace through aiv_redact
# before printing. Empty / unset values are skipped silently — an unset
# secret cannot leak.
#
# Pure bash, no external dependencies. Safe under `set -euo pipefail`.

# Guard against double-source.
if [ -n "${AIV_REDACT_LOADED:-}" ]; then
  return 0 2>/dev/null || exit 0
fi
AIV_REDACT_LOADED=1

# Registry of secrets to scrub. Newline-separated; populated by
# aiv_redact_register. Never echoed.
AIV_REDACT_SECRETS=""

aiv_redact_register() {
  local secret="${1:-}"
  # Treat empty / placeholder values as no-op so adapters can call this
  # unconditionally without leaking the placeholder string.
  case "${secret}" in
    ""|"REPLACE-ME"|*"-REPLACE-ME") return 0 ;;
  esac
  # Require a minimum length so single characters do not nuke the log.
  if [ "${#secret}" -lt 8 ]; then
    return 0
  fi
  # Idempotent — skip if already registered.
  case "${AIV_REDACT_SECRETS}" in
    *"${secret}"*) return 0 ;;
  esac
  AIV_REDACT_SECRETS="${AIV_REDACT_SECRETS}${secret}
"
}

aiv_redact() {
  local input
  if [ "$#" -gt 0 ]; then
    input="$*"
  else
    input="$(cat)"
  fi
  if [ -z "${AIV_REDACT_SECRETS}" ]; then
    printf '%s\n' "${input}"
    return 0
  fi
  # Apply replacements one secret at a time using awk so special chars
  # in the secret cannot break a sed expression. Use a here-string to
  # avoid running the loop in a subshell (which would discard mutations
  # to ${input}).
  local secret
  while IFS= read -r secret; do
    [ -z "${secret}" ] && continue
    input="$(printf '%s' "${input}" | awk -v s="${secret}" '
      {
        out = ""
        rest = $0
        while ((i = index(rest, s)) > 0) {
          out = out substr(rest, 1, i - 1) "***REDACTED***"
          rest = substr(rest, i + length(s))
        }
        print out rest
      }')"
  done <<< "${AIV_REDACT_SECRETS}"
  printf '%s\n' "${input}"
}

# Convenience wrapper: pipe stdin through aiv_redact line by line so
# adapters can do `curl … 2>&1 | aiv_redact_stream`.
aiv_redact_stream() {
  while IFS= read -r line; do
    aiv_redact "${line}"
  done
}
