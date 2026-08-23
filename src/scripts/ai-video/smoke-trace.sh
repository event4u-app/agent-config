#!/usr/bin/env bash
# smoke-trace.sh — capture an adapter smoke trace (positioning Phase 2, turnkey harness).
#
# Runs an adapter's contract round-trip and records a structured trace under
# agents/reference/ai-video/smoke-traces/. Two modes:
#
#   (default) DRY-RUN  — calls the adapter's `dry-run` subcommand (deterministic
#                        fixture, NO network, NO spend). Proves the harness +
#                        validates the v2 stdout shape + the trust boundary on the
#                        returned artifact path. The trace is marked mode=dry-run
#                        and is NOT a real validation — it is plumbing proof.
#
#   --live             — calls the real submit -> poll -> fetch round-trip
#                        (AIV_DRYRUN=false). Requires a provider key in
#                        agents/.ai-video.xml and REAL SPEND — this is the
#                        maintainer's Hard-Floor step (non-destructive-by-default).
#                        Stub adapters that are not live-wired record an honest
#                        "live not wired" failure instead of a trace.
#
# Usage:
#   bash src/scripts/ai-video/smoke-trace.sh --provider <id> [--live] [--out <dir>]
#   bash src/scripts/ai-video/smoke-trace.sh index   [--traces <dir>] [--out <file>]
#   bash src/scripts/ai-video/smoke-trace.sh assumed <adapter>
#
# Exit: 0 = trace captured (dry-run plumbing OK, or live success),
#       non-zero = adapter/harness error (recorded in the trace + stderr).
#
# Subcommand `index` — the reviewer-reachable projection of the local traces.
#   The raw traces are deliberately local-only (commit d7f5d5d3c, 2026-06-10):
#   they carry request bodies, provider response bodies and signed URLs, and
#   `git ls-files` over the trace path returns 0. That decision stands. What it
#   left broken is that a reviewer holding a clone could not check an adapter's
#   `# Lifecycle: stable` claim at all. `index` fixes exactly that, and nothing
#   else: it emits a FIVE-FIELD row per trace — provider, trace_id,
#   captured_at, model, sha256 — and copies no trace content whatsoever. The
#   allowlist is the security property, not a formatting choice: exclusion by
#   construction, never a redaction pass over a body that might hide a secret
#   the scrub did not know about (`domain-safety-pii` § Surface 2 states the
#   preference; this is that preference applied).
#
#   `model` is the FILESYSTEM-SAFE SLUG the capture path wrote into the
#   filename (`/` → `_`), never the provider's model id reversed back out —
#   that transformation is lossy and guessing its inverse would be a fabricated
#   field. Consumers match by applying the same forward substitution.
#
#   An absent trace directory is a REFUSAL, not an empty index: a zero-row
#   index is indistinguishable from "no evidence exists", and writing one would
#   turn a missing input into a published claim.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
# Adapters live per-domain under scripts/<domain>/adapters/; the shared
# substrate (scripts/media/lib) is domain-neutral, so the harness resolves a
# provider from any media domain (ai-video, ai-image, …).
ADAPTER_DIRS=(
  "${ROOT}/src/scripts/ai-video/adapters"
  "${ROOT}/src/scripts/ai-image/adapters"
)
# shellcheck source=/dev/null
. "${ROOT}/src/scripts/media/lib/adapter-common.sh"

# --- Subcommands -------------------------------------------------------------
# Dispatched before the flag parser so the capture path below is unchanged for
# every caller that does not name a subcommand.

_st_sha256() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    echo "smoke-trace: need shasum or sha256sum" >&2; exit 3
  fi
}

# Recover the model slug from a trace filename, given the provider.
# Layout written by the capture path above:
#   <provider>[-<model_slug>]-<mode>-<TS>.json      mode = live | dry-run
# Strip from the right (TS, then mode), then the provider prefix; whatever is
# left is the slug, and an empty remainder means the trace named no model.
_st_model_slug() {
  local stem="$1" provider="$2" rest
  rest="$(printf '%s' "${stem}" | sed -E 's/-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z$//')"
  rest="$(printf '%s' "${rest}" | sed -E 's/-(live|dry-run)$//')"
  case "${rest}" in
    "${provider}") printf '' ;;
    "${provider}-"*) printf '%s' "${rest#"${provider}-"}" ;;
    *) printf '' ;;
  esac
}

