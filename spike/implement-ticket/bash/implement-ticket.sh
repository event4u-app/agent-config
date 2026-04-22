#!/usr/bin/env bash
# Phase 0 spike — Bash prototype for the /implement-ticket orchestrator.
# Linear dispatcher over 8 mock steps. State = JSON file. Step outcomes
# via exit codes (0 success, 10 blocked, 20 partial).
#
# Throwaway — lives only on the spike branch. Not shipped.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
STEPS_DIR="$SCRIPT_DIR/steps"
LOG_DIR="$REPO_ROOT/agents/logs/implement-ticket"

RC_SUCCESS=0
RC_BLOCKED=10
RC_PARTIAL=20

STEPS=(refine memory analyze plan implement test verify report)

die() { echo "❌ $*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: $0 <ticket-yaml>

Runs the Bash dispatcher over the 8 spike steps. Emits one JSON line
into $LOG_DIR/metrics.jsonl and prints the delivery report to stdout.
EOF
}

[[ $# -eq 1 ]] || { usage; exit 2; }
TICKET_YAML="$1"
[[ -f "$TICKET_YAML" ]] || die "Ticket not found: $TICKET_YAML"

# YAML → JSON via yq (external dependency, idiomatic for shell).
yaml_to_json() { yq -o=json '.' "$1"; }

# Timer helper (ms since epoch) — perl is preinstalled on macOS/Linux,
# avoids the ~30ms python-interpreter boot per call.
now_ms() { perl -MTime::HiRes -e 'printf "%d\n", Time::HiRes::time()*1000'; }

BOOT_START=$(now_ms)

# Load ticket, init DeliveryState.
TICKET_JSON=$(yaml_to_json "$TICKET_YAML")
STATE_FILE=$(mktemp -t implement-ticket.XXXXXX.json)
trap 'rm -f "$STATE_FILE"' EXIT

jq -n --argjson t "$TICKET_JSON" '{
  ticket: $t,
  persona: ($t.persona_hint // "senior-engineer"),
  memory: [],
  plan: null,
  changes: [],
  tests: null,
  verify: null,
  outcomes: {},
  questions: [],
  report: null
}' > "$STATE_FILE"

DISPATCH_START=$(now_ms)
BOOT_MS=$((DISPATCH_START - BOOT_START))

FINAL="success"
BLOCK_STEP=""

# Linear dispatch.
for step in "${STEPS[@]}"; do
  handler="$STEPS_DIR/${step}.sh"
  [[ -x "$handler" ]] || die "Missing step handler: $handler"

  set +e
  "$handler" "$STATE_FILE"
  rc=$?
  set -e

  case "$rc" in
    "$RC_SUCCESS")
      jq --arg s "$step" '.outcomes[$s] = "success"' "$STATE_FILE" > "$STATE_FILE.tmp"
      mv "$STATE_FILE.tmp" "$STATE_FILE"
      ;;
    "$RC_BLOCKED")
      jq --arg s "$step" '.outcomes[$s] = "blocked"' "$STATE_FILE" > "$STATE_FILE.tmp"
      mv "$STATE_FILE.tmp" "$STATE_FILE"
      FINAL="blocked"
      BLOCK_STEP="$step"
      break
      ;;
    "$RC_PARTIAL")
      jq --arg s "$step" '.outcomes[$s] = "partial"' "$STATE_FILE" > "$STATE_FILE.tmp"
      mv "$STATE_FILE.tmp" "$STATE_FILE"
      FINAL="partial"
      break
      ;;
    *)
      die "Step '$step' returned unknown exit code: $rc"
      ;;
  esac
done

END_MS=$(now_ms)
TOTAL_MS=$((END_MS - BOOT_START))

# Render report (minimal, per implement-ticket-flow.md schema).
echo "---"
FINAL_UPPER=$(echo "$FINAL" | tr '[:lower:]' '[:upper:]')
echo "# Delivery report — $FINAL_UPPER"
echo
echo "- Ticket: $(jq -r '.ticket.id + " — " + .ticket.title' "$STATE_FILE")"
echo "- Persona: $(jq -r '.persona' "$STATE_FILE")"
echo "- Final: $FINAL${BLOCK_STEP:+ (blocked at: $BLOCK_STEP)}"
echo "- Outcomes: $(jq -c '.outcomes' "$STATE_FILE")"
if [[ "$FINAL" = "blocked" ]]; then
  echo "- Questions:"
  jq -r '.questions[] | "  > " + .' "$STATE_FILE"
fi
echo "---"

# Metrics emission (Q38 decided — JSON lines into agents/logs/implement-ticket/).
mkdir -p "$LOG_DIR"
printf '{"runtime":"bash","ticket":%s,"final":"%s","boot_ms":%d,"total_ms":%d,"outcomes":%s}\n' \
  "$(jq -c '.ticket.id' "$STATE_FILE")" \
  "$FINAL" \
  "$BOOT_MS" \
  "$TOTAL_MS" \
  "$(jq -c '.outcomes' "$STATE_FILE")" \
  >> "$LOG_DIR/metrics.jsonl"

# Exit code mirrors final outcome so callers can chain.
case "$FINAL" in
  success) exit 0 ;;
  partial) exit $RC_PARTIAL ;;
  blocked) exit $RC_BLOCKED ;;
esac
