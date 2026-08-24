#!/usr/bin/env bash
# calibrate-cost.sh — compare the MODELED cost against what the provider
# actually CHARGED, before committing a batch.
#
# Why this exists, and why it is smaller than it first looked. The read-back
# already existed: `resume-scan.sh` reads `<project>/scenes/<id>/cost.json`
# `.charged_usd` and sums it as `spent_usd`, and the from-song command writes
# that file after every live scene. What did NOT exist was any path from that
# number back into `manifest.cost_per_second_usd` — money was spent, recorded,
# and never read into the model it contradicted. This is that path's front end.
#
# It runs at the operator-pick moment (the checkpoint the operator was already
# stopping at) rather than adding a gate of its own, so the calibration line
# appears where a human is already looking.
#
# Usage:
#   calibrate-cost.sh <project-dir> <scene-id> --adapter <id> --model <id>
#                     [--scenes <n>] [--ledger <path>] [--no-append]
#
# Output (stdout, one line):
#   calibration: modeled $<m>/s · charged $<c>/s · <delta> · extrapolated batch $<x> (modeled $<y>)
#
# `charged: null` is NOT `0`. An unpriceable or not-yet-charged scene prints
# `charged: null`, extrapolates nothing, and never re-confirms. A modeled figure
# is only ever corrected by a MEASURED one — treating null as zero would make
# every future estimate quietly cheaper, which is the one direction a costing
# error must never drift.
#
# Exit codes:
#   0   calibration printed; within tolerance (or nothing charged yet)
#   2   usage
#   3   jq missing
#   7   project/scene inputs unreadable
#   13  charged exceeds modeled by more than the tolerance — RE-CONFIRM
#       before the batch. Not a failure: a deliberate halt for a human.
set -euo pipefail

_cc_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# shellcheck source=/dev/null
. "${_cc_root}/src/scripts/media/lib/adapter-common.sh"

# The re-confirmation threshold. 25 % is the roadmap's stated number and is a
# STATED DEFAULT, not a measured optimum: it is the point past which "the model
# is roughly right" stops being a fair description. Revisit-if a provider's
# real-world variance is measured and sits above it, which would make the halt
# fire on noise rather than on drift.
CC_TOLERANCE_PCT="${AIV_CALIBRATE_TOLERANCE_PCT:-25}"

project=""; scene=""; adapter=""; model=""; scenes=""; ledger=""; append=1
[ "$#" -ge 2 ] || { printf 'calibrate-cost: usage: %s <project-dir> <scene-id> --adapter <id> --model <id> [--scenes <n>]\n' "$0" >&2; exit 2; }
project="$1"; scene="$2"; shift 2
while [ "$#" -gt 0 ]; do
  case "$1" in
    --adapter) adapter="${2:-}"; shift 2 ;;
    --model)   model="${2:-}"; shift 2 ;;
    --scenes)  scenes="${2:-}"; shift 2 ;;
    --ledger)  ledger="${2:-}"; shift 2 ;;
    --no-append) append=0; shift ;;
    *) printf "calibrate-cost: unknown arg '%s'\n" "$1" >&2; exit 2 ;;
  esac
done
[ -n "${adapter}" ] && [ -n "${model}" ] \
  || { printf 'calibrate-cost: --adapter and --model are required\n' >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { printf 'calibrate-cost: jq required\n' >&2; exit 3; }

scene_dir="${project}/scenes/${scene}"
[ -d "${scene_dir}" ] || { printf 'calibrate-cost: scene dir not readable: %s\n' "${scene_dir}" >&2; exit 7; }

# Duration: the scene's own render input, never a default. A guessed duration
# would turn a per-second comparison into a fabricated one.
duration=""
if [ -r "${scene_dir}/prompt.json" ]; then
  duration="$(jq -r '.duration // empty' "${scene_dir}/prompt.json" 2>/dev/null || true)"
fi

manifest="$(aiv_manifest_path "${adapter}")"
modeled_per_s="null"
if [ -r "${manifest}" ]; then
  modeled_per_s="$(jq -r --arg m "${model}" '.models[$m].cost_per_second_usd // "null" | tostring' "${manifest}" 2>/dev/null || printf 'null')"
fi

# The existing spend record — the same file resume-scan.sh already sums.
charged_total="null"
if [ -r "${scene_dir}/cost.json" ]; then
  charged_total="$(jq -r '.charged_usd // "null" | tostring' "${scene_dir}/cost.json" 2>/dev/null || printf 'null')"
fi

line="$(MODELED="${modeled_per_s}" CHARGED="${charged_total}" DUR="${duration}" \
  SCENES="${scenes}" TOL="${CC_TOLERANCE_PCT}" node -e '
  const num = (v) => (v === "" || v === "null" || v === undefined ? null : Number(v));
  const modeled = num(process.env.MODELED);
  const charged = num(process.env.CHARGED);
  const dur = num(process.env.DUR);
  const scenes = num(process.env.SCENES);
  const tol = Number(process.env.TOL);
  const fmt = (v) => (v === null || Number.isNaN(v) ? "null" : `$${v.toFixed(4)}`);

  // Per-second charged needs a duration. Without one the charge is real but not
  // comparable, and saying so beats dividing by a guess.
  const chargedPerS = charged !== null && dur !== null && dur > 0 ? charged / dur : null;

  let delta = "delta: n/a (nothing charged yet)";
  let reconfirm = false;
  if (modeled !== null && chargedPerS !== null) {
    if (modeled === 0) {
      delta = chargedPerS === 0 ? "+0.0 %" : "modeled 0 — any charge is a model defect";
      reconfirm = chargedPerS > 0;
    } else {
      const pct = ((chargedPerS - modeled) / modeled) * 100;
      delta = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)} %`;
      reconfirm = pct > tol;
    }
  }

  let extra = "";
  if (scenes !== null && dur !== null) {
    const m = modeled !== null ? modeled * dur * scenes : null;
    const c = chargedPerS !== null ? chargedPerS * dur * scenes : null;
    extra = ` · extrapolated batch ${fmt(c)} (modeled ${fmt(m)})`;
  }

  process.stdout.write(
    `calibration: modeled ${fmt(modeled)}/s · charged ${chargedPerS === null ? "null" : fmt(chargedPerS)}/s · ${delta}${extra}\n` +
    `RECONFIRM=${reconfirm ? "1" : "0"}\n`,
  );
')"

printf '%s\n' "${line%$'\n'RECONFIRM=*}"
reconfirm="${line##*RECONFIRM=}"

if [ "${append}" -eq 1 ]; then
  bash "${_cc_root}/src/scripts/ai-video/smoke-trace.sh" cost-ledger append \
    --adapter "${adapter}" --model "${model}" \
    --modeled "${modeled_per_s}" \
    --charged "$(printf '%s' "${line}" | sed -nE 's/.*charged (null|\$([0-9.]+))\/s.*/\2/p' | sed 's/^$/null/')" \
    --note "calibration probe at scene ${scene}" \
    ${ledger:+--ledger "${ledger}"} >/dev/null
fi

if [ "${reconfirm}" = "1" ]; then
  printf 'calibrate-cost: charged exceeds modeled by more than %s %% — RE-CONFIRM before the batch (the cap in --max-spend-usd is not a substitute: it bounds total spend, not a wrong per-second model).\n' \
    "${CC_TOLERANCE_PCT}" >&2
  exit 13
fi
exit 0