_st_index() {
  local traces_dir="${ROOT}/agents/reference/ai-video/smoke-traces"
  local out_file="${ROOT}/agents/evidence/ai-video/trace-index.json"
  while [ $# -gt 0 ]; do
    case "$1" in
      --traces) traces_dir="${2:-}"; shift 2 ;;
      --out)    out_file="${2:-}"; shift 2 ;;
      *) echo "smoke-trace index: unknown arg '$1'" >&2; exit 2 ;;
    esac
  done
  command -v jq >/dev/null 2>&1 || { echo "smoke-trace: jq required" >&2; exit 3; }
  [ -d "${traces_dir}" ] || {
    echo "smoke-trace index: trace directory not found: ${traces_dir}" >&2
    echo "smoke-trace index: refusing to write an empty index — a zero-row index reads as 'no evidence exists', which is a different claim from 'the traces are not on this disk'." >&2
    exit 7
  }

  local rows="[]" f stem provider captured slug model_json sha
  for f in "${traces_dir}"/*.json; do
    [ -f "${f}" ] || continue
    stem="$(basename "${f}" .json)"
    provider="$(jq -r '.provider // empty' "${f}" 2>/dev/null || true)"
    captured="$(jq -r '.captured_utc // empty' "${f}" 2>/dev/null || true)"
    if [ -z "${provider}" ] || [ -z "${captured}" ]; then
      echo "smoke-trace index: skipping ${stem} (no .provider/.captured_utc — not a trace)" >&2
      continue
    fi
    slug="$(_st_model_slug "${stem}" "${provider}")"
    if [ -n "${slug}" ]; then
      model_json="$(jq -nc --arg m "${slug}" '$m')"
    else
      model_json="null"
    fi
    sha="$(_st_sha256 "${f}")"
    rows="$(printf '%s' "${rows}" | jq -c \
      --arg p "${provider}" --arg t "${stem}" --arg c "${captured}" \
      --argjson m "${model_json}" --arg s "${sha}" \
      '. + [{provider:$p, trace_id:$t, captured_at:$c, model:$m, sha256:$s}]')"
  done

  mkdir -p "$(dirname "${out_file}")"
  # Sorted by trace_id so a regeneration is byte-identical and a diff is real.
  printf '%s' "${rows}" | jq --sort-keys 'sort_by(.trace_id)' > "${out_file}"
  printf 'smoke-trace index: %s rows -> %s\n' \
    "$(jq 'length' "${out_file}")" "${out_file#"${ROOT}/"}" >&2
}

# `assumed` — every ASSUMED-tagged field in an adapter, with its line. A field
# stays ASSUMED until a live trace confirms it; this makes the count auditable
# instead of a number somebody has to re-grep by hand.
#
# `--all` reports `<domain>\t<adapter>\t<count>` and a total. `--domain
# <ai-video|ai-image>` narrows it, and the narrowing is not cosmetic: the
# ai-image adapters carry one ASSUMED tag each and belong to a different
# adapter population than the video set, so a single undifferentiated total
# answers no question anybody actually asks. (Measured 2026-08-23: ai-video 21
# across 7 adapters, ai-image 4 across 4, 25 in all.)
_st_assumed() {
  local target="${1:-}" want_domain="" d f found="" domain
  shift || true
  while [ $# -gt 0 ]; do
    case "$1" in
      --domain) want_domain="${2:-}"; shift 2 ;;
      *) echo "smoke-trace assumed: unknown arg '$1'" >&2; exit 2 ;;
    esac
  done
  [ -n "${target}" ] || { echo "usage: smoke-trace.sh assumed <adapter|--all> [--domain <id>]" >&2; exit 2; }
  if [ "${target}" = "--all" ]; then
    local total=0 n
    for d in "${ADAPTER_DIRS[@]}"; do
      [ -d "${d}" ] || continue
      domain="$(basename "$(dirname "${d}")")"
      [ -z "${want_domain}" ] || [ "${want_domain}" = "${domain}" ] || continue
      for f in "${d}"/*.sh; do
        [ -f "${f}" ] || continue
        n="$(grep -c 'ASSUMED' "${f}" 2>/dev/null || true)"
        [ -n "${n}" ] || n=0
        [ "${n}" -gt 0 ] || continue
        printf '%s\t%s\t%s\n' "${domain}" "$(basename "${f}" .sh)" "${n}"
        total=$((total + n))
      done
    done
    printf 'total\t%s\n' "${total}"
    return 0
  fi
  for d in "${ADAPTER_DIRS[@]}"; do
    [ -f "${d}/${target}.sh" ] && { found="${d}/${target}.sh"; break; }
  done
  [ -n "${found}" ] || { echo "smoke-trace assumed: no adapter for '${target}'" >&2; exit 2; }
  grep -n 'ASSUMED' "${found}" || true
}

# --- Image / video similarity primitives ------------------------------------
# ffmpeg's psnr and ssim filters, parsed to one number on stdout. Split out so
# the threshold logic is testable on two PNGs without any provider call.
#
# `inf` is a REAL answer and is printed as `inf`: two byte-identical frames have
# no error to measure. Mapping it to a large finite number would make an exact
# match indistinguishable from a very good one, and every caller here wants the
# distinction.

_st_need_ffmpeg() {
  command -v ffmpeg >/dev/null 2>&1 || { echo "smoke-trace: ffmpeg required for this subcommand" >&2; exit 3; }
}

# _st_psnr <ref> <cmp>  -> average PSNR in dB, or `inf`
_st_psnr() {
  local ref="$1" cmp="$2" out
  [ -r "${ref}" ] || { echo "smoke-trace psnr: cannot read ${ref}" >&2; exit 7; }
  [ -r "${cmp}" ] || { echo "smoke-trace psnr: cannot read ${cmp}" >&2; exit 7; }
  out="$(ffmpeg -hide_banner -nostdin -i "${ref}" -i "${cmp}" -lavfi psnr -f null - 2>&1 \
    | sed -nE 's/.*PSNR .*average:([0-9.]+|inf).*/\1/p' | tail -1)"
  [ -n "${out}" ] || { echo "smoke-trace psnr: ffmpeg produced no PSNR line (mismatched dimensions?)" >&2; exit 8; }
  printf '%s' "${out}"
}

