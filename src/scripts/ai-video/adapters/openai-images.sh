#!/usr/bin/env bash
# openai-images.sh — image generation adapter (DALL-E / gpt-image-1).
#
# Capability: audio=none (still images only — motion handled by a
# downstream video adapter). Ref-image and seed reuse are passed
# through verbatim so character-consistency can lock a face across
# scenes by reusing the same seed.
#
# Contract: scripts/ai-video/lib/adapter-contract.md
# Provider: top-level <provider id="openai-images" kind="image"> in
# agents/.ai-video.xml.
#
# Lifecycle: experimental — structural shape conformant; no maintainer
# real-API smoke trace captured yet. See docs/contracts/provider-lifecycle.md
# for promotion criteria. The agent must surface this tier and ask
# before defaulting to this adapter.
# Encoder note: provider-specific prompt grammar comes from the
#   motion-choreographer encoder table; the scene blueprint stays
#   provider-agnostic (see adapter-contract.md § Blueprint → provider translation).

set -euo pipefail

# shellcheck source=../lib/adapter-common.sh
. "$(dirname "$0")/../lib/adapter-common.sh"

ADAPTER_ID="openai-images"

aiv_cmd_run() {
  aiv_assert_dryrun
  aiv_require_cmd curl jq
  aiv_load_provider "${ADAPTER_ID}"
  [ "$(aiv_key_status)" = "present" ] \
    || aiv_die 6 "${ADAPTER_ID}: api key missing in agents/.ai-video.xml"

  # Read contract stdin JSON; compose a single text prompt from the
  # eight prose blocks. Ref-image + seed are passed verbatim.
  local stdin_json prompt seed ref_first
  stdin_json="$(cat)"
  prompt="$(printf '%s' "${stdin_json}" | jq -r '
    [.prompt.style, .prompt.subject, .prompt.environment, .prompt.action,
     .prompt.camera, .prompt.lens, .prompt.lighting, .prompt.mood]
    | map(select(. != null and . != ""))
    | join(". ")
  ')"
  seed="$(printf '%s' "${stdin_json}" | jq -r '.seed // empty')"
  ref_first="$(printf '%s' "${stdin_json}" | jq -r '.ref_images[0] // empty')"

  [ -n "${prompt}" ] || aiv_die 7 "${ADAPTER_ID}: empty prompt (prompt.* blocks required)"

  # Images-generations API has no negative-prompt field — fold the
  # negative list into the prompt as an explicit "Avoid:" clause.
  local negative
  negative="$(printf '%s' "${stdin_json}" | jq -r '(.negative // []) | join(", ")')"
  [ -n "${negative}" ] && prompt="${prompt} Avoid: ${negative}."

  # gpt-image-1 has no seed param. Log if present.
  [ -n "${seed}" ] && printf '%s: seed=%s ignored (gpt-image-1 has no seed)\n' "${ADAPTER_ID}" "${seed}" >&2
  : "${ref_first:=}"

  # Resolve size from requested aspect (stdin .aspect overrides XML tuning).
  local aspect quality size out
  aspect="$(printf '%s' "${stdin_json}" | jq -r --arg a "${AIV_TUNING_ASPECT:-16:9}" '.aspect // $a')"
  quality="${AIV_TUNING_QUALITY:-high}"
  case "${aspect}" in
    16:9|3:2|landscape) size="1536x1024" ;;
    9:16|2:3|portrait)  size="1024x1536" ;;
    1:1|square)         size="1024x1024" ;;
    *)                  size="1536x1024" ;;
  esac

  # Output path: caller-set AIV_OUT wins; else a temp PNG.
  out="${AIV_OUT:-}"
  [ -n "${out}" ] || out="$(mktemp -t aiv-openai-XXXXXX).png"

  # Collect reference image files. When present → /v1/images/edits
  # (reference-conditioned, so the model adheres to the supplied
  # character); otherwise plain text-to-image /v1/images/generations.
  local -a ref_files=() tmp_files=()
  local r tmp
  while IFS= read -r r; do
    [ -n "${r}" ] || continue
    case "${r}" in
      http://*|https://*)
        tmp="$(mktemp -t aiv-ref-XXXXXX).png"
        curl -sS -L -o "${tmp}" "${r}" || aiv_die 8 "${ADAPTER_ID}: failed to download ref image: ${r}"
        ref_files+=("${tmp}"); tmp_files+=("${tmp}") ;;
      *)
        case "${r}" in /*) : ;; *) r="$(pwd)/${r}" ;; esac
        [ -f "${r}" ] || aiv_die 7 "${ADAPTER_ID}: ref image not found: ${r}"
        ref_files+=("${r}") ;;
    esac
  done < <(printf '%s' "${stdin_json}" | jq -r '.ref_images[]? // empty')

  local req resp http_code body b64
  if [ "${#ref_files[@]}" -gt 0 ]; then
    # Reference-conditioned edit. gpt-image-1 accepts multiple image[] refs.
    local -a fargs=(-F "model=${AIV_MODEL:-gpt-image-1}" -F "prompt=${prompt}" \
      -F "size=${size}" -F "quality=${quality}" -F "n=1")
    for r in "${ref_files[@]}"; do fargs+=(-F "image[]=@${r};type=image/png"); done
    printf '%s: edits endpoint with %d reference image(s)\n' "${ADAPTER_ID}" "${#ref_files[@]}" >&2
    resp="$(curl -sS -w '\n%{http_code}' \
      -X POST "${AIV_ENDPOINT%/}/images/edits" \
      -H "Authorization: Bearer ${AIV_KEY}" \
      "${fargs[@]}")" \
      || aiv_die 8 "${ADAPTER_ID}: curl to ${AIV_ENDPOINT%/}/images/edits failed"
  else
    req="$(jq -n \
      --arg m "${AIV_MODEL:-gpt-image-1}" --arg p "${prompt}" \
      --arg s "${size}" --arg q "${quality}" \
      '{model: $m, prompt: $p, size: $s, quality: $q, n: 1}')"
    resp="$(curl -sS -w '\n%{http_code}' \
      -X POST "${AIV_ENDPOINT%/}/images/generations" \
      -H "Authorization: Bearer ${AIV_KEY}" \
      -H "Content-Type: application/json" \
      --data-binary "${req}")" \
      || aiv_die 8 "${ADAPTER_ID}: curl to ${AIV_ENDPOINT%/}/images/generations failed"
  fi
  # Clean up any downloaded temp refs (set -u safe on empty arrays).
  for tmp in ${tmp_files[@]+"${tmp_files[@]}"}; do rm -f "${tmp}"; done

  http_code="$(printf '%s' "${resp}" | tail -n1)"
  body="$(printf '%s' "${resp}" | sed '$d')"
  case "${http_code}" in
    2*) : ;;
    *) aiv_die 8 "${ADAPTER_ID}: HTTP ${http_code}: $(printf '%s' "${body}" | jq -r '.error.message // .error // "unknown error"' 2>/dev/null | head -c 300)" ;;
  esac

  # gpt-image-1 always returns base64 (no url).
  b64="$(printf '%s' "${body}" | jq -r '.data[0].b64_json // empty')"
  [ -n "${b64}" ] || aiv_die 8 "${ADAPTER_ID}: no image data in response (got: $(printf '%s' "${body}" | head -c 200))"

  # Portable base64 decode (GNU -d / BSD -D).
  local b64dec
  if printf '' | base64 -d >/dev/null 2>&1; then b64dec='base64 -d'; else b64dec='base64 -D'; fi
  printf '%s' "${b64}" | ${b64dec} > "${out}" \
    || aiv_die 8 "${ADAPTER_ID}: base64 decode to ${out} failed"

  case "${out}" in /*) : ;; *) out="$(pwd)/${out}" ;; esac
  jq -n --arg p "${out}" '{video_path: $p, audio_embedded: false}'
}

aiv_cmd_submit() { aiv_cmd_run "$@"; }
aiv_cmd_fetch()  { aiv_cmd_run "$@"; }
aiv_cmd_poll()   { printf '{"status":"done"}\n'; }

aiv_dispatch "${ADAPTER_ID}" "none" "$@"
