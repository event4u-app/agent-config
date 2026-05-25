#!/usr/bin/env bash
# scope_guard.sh — detect cross-scope install drift for event4u/agent-config.
#
# Roadmap reference: road-to-clean-skill-distribution-channels.md, Phase B Step 2.
# Contract: docs/contracts/skill-distribution-channels.md + docs/contracts/install-scopes.md.
#
# Pre-install hook called by scripts/install.sh. Detects whether the same package
# is already installed at the OTHER scope (user-global vs project-local) for any
# of the six supported tools. Emits one verdict per tool plus a global verdict
# on stdout (one finding per line).
#
# Verdicts (per the roadmap contract):
#   OK     — no install at the other scope; the install can proceed.
#   WARN   — install at the other scope, SAME version as the one being installed.
#            Same content; duplicate registration but no drift.
#   DRIFT  — install at the other scope, DIFFERENT version (or unreadable).
#            Drift will produce the 2026-05-25 failure mode (stale frontmatter
#            registered alongside fresh frontmatter).
#
# Output shape (line-oriented, parseable by install.sh):
#   <verdict>\t<tool-id>\t<other-scope-path>\t<other-version>\t<this-version>
#
# A final summary line is emitted:
#   SUMMARY\t<verdict>\t<count-OK>\t<count-WARN>\t<count-DRIFT>
#
# The script exits 0 always — verdict interpretation is the caller's job.

set -euo pipefail

THIS_SCOPE="${1:-project}"   # project|user — which scope we're ABOUT to install to
SOURCE_DIR="${2:-}"          # package source repo (read version from here)
TARGET_DIR="${3:-}"          # consumer install root for "this" scope

# Default SOURCE_DIR to the package root when invoked from inside this repo.
if [[ -z "$SOURCE_DIR" ]]; then
    SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

# Resolve the version we're about to install. Authoritative source:
# package.json at the package root (release.py keeps this current).
this_version() {
    local pkg="$SOURCE_DIR/package.json"
    [[ -f "$pkg" ]] || { echo "unknown"; return; }
    # Tiny scoped parser — no jq / python dependency.
    awk -F'"' '/"version":/ { print $4; exit }' "$pkg" 2>/dev/null || echo "unknown"
}

# Resolve the version recorded at a given install root. Falls back through
# package.json → .augment-plugin/plugin.json → "unknown".
installed_version_at() {
    local root="$1"
    if [[ -f "$root/package.json" ]]; then
        awk -F'"' '/"version":/ { print $4; exit }' "$root/package.json" 2>/dev/null && return
    fi
    if [[ -f "$root/.augment-plugin/plugin.json" ]]; then
        awk -F'"' '/"version":/ { print $4; exit }' "$root/.augment-plugin/plugin.json" 2>/dev/null && return
    fi
    echo "unknown"
}

# Heuristic: does this look like an agent-config install (vs a vanilla user
# directory with the same path layout)? We accept "looks like" if the tool
# directory contains ≥ N entries that ALSO exist in the SOURCE_DIR tree —
# but we keep the check coarse: simply that the directory is non-empty.
dir_nonempty() {
    [[ -d "$1" ]] && [[ -n "$(ls -A "$1" 2>/dev/null | head -1)" ]]
}

# Per-tool probe definitions: tool-id, user-scope path, project-scope path.
# Project-scope path is relative to "$TARGET_DIR" (or "$HOME/<proj>" for user).
probe_tool() {
    local tool="$1"
    local user_path="$2"
    local project_path="$3"

    local other_path other_scope this_scope_path
    if [[ "$THIS_SCOPE" == "project" ]]; then
        this_scope_path="$project_path"
        other_path="$user_path"
        other_scope="user"
    else
        this_scope_path="$user_path"
        other_path="$project_path"
        other_scope="project"
    fi

    if ! dir_nonempty "$other_path"; then
        printf 'OK\t%s\t-\t-\t%s\n' "$tool" "$(this_version)"
        return
    fi

    local other_root other_ver
    # Walk up from the tool directory to find the install root (containing
    # package.json or .augment-plugin/plugin.json).
    other_root="$(cd "$other_path/.." 2>/dev/null && pwd)" || other_root=""
    if [[ -n "$other_root" ]]; then
        # Look up to 3 levels up for an install root.
        local probe="$other_root"
        for _ in 1 2 3; do
            if [[ -f "$probe/package.json" ]] || [[ -f "$probe/.augment-plugin/plugin.json" ]]; then
                other_root="$probe"
                break
            fi
            probe="$(dirname "$probe")"
            [[ "$probe" == "/" ]] && break
        done
    fi
    other_ver="$(installed_version_at "$other_root")"

    local this_ver
    this_ver="$(this_version)"

    if [[ "$other_ver" == "unknown" ]] || [[ "$this_ver" == "unknown" ]] || [[ "$other_ver" != "$this_ver" ]]; then
        printf 'DRIFT\t%s\t%s\t%s\t%s\n' "$tool" "$other_path" "$other_ver" "$this_ver"
    else
        printf 'WARN\t%s\t%s\t%s\t%s\n' "$tool" "$other_path" "$other_ver" "$this_ver"
    fi
}

main() {
    # Resolve target root for project-scope probes.
    local project_root="${TARGET_DIR:-$(pwd)}"
    local home_root="${HOME:-/tmp}"

    local count_ok=0 count_warn=0 count_drift=0 finding

    # Each probe_tool call prints exactly one line.
    while IFS= read -r finding; do
        echo "$finding"
        case "${finding%%$'\t'*}" in
            OK)    ((count_ok++))    ;;
            WARN)  ((count_warn++))  ;;
            DRIFT) ((count_drift++)) ;;
        esac
    done < <(
        probe_tool claude-code "$home_root/.claude/skills" "$project_root/.claude/skills"
        probe_tool augment     "$home_root/.augment/skills" "$project_root/.augment/skills"
        probe_tool cursor      "$home_root/.cursor/rules"  "$project_root/.cursor/rules"
        probe_tool cline       "$home_root/.clinerules"    "$project_root/.clinerules"
        probe_tool windsurf    "$home_root/.windsurf/rules" "$project_root/.windsurf/rules"
        probe_tool copilot     "$home_root/.github/copilot-instructions.md" "$project_root/.github/copilot-instructions.md"
    )

    local overall
    if [[ $count_drift -gt 0 ]]; then
        overall=DRIFT
    elif [[ $count_warn -gt 0 ]]; then
        overall=WARN
    else
        overall=OK
    fi
    printf 'SUMMARY\t%s\t%d\t%d\t%d\n' "$overall" "$count_ok" "$count_warn" "$count_drift"
}

# Allow sourcing without executing (so other scripts can call individual
# functions). Only run main() when invoked directly.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