# _st_ssim <ref> <cmp>  -> All-channel SSIM in 0..1, or `inf` never (SSIM is bounded)
_st_ssim() {
  local ref="$1" cmp="$2" out
  [ -r "${ref}" ] || { echo "smoke-trace ssim: cannot read ${ref}" >&2; exit 7; }
  [ -r "${cmp}" ] || { echo "smoke-trace ssim: cannot read ${cmp}" >&2; exit 7; }
  out="$(ffmpeg -hide_banner -nostdin -i "${ref}" -i "${cmp}" -lavfi ssim -f null - 2>&1 \
    | sed -nE 's/.*SSIM .*All:([0-9.]+).*/\1/p' | tail -1)"
  [ -n "${out}" ] || { echo "smoke-trace ssim: ffmpeg produced no SSIM line (mismatched dimensions?)" >&2; exit 8; }
  printf '%s' "${out}"
}

# Numeric comparison that treats `inf` as above every threshold.
_st_ge() {
  local value="$1" threshold="$2"
  [ "${value}" = "inf" ] && return 0
  node -e 'process.exit(Number(process.argv[1]) >= Number(process.argv[2]) ? 0 : 1)' "${value}" "${threshold}"
}

# The frame-0 identity threshold. 30 dB is the roadmap's stated number and is a
# STATED DEFAULT, not a measured optimum: it asks "is frame 0 the input still,
# modulo codec noise", which is a different and much easier question than seam
# quality — so the "PSNR is the wrong metric for seams" caveat does not transfer
# here. Revisit-if a model passes at 30 dB while a human says frame 0 is a
# different image, or fails at 30 dB while a human says it is the same one.
ST_FRAME0_PSNR_MIN="${AIV_FRAME0_PSNR_MIN:-30}"

# psnr / ssim / frame0-verdict — the testable primitives.
_st_metric() {
  local kind="$1"; shift
  _st_need_ffmpeg
  case "${kind}" in
    psnr) _st_psnr "$@"; printf '\n' ;;
    ssim) _st_ssim "$@"; printf '\n' ;;
    frame0)
      local v; v="$(_st_psnr "$@")"
      if _st_ge "${v}" "${ST_FRAME0_PSNR_MIN}"; then
        printf '{"psnr_frame0":"%s","threshold":%s,"start_frame":true}\n' "${v}" "${ST_FRAME0_PSNR_MIN}"
      else
        printf '{"psnr_frame0":"%s","threshold":%s,"start_frame":false}\n' "${v}" "${ST_FRAME0_PSNR_MIN}"
      fi
      ;;
    *) echo "smoke-trace: unknown metric '${kind}'" >&2; exit 2 ;;
  esac
}

