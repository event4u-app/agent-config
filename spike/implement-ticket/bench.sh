#!/usr/bin/env bash
# Phase 0 spike — measurement harness.
#
# Runs both prototypes N times against both fixtures, captures wall-clock
# time (ms) via perl Time::HiRes, prints mean/min/median/max per combo.
#
# Throwaway — lives on the spike branch only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNS="${RUNS:-20}"
WARMUP="${WARMUP:-3}"

FIXTURES=(
  "$SCRIPT_DIR/fixtures/ticket-clean.yml"
  "$SCRIPT_DIR/fixtures/ticket-ambiguous.yml"
)
BASH_CMD=("$SCRIPT_DIR/bash/implement-ticket.sh")
PY_CMD=(python3 "$SCRIPT_DIR/python/implement_ticket.py")

# Silence the metrics log noise: point it at /dev/null for the bench run.
export LOG_DIR_OVERRIDE=""

bench() {
  local label="$1" fixture="$2"
  shift 2
  local -a cmd=("$@")

  # Warmup (discard).
  for _ in $(seq 1 "$WARMUP"); do
    "${cmd[@]}" "$fixture" >/dev/null 2>&1 || true
  done

  # Measured runs — collect wall-clock ms per invocation.
  # Child stdout/stderr → /dev/null so only perl's printf reaches us.
  local samples=()
  for _ in $(seq 1 "$RUNS"); do
    local ms
    ms=$(perl -MTime::HiRes -e '
      open(my $devnull, ">", "/dev/null") or die;
      my $t0 = Time::HiRes::time();
      my $pid = fork();
      if ($pid == 0) {
        open(STDOUT, ">&", $devnull);
        open(STDERR, ">&", $devnull);
        exec(@ARGV) or exit 127;
      }
      waitpid($pid, 0);
      my $rc = $? >> 8;
      ($rc == 0 || $rc == 10 || $rc == 20) or die "cmd failed rc=$rc";
      printf "%d\n", (Time::HiRes::time() - $t0) * 1000;
    ' "${cmd[@]}" "$fixture")
    samples+=("$ms")
  done

  # Stats via perl.
  printf "%s\n" "${samples[@]}" | perl -e '
    my @s = sort { $a <=> $b } map { chomp; $_ } <STDIN>;
    my $n = scalar @s;
    my $sum = 0; $sum += $_ for @s;
    my $mean = $sum / $n;
    my $median = $s[int($n/2)];
    printf "  %-28s  mean=%4dms  min=%4dms  median=%4dms  max=%4dms  n=%d\n",
           "'"$label"'", $mean, $s[0], $median, $s[-1], $n;
  '
}

echo "=== Phase 0 measurement ($RUNS runs, $WARMUP warmup) ==="
echo

echo "## CLEAN ticket (8 steps, success)"
bench "bash"   "${FIXTURES[0]}" "${BASH_CMD[@]}"
bench "python" "${FIXTURES[0]}" "${PY_CMD[@]}"
echo

echo "## AMBIGUOUS ticket (1 step, blocked)"
bench "bash"   "${FIXTURES[1]}" "${BASH_CMD[@]}"
bench "python" "${FIXTURES[1]}" "${PY_CMD[@]}"
echo

# Line counts — proxy for "test-writability" and maintenance cost.
echo "## Source size (lines)"
{
  echo "  bash dispatcher:  $(wc -l < "$SCRIPT_DIR/bash/implement-ticket.sh") lines"
  echo "  bash step handlers (sum):  $(wc -l "$SCRIPT_DIR"/bash/steps/*.sh | tail -1 | awk '{print $1}') lines"
  echo "  python dispatcher:         $(wc -l < "$SCRIPT_DIR/python/implement_ticket.py") lines"
  echo "  python steps + state:      $(wc -l "$SCRIPT_DIR"/python/steps.py "$SCRIPT_DIR"/python/delivery_state.py | tail -1 | awk '{print $1}') lines"
}
