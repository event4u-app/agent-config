#!/usr/bin/env bash
# embed-provenance.sh — the finish step for AI-generated media: every
# carrier the pipeline can write, in a fixed order, enforcing
# agents/settings/policies/media/transparency.md in code instead of prose.
#
# Carrier order (`finish`), each reported, none silent:
#   1. visible   — burned-in label. RESERVED: reported
#                  "not-applied (rule pending)" until the burn-in rule and
#                  label form are decided. Nothing else stands in for it.
#   2. embedded  — container tags on mp4/mov/m4v (ffmpeg stream copy):
#                  `comment` (human wording) and `description` (machine
#                  fields). Only keys the mp4 muxer keeps are written; a
#                  custom key is silently dropped there. REMOVABLE: a
#                  stream copy that drops metadata erases both.
#   3. sidecar   — `<artifact>.provenance.json`, ALWAYS written, carrying
#                  `artifact_sha256` of the bytes as they stand after
#                  step 2. REMOVABLE: it is a separate file.
#   4. c2pa      — a C2PA manifest, LAST, when the OPERATOR installed
#                  `c2patool` and configured signing (C2PATOOL_SIGN_ARGS).
#                  The suite never ships keys or certificates. Signing
#                  changes the bytes, so the sidecar is re-bound to the
#                  signed file and keeps the pre-signing hash beside it.
#
# Wording follows the assertion (transparency.md § Vocabulary):
#   ai_generated → label "generated", "AI-generated content",
#                  c2pa.created, trainedAlgorithmicMedia
#   ai_edited    → label "modified", "AI-modified content",
#                  c2pa.edited, compositeWithTrainedAlgorithmicMedia
#
# Re-cut means re-finish: any change to the bytes invalidates the sidecar
# hash and the signature, so run `finish` again on the new file.
#
# This script only ADDS provenance. It has no strip/remove path by
# design — transparency.md forbids stripping or forging; refusal is the
# agent's job, absence of the capability is this script's contribution.
#
# Usage:
#   echo '{"artifact_path":"/abs/final.mp4","provider":"gemini-veo",
#          "model":"veo-3.0","prompt_sha256":"<hex>",
#          "assertion":"ai_generated"}' \
#     | scripts/ai-video/lib/embed-provenance.sh finish
#   scripts/ai-video/lib/embed-provenance.sh manifest <artifact>.provenance.json
#
# Subcommands:
#   finish     run every carrier in order (stdin JSON below).
#   embed      legacy name for `finish` — same carriers, same output.
#   manifest   print the C2PA manifest definition built from a sidecar,
#              read-only (what `finish` hands to c2patool).
#
# Stdin JSON (finish / embed):
#   artifact_path  mandatory — absolute path to the artifact (mp4/mov/
#                  m4v/png/jpg/wav). Validated against AIV_PROJECT_DIR
#                  when set (trust boundary), else against its parent.
#   provider       mandatory — adapter id that produced the artifact.
#   model          mandatory — model identifier (e.g. veo-3.0).
#   assertion      optional — ai_generated (default) | ai_edited.
#   prompt_sha256  optional — SHA-256 of the REDACTED prompt (the
#                  caller hashes after lib/redact.sh; raw prompts never
#                  enter the manifest).
#   extra          optional object — additional non-conflicting fields
#                  (transparency.md § Allowed). Required fields win on a
#                  name clash; `extra` cannot overwrite them.
#
# Stdout JSON (finish / embed):
#   {"provenance_path": "...", "artifact_sha256": "<hex>",
#    "assertion": "c2pa.ai_generated", "label": "generated",
#    "digital_source_type": "trainedAlgorithmicMedia",
#    "container_tagged": true|false, "c2pa": "c2patool"|"sidecar-only",
#    "order": ["visible","embedded","sidecar","c2pa"],
#    "carriers": {"visible": {...}, "embedded": {...}, "sidecar": {...},
#                 "c2pa": {...}},
#    "note": "..."}
#
# Determinism for tests: AIV_PROVENANCE_NOW overrides the timestamp.
#
# Exit codes (aligned with adapter-contract v2):
#   2 usage · 3 required tool missing (jq, sha256) · 7 invalid input ·
#   10 trust-boundary violation (path escapes scope).

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

PROV_SCHEMA=2
PROV_GENERATOR="event4u/agent-config ai-video"
PROV_IPTC="http://cv.iptc.org/newscodes/digitalsourcetype"
PROV_VISIBLE_PENDING="not-applied (rule pending)"

_prov_now() {
  if [ -n "${AIV_PROVENANCE_NOW:-}" ]; then
    printf '%s' "${AIV_PROVENANCE_NOW}"
  else
    date -u +%Y-%m-%dT%H:%M:%SZ
  fi
}

_prov_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    aiv_die 3 "required tool not found: sha256sum or shasum"
  fi
}