# `seam-score <a.mp4> <b.mp4>` — the diagnostic Phase 4 measures with (4.2).
# The LAST frame of a and the FIRST frame of b are the boundary pair a viewer
# actually sees across a cut, so those are the two frames scored. Both metrics
# are emitted because the pre-registered question is which of them (if either)
# tracks human judgement — picking one here would answer the question the
# falsifier exists to ask.
_st_seam_score() {
  local a="${1:-}" b="${2:-}" work last first
  [ -n "${a}" ] && [ -n "${b}" ] || { echo "usage: smoke-trace.sh seam-score <a.mp4> <b.mp4>" >&2; exit 2; }
  _st_need_ffmpeg
  [ -r "${a}" ] || { echo "smoke-trace seam-score: cannot read ${a}" >&2; exit 7; }
  [ -r "${b}" ] || { echo "smoke-trace seam-score: cannot read ${b}" >&2; exit 7; }
  work="$(mktemp -d -t aiv-seam-XXXXXX)"
  trap 'rm -rf "${work}"' RETURN
  last="${work}/last.png"
  first="${work}/first.png"
  # -sseof seeks from the end; 0.15 s back lands inside the final GOP on every
  # frame rate this pipeline emits, and -frames:v 1 takes the first frame after
  # the seek rather than a decoded-but-discarded one.
  ffmpeg -hide_banner -loglevel error -nostdin -y -sseof -0.15 -i "${a}" -frames:v 1 -update 1 "${last}" \
    || { echo "smoke-trace seam-score: could not extract the last frame of ${a}" >&2; exit 8; }
  ffmpeg -hide_banner -loglevel error -nostdin -y -i "${b}" -frames:v 1 -update 1 "${first}" \
    || { echo "smoke-trace seam-score: could not extract the first frame of ${b}" >&2; exit 8; }
  printf '{"a":"%s","b":"%s","psnr":"%s","ssim":"%s","note":"diagnostic only — no threshold is a gate until the falsifier decides one (agents/evidence/analysis/seam-score-falsifier.md)"}\n' \
    "${a}" "${b}" "$(_st_psnr "${last}" "${first}")" "$(_st_ssim "${last}" "${first}")"
}

# `probe-frame-lock <adapter> <model>` — does this model actually accept a start
# frame, and does the rendered clip's frame 0 come back as that frame?
#
# COSTS MONEY. Guarded by the same AIV_DRYRUN default as every other live path:
# without an explicit AIV_DRYRUN=false it prints the plan and the estimate and
# exits 0 without submitting. The end-frame side deliberately records NO
# pass/fail number: whether a clip ENDS on a given composition is a judgement
# about composition, not an identity check, and a dB figure there would be a
# fabricated verdict wearing a measurement's clothes — it stores the extracted
# end frame beside the target for a human instead.
_st_probe_frame_lock() {
  local adapter_id="${1:-}" model="${2:-}" still="" end_still="" out_dir=""
  shift 2 2>/dev/null || true
  while [ $# -gt 0 ]; do
    case "$1" in
      --still)     still="${2:-}"; shift 2 ;;
      --end-still) end_still="${2:-}"; shift 2 ;;
      --out)       out_dir="${2:-}"; shift 2 ;;
      *) echo "smoke-trace probe-frame-lock: unknown arg '$1'" >&2; exit 2 ;;
    esac
  done
  [ -n "${adapter_id}" ] && [ -n "${model}" ] \
    || { echo "usage: smoke-trace.sh probe-frame-lock <adapter> <model> [--still <png>] [--end-still <png>] [--out <dir>]" >&2; exit 2; }

  local adapter=""
  for d in "${ADAPTER_DIRS[@]}"; do
    [ -f "${d}/${adapter_id}.sh" ] && { adapter="${d}/${adapter_id}.sh"; break; }
  done
  [ -n "${adapter}" ] || { echo "smoke-trace probe-frame-lock: no adapter for '${adapter_id}'" >&2; exit 2; }

  local manifest="${ROOT}/src/scripts/ai-video/lib/model-capabilities/${adapter_id}.json"
  local min_dur cost aspect
  min_dur="$(jq -r --arg m "${model}" '.models[$m].min_duration // empty' "${manifest}" 2>/dev/null || true)"
  cost="$(jq -r --arg m "${model}" '.models[$m].cost_per_second_usd // empty' "${manifest}" 2>/dev/null || true)"
  aspect="$(jq -r --arg m "${model}" '.models[$m].aspect[0] // "16:9"' "${manifest}" 2>/dev/null || printf '16:9')"
  [ -n "${min_dur}" ] || min_dur=4
  local est="unknown"
  if [ -n "${cost}" ] && [ "${cost}" != "null" ]; then
    est="$(node -e 'process.stdout.write(String(Number(process.argv[1]) * Number(process.argv[2])))' "${cost}" "${min_dur}")"
  fi

  local dryrun="${AIV_DRYRUN:-true}"
  case "${dryrun}" in false|FALSE|0|no|NO) dryrun=0 ;; *) dryrun=1 ;; esac

  if [ "${dryrun}" -eq 1 ]; then
    jq -nc --arg a "${adapter_id}" --arg m "${model}" --arg d "${min_dur}" \
      --arg asp "${aspect}" --arg est "${est}" '{
      dry_run: true, adapter: $a, model: $m, duration_s: ($d|tonumber), aspect: $asp,
      estimated_usd: $est,
      plan: "render one clip from the fixture still at the cheapest duration, extract frame 0, PSNR against the still",
      note: "NO submit performed. Set AIV_DRYRUN=false to spend. The end-frame side records the extracted end frame for a human and no pass/fail number."
    }'
    return 0
  fi

  _st_need_ffmpeg
  [ -n "${still}" ] || { echo "smoke-trace probe-frame-lock: --still <png> is required for a live probe" >&2; exit 2; }
  [ -r "${still}" ] || { echo "smoke-trace probe-frame-lock: cannot read --still ${still}" >&2; exit 7; }
  out_dir="${out_dir:-${ROOT}/agents/reference/ai-video/smoke-traces/frame-lock}"
  mkdir -p "${out_dir}"
  local stamp clip frame0
  stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
  clip="${out_dir}/${adapter_id}-$(printf '%s' "${model}" | tr '/' '_')-${stamp}.mp4"
  frame0="${clip%.mp4}-frame0.png"

  local stdin_json
  stdin_json="$(jq -nc --arg m "${model}" --arg ref "${still}" --arg asp "${aspect}" --argjson dur "${min_dur}" '{
    prompt: {style:"frame-lock probe", subject:"the supplied still, continuing",
             environment:"as in the still", action:"minimal motion", camera:"locked",
             lens:"as in the still", lighting:"as in the still", mood:"neutral"},
    duration: $dur, aspect: $asp, seed: 1, model_id: $m, ref_images: [$ref]
  } + (if $end != "" then {end_image: $end} else {} end)' --arg end "${end_still}")"

  AIV_DRYRUN=false AIV_OUT="${clip}" printf '%s' "${stdin_json}" | bash "${adapter}" run >/dev/null \
    || { echo "smoke-trace probe-frame-lock: adapter run failed for ${adapter_id}/${model}" >&2; exit 8; }
  ffmpeg -hide_banner -loglevel error -nostdin -y -i "${clip}" -frames:v 1 -update 1 "${frame0}" \
    || { echo "smoke-trace probe-frame-lock: could not extract frame 0 from ${clip}" >&2; exit 8; }

  local psnr verdict
  psnr="$(_st_psnr "${still}" "${frame0}")"
  if _st_ge "${psnr}" "${ST_FRAME0_PSNR_MIN}"; then verdict=true; else verdict=false; fi

  # Write the probed fact into the manifest. `start_frame` is set from the
  # measurement in BOTH directions — a failed probe writes `false` with the
  # measured value kept, never `null`, because "we looked and it did not hold"
  # is a different fact from "nobody looked".
  local tmp; tmp="$(mktemp)"
  jq --arg m "${model}" --argjson v "${verdict}" --arg p "${psnr}" --arg d "${stamp%T*}" '
    .models[$m].start_frame = $v
    | .models[$m].frame_lock = {probed_at: $d, psnr_frame0: $p}
  ' "${manifest}" > "${tmp}" && mv "${tmp}" "${manifest}"

  local end_note="not probed (no --end-still)"
  if [ -n "${end_still}" ]; then
    local endframe="${clip%.mp4}-endframe.png"
    ffmpeg -hide_banner -loglevel error -nostdin -y -sseof -0.15 -i "${clip}" -frames:v 1 -update 1 "${endframe}" || true
    end_note="end frame extracted to ${endframe} beside ${end_still} — composition is a human judgement, no number recorded"
  fi

  jq -nc --arg a "${adapter_id}" --arg m "${model}" --arg p "${psnr}" \
    --argjson v "${verdict}" --arg d "${stamp%T*}" --arg clip "${clip}" --arg en "${end_note}" '{
    adapter:$a, model:$m, psnr_frame0:$p, start_frame:$v, probed_at:$d, clip:$clip, end_frame_side:$en
  }'
}

