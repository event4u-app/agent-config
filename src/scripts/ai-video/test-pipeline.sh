#!/usr/bin/env bash
# test-pipeline.sh — offline smoke test for /video:* against
# agents/reference/ai-video/examples/banana-arc/. Dry-run only; no network.
#
# Asserts (per agents/roadmaps/ai-video-pipeline.md Phase 6 Step 3):
#   1. parse-blueprint.sh output matches the committed expected.json
#      per scene (3 scenes, 3 tiers).
#   2. character.json descriptor tokens (silhouette, palette, wardrobe,
#      prop) appear verbatim in each scene's prompt.subject — the
#      load-bearing character-lock substring assertion.
#   3. audio.* branching is correct: scene 2 → enable_native_audio=true,
#      scenes 1+3 → false.
#   4. native-audio-capable adapter (gemini-veo) advertises capability
#      audio=native; non-audio adapter (openai-images) advertises
#      audio=none; stitch.sh sees audio_embedded per scene.
#   5. stitch.sh dry-run returns the committed manifest's stitch_output
#      path without invoking ffmpeg or any network.
#   6. visual regression: each scene's locked.png is non-empty + has
#      PNG magic; pairwise NCC ≥ 0.95 when `compare` is available.
#      When unavailable, asserts byte-identity (the three frames are
#      committed identical for the offline path).
#   7. end_image refusal: an adapter handed `end_image` for a model whose
#      model-capabilities entry answers `end_frame: null` exits non-zero
#      and names the model — it never drops the image (adapter-contract.md
#      § end_image, exit 12).
#
# Exit 0 = all assertions pass; 1 = at least one failure (counted +
# summarized at the end).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROJECT="$ROOT/agents/reference/ai-video/examples/banana-arc"

PASS=0
FAIL=0
FAILS=""

ok()   { PASS=$((PASS+1)); printf '  ✅  %s\n' "$1"; }
fail() { FAIL=$((FAIL+1)); FAILS="$FAILS\n  ❌  $1"; printf '  ❌  %s\n' "$1"; }

require() {
  if command -v "$1" >/dev/null 2>&1; then return 0; fi
  fail "required tool missing: $1"
  return 1
}

require jq || exit 1

printf '\n== test-pipeline.sh — banana-arc golden run (offline) ==\n\n'

# ---------------------------------------------------------------- 1
printf '[1/8] parse-blueprint vs. expected.json\n'
SCENES="01-simple 02-dialogue-native-audio 03-edge-duration"
for s in $SCENES; do
  actual="$(bash "$ROOT/src/scripts/ai-video/lib/parse-blueprint.sh" "$PROJECT/scenes/$s/blueprint.txt" 2>/dev/null \
    | jq -S . 2>/dev/null || true)"
  expected="$(jq -S . "$PROJECT/scenes/$s/expected.json" 2>/dev/null || true)"
  if [ -z "$actual" ]; then
    fail "$s: parse-blueprint produced no output"
  elif [ "$actual" = "$expected" ]; then
    ok "$s: parse-blueprint matches expected.json"
  else
    fail "$s: parse-blueprint mismatch (diff actual vs. expected.json)"
  fi
done

# ---------------------------------------------------------------- 2
printf '\n[2/8] character.json descriptors verbatim in prompt.subject\n'
SILHOUETTE="$(jq -r '.characters[0].silhouette' "$PROJECT/character.json")"
PALETTE="$(jq -r '.characters[0].palette'    "$PROJECT/character.json")"
WARDROBE="$(jq -r '.characters[0].wardrobe'  "$PROJECT/character.json")"
PROP="$(jq -r '.characters[0].prop'          "$PROJECT/character.json")"

for s in $SCENES; do
  subj="$(jq -r '.prompt.subject' "$PROJECT/scenes/$s/expected.json")"
  miss=""
  case "$subj" in *"$SILHOUETTE"*) :;; *) miss="$miss silhouette";; esac
  case "$subj" in *"$PALETTE"*)    :;; *) miss="$miss palette";; esac
  case "$subj" in *"$WARDROBE"*)   :;; *) miss="$miss wardrobe";; esac
  case "$subj" in *"$PROP"*)       :;; *) miss="$miss prop";; esac
  if [ -z "$miss" ]; then
    ok "$s: silhouette + palette + wardrobe + prop verbatim in prompt.subject"
  else
    fail "$s: missing verbatim tokens in prompt.subject:$miss"
  fi
