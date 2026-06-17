#!/usr/bin/env bash
# embed-provenance.sh — machine-readable provenance for AI-generated
# artifacts, enforcing agents/settings/policies/media/transparency.md in
# code instead of prose.
#
# Layered surface (best tool available, sidecar always):
#   1. Sidecar `<artifact>.provenance.json` — ALWAYS written. The
#      zero-dependency floor the policy names for providers without
#      native C2PA support.
#   2. Container metadata tag — when ffmpeg is installed and the
#      artifact is an mp4/mov/m4v: a human-readable AI-generation
#      disclosure comment is embedded into the container (stream copy,
#      no re-encode), satisfying the non-removable disclosure step of
#      /video:from-song Step 9.4 (disclosure.md).
#   3. C2PA manifest — when the OPERATOR has installed `c2patool`
#      (https://github.com/contentauth/c2pa-rs) and signing is
#      configured (C2PATOOL_SIGN_ARGS), a real C2PA manifest is
#      embedded. The suite ships only this wrapper, never the signing
#      keys ("skill suite, not an app"). Missing tool → sidecar-only,
#      reported, never an error.
#
# This script only ADDS provenance. It has no strip/remove path by
# design — transparency.md forbids stripping or forging; refusal is the
# agent's job, absence of the capability is this script's contribution.
#
# Usage:
#   echo '{"artifact_path":"/abs/final.mp4","provider":"gemini-veo",
#          "model":"veo-3.0","prompt_sha256":"<hex>",
#          "assertion":"ai_generated"}' \
#     | scripts/ai-video/lib/embed-provenance.sh embed
#
# Stdin JSON (embed):
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
#                  (transparency.md § Allowed), merged verbatim.
#
# Stdout JSON:
#   {"provenance_path": "...", "container_tagged": true|false,
#    "c2pa": "c2patool" | "sidecar-only", "assertion": "..."}
#
# Determinism for tests: AIV_PROVENANCE_NOW overrides the timestamp.
#
# Exit codes (aligned with adapter-contract v2):
#   2 usage · 3 required tool missing (jq) · 7 invalid input ·
#   10 trust-boundary violation (path escapes scope).

set -euo pipefail

# shellcheck source=../../media/lib/adapter-common.sh
. "$(dirname "$0")/../../media/lib/adapter-common.sh"

PROV_SCHEMA=1
PROV_GENERATOR="event4u/agent-config ai-video"

_prov_now() {
  if [ -n "${AIV_PROVENANCE_NOW:-}" ]; then
    printf '%s' "${AIV_PROVENANCE_NOW}"
  else
    date -u +%Y-%m-%dT%H:%M:%SZ
  fi
}

_prov_embed() {
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
  case "${assertion}" in
    ai_generated|ai_edited) : ;;
    *) aiv_die 7 "embed-provenance: assertion must be ai_generated|ai_edited (got: ${assertion})" ;;
  esac
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

  local created sidecar
  created="$(_prov_now)"
  sidecar="${artifact}.provenance.json"

  # 1. Sidecar — the always-on floor (transparency.md § Required).
  jq -n \
    --argjson schema "${PROV_SCHEMA}" \
    --arg assertion "c2pa.${assertion}" \
    --arg provider "${provider}" \
    --arg model "${model}" \
    --arg created "${created}" \
    --arg prompt_sha256 "${prompt_hash}" \
    --arg generator "${PROV_GENERATOR}" \
    --argjson extra "${extra}" \
    '{
      schema: $schema,
      assertion: $assertion,
      provider: $provider,
      model: $model,
      created: $created,
      generator: $generator
    }
    + (if $prompt_sha256 == "" then {} else {prompt_sha256: $prompt_sha256} end)
    + $extra' > "${sidecar}" \
    || aiv_die 7 "embed-provenance: failed to write sidecar ${sidecar}"

  # 2. Container disclosure tag — mp4-family only, stream copy, written
  #    to a temp file then atomically swapped so a failed ffmpeg never
  #    corrupts the artifact.
  local container_tagged=false tmp
  case "${artifact}" in
    *.mp4|*.mov|*.m4v)
      if command -v ffmpeg >/dev/null 2>&1; then
        tmp="${artifact}.provtag.tmp.${artifact##*.}"
        if ffmpeg -loglevel error -y -i "${artifact}" -c copy \
             -metadata comment="AI-generated content — ${model} via ${provider}; provenance sidecar: $(basename "${sidecar}")" \
             -metadata ai_generated=true \
             "${tmp}" >/dev/null 2>&1; then
          mv "${tmp}" "${artifact}"
          container_tagged=true
        else
          rm -f "${tmp}"
          printf 'embed-provenance: ffmpeg metadata tag failed — sidecar remains the provenance surface\n' >&2
        fi
      else
        printf 'embed-provenance: ffmpeg not installed — container tag skipped, sidecar written\n' >&2
      fi
      ;;
  esac

  # 3. C2PA manifest — operator-installed c2patool, best-effort. The
  #    manifest mirrors the sidecar fields; signing args (cert/key) are
  #    the operator's (C2PATOOL_SIGN_ARGS) — the suite never ships keys.
  local c2pa_surface="sidecar-only" manifest out
  if command -v c2patool >/dev/null 2>&1; then
    manifest="$(mktemp -t aiv-c2pa-XXXXXX.json)"
    jq '{
      claim_generator: .generator,
      assertions: [
        {label: "c2pa.actions", data: {actions: [{action: "c2pa.created",
          digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"}]}},
        {label: "ai.provenance", data: (del(.schema))}
      ]
    }' "${sidecar}" > "${manifest}"
    out="${artifact}.c2pa.tmp.${artifact##*.}"
    # Operator-supplied signing args are intentionally word-split.
    # shellcheck disable=SC2086
    if c2patool "${artifact}" -m "${manifest}" -o "${out}" ${C2PATOOL_SIGN_ARGS:-} >/dev/null 2>&1; then
      mv "${out}" "${artifact}"
      c2pa_surface="c2patool"
    else
      rm -f "${out}"
      printf 'embed-provenance: c2patool embed failed (signing unconfigured?) — sidecar remains the provenance surface\n' >&2
    fi
    rm -f "${manifest}"
  fi

  jq -n \
    --arg p "${sidecar}" \
    --argjson tagged "${container_tagged}" \
    --arg c2pa "${c2pa_surface}" \
    --arg assertion "c2pa.${assertion}" \
    '{provenance_path: $p, container_tagged: $tagged, c2pa: $c2pa, assertion: $assertion}'
}

sub="${1:-}"
case "${sub}" in
  embed) shift; _prov_embed "$@" ;;
  "")    aiv_die 2 "embed-provenance: subcommand required (embed)" ;;
  *)     aiv_die 2 "embed-provenance: unknown subcommand: ${sub}" ;;
esac