# `cost-ledger append` — the ONLY sanctioned route from a charged figure back
# into a modeled one (roadmap 2.3).
#
# The gap this closes is narrow and was mis-stated before reproduction: the
# read-back already existed. `lib/resume-scan.sh` reads `cost.json .charged_usd`
# and sums it as `spent_usd`, and the from-song command writes that file after
# every live scene. What did NOT exist is any path from that number back into
# `manifest.cost_per_second_usd` — money was spent, recorded, and never read
# into the model it contradicted.
#
# `charged` is `null`, never `0`, when nothing was charged or the charge is
# unknown. A missing price and a free render are different facts, and `0` erases
# the difference in the one direction that silently lowers every future
# estimate. `--charged` accepts the literal `null` for exactly this reason.
_st_cost_ledger() {
  local sub="${1:-}"; shift || true
  local ledger="${ROOT}/agents/evidence/ai-video/cost-ledger.jsonl"
  case "${sub}" in
    append)
      local adapter="" model="" modeled="null" charged="null" note="" date_s="" out=""
      while [ $# -gt 0 ]; do
        case "$1" in
          --adapter) adapter="${2:-}"; shift 2 ;;
          --model)   model="${2:-}"; shift 2 ;;
          --modeled) modeled="${2:-null}"; shift 2 ;;
          --charged) charged="${2:-null}"; shift 2 ;;
          --note)    note="${2:-}"; shift 2 ;;
          --date)    date_s="${2:-}"; shift 2 ;;
          --ledger)  ledger="${2:-}"; shift 2 ;;
          *) echo "smoke-trace cost-ledger append: unknown arg '$1'" >&2; exit 2 ;;
        esac
      done
      [ -n "${adapter}" ] && [ -n "${model}" ] \
        || { echo "usage: smoke-trace.sh cost-ledger append --adapter <id> --model <id> [--modeled <usd>] [--charged <usd|null>] [--note <text>]" >&2; exit 2; }
      [ -n "${date_s}" ] || date_s="$(date -u +%Y-%m-%d)"
      # An empty string is NOT zero and is NOT a number: normalise it to null
      # rather than letting jq coerce it.
      [ -n "${modeled}" ] || modeled="null"
      [ -n "${charged}" ] || charged="null"
      out="$(jq -nc --arg a "${adapter}" --arg m "${model}" --arg d "${date_s}" --arg n "${note}" \
        --argjson modeled "${modeled}" --argjson charged "${charged}" '{
          adapter:$a, model:$m, modeled:$modeled, charged:$charged, date:$d
        } + (if $n == "" then {} else {note:$n} end)')" \
        || { echo "smoke-trace cost-ledger: --modeled/--charged must be a number or the literal null" >&2; exit 7; }
      mkdir -p "$(dirname "${ledger}")"
      printf '%s\n' "${out}" >> "${ledger}"
      printf '%s\n' "${out}"
      ;;
    "") echo "usage: smoke-trace.sh cost-ledger append …" >&2; exit 2 ;;
    *)  echo "smoke-trace cost-ledger: unknown subcommand '${sub}'" >&2; exit 2 ;;
  esac
}