done

# ---------------------------------------------------------------- 3
printf '\n[3/8] audio.* branching matches manifest\n'
for entry in 01-simple:false 02-dialogue-native-audio:true 03-edge-duration:false; do
  s="${entry%%:*}"
  want="${entry##*:}"
  got="$(jq -r '.audio.enable_native_audio' "$PROJECT/scenes/$s/expected.json")"
  manifest_got="$(jq -r --arg id "$s" '.scenes[] | select(.id==$id) | .audio_embedded' "$PROJECT/manifest.json")"
  if [ "$got" = "$want" ] && [ "$manifest_got" = "$want" ]; then
    ok "$s: enable_native_audio=$got, manifest.audio_embedded=$manifest_got"
  else
    fail "$s: audio branching drift (expected=$want, blueprint=$got, manifest=$manifest_got)"
  fi
done

# ---------------------------------------------------------------- 4
printf '\n[4/8] adapter capability declarations\n'
declare_caps() {
  local adapter="$1"; local expected="$2"
  local out got
  out="$(AIV_DRYRUN=true bash "$ROOT/src/scripts/ai-video/adapters/$adapter.sh" capability 2>/dev/null || true)"
  got="$(printf '%s' "$out" | jq -r '.audio // empty' 2>/dev/null || true)"
  if [ "$got" = "$expected" ]; then
    ok "$adapter: capability.audio=$got"
  else
    fail "$adapter: capability mismatch (want audio=$expected, got: ${got:-<unparseable: $out>})"
  fi
}
declare_caps gemini-veo    "native"
declare_caps openai-images "none"
declare_caps sora          "native"
declare_caps kling         "none"

# ---------------------------------------------------------------- 5
printf '\n[5/8] stitch.sh dry-run returns manifest output path\n'
STITCH_OUT="$(jq -r '.stitch_output' "$PROJECT/manifest.json")"
stitch_log="$(AIV_DRYRUN=true bash "$ROOT/src/scripts/ai-video/stitch.sh" \
  "$PROJECT/manifest.json" "$PROJECT/$STITCH_OUT" 2>&1 || true)"
case "$stitch_log" in
  *"$STITCH_OUT"*) ok   "stitch.sh dry-run referenced $STITCH_OUT";;
  *)               fail "stitch.sh dry-run did not reference $STITCH_OUT (log: $stitch_log)";;
esac

# ---------------------------------------------------------------- 6
printf '\n[6/8] visual regression (locked.png pairwise)\n'
PNG_MAGIC="$(printf '\x89PNG\r\n\x1a\n')"
prev=""
have_compare=0
command -v compare >/dev/null 2>&1 && have_compare=1
for s in $SCENES; do
  f="$PROJECT/scenes/$s/fixtures/frames/locked.png"
  if [ ! -s "$f" ]; then
    fail "$s: locked.png missing or empty"
    continue
  fi
  head -c 8 "$f" | od -An -c | tr -d ' \n' | grep -q '211PNG' \
    && ok "$s: locked.png is a valid PNG ($(wc -c < "$f" | tr -d ' ') bytes)" \
    || fail "$s: locked.png lacks PNG magic"
  if [ -n "$prev" ]; then
    if [ "$have_compare" -eq 1 ]; then
      ncc="$(compare -metric NCC "$prev" "$f" null: 2>&1 || true)"
      awk_ok="$(awk -v v="$ncc" 'BEGIN { exit !(v+0 >= 0.95) }' && echo yes || echo no)"
      if [ "$awk_ok" = "yes" ]; then
        ok "$s: NCC vs. previous = $ncc (≥ 0.95)"
      else
        fail "$s: NCC vs. previous = $ncc (< 0.95)"
      fi
    else
      if cmp -s "$prev" "$f"; then
        ok "$s: byte-identical to previous (compare unavailable; offline fallback)"
      else
        fail "$s: differs from previous frame and compare is unavailable"
      fi
    fi
  fi
  prev="$f"
done

# ---------------------------------------------------------------- 7
printf '\n[7/8] end_image is refused, never dropped\n'
END_ADAPTER="kling"
END_MODEL="kling-v2-master"
END_MANIFEST="$ROOT/src/scripts/ai-video/lib/model-capabilities/$END_ADAPTER.json"