# One vocabulary row per assertion: label, human wording, C2PA action,
# IPTC digital source type. Every carrier reads from here.
_prov_vocab() {
  case "$1" in
    ai_generated) printf 'generated|AI-generated content|c2pa.created|trainedAlgorithmicMedia' ;;
    ai_edited)    printf 'modified|AI-modified content|c2pa.edited|compositeWithTrainedAlgorithmicMedia' ;;
    *) aiv_die 7 "embed-provenance: assertion must be ai_generated|ai_edited (got: $1)" ;;
  esac
}

# Sidecar fields (minus schema) → C2PA manifest definition on stdout.
_prov_manifest_json() {
  jq --arg iptc "${PROV_IPTC}" '{
    claim_generator: .generator,
    assertions: [
      {label: "c2pa.actions", data: {actions: [{action: .c2pa_action,
        digitalSourceType: ($iptc + "/" + .digital_source_type)}]}},
      {label: "ai.provenance", data: (del(.schema))}
    ]
  }' "$1"
}

_prov_manifest() {
  aiv_require_cmd jq
  local sidecar="${1:-}"
  [ -n "${sidecar}" ] || aiv_die 2 "embed-provenance: manifest needs a <artifact>.provenance.json path"
  case "${sidecar}" in
    *.provenance.json) : ;;
    *) aiv_die 7 "embed-provenance: manifest reads a .provenance.json sidecar (got: ${sidecar})" ;;
  esac
  [ -f "${sidecar}" ] || aiv_die 7 "embed-provenance: sidecar not found: ${sidecar}"
  jq -e '.digital_source_type and .c2pa_action' "${sidecar}" >/dev/null 2>&1 \
    || aiv_die 7 "embed-provenance: sidecar predates schema ${PROV_SCHEMA} (no digital_source_type) — re-run finish"
  _prov_manifest_json "${sidecar}"
}