case "${1:-}" in
  index)   shift; _st_index "$@"; exit 0 ;;
  cost-ledger) shift; _st_cost_ledger "$@"; exit 0 ;;
  assumed) shift; _st_assumed "$@"; exit 0 ;;
  psnr)    shift; _st_metric psnr "$@"; exit 0 ;;
  ssim)    shift; _st_metric ssim "$@"; exit 0 ;;
  frame0)  shift; _st_metric frame0 "$@"; exit 0 ;;
  seam-score)       shift; _st_seam_score "$@"; exit 0 ;;
  probe-frame-lock) shift; _st_probe_frame_lock "$@"; exit 0 ;;
esac
# --- end subcommands ---------------------------------------------------------

PROVIDER=""
MODE="dry-run"
MODEL=""
REF_IMAGE=""
# Comma-separated ASSUMED field names this trace confirms (0.5). Empty is the
# honest default: a capture confirms nothing until the operator names what it
# confirmed, and `[]` is what every trace written before this field existed
# would have carried.
CONFIRMS=""
OUT_DIR="${ROOT}/agents/reference/ai-video/smoke-traces"
while [ $# -gt 0 ]; do
  case "$1" in
    --provider)  PROVIDER="${2:-}"; shift 2 ;;
    --model)     MODEL="${2:-}"; shift 2 ;;
    --ref-image) REF_IMAGE="${2:-}"; shift 2 ;;
    --live)      MODE="live"; shift ;;
    --confirms)  CONFIRMS="${2:-}"; shift 2 ;;
    --out)       OUT_DIR="${2:-}"; shift 2 ;;
    *) echo "smoke-trace: unknown arg '$1'" >&2; exit 2 ;;
  esac
done
[ -n "${PROVIDER}" ] || { echo "smoke-trace: --provider <id> required" >&2; exit 2; }
ADAPTER=""
for _dir in "${ADAPTER_DIRS[@]}"; do
  [ -f "${_dir}/${PROVIDER}.sh" ] && { ADAPTER="${_dir}/${PROVIDER}.sh"; break; }
done
[ -n "${ADAPTER}" ] || { echo "smoke-trace: no adapter for '${PROVIDER}' under ${ADAPTER_DIRS[*]}" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "smoke-trace: jq required" >&2; exit 2; }

TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p "${OUT_DIR}"
# Per-model traces (multiplexer adapters) carry a filesystem-safe model slug
# in the filename so one adapter can collect traces per reachable model.
MODEL_SLUG=""
[ -n "${MODEL}" ] && MODEL_SLUG="-$(printf '%s' "${MODEL}" | tr '/' '_' | tr -cd 'A-Za-z0-9._-')"
TRACE="${OUT_DIR}/${PROVIDER}${MODEL_SLUG}-${MODE}-${TS}.json"

