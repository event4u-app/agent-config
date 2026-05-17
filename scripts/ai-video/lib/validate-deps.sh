#!/usr/bin/env bash
# validate-deps.sh — startup validator invoked by every /video:* command
# BEFORE any adapter or network call. Reads the YAML frontmatter from
# the command file, resolves every declared persona + skill against
# .agent-src/personas/ and .agent-src/skills/, and fails fast with the
# missing-id list.
#
# Scope (per roadmap Phase 5 Step 5): existence + frontmatter `id` match
# only. No version pinning (scope-control § rules); no schema validation
# of persona / skill bodies — that lives in `task lint-skills`.
#
# Usage:
#   validate-deps.sh <path-to-command.md>
#
# Exit codes:
#   0   all declared personas + skills resolve
#   2   command file missing or no frontmatter
#   3   one or more declared ids do not resolve (list on stderr)

set -euo pipefail

if [ "$#" -ne 1 ]; then
  printf 'validate-deps: usage: %s <path-to-command.md>\n' "$0" >&2
  exit 2
fi

cmd_file="$1"
if [ ! -f "${cmd_file}" ]; then
  printf 'validate-deps: command file not found: %s\n' "${cmd_file}" >&2
  exit 2
fi

# Resolve repo root from this script's location (scripts/ai-video/lib/).
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../../.." && pwd)"

# AIV_PERSONAS_DIR / AIV_SKILLS_DIR allow overrides for tests; defaults
# point at the generated mirrors (skills+personas live there at runtime).
personas_dir="${AIV_PERSONAS_DIR:-${repo_root}/.agent-src/personas}"
skills_dir="${AIV_SKILLS_DIR:-${repo_root}/.agent-src/skills}"

# Extract the frontmatter block (between the first two `---` lines).
fm="$(awk '
  BEGIN { in_fm=0; count=0 }
  /^---[[:space:]]*$/ { count++; if (count==1) { in_fm=1; next } if (count==2) { exit } }
  in_fm { print }
' "${cmd_file}")"

if [ -z "${fm}" ]; then
  printf 'validate-deps: no YAML frontmatter in %s\n' "${cmd_file}" >&2
  exit 2
fi

# Parse `personas:` and `skills:` lines. We accept inline-list form only
# (the template we ship), e.g. `personas: [a, b]`. No multi-line block
# form — keeps the validator dependency-free (no yq / python).
_extract_list() {
  # $1 = key name (personas|skills)
  printf '%s\n' "${fm}" \
    | awk -v key="$1" '
        $0 ~ "^" key ":" {
          line=$0
          sub("^" key ":[[:space:]]*", "", line)
          sub("^\\[", "", line)
          sub("\\][[:space:]]*$", "", line)
          gsub(",", " ", line)
          print line
        }' \
    | tr -s ' ' '\n' \
    | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' \
    | sed '/^$/d'
}

# Portable to macOS bash 3.2 — no `mapfile`.
personas=()
while IFS= read -r _id; do
  personas+=("${_id}")
done < <(_extract_list personas)
skills=()
while IFS= read -r _id; do
  skills+=("${_id}")
done < <(_extract_list skills)

missing=()

# bash 3.2 treats `"${arr[@]}"` on an empty array as unbound under
# `set -u`. Guard each loop with the length check.

# A persona is "present" if .agent-src/personas/<id>.md exists OR
# .agent-src/personas/<id>/persona.md exists (template-specialist shape).
if [ "${#personas[@]}" -gt 0 ]; then
for p in "${personas[@]}"; do
  [ -z "${p}" ] && continue
  if [ ! -f "${personas_dir}/${p}.md" ] && [ ! -f "${personas_dir}/${p}/persona.md" ]; then
    missing+=("persona:${p}")
    continue
  fi
  # Frontmatter id match: read `id:` (optional) or `name:` from the
  # persona file; if present it must equal the declared slug.
  src_file="${personas_dir}/${p}.md"
  [ -f "${src_file}" ] || src_file="${personas_dir}/${p}/persona.md"
  declared_id="$(awk '/^id:[[:space:]]*/ { sub("^id:[[:space:]]*", ""); print; exit } /^name:[[:space:]]*/ { sub("^name:[[:space:]]*", ""); print; exit }' "${src_file}" | tr -d '"' | tr -d "'")"
  if [ -n "${declared_id}" ] && [ "${declared_id}" != "${p}" ]; then
    missing+=("persona:${p} (file declares id=${declared_id})")
  fi
done
fi

# A skill is "present" if .agent-src/skills/<id>/SKILL.md exists.
if [ "${#skills[@]}" -gt 0 ]; then
for s in "${skills[@]}"; do
  [ -z "${s}" ] && continue
  skill_file="${skills_dir}/${s}/SKILL.md"
  if [ ! -f "${skill_file}" ]; then
    missing+=("skill:${s}")
    continue
  fi
  declared_id="$(awk '/^name:[[:space:]]*/ { sub("^name:[[:space:]]*", ""); print; exit }' "${skill_file}" | tr -d '"' | tr -d "'")"
  if [ -n "${declared_id}" ] && [ "${declared_id}" != "${s}" ]; then
    missing+=("skill:${s} (file declares name=${declared_id})")
  fi
done
fi

if [ "${#missing[@]}" -gt 0 ]; then
  printf 'validate-deps: unresolved declarations in %s:\n' "${cmd_file}" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 3
fi

# Silent success — callers can `set -e` and continue.
exit 0