_prov_finish() {
  aiv_require_cmd jq

  local stdin_json artifact provider model assertion prompt_hash extra
  stdin_json="$(cat)"
  artifact="$(printf '%s' "${stdin_json}" | jq -r '.artifact_path // empty' 2>/dev/null)" \
    || aiv_die 7 "embed-provenance: malformed stdin JSON"
  provider="$(printf '%s' "${stdin_json}" | jq -r '.provider // empty')"
  model="$(printf '%s' "${stdin_json}" | jq -r '.model // empty')"
  assertion="$(printf '%s' "${stdin_json}" | jq -r '.assertion // "ai_generated"')"
  prompt_hash="$(printf '%s' "${stdin_json}" | jq -r '.prompt_sha256 // empty')"
  extra="$(printf '%s' "${stdin_json}" | jq -c '.extra // {}')"

  [ -n "${artifact}" ] || aiv_die 7 "embed-provenance: artifact_path required"
  [ -n "${provider}" ] || aiv_die 7 "embed-provenance: provider required"
  [ -n "${model}" ]    || aiv_die 7 "embed-provenance: model required"
  local vocab label wording c2pa_action dst
  vocab="$(_prov_vocab "${assertion}")"
  IFS='|' read -r label wording c2pa_action dst <<EOF
${vocab}
EOF
  if [ -n "${prompt_hash}" ]; then
    printf '%s' "${prompt_hash}" | grep -Eq '^[0-9a-f]{64}$' \
      || aiv_die 7 "embed-provenance: prompt_sha256 must be a 64-char hex SHA-256 of the REDACTED prompt"
  fi

  # Trust boundary: the artifact path is orchestrator-supplied but the
  # same project-scope rule applies — scope to AIV_PROJECT_DIR when the
  # orchestrator set it, else to the artifact's own parent directory.
  local scope_root
  scope_root="${AIV_PROJECT_DIR:-$(dirname "${artifact}")}"
  artifact="$(aiv_validate_artifact_path "${scope_root}" "${artifact}")"
  [ -f "${artifact}" ] || aiv_die 7 "embed-provenance: artifact not found: ${artifact}"

  local created sidecar sidecar_name
  created="$(_prov_now)"
  sidecar="${artifact}.provenance.json"
  sidecar_name="$(basename "${sidecar}")"

  # 1. visible — reserved slot, never faked by another carrier.
  local visible_status="${PROV_VISIBLE_PENDING}"

  # 2. embedded — container tags, mp4 family only, stream copy into a
  #    temp file then an atomic swap so a failed ffmpeg never corrupts
  #    the artifact.
  local container_tagged=false embedded_status tmp
  case "${artifact}" in
    *.mp4|*.mov|*.m4v)
      if command -v ffmpeg >/dev/null 2>&1; then
        tmp="${artifact}.provtag.tmp.${artifact##*.}"
        if ffmpeg -loglevel error -y -i "${artifact}" -c copy \
             -metadata comment="${wording} — ${model} via ${provider}; provenance sidecar: ${sidecar_name}" \
             -metadata description="ai_assertion=${assertion}; label=${label}; digital_source_type=${dst}; sidecar=${sidecar_name}" \
             "${tmp}" >/dev/null 2>&1; then
          mv "${tmp}" "${artifact}"
          container_tagged=true
          embedded_status="container-tags"
        else
          rm -f "${tmp}"
          embedded_status="skipped: ffmpeg metadata tag failed"
          printf 'embed-provenance: ffmpeg metadata tag failed — sidecar remains the provenance surface\n' >&2
        fi
      else
        embedded_status="skipped: ffmpeg not installed"
        printf 'embed-provenance: ffmpeg not installed — container tag skipped, sidecar written\n' >&2
      fi
      ;;
    *) embedded_status="not-applicable: no container tags for .${artifact##*.}" ;;
  esac

  # 3. sidecar — the always-on floor, bound to the bytes as they stand.
  #    Required fields are applied after `extra` so a clash cannot
  #    overwrite them.
  local artifact_sha
  artifact_sha="$(_prov_sha256 "${artifact}")"
  jq -n \
    --argjson schema "${PROV_SCHEMA}" \
    --arg assertion "c2pa.${assertion}" \
    --arg label "${label}" \
    --arg c2pa_action "${c2pa_action}" \
    --arg dst "${dst}" \
    --arg provider "${provider}" \
    --arg model "${model}" \
    --arg created "${created}" \
    --arg prompt_sha256 "${prompt_hash}" \
    --arg generator "${PROV_GENERATOR}" \
    --arg sha "${artifact_sha}" \
    --argjson extra "${extra}" \
    '$extra + {
      schema: $schema,
      assertion: $assertion,
      label: $label,
      c2pa_action: $c2pa_action,
      digital_source_type: $dst,
      provider: $provider,
      model: $model,
      created: $created,
      generator: $generator,
      artifact_sha256: $sha
    }
    + (if $prompt_sha256 == "" then {} else {prompt_sha256: $prompt_sha256} end)' > "${sidecar}" \
    || aiv_die 7 "embed-provenance: failed to write sidecar ${sidecar}"

  # 4. c2pa — last, operator-installed c2patool, best-effort. Signing
  #    args (cert/key) are the operator's — the suite never ships keys.
  local c2pa_surface="sidecar-only" c2pa_status="sidecar-only: c2patool not installed" manifest out signed_sha
  if command -v c2patool >/dev/null 2>&1; then
    manifest="$(mktemp -t aiv-c2pa-XXXXXX.json)"
    _prov_manifest_json "${sidecar}" > "${manifest}"
    out="${artifact}.c2pa.tmp.${artifact##*.}"
    # Operator-supplied signing args are intentionally word-split.
    # shellcheck disable=SC2086
    if c2patool "${artifact}" -m "${manifest}" -o "${out}" ${C2PATOOL_SIGN_ARGS:-} >/dev/null 2>&1; then
      mv "${out}" "${artifact}"
      c2pa_surface="c2patool"
      c2pa_status="c2patool"
      signed_sha="$(_prov_sha256 "${artifact}")"
      jq --arg signed "${signed_sha}" --arg content "${artifact_sha}" \
        '. + {artifact_sha256: $signed, content_sha256_before_c2pa: $content}' \
        "${sidecar}" > "${sidecar}.tmp" && mv "${sidecar}.tmp" "${sidecar}"
      artifact_sha="${signed_sha}"
    else
      rm -f "${out}"
      c2pa_status="sidecar-only: c2patool embed failed (signing unconfigured?)"
      printf 'embed-provenance: c2patool embed failed (signing unconfigured?) — sidecar remains the provenance surface\n' >&2
    fi
    rm -f "${manifest}"
  fi

  jq -n \
    --arg p "${sidecar}" \
    --arg sha "${artifact_sha}" \
    --arg assertion "c2pa.${assertion}" \
    --arg label "${label}" \
    --arg dst "${dst}" \
    --argjson tagged "${container_tagged}" \
    --arg c2pa "${c2pa_surface}" \
    --arg visible "${visible_status}" \
    --arg embedded "${embedded_status}" \
    --arg c2pa_status "${c2pa_status}" \
    '{
      provenance_path: $p,
      artifact_sha256: $sha,
      assertion: $assertion,
      label: $label,
      digital_source_type: $dst,
      container_tagged: $tagged,
      c2pa: $c2pa,
      order: ["visible", "embedded", "sidecar", "c2pa"],
      carriers: {
        visible: {status: $visible},
        embedded: ({status: $embedded, removable: true}
          + (if $tagged then {keys: ["comment", "description"]} else {} end)),
        sidecar: {status: "written", removable: true},
        c2pa: {status: $c2pa_status, removable: true}
      },
      note: "Embedded tags, sidecar and C2PA are removable; only a visible label is non-removable and it is not applied (rule pending). An external re-encode loses the embedded carriers and the C2PA signature, and the sidecar stops matching — re-cut means re-finish."
    }'
}

sub="${1:-}"
case "${sub}" in
  finish) shift; _prov_finish "$@" ;;
  embed) shift; _prov_finish "$@" ;;
  manifest) shift; _prov_manifest "$@" ;;
  "")    aiv_die 2 "embed-provenance: subcommand required (finish | embed | manifest)" ;;
  *)     aiv_die 2 "embed-provenance: unknown subcommand: ${sub}" ;;
esac