# Minimal valid stdin JSON (contract: prompt.* blocks mandatory). --model
# injects the optional top-level model_id key (multiplexer adapters route it;
# single-model adapters ignore unknown stdin keys per contract). --ref-image
# injects ref_images[0] for image2video adapters (e.g. higgsfield) that
# animate a still instead of generating from text alone.
STDIN_JSON="$(jq -nc --arg model "${MODEL}" --arg ref "${REF_IMAGE}" '{
  prompt: {style:"smoke-test", subject:"a red cube", environment:"white void",
           action:"rotates slowly", camera:"locked", lens:"50mm",
           lighting:"soft key", mood:"neutral"},
  duration: 2.0, aspect:"16:9", seed: 1
} + (if $model != "" then {model_id: $model} else {} end)
  + (if $ref   != "" then {ref_images: [$ref]} else {} end)')"

ms_now() { node -e 'console.log(Date.now())'; }

PHASES="[]"
SUCCESS=true
FETCH_OUT=""
LAST_OUT=""
TIER="$(grep -oE 'Lifecycle:[[:space:]]*[a-z]+' "${ADAPTER}" | head -1 | awk '{print $2}')"
[ -n "${TIER}" ] || TIER="unknown"

# run_phase NAME STDIN -- CMD...  : runs CMD with STDIN, times it, appends a
# {name,ms,exit,stdout,stderr} record to PHASES (in THIS shell — no subshell),
# and stashes stdout in LAST_OUT. Sets SUCCESS=false on non-zero exit.
run_phase() {
  local name="$1" stdin="$2"; shift 2
  local t0 t1 rc errf="/tmp/smoke_err.$$"
  t0="$(ms_now)"
  set +e; LAST_OUT="$(printf '%s' "${stdin}" | "$@" 2>"${errf}")"; rc=$?; set -e
  t1="$(ms_now)"
  PHASES="$(jq -c --arg n "${name}" --argjson ms "$((t1 - t0))" --argjson rc "${rc}" \
    --arg out "${LAST_OUT}" --arg err "$(cat "${errf}" 2>/dev/null || true)" \
    '. + [{name:$n, ms:$ms, exit:$rc, stdout:$out, stderr:$err}]' <<<"${PHASES}")"
  rm -f "${errf}"
  [ "${rc}" -eq 0 ] || SUCCESS=false
  return 0
}

if [ "${MODE}" = "dry-run" ]; then
  run_phase capability "" bash "${ADAPTER}" capability
  run_phase dry-run "${STDIN_JSON}" bash "${ADAPTER}" dry-run
  FETCH_OUT="${LAST_OUT}"
else
  export AIV_DRYRUN=false
  # Scope the adapter's artifact into a per-trace dir beside the trace JSON
  # (contract v2: unscoped adapters fall back to mktemp OUTSIDE the repo,
  # which the harness's own ROOT-scoped validation below would then reject).
  ARTIFACT_DIR="${OUT_DIR}/artifacts"
  mkdir -p "${ARTIFACT_DIR}"
  export AIV_OUT="${ARTIFACT_DIR}/${PROVIDER}-${TS}.mp4"
  run_phase submit "${STDIN_JSON}" bash "${ADAPTER}" submit
  JOB="$(jq -r '.job_id // empty' <<<"${LAST_OUT}" 2>/dev/null || true)"
  if [ -n "${JOB}" ]; then
    # Async providers render for minutes — poll quietly until done/failed or
    # AIV_SMOKE_POLL_TIMEOUT (default 600s; interval AIV_SMOKE_POLL_INTERVAL,
    # default 10s), then record ONE final poll phase with the attempt count
    # (recording every tick would bloat the trace with dozens of identical
    # "running" records).
    POLL_DEADLINE=$(( $(date +%s) + ${AIV_SMOKE_POLL_TIMEOUT:-600} ))
    POLL_ATTEMPTS=0
    POLL_ST=""
    while :; do
      POLL_OUT="$(bash "${ADAPTER}" poll "${JOB}" 2>/dev/null || true)"
      POLL_ATTEMPTS=$((POLL_ATTEMPTS + 1))
      POLL_ST="$(jq -r '.status // empty' <<<"${POLL_OUT}" 2>/dev/null || true)"
      case "${POLL_ST}" in done|failed) break ;; esac
      [ "$(date +%s)" -lt "${POLL_DEADLINE}" ] || break
      sleep "${AIV_SMOKE_POLL_INTERVAL:-10}"
    done
    run_phase "poll(final,attempts=${POLL_ATTEMPTS})" "" bash "${ADAPTER}" poll "${JOB}"
    POLL_ST="$(jq -r '.status // empty' <<<"${LAST_OUT}" 2>/dev/null || true)"
    if [ "${POLL_ST}" = "done" ]; then
      run_phase fetch "" bash "${ADAPTER}" fetch "${JOB}"
      FETCH_OUT="${LAST_OUT}"
    else
      SUCCESS=false   # timed out or provider-failed — recorded in PHASES
    fi
  elif [ -n "$(jq -r '.video_path // .image_path // empty' <<<"${LAST_OUT}" 2>/dev/null || true)" ]; then
    # Synchronous adapter (e.g. images API): submit produced the artifact
    # directly — its stdout IS the round-trip result, no poll/fetch.
    FETCH_OUT="${LAST_OUT}"
  else
    SUCCESS=false   # stub adapter (live not wired) or submit failed — recorded in PHASES
  fi
