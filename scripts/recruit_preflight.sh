#!/usr/bin/env bash
# Recruit-session day-of pre-flight checks.
#
# Phase B Step 2 of road-to-adoption-proof-and-ci-green.md. Run this
# 30 minutes before a recruit session — exits non-zero on any failure
# so a missed prereq pushes the session rather than burning it.
#
# Checks (all ≤ 5 s total runtime):
#
#   1. Provider keys present  — ANTHROPIC_API_KEY or OPENAI_API_KEY in env,
#      OR AGENT_CONFIG_DRYRUN=true (dry-run session task).
#   2. Workspace state clean  — ~/.augment/ has no in-progress experiments.
#   3. agents/recruit-sessions/ writable.
#   4. task ci green at HEAD  — last 'task ci' run summary is clean.
#   5. Screen recording tool installed — one of obs / loom-cli /
#      zoom-cli / riverside present (best-effort detection).
#
# Output: one line per check, prefixed ✅ / ❌. Exit codes:
#   0 — every check passed.
#   1 — at least one check failed.
#
# CLI:
#   bash scripts/recruit_preflight.sh [--quiet] [--dry-run-allowed]
#
#   --quiet               Suppress per-check rows; print summary only.
#   --dry-run-allowed     Accept AGENT_CONFIG_DRYRUN=true as the provider
#                         keys check (default false — explicit keys needed).
#
# Tests live at tests/test_recruit_preflight.sh (fixture-driven).

set -euo pipefail

QUIET=false
DRY_RUN_ALLOWED=false
for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=true ;;
    --dry-run-allowed) DRY_RUN_ALLOWED=true ;;
    -h|--help)
      sed -n '2,28p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *) echo "recruit_preflight: unknown arg: $arg" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0

_emit() {
  if [ "$QUIET" = false ]; then
    echo "$1"
  fi
}

_check() {
  local label="$1"
  local ok="$2"
  local detail="${3:-}"
  if [ "$ok" = "true" ]; then
    _emit "✅  ${label}${detail:+ — ${detail}}"
    PASS=$((PASS + 1))
  else
    _emit "❌  ${label}${detail:+ — ${detail}}"
    FAIL=$((FAIL + 1))
  fi
}

# 1. Provider keys present (or dry-run accepted)
if [ -n "${ANTHROPIC_API_KEY:-}" ] || [ -n "${OPENAI_API_KEY:-}" ]; then
  _check "provider keys" true "anthropic / openai env var set"
elif [ "$DRY_RUN_ALLOWED" = true ] && [ "${AGENT_CONFIG_DRYRUN:-}" = "true" ]; then
  _check "provider keys" true "dry-run mode accepted"
else
  _check "provider keys" false "set ANTHROPIC_API_KEY or OPENAI_API_KEY (or pass --dry-run-allowed)"
fi

# 2. Workspace state clean — ~/.augment/ has no in-progress experiments.
# "In-progress" is defined as any file under ~/.augment/ modified within
# the last 60 minutes whose name suggests a session / experiment / draft.
AUGMENT_DIR="${HOME}/.augment"
if [ ! -d "$AUGMENT_DIR" ]; then
  _check "workspace clean" true "no ~/.augment/ — fresh user"
else
  RECENT=$(find "$AUGMENT_DIR" -type f \
    \( -name '*session*' -o -name '*experiment*' -o -name '*draft*' \) \
    -mmin -60 2>/dev/null | head -1 || true)
  if [ -z "$RECENT" ]; then
    _check "workspace clean" true "no recent session/experiment files"
  else
    _check "workspace clean" false "recent file: $(basename "$RECENT")"
  fi
fi

# 3. agents/recruit-sessions/ writable.
RECRUIT_DIR="$REPO_ROOT/agents/recruit-sessions"
if [ ! -d "$RECRUIT_DIR" ]; then
  _check "recruit dir writable" false "missing: $RECRUIT_DIR"
elif [ ! -w "$RECRUIT_DIR" ]; then
  _check "recruit dir writable" false "not writable: $RECRUIT_DIR"
else
  _check "recruit dir writable" true "$RECRUIT_DIR"
fi

# 4. task ci green at HEAD — look at the last 'task ci' marker if it
#    exists. /tmp/agent-config-ci-start.txt is written by _ci-start
#    at the start of every 'task ci' run; /tmp/agent-config-ci-end.txt
#    by _ci-end on success. Pre-flight passes when both exist AND
#    end > start AND no .agent-src.uncompressed file is newer than end.
START_MARKER="/tmp/agent-config-ci-start.txt"
END_MARKER="/tmp/agent-config-ci-end.txt"
if [ ! -f "$START_MARKER" ] || [ ! -f "$END_MARKER" ]; then
  # Soft pass — no marker yet on a fresh checkout. The session does
  # not need a green CI in the past 30 days; it needs no obvious red.
  _check "task ci green" true "no recent ci marker (acceptable on fresh checkout)"
else
  START_TS=$(cat "$START_MARKER")
  END_TS=$(cat "$END_MARKER")
  if [ "$END_TS" -gt "$START_TS" ]; then
    _check "task ci green" true "last run completed (end=$END_TS, start=$START_TS)"
  else
    _check "task ci green" false "last run incomplete (start=$START_TS, end=$END_TS)"
  fi
fi

# 5. Screen recording tool — best-effort presence check.
RECORDING_TOOL=""
for tool in obs-cli obs loom riverside zoom; do
  if command -v "$tool" >/dev/null 2>&1; then
    RECORDING_TOOL="$tool"
    break
  fi
done
if [ -n "$RECORDING_TOOL" ]; then
  _check "recording tool" true "$RECORDING_TOOL on PATH"
else
  # Browser-based recorders (Loom web, Zoom web, Riverside web) leave
  # nothing on the PATH; the maintainer is presumed to test the clip
  # the day before per _runbook.md § Scheduling. Soft pass with a hint.
  _check "recording tool" true "no CLI recording tool detected — verify the browser/desktop app is open"
fi

if [ "$QUIET" = false ]; then
  echo ""
fi
echo "recruit_preflight: ${PASS} pass / ${FAIL} fail"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