# Precondition: the entry must actually answer end_frame:null, or this case
# proves nothing. A probed `true` here would make the refusal wrong, not this
# assertion stale — so it is checked, not assumed.
end_declared="$(jq -r --arg m "$END_MODEL" \
  '.models[$m] // {} | .end_frame | if . == null then "null" else tostring end' \
  "$END_MANIFEST" 2>/dev/null || echo missing)"
if [ "$end_declared" = "null" ]; then
  ok "$END_ADAPTER/$END_MODEL declares end_frame=null (unknown)"
else
  fail "$END_ADAPTER/$END_MODEL declares end_frame=$end_declared — expected null for this case"
fi

end_stdin='{"prompt":{"subject":"a lone figure","action":"turns toward the door"},"duration":5,"end_image":"/tmp/aiv-end-frame.png"}'
end_out="$(printf '%s' "$end_stdin" \
  | AIV_DRYRUN=true AIV_MODEL="$END_MODEL" \
    bash "$ROOT/src/scripts/ai-video/adapters/$END_ADAPTER.sh" submit 2>&1)"
end_rc=$?

if [ "$end_rc" -eq 0 ]; then
  fail "$END_ADAPTER: end_image was accepted (exit 0) — the image was dropped silently"
else
  case "$end_out" in
    *"$END_MODEL"*end_frame*|*end_frame*"$END_MODEL"*)
      ok "$END_ADAPTER: end_image refused with exit $end_rc, naming $END_MODEL and end_frame";;
    *)
      fail "$END_ADAPTER: exit $end_rc but the message names neither the model nor the field (got: $end_out)";;
  esac
fi

# ---------------------------------------------------------------- 8
printf '\n[8/8] cost calibration prints modeled-vs-charged and does not re-confirm on null\n'
CAL_PROJECT="$(mktemp -d -t aiv-cal-XXXXXX)"
mkdir -p "$CAL_PROJECT/scenes/0001"
printf '{"duration":5}\n' > "$CAL_PROJECT/scenes/0001/prompt.json"
CAL_ADAPTER="fal"
CAL_MODEL="fal-ai/ltx-2/text-to-video"

# No cost.json: nothing has been charged. This is the dry-run shape, and it is
# the case that matters most — `charged: null` must extrapolate nothing and must
# NOT halt, because treating an absent charge as 0 would make every future
# estimate quietly cheaper.
cal_out="$(bash "$ROOT/src/scripts/ai-video/lib/calibrate-cost.sh" \
  "$CAL_PROJECT" 0001 --adapter "$CAL_ADAPTER" --model "$CAL_MODEL" \
  --scenes 4 --no-append 2>&1)" && cal_rc=0 || cal_rc=$?

case "$cal_out" in
  *"modeled \$"*"charged null"*) ok "calibration line prints modeled vs charged with charged: null" ;;
  *) fail "calibration line missing or malformed (got: $cal_out)" ;;
esac
if [ "$cal_rc" -eq 0 ]; then
  ok "charged: null does not re-confirm (exit 0)"
else
  fail "charged: null re-confirmed with exit $cal_rc — an absent charge is not an overrun"
fi

# Sensitivity: the halt must actually fire when a charge genuinely overruns, or
# the exit-0 assertion above would pass against a script that never halts.
printf '{"charged_usd":1.60}\n' > "$CAL_PROJECT/scenes/0001/cost.json"
cal_over="$(bash "$ROOT/src/scripts/ai-video/lib/calibrate-cost.sh" \
  "$CAL_PROJECT" 0001 --adapter "$CAL_ADAPTER" --model "$CAL_MODEL" \
  --scenes 4 --no-append 2>&1)" && cal_over_rc=0 || cal_over_rc=$?
if [ "$cal_over_rc" -eq 13 ]; then
  ok "a charge over the tolerance halts with exit 13 for re-confirmation"
else
  fail "an overrun exited $cal_over_rc, expected 13 (got: $cal_over)"
fi
rm -rf "$CAL_PROJECT"

# ----------------------------------------------------------------
printf '\n----------------\nresult: %d passed · %d failed\n' "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf '%b\n' "$FAILS"
  exit 1
fi
exit 0