fi

# Validate the returned artifact path against the trust boundary (when present).
[ -n "${FETCH_OUT}" ] || FETCH_OUT='{}'
VIDEO_PATH="$(jq -r '.video_path // .image_path // empty' <<<"${FETCH_OUT}" 2>/dev/null | head -1 || true)"
ARTIFACT_OK="n/a"
if [ -n "${VIDEO_PATH}" ]; then
  # Subshell the validation: aiv_validate_artifact_path uses aiv_die (exit),
  # which would kill the harness BEFORE the trace is written. In live mode the
  # scope root is the per-trace artifact dir; dry-run fixtures live in ROOT.
  VALIDATE_ROOT="${ROOT}"
  [ "${MODE}" = "live" ] && [ -n "${ARTIFACT_DIR:-}" ] && VALIDATE_ROOT="${ARTIFACT_DIR}"
  if ( aiv_validate_artifact_path "${VALIDATE_ROOT}" "${VIDEO_PATH}" ) >/dev/null 2>&1; then ARTIFACT_OK=true; else ARTIFACT_OK=false; SUCCESS=false; fi
fi
# cost_estimate lives on the SUBMIT stdout (contract v2); fall back to fetch.
COST="$(jq -r 'first(.[] | select(.name=="submit") | .stdout | try fromjson | .cost_estimate | select(. != null) | tostring) // empty' <<<"${PHASES}" 2>/dev/null | head -1 || true)"
[ -n "${COST}" ] || COST="$(jq -r '.cost_estimate // "unknown"' <<<"${FETCH_OUT}" 2>/dev/null | head -1 || echo unknown)"
AUDIO_EMB="$(jq -r 'if .audio_embedded == true then "true" else "false" end' <<<"${FETCH_OUT}" 2>/dev/null | head -1 || echo false)"

NOTE="dry-run = plumbing proof (no network/spend); NOT a real validation. Run --live with a provider key for the real smoke trace."
[ "${MODE}" = "live" ] && NOTE="live round-trip against the real provider API (real spend)."

# recheck_by — a vendor capability is a dated observation, never a permanent
# fact. Endpoints have gained and lost frame conditioning inside a few weeks,
# so every trace states when its claim stops being evidence. Same idiom as
# `keep-beta-until` in docs/contracts/skill-bundled-assets.md; the window is
# ONE constant, shared with lint_adapter_tier.ts's staleness check, so the two
# cannot drift apart.
RECHECK_DAYS="${AIV_TRACE_RECHECK_DAYS:-180}"
RECHECK_BY="$(TS="${TS}" D="${RECHECK_DAYS}" node -e '
  const ts = process.env.TS;
  // Capture stamps are filesystem-safe: 2026-06-10T12-36-49Z -> ISO.
  const iso = ts.replace(/T(\d{2})-(\d{2})-(\d{2})Z$/, "T$1:$2:$3Z");
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) { process.stdout.write(""); process.exit(0); }
  t.setUTCDate(t.getUTCDate() + Number(process.env.D));
  process.stdout.write(t.toISOString().slice(0, 10));
')"

CONFIRMS_JSON="$(printf '%s' "${CONFIRMS}" | tr ',' '\n' \
  | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//' | sed '/^$/d' \
  | jq -R . | jq -sc .)"

jq -n \
  --arg provider "${PROVIDER}" --arg tier "${TIER}" --arg mode "${MODE}" \
  --arg ts "${TS}" --argjson phases "${PHASES}" \
  --arg video "${VIDEO_PATH}" --arg artifact_ok "${ARTIFACT_OK}" \
  --arg cost "${COST}" --argjson audio "${AUDIO_EMB}" \
  --argjson success "${SUCCESS}" --arg note "${NOTE}" \
  --arg recheck "${RECHECK_BY}" --argjson confirms "${CONFIRMS_JSON}" \
  '{provider:$provider, lifecycle_tier:$tier, mode:$mode, captured_utc:$ts,
    recheck_by:$recheck, success:$success, video_path:$video,
    artifact_path_validated:$artifact_ok, cost_estimate:$cost,
    audio_embedded:$audio, assumed_fields_confirmed:$confirms,
    phases:$phases, note:$note}' \
  > "${TRACE}"

echo "smoke-trace: ${MODE} ${PROVIDER} (tier=${TIER}) success=${SUCCESS} → ${TRACE#"${ROOT}/"}"
[ "${SUCCESS}" = true ]
