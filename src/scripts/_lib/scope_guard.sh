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
#            No drift — and NOT free. The host loads both registrations with no
#            dedup, so every shared artefact is delivered twice. This verdict used
#            to read "Same content; duplicate registration but no drift", which
#            classified duplication by DRIFT RISK and never by CONTEXT COST, and
#            so taught every reader that identical copies cost nothing. Measured
#            2026-08-19 on a freshly regenerated maintainer projection: 110 rules
#            and 290 skills delivered twice, 203,873 tok of standing rule prose
#            against a 110,000 cap. See ADR-236 and
#            agents/evidence/analysis/single-delivery-partition-census.md.
#   DRIFT  — install at the other scope, DIFFERENT version (or unreadable).
#            Drift will produce the 2026-05-25 failure mode (stale frontmatter
#            registered alongside fresh frontmatter).
#
# Output shape (line-oriented, parseable by install.sh):
#   <verdict>\t<tool-id>\t<other-scope-path>\t<other-version>\t<this-version>[\t<overlap>]
#
# Field 6 (<overlap>) is emitted on WARN lines only: the number of entry names
# present in BOTH scope directories — what a same-version duplicate registration
# actually delivers twice. It is APPENDED rather than inserted, so every existing
# field-indexed consumer keeps working unchanged. `-1` means the count could not
# be taken — the scope being installed to does not exist yet, or a directory is
# unreadable — which is reported rather than silently rendered as 0. See
# `count_overlap` for why the two are different facts.
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
# This lib lives at src/scripts/_lib/, so the package root is three levels up.
if [[ -z "$SOURCE_DIR" ]]; then
    SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
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

# Count entry names present in BOTH scope directories — what a same-version
# duplicate registration actually delivers twice, which is the cost the WARN
# verdict used to omit.
#
# Returns -1 rather than 0 when the count cannot be taken, because the two are
# different facts and reporting "0 overlap" for "could not look" is how a gate
# starts reading as coverage.
#
# R2 review corrected the docstring twice over. The copilot probe was named here
# as the concrete -1 case; it is UNREACHABLE, because `dir_nonempty`'s `[[ -d ]]`
# test short-circuits a single-file path to OK before probe_tool ever reaches a
# version comparison. The reachable cases are: the scope being installed TO does
# not exist yet (a first install at this scope — genuinely no overlap to count,
# not a failure), and a directory that exists but cannot be read.
#
# The unreadable case used to return 0 — the precise failure this function's own
# docstring claimed to prevent, because `cd` failed inside the process
# substitution and `comm` compared two empty streams. It is now detected before
# the comparison.
count_overlap() {
    local a="$1" b="$2" n
    if [[ ! -d "$a" ]] || [[ ! -d "$b" ]]; then
        printf '%s' '-1'
        return 0
    fi
    # Readability is checked explicitly: `ls` on an unreadable directory fails,
    # and inside `<(...)` that failure is invisible to the caller.
    if ! ls -A "$a" >/dev/null 2>&1 || ! ls -A "$b" >/dev/null 2>&1; then
        printf '%s' '-1'
        return 0
    fi
    n="$(comm -12 \
            <(ls -A "$a" 2>/dev/null | sort) \
            <(ls -A "$b" 2>/dev/null | sort) \
         2>/dev/null | wc -l | tr -d ' ')" || n=''
    printf '%s' "${n:--1}"
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

    # Field 6 is the duplicate-registration count, and it is printed on BOTH
    # verdicts. It used to appear only on WARN, which required the two scopes to
    # report the SAME version — and `installed_version_at` returns `unknown` for
    # `~/.claude/…` because a host directory has no `package.json` beside it. So
    # every real cross-scope install classified as DRIFT and the count never
    # printed at all: the instrumentation was live and unreachable, which reads as
    # coverage in a diff and is strictly worse than absent.
    #
    # Resolved 2026-08-20, road-to-single-delivery Phase 5, blocker
    # `warn-path-unreachable-without-version-marker`, option (b). The council had
    # already put the reasoning on record in the round that decided the partition:
    # *"overlap reporting should not depend on version equality in the first
    # place. Duplicate files can and should be reported whether versions match,
    # drift, or are unknown."* A duplicate is a duplicate at any version pair.
    #
    # (a) — having the installer stamp a version beside every host layer — was the
    # larger change and is NOT what shipped: it alters a consumer-facing surface to
    # repair a reporting line. (c) — treating `unknown` as "same version" for the
    # overlap half — was rejected because it weakens the DRIFT block itself.
    #
    # Wire compatibility: the DRIFT line gains a SIXTH field. The only structured
    # consumer (`src/server/routes/wizard.ts`) destructures the first five and
    # ignores the rest, so this is additive.
    local overlap
    overlap="$(count_overlap "$other_path" "$this_scope_path")"
    if [[ "$other_ver" == "unknown" ]] || [[ "$this_ver" == "unknown" ]] || [[ "$other_ver" != "$this_ver" ]]; then
        printf 'DRIFT\t%s\t%s\t%s\t%s\t%s\n' "$tool" "$other_path" "$other_ver" "$this_ver" "$overlap"
    else
        # Same version, so no drift — but the duplicate registration is delivered
        # twice, and field 6 is what makes that cost visible at the moment of the
        # decision instead of only in a token census nobody runs.
        printf 'WARN\t%s\t%s\t%s\t%s\t%s\n' "$tool" "$other_path" "$other_ver" "$this_ver" "$overlap"
    fi
}

main() {
    # Resolve target root for project-scope probes.
    local project_root="${TARGET_DIR:-$(pwd)}"
    local home_root="${HOME:-/tmp}"

    local count_ok=0 count_warn=0 count_drift=0 finding

    # Each probe_tool call prints exactly one line. Use
    # assignment-arithmetic (returns 0) rather than post-increment
    # (returns the OLD value — 0 trips `set -e` on the first OK hit
    # under bash 5+ / GitHub Actions runners).
    while IFS= read -r finding; do
        echo "$finding"
        case "${finding%%$'\t'*}" in
            OK)    count_ok=$((count_ok + 1))       ;;
            WARN)  count_warn=$((count_warn + 1))   ;;
            DRIFT) count_drift=$((count_drift + 1)) ;;
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
