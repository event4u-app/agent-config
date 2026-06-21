#!/usr/bin/env bash
# install.sh — Agent-config payload sync (one of two installer stages).
#
# Reads from the package's dist/agent-src/ and writes the target project's
# .augment/ tree: copies rules, symlinks everything else. When
# augment.rules_use_symlinks: true is set in the target's
# .agent-settings.yml, rules are symlinked instead of copied.
# Creates tool-specific directories for Claude Code, Cursor, Cline, Windsurf, Gemini.
#
# Does NOT render .agent-settings.yml or bridge JSONs — that is the job of
# scripts/install.py. The primary entry point scripts/install orchestrates both.
# Running this script on its own installs the payload only.
#
# Usage:
#   bash scripts/install.sh [--source <dir>] [--target <dir>] [--dry-run] [--verbose] [--quiet]
#
# Environment:
#   PROJECT_ROOT  — override target directory (default: cwd)

set -euo pipefail

# --- Configuration ---
COPY_DIRS="rules"  # Subdirectories where files must be real copies (space-separated)

# Rules that are internal to the agent-config package and should NOT be shipped to consumers.
# These are only relevant when developing the agent-config package itself.
EXCLUDE_RULES="source-of-truth.md augment-portability.md docs-sync.md"

# Files inside target/.augment/ that are NOT managed by sync (created by the bridge installer).
# Never remove them in clean_stale even though they are absent in the source manifest.
PRESERVE_TARGET="settings.json"

# --- Globals ---
SOURCE_DIR=""
TARGET_DIR=""
DRY_RUN=false
VERBOSE=false
QUIET=false
SKIP_GITIGNORE=false
# Per the canonical-channel contract (docs/contracts/skill-distribution-channels.md),
# consumer installs default to the filesystem channel only (e.g. .claude/skills/) and
# do NOT project the plugin manifest (.claude-plugin/marketplace.json). Set this true
# via --legacy-both to also copy the plugin manifest for users on older harnesses
# that require both channels.
LEGACY_BOTH=false
# When true, skip payload sync entirely and only install the project-local
# `./agent-config` wrapper (Step 7 Phase 2). The bridge stage (install.py)
# handles the .agent-settings.yml stub + nested-install guard.
MINIMAL=false
# Comma-separated tool IDs (default: all). Set by --tools or the
# orchestrator (scripts/install). The .augment/ substrate is always
# synced because every other tool symlinks back into it.
TOOLS="all"
# Resolved from <TARGET>/.agent-settings.yml in resolve_settings(); when
# true, .augment/rules/ files are symlinked instead of copied.
USE_RULES_SYMLINKS=false

# Return 0 if a tool ID is enabled by the current --tools selection.
# "all" matches everything; otherwise match the comma list exactly.
is_tool_enabled() {
    local id="$1"
    [[ "$TOOLS" == "all" ]] && return 0
    case ",$TOOLS," in
        *,"$id",*) return 0 ;;
        *,all,*)   return 0 ;;
    esac
    return 1
}

# --- Logging ---
log_info()    { $QUIET || echo "  ✅  $*"; }
log_warn()    { $QUIET || echo "  ⚠️  $*" >&2; }
log_verbose() { $VERBOSE && ! $QUIET && echo "      $*" || true; }
log_error()   { echo "  ❌  $*" >&2; }

# --- Argument parsing ---
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --source)  SOURCE_DIR="$2"; shift 2 ;;
            --target)  TARGET_DIR="$2"; shift 2 ;;
            --dry-run) DRY_RUN=true; shift ;;
            --verbose) VERBOSE=true; shift ;;
            --quiet)   QUIET=true; shift ;;
            --skip-gitignore) SKIP_GITIGNORE=true; shift ;;
            --tools)   TOOLS="$2"; shift 2 ;;
            --tools=*) TOOLS="${1#*=}"; shift ;;
            # --user-type is consumed by install.py (settings persistence).
            # Accepted here so direct `bash scripts/install.sh --user-type=...`
            # invocations from the `install` wrapper / standalone users do not
            # trip the "Unknown argument" guard. Value is intentionally unused
            # by the payload-sync stage.
            --user-type)   shift 2 ;;
            --user-type=*) shift ;;
            --minimal|--settings-only) MINIMAL=true; shift ;;
            --legacy-both) LEGACY_BOTH=true; shift ;;
            --help|-h) show_help; exit 0 ;;
            *) log_error "Unknown argument: $1"; show_help; exit 1 ;;
        esac
    done

    [[ -z "$TOOLS" ]] && TOOLS="all"

    # Auto-detect source: this script lives at src/scripts/install.sh, so the
    # package root (where dist/agent-src/ lives) is two levels up (../.. ).
    if [[ -z "$SOURCE_DIR" ]]; then
        SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    fi

    # Auto-detect target: PROJECT_ROOT env var, or derive from source location
    if [[ -z "$TARGET_DIR" ]]; then
        if [[ -n "${PROJECT_ROOT:-}" ]]; then
            TARGET_DIR="$PROJECT_ROOT"
        elif [[ "$SOURCE_DIR" == */node_modules/@event4u/agent-config ]]; then
            # npm (scoped): node_modules/@event4u/agent-config → project root is 3 levels up
            TARGET_DIR="$(cd "$SOURCE_DIR/../../.." && pwd)"
        elif [[ "$SOURCE_DIR" == */node_modules/*/agent-config ]]; then
            # npm (unscoped fallback)
            TARGET_DIR="$(cd "$SOURCE_DIR/../../.." && pwd)"
        else
            # Fallback: cwd (manual invocation or local development)
            TARGET_DIR="$(pwd)"
        fi
    fi

    # Resolve source layout. dist/agent-src/ is the only supported source since v2.0.
    if [[ -d "$SOURCE_DIR/dist/agent-src" ]]; then
        SOURCE_PAYLOAD="$SOURCE_DIR/dist/agent-src"
    else
        log_error "Source payload not found: $SOURCE_DIR/dist/agent-src"
        exit 1
    fi
}

show_help() {
    cat <<'EOF'
Usage: bash install.sh [OPTIONS]

Syncs agent-config to target project. Copies rules, symlinks everything else.

Options:
  --source <dir>   Package source directory (default: auto-detect from script location)
  --target <dir>   Target project root (default: $PROJECT_ROOT or cwd)
  --tools <list>   Comma-separated tool IDs (default: all). Filters tool-specific
                   payload (.claude/, .cursor/, .clinerules/, .windsurfrules,
                   GEMINI.md, copilot-instructions.md). The .augment/ substrate
                   and AGENTS.md are always written.
  --dry-run        Show what would happen without making changes
  --verbose        Show detailed output
  --quiet          Suppress all output except errors
  --skip-gitignore Do not touch the target project's .gitignore
  --legacy-both    Also project the Claude plugin manifest
                   (.claude-plugin/marketplace.json) into the consumer install.
                   Default is filesystem-only per the canonical-channel contract
                   at docs/contracts/skill-distribution-channels.md.
  --help, -h       Show this help

Environment:
  PROJECT_ROOT     Override target directory
EOF
}

# --- Utility functions ---

# Read augment.rules_use_symlinks from <TARGET>/.agent-settings.yml.
# Sets USE_RULES_SYMLINKS=true|false. Missing file or absent key → false.
# Minimal scoped parser; avoids a hard yq/python dependency.
resolve_settings() {
    USE_RULES_SYMLINKS=false
    local settings_file="$TARGET_DIR/.agent-settings.yml"
    [[ -f "$settings_file" ]] || return 0
    local val
    val=$(awk '
        /^[^[:space:]#]/ { in_block = ($0 ~ /^augment:[[:space:]]*$/) }
        in_block && /^[[:space:]]+rules_use_symlinks[[:space:]]*:/ {
            line = $0
            sub(/^[[:space:]]*rules_use_symlinks[[:space:]]*:[[:space:]]*/, "", line)
            sub(/[[:space:]]*#.*$/, "", line)
            gsub(/[[:space:]]/, "", line)
            print tolower(line)
            exit
        }
    ' "$settings_file" 2>/dev/null || true)
    case "$val" in
        true|yes|on|1) USE_RULES_SYMLINKS=true ;;
    esac
}

# Check if a relative path should be copied (true=copy) or symlinked (false=symlink)
should_copy() {
    local rel_path="$1"
    local first_segment="${rel_path%%/*}"

    # Root-level files (no /) → symlink
    if [[ "$first_segment" == "$rel_path" ]]; then
        return 1
    fi

    # Check against COPY_DIRS
    for dir in $COPY_DIRS; do
        if [[ "$first_segment" == "$dir" ]]; then
            # Honor augment.rules_use_symlinks toggle for the rules dir.
            if [[ "$dir" == "rules" ]] && $USE_RULES_SYMLINKS; then
                return 1
            fi
            return 0
        fi
    done
    return 1
}

# Resolve a path to its canonical form (cached per session)
# Uses pwd -P to avoid subprocess overhead of realpath
_resolve_path() {
    if [[ -d "$1" ]]; then
        (cd "$1" && pwd -P)
    elif [[ -f "$1" ]]; then
        echo "$(cd "$(dirname "$1")" && pwd -P)/$(basename "$1")"
    else
        echo "$1"
    fi
}

# Calculate relative path from $1 (directory) to $2 (file)
get_relative_path() {
    local from_dir to_file
    from_dir="$(_resolve_path "$1")"
    to_file="$(_resolve_path "$2")"
    _bash_relpath "$from_dir" "$to_file"
}

# Pure bash relative path calculation (no external tools needed)
_bash_relpath() {
    local from="$1" to="$2"
    local common_part="$from" result=""

    while [[ "${to#"$common_part"}" == "${to}" ]]; do
        common_part="$(dirname "$common_part")"
        result="../${result}"
    done

    local forward="${to#"$common_part"}"
    forward="${forward#/}"

    if [[ -n "$result" ]] && [[ -n "$forward" ]]; then
        echo "${result}${forward}"
    elif [[ -n "$result" ]]; then
        echo "${result%/}"
    elif [[ -n "$forward" ]]; then
        echo "$forward"
    else
        echo "."
    fi
}

# Create a relative symlink, with copy fallback
create_symlink() {
    local source_abs="$1"
    local link_abs="$2"
    local link_dir
    link_dir="$(dirname "$link_abs")"

    $DRY_RUN || mkdir -p "$link_dir"

    # Remove existing file/symlink
    if [[ -L "$link_abs" ]] || [[ -f "$link_abs" ]]; then
        $DRY_RUN || rm -f "$link_abs"
    fi

    local rel_path
    rel_path="$(get_relative_path "$link_dir" "$source_abs")"

    if $DRY_RUN; then
        log_verbose "symlink $link_abs → $rel_path"
        return
    fi

    if ! ln -s "$rel_path" "$link_abs" 2>/dev/null; then
        cp "$source_abs" "$link_abs"
        log_warn "Symlink failed, copied: $(basename "$link_abs")"
    fi
}


# --- Core functions ---

# Check if a relative path matches an excluded rule
is_excluded_rule() {
    local rel_path="$1"
    # Pure-bash basename — this runs once per file in hot loops; a
    # $(basename) command substitution here costs a fork per call.
    local filename="${rel_path##*/}"

    for excluded in $EXCLUDE_RULES; do
        if [[ "$filename" == "$excluded" ]]; then
            return 0
        fi
    done
    return 1
}

# Check if a target entry must never be removed by clean_stale
is_preserved_target() {
    local rel_path="$1"
    for preserved in $PRESERVE_TARGET; do
        if [[ "$rel_path" == "$preserved" ]]; then
            return 0
        fi
    done
    return 1
}

# Hybrid sync: copy COPY_DIRS files, symlink everything else
sync_hybrid() {
    local source_augment="$1"
    local target_augment="$2"

    if [[ ! -d "$source_augment" ]]; then
        return
    fi

    $DRY_RUN || mkdir -p "$target_augment"

    # Resolve canonical paths ONCE (avoids per-file subprocess)
    local source_canonical target_canonical
    source_canonical="$(_resolve_path "$source_augment")"
    target_canonical="$(_resolve_path "$target_augment")"

    # Pre-compute base relative path (target → source at the same depth)
    local base_rel
    base_rel="$(_bash_relpath "$target_canonical" "$source_canonical")"

    # Collect all source files (relative paths)
    local source_files
    source_files=$(cd "$source_augment" && find . -type f | sed 's|^\./||' | sort)

    # Sync each file. The body runs ~1200 times per install — every command
    # substitution or external binary in here is a fork that multiplies by
    # the file count (measured: forks in this loop made sync_hybrid ~9.6s of
    # a ~12s install; pure-bash equivalents bring it under 2s).
    local last_mkdir=""
    while IFS= read -r rel_path; do
        [[ -z "$rel_path" ]] && continue

        # Skip package-internal rules that should not be shipped to consumers
        if is_excluded_rule "$rel_path"; then
            log_verbose "skip (internal): $rel_path"
            continue
        fi

        local source_file="$source_augment/$rel_path"
        local target_file="$target_augment/$rel_path"
        # Pure-bash dirname (relative): "." for root-level files.
        local rel_dir="."
        [[ "$rel_path" == */* ]] && rel_dir="${rel_path%/*}"
        local target_dir="$target_augment"
        [[ "$rel_dir" != "." ]] && target_dir="$target_augment/$rel_dir"

        # The file list is sorted, so files in the same directory arrive
        # grouped — mkdir once per directory run instead of once per file.
        if [[ "$target_dir" != "$last_mkdir" ]]; then
            $DRY_RUN || mkdir -p "$target_dir"
            last_mkdir="$target_dir"
        fi

        if should_copy "$rel_path"; then
            # Remove existing symlink before copying
            if [[ -L "$target_file" ]]; then
                $DRY_RUN || rm -f "$target_file"
            fi
            if $DRY_RUN; then
                log_verbose "copy $rel_path"
            else
                cp "$source_file" "$target_file"
            fi
        else
            # Fast symlink: compute relative path from depth offset instead of per-file resolution
            local depth_prefix=""
            if [[ "$rel_dir" != "." ]]; then
                # Directory depth = slash count + 1, computed without forks
                # (the previous echo|tr|wc pipeline forked 3× per file).
                local slashes="${rel_dir//[!\/]/}"
                local depth=$(( ${#slashes} + 1 ))
                local i
                for ((i=0; i<depth; i++)); do
                    depth_prefix="../$depth_prefix"
                done
            fi
            local sym_target="${depth_prefix}${base_rel}/${rel_path}"

            # Remove existing file/symlink
            if [[ -L "$target_file" ]] || [[ -f "$target_file" ]]; then
                $DRY_RUN || rm -f "$target_file"
            fi

            if $DRY_RUN; then
                log_verbose "symlink $target_file → $sym_target"
            else
                if ! ln -s "$sym_target" "$target_file" 2>/dev/null; then
                    cp "$source_file" "$target_file"
                    log_warn "Symlink failed, copied: $(basename "$target_file")"
                fi
            fi
        fi
    done <<< "$source_files"

    # Clean stale entries
    clean_stale "$source_augment" "$target_augment"
}

# Remove stale files and broken symlinks
clean_stale() {
    local source_dir="$1"
    local target_dir="$2"

    if [[ ! -d "$target_dir" ]]; then
        return
    fi

    # Build source manifest
    local source_manifest
    source_manifest=$(cd "$source_dir" && find . -type f | sed 's|^\./||' | sort)

    # Find all entries in target (files + symlinks)
    local target_entries
    target_entries=$(cd "$target_dir" && find . \( -type f -o -type l \) | sed 's|^\./||' | sort)

    # Entries present in target but absent from source — ONE comm fork over
    # the two (already sorted) lists instead of a `grep` fork per target
    # entry (~1280 forks per install before this change).
    local missing_entries
    missing_entries=$(comm -13 <(printf '%s\n' "$source_manifest") <(printf '%s\n' "$target_entries"))

    # Remove stale entries (in target but not in source) and excluded rules
    while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        if is_preserved_target "$entry"; then
            log_verbose "preserve: $entry"
            continue
        fi
        if is_excluded_rule "$entry" || [[ $'\n'"$missing_entries"$'\n' == *$'\n'"$entry"$'\n'* ]]; then
            local path="$target_dir/$entry"
            if $DRY_RUN; then
                log_verbose "remove stale: $entry"
            else
                rm -f "$path"
                log_verbose "Removed stale: $entry"
            fi
        fi
    done <<< "$target_entries"

    # Remove broken symlinks
    while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        local path="$target_dir/$entry"
        if [[ -L "$path" ]] && [[ ! -e "$path" ]]; then
            if $DRY_RUN; then
                log_verbose "remove broken symlink: $entry"
            else
                rm -f "$path"
                log_verbose "Removed broken symlink: $entry"
            fi
        fi
    done <<< "$target_entries"

    # Remove empty directories
    if ! $DRY_RUN; then
        find "$target_dir" -type d -empty -delete 2>/dev/null || true
    fi
}


# Create tool-specific rule symlinks (filtered by --tools selection).
# Map: tool ID → (target dir, relative prefix from target → .augment/rules).
create_tool_symlinks() {
    local project_root="$1"
    local rules_dir="$project_root/.augment/rules"

    [[ -d "$rules_dir" ]] || return 0

    local -a tool_ids=()
    local -a tool_dirs=()
    local -a rel_prefixes=()
    is_tool_enabled "claude-code" && { tool_ids+=("claude-code"); tool_dirs+=(".claude/rules");  rel_prefixes+=("../../.augment/rules"); }
    is_tool_enabled "cursor"      && { tool_ids+=("cursor");      tool_dirs+=(".cursor/rules");  rel_prefixes+=("../../.augment/rules"); }
    is_tool_enabled "cline"       && { tool_ids+=("cline");       tool_dirs+=(".clinerules");    rel_prefixes+=("../.augment/rules"); }

    if [[ ${#tool_dirs[@]} -eq 0 ]]; then
        log_verbose "no tool rule directories selected (--tools=$TOOLS)"
        return 0
    fi

    local count=0
    for i in "${!tool_dirs[@]}"; do
        local dir="${tool_dirs[$i]}"
        local rel_prefix="${rel_prefixes[$i]}"
        local target_dir="$project_root/$dir"

        $DRY_RUN || mkdir -p "$target_dir"

        for rule_file in "$rules_dir"/*.md; do
            [[ -f "$rule_file" ]] || continue
            local filename="${rule_file##*/}"
            local link="$target_dir/$filename"
            local target="$rel_prefix/$filename"

            if [[ -L "$link" ]]; then
                $DRY_RUN || rm -f "$link"
            elif [[ -f "$link" ]]; then
                continue  # Don't overwrite real files
            fi

            if $DRY_RUN; then
                log_verbose "symlink $dir/$filename"
            else
                ln -s "$target" "$link" 2>/dev/null || cp "$rule_file" "$link"
            fi
            ((count++)) || true
        done
    done

    # Clean stale symlinks in tool dirs
    for i in "${!tool_dirs[@]}"; do
        local dir="${tool_dirs[$i]}"
        local target_dir="$project_root/$dir"
        [[ -d "$target_dir" ]] || continue

        for entry in "$target_dir"/*; do
            [[ -L "$entry" ]] || continue
            local entry_name="${entry##*/}"
            # If no matching source rule exists, remove the stale symlink
            if [[ ! -f "$rules_dir/$entry_name" ]]; then
                $DRY_RUN || rm -f "$entry"
                log_verbose "Removed stale tool symlink: $dir/$entry_name"
            fi
        done
    done

    log_info "Created $count rule symlinks across ${#tool_dirs[@]} tool directories (${tool_ids[*]})"
}

# Create .claude/skills/ directory symlinks (claude-code only).
create_skill_symlinks() {
    local project_root="$1"
    local skills_dir="$project_root/.augment/skills"

    [[ -d "$skills_dir" ]] || return 0
    is_tool_enabled "claude-code" || { log_verbose "skip .claude/skills/ (claude-code not selected)"; return 0; }

    local target_dir="$project_root/.claude/skills"
    $DRY_RUN || mkdir -p "$target_dir"

    local count=0
    for skill_dir in "$skills_dir"/*/; do
        [[ -d "$skill_dir" ]] || continue
        local skill_name="${skill_dir%/}"
        skill_name="${skill_name##*/}"
        local link="$target_dir/$skill_name"
        local target="../../.augment/skills/$skill_name"

        if [[ -L "$link" ]]; then
            $DRY_RUN || rm -f "$link"
        elif [[ -d "$link" ]]; then
            continue  # Don't overwrite real directories
        fi

        if $DRY_RUN; then
            log_verbose "symlink .claude/skills/$skill_name"
        else
            ln -s "$target" "$link" 2>/dev/null || {
                # Fallback: copy SKILL.md
                if [[ -f "$skills_dir/$skill_name/SKILL.md" ]]; then
                    mkdir -p "$link"
                    cp "$skills_dir/$skill_name/SKILL.md" "$link/SKILL.md"
                fi
            }
        fi
        ((count++)) || true
    done

    # Clean stale skill symlinks
    for entry in "$target_dir"/*; do
        [[ -L "$entry" ]] || continue
        local entry_name="${entry##*/}"
        if [[ ! -d "$skills_dir/$entry_name" ]]; then
            $DRY_RUN || rm -f "$entry"
            log_verbose "Removed stale skill symlink: .claude/skills/$entry_name"
        fi
    done

    log_info "Created $count skill symlinks in .claude/skills/"
}

# Generate .windsurfrules from all rules (strip frontmatter)
generate_windsurfrules() {
    local project_root="$1"
    local rules_dir="$project_root/.augment/rules"

    [[ -d "$rules_dir" ]] || return 0
    is_tool_enabled "windsurf" || { log_verbose "skip .windsurfrules (windsurf not selected)"; return 0; }

    local output="$project_root/.windsurfrules"
    local count=0

    if $DRY_RUN; then
        log_verbose "generate .windsurfrules"
        return
    fi

    echo "# Auto-generated from .augment/rules/ — do not edit directly" > "$output"
    echo "" >> "$output"

    for rule_file in "$rules_dir"/*.md; do
        [[ -f "$rule_file" ]] || continue
        local content
        content="$(cat "$rule_file")"

        # Strip YAML frontmatter (between first and second ---)
        if [[ "$content" == ---* ]]; then
            content="$(echo "$content" | awk 'BEGIN{skip=0} /^---$/{skip++; next} skip>=2{print}')"
        fi

        echo "---" >> "$output"
        echo "" >> "$output"
        echo "$content" >> "$output"
        echo "" >> "$output"
        ((count++)) || true
    done

    log_info "Generated .windsurfrules ($count rules)"
}


# Run scripts/_lib/scope_guard.sh as a pre-flight check. On DRIFT findings
# the function surfaces a numbered-options prompt and aborts on no-confirm
# paths. SCOPE_GUARD_BYPASS=1 (set by the orchestrator, CI runs, and
# --dry-run) skips the prompt entirely. Findings are always logged in
# verbose mode regardless.
run_scope_guard() {
    local target="$1"
    local guard="$SOURCE_DIR/src/scripts/_lib/scope_guard.sh"

    # Skip when the guard is not present (e.g. trimmed install bundle).
    [[ -f "$guard" ]] || { log_verbose "scope_guard.sh not found — skipping cross-scope drift check"; return 0; }

    # Bypass paths that cannot or must not be interactive.
    if $DRY_RUN; then
        log_verbose "skip scope_guard (--dry-run)"
        return 0
    fi
    if [[ "${SCOPE_GUARD_BYPASS:-0}" == "1" ]]; then
        log_verbose "skip scope_guard (SCOPE_GUARD_BYPASS=1)"
        return 0
    fi
    if [[ "${CI:-0}" == "true" ]] || [[ "${CI:-0}" == "1" ]]; then
        log_verbose "skip scope_guard (CI=true)"
        return 0
    fi

    local output verdict
    output="$(bash "$guard" project "$SOURCE_DIR" "$target" 2>/dev/null || true)"
    [[ -n "$output" ]] || return 0

    local summary
    summary="$(echo "$output" | grep '^SUMMARY' | tail -1)"
    [[ -n "$summary" ]] || return 0
    verdict="$(echo "$summary" | cut -f2)"

    if [[ "$verdict" == "OK" ]]; then
        log_verbose "scope_guard OK (no cross-scope install)"
        return 0
    fi

    if [[ "$verdict" == "WARN" ]]; then
        $QUIET || {
            echo ""
            echo "  ⚠️  Cross-scope install detected (same version, no drift)."
            echo "$output" | awk -F'\t' '$1=="WARN" { printf "       - %s at %s (v%s)\n", $2, $3, $4 }'
            echo ""
        }
        return 0
    fi

    # DRIFT: surface the gate. Non-interactive shells get the warning and
    # an exit code that the caller can short-circuit with SCOPE_GUARD_BYPASS=1.
    echo ""
    echo "  ❌  Cross-scope DRIFT detected — same package installed at user AND project scope at different versions:"
    echo "$output" | awk -F'\t' '$1=="DRIFT" { printf "       - %s: other-scope=%s (v%s) vs this-install=v%s\n", $2, $3, $4, $5 }'
    echo ""
    echo "      The 2026-05-25 root cause (duplicate skill registration with stale frontmatter)"
    echo "      will fire when both registrations load. Choose how to proceed:"
    echo ""
    echo "         1. Abort install — fix drift first (recommended)"
    echo "         2. Upgrade the OTHER scope first (run scripts/install.sh --target=\$HOME or equivalent)"
    echo "         3. Force install at this scope — accept drift (set SCOPE_GUARD_BYPASS=1)"
    echo "         4. Clean the other scope (bash scripts/cleanup_other_scope.sh --confirm)"
    echo ""
    echo "      Recommendation: 1"
    echo ""

    # In interactive mode the caller has stdin; we honour SCOPE_GUARD_BYPASS=1
    # already above. Default: abort.
    if [[ -t 0 ]]; then
        local choice
        read -r -p "      Enter 1-4 [default 1]: " choice || choice=1
        case "${choice:-1}" in
            2) echo "      → Re-run scripts/install.sh against the other scope first; aborting this run."; exit 2 ;;
            3) log_warn "Continuing despite DRIFT (user opted into option 3)" ;;
            4) echo "      → Run: bash scripts/cleanup_other_scope.sh --confirm — then retry."; exit 2 ;;
            *) echo "      → Aborting (option 1)."; exit 2 ;;
        esac
    else
        echo "      Non-interactive shell — aborting. Set SCOPE_GUARD_BYPASS=1 to override."
        exit 2
    fi
}

# Resolve the tsx runner (Python→TypeScript migration). Echoes the runner
# command on stdout and returns 0 when found, else returns 1.
resolve_tsx_bin() {
    if [[ -x "$SOURCE_DIR/node_modules/.bin/tsx" ]]; then
        printf '%s' "$SOURCE_DIR/node_modules/.bin/tsx"
        return 0
    fi
    if command -v npx >/dev/null 2>&1; then
        printf '%s' "npx tsx"
        return 0
    fi
    return 1
}

# Post-install skill-registration probe (Phase C Step 6). Informational by
# default; PROBE_STRICT=1 turns drift findings into a non-zero exit so a
# release install fails loudly. Skipped in dry-run and when tsx or the
# probe script is missing (older bundles).
run_post_install_probe() {
    local target="$1"
    local probe="$SOURCE_DIR/src/scripts/probe_skill_registration.ts"

    [[ -f "$probe" ]] || { log_verbose "skip probe_skill_registration.ts (not found)"; return 0; }
    local tsx_bin
    tsx_bin="$(resolve_tsx_bin)" || {
        log_verbose "skip skill-registration probe (tsx missing)"
        return 0
    }
    if $DRY_RUN; then
        log_verbose "skip skill-registration probe (--dry-run)"
        return 0
    fi
    if [[ "${PROBE_BYPASS:-0}" == "1" ]]; then
        log_verbose "skip skill-registration probe (PROBE_BYPASS=1)"
        return 0
    fi

    local args=( "$probe" "--project" "$target" "--format=text" )
    [[ "${PROBE_STRICT:-0}" == "1" ]] && args+=("--strict")

    # shellcheck disable=SC2086
    if $tsx_bin "${args[@]}" > /tmp/agent-config-probe.$$ 2>&1; then
        # On clean output (no findings) only show a one-liner.
        if grep -qE 'DUPLICATE|DRIFT' /tmp/agent-config-probe.$$; then
            $QUIET || echo ""
            $QUIET || echo "  ⚠️  Skill-registration findings:"
            $QUIET || sed -n '/DUPLICATE\|DRIFT/,$p' /tmp/agent-config-probe.$$ | head -40
            $QUIET || echo ""
            $QUIET || echo "      Run: ./scripts-run src/scripts/probe_skill_registration — for the full report."
        else
            log_info "Skill-registration probe: clean (no duplicates / drift)"
        fi
        rm -f /tmp/agent-config-probe.$$
        return 0
    else
        local code=$?
        echo ""
        echo "  ❌  Skill-registration probe surfaced DUPLICATE / DRIFT findings (PROBE_STRICT=1):"
        sed -n '/DUPLICATE\|DRIFT/,$p' /tmp/agent-config-probe.$$ | head -40
        rm -f /tmp/agent-config-probe.$$
        return "$code"
    fi
}

# Project the Claude plugin manifest into the consumer install — gated on
# --legacy-both. Default install path is filesystem-only per the canonical-
# channel contract (docs/contracts/skill-distribution-channels.md). Only
# users on older Claude Code harnesses that need both channels opt in.
project_legacy_plugin_manifest() {
    local project_root="$1"
    local source_manifest="$SOURCE_DIR/.claude-plugin/marketplace.json"
    local target_manifest="$project_root/.claude-plugin/marketplace.json"

    if ! $LEGACY_BOTH; then
        log_verbose "skip .claude-plugin/marketplace.json (filesystem is canonical; use --legacy-both to opt in)"
        return 0
    fi
    is_tool_enabled "claude-code" || { log_verbose "skip .claude-plugin/marketplace.json (claude-code not selected)"; return 0; }
    [[ -f "$source_manifest" ]] || { log_verbose "skip .claude-plugin/marketplace.json (source manifest absent)"; return 0; }

    if $DRY_RUN; then
        log_verbose "copy .claude-plugin/marketplace.json (--legacy-both)"
        return
    fi
    mkdir -p "$(dirname "$target_manifest")"
    cp "$source_manifest" "$target_manifest"
    log_info "Projected .claude-plugin/marketplace.json (--legacy-both opted in)"
}

# Create GEMINI.md symlink (gemini-cli only).
create_gemini_md() {
    local project_root="$1"
    local link="$project_root/GEMINI.md"

    is_tool_enabled "gemini-cli" || { log_verbose "skip GEMINI.md (gemini-cli not selected)"; return 0; }

    if [[ -L "$link" ]] || [[ -f "$link" ]]; then
        return  # Don't overwrite
    fi

    if $DRY_RUN; then
        log_verbose "symlink GEMINI.md → AGENTS.md"
        return
    fi

    ln -s "AGENTS.md" "$link" 2>/dev/null || true
    log_info "Created GEMINI.md → AGENTS.md symlink"
}

# Copy file if it doesn't exist in target
copy_if_missing() {
    local source="$1"
    local target="$2"

    [[ -f "$source" ]] || return 0
    [[ -f "$target" ]] && return 0

    if $DRY_RUN; then
        log_verbose "copy $(basename "$target") (missing)"
        return
    fi

    mkdir -p "$(dirname "$target")"
    cp "$source" "$target"
}

# Migrate legacy infra files to their current home under agents/runtime/.
# Three source layouts are handled per file:
#   - pre-2.x:           <name> at project root
#   - 2.x intermediate:  agents/<name>
#   - current:           agents/runtime/<name>
# Covered files: .agent-chat-history (+ .bak) and the append-only budget
# history JSONLs. Idempotent: skips silently if the target already exists;
# never overwrites.
#
# .agent-prices.md is handled separately by migrate_legacy_prices_file.
migrate_legacy_root_infra() {
    local project_root="$1"
    local runtime_dir="$project_root/agents/runtime"
    local items=(
        ".agent-chat-history"
        ".agent-chat-history.bak"
        ".augment-budget-history.jsonl"
        ".rule-budget-history.jsonl"
    )

    for name in "${items[@]}"; do
        local target="$runtime_dir/$name"
        local sources=("$project_root/$name" "$project_root/agents/$name")

        for old in "${sources[@]}"; do
            [[ -e "$old" ]] || continue

            if [[ -e "$target" ]]; then
                log_warn "Legacy ${old#"$project_root/"} found, but agents/runtime/$name already exists — leaving source in place"
                continue
            fi

            if $DRY_RUN; then
                log_verbose "would migrate ${old#"$project_root/"} → agents/runtime/$name"
                continue
            fi

            mkdir -p "$runtime_dir"
            mv "$old" "$target"
            log_info "Migrated ${old#"$project_root/"} → agents/runtime/$name"
        done
    done
}

# Migrate the low-impact decision corpus from agents/ to agents/decisions/.
# Pre-refactor: the .md and its .lock.yaml lived at agents/ root. They
# now live under agents/decisions/ to separate tracked decisions from
# volatile runtime data. Idempotent: skips silently if the target
# already exists; never overwrites.
migrate_legacy_low_impact_decisions() {
    local project_root="$1"
    local decisions_dir="$project_root/agents/decisions"
    local items=("low-impact-decisions.md" "low-impact-decisions.lock.yaml")

    for name in "${items[@]}"; do
        local old="$project_root/agents/$name"
        local target="$decisions_dir/$name"

        [[ -e "$old" ]] || continue

        if [[ -e "$target" ]]; then
            log_warn "Legacy agents/$name found, but agents/decisions/$name already exists — leaving source in place"
            continue
        fi

        if $DRY_RUN; then
            log_verbose "would migrate agents/$name → agents/decisions/$name"
            continue
        fi

        mkdir -p "$decisions_dir"
        mv "$old" "$target"
        log_info "Migrated agents/$name → agents/decisions/$name"
    done
}

# Migrate the AI Council price cache to its current home under agents/runtime/.
# Two source locations are handled:
#   - pre-2.x:           .agent-prices.md at project root
#   - 2.x intermediate:  agents/.agent-prices.md
# Both move to agents/runtime/.agent-prices.md. Idempotent: skips silently
# if the target already exists; never overwrites.
migrate_legacy_prices_file() {
    local project_root="$1"
    local runtime_dir="$project_root/agents/runtime"
    local target="$runtime_dir/.agent-prices.md"
    local sources=("$project_root/.agent-prices.md" "$project_root/agents/.agent-prices.md")

    for old in "${sources[@]}"; do
        [[ -e "$old" ]] || continue

        if [[ -e "$target" ]]; then
            log_warn "Legacy ${old#"$project_root/"} found, but agents/runtime/.agent-prices.md already exists — leaving source in place"
            continue
        fi

        if $DRY_RUN; then
            log_verbose "would migrate ${old#"$project_root/"} → agents/runtime/.agent-prices.md"
            continue
        fi

        mkdir -p "$runtime_dir"
        mv "$old" "$target"
        log_info "Migrated ${old#"$project_root/"} → agents/runtime/.agent-prices.md"
    done
}

# Migrate the AI Council config from agents/.ai-council.yml to
# agents/settings/.ai-council.yml. Idempotent: skips silently if the
# target already exists; never overwrites.
migrate_legacy_council_yml() {
    local project_root="$1"
    local settings_dir="$project_root/agents/settings"
    local target="$settings_dir/.ai-council.yml"
    local source="$project_root/agents/.ai-council.yml"

    [[ -e "$source" ]] || return 0

    if [[ -e "$target" ]]; then
        log_warn "Legacy agents/.ai-council.yml found, but agents/settings/.ai-council.yml already exists — leaving source in place"
        return 0
    fi

    if $DRY_RUN; then
        log_verbose "would migrate agents/.ai-council.yml → agents/settings/.ai-council.yml"
        return 0
    fi

    mkdir -p "$settings_dir"
    mv "$source" "$target"
    log_info "Migrated agents/.ai-council.yml → agents/settings/.ai-council.yml"
}

# Ensure .gitignore contains the managed agent-config block.
# Delegates to scripts/sync_gitignore.ts so the installer and the
# standalone /sync-gitignore command share one source of truth
# (src/config/gitignore-block.txt). Honors --dry-run and --skip-gitignore.
ensure_gitignore() {
    local project_root="$1"
    local gitignore="$project_root/.gitignore"
    local sync_script="$SOURCE_DIR/src/scripts/sync_gitignore.ts"
    local template="$SOURCE_DIR/src/config/gitignore-block.txt"

    if $SKIP_GITIGNORE; then
        log_verbose "skip .gitignore (--skip-gitignore)"
        return 0
    fi

    # Match the pre-refactor behavior: don't create .gitignore in a
    # project that doesn't use git / doesn't already have one.
    if [[ ! -f "$gitignore" ]]; then
        return 0
    fi

    if [[ ! -f "$sync_script" || ! -f "$template" ]]; then
        log_warn ".gitignore sync skipped — script or template missing"
        return 0
    fi

    local args=(--path "$gitignore" --template "$template" --quiet)
    $DRY_RUN && args+=(--dry-run)

    local tsx_bin
    tsx_bin="$(resolve_tsx_bin)" || {
        log_warn ".gitignore sync skipped — tsx runner missing"
        return 0
    }
    # shellcheck disable=SC2086
    if $tsx_bin "$sync_script" "${args[@]}" >/dev/null 2>&1; then
        log_verbose ".gitignore synced"
    else
        log_warn ".gitignore sync failed (exit $?)"
    fi
}

# Install the consumer-facing CLI wrapper `./agent-config` at the project
# root. Gitignored, overwritten on every install, delegates to the master
# CLI shipped in the package (node_modules) or fetched on demand via npx.
install_cli_wrapper() {
    local project_root="$1"
    local template="$SOURCE_DIR/src/templates/agent-config-wrapper.sh"
    local target="$project_root/agent-config"

    if [[ ! -f "$template" ]]; then
        log_verbose "CLI wrapper template missing: $template — skipping"
        return 0
    fi

    if $DRY_RUN; then
        log_verbose "install CLI wrapper → $target"
        return
    fi

    cp "$template" "$target"
    chmod +x "$target"
    log_info "Installed ./agent-config wrapper"
}

# --- Main ---
# Phase 6 of monorepo-phase-3-typescript-installer (ADR-016 § Distribution):
# direct `bash install.sh` invocations are deprecated in favor of the
# TypeScript installer (`npx @event4u/agent-config init`). The banner only
# fires when this script is invoked directly — the orchestrator
# (scripts/install) and the consumer `./agent-config` wrapper set
# AGENT_CONFIG_FROM_ORCHESTRATOR=1 to suppress the noise. Removal target:
# the cutover release that flips the npx entry point to the TS installer.
emit_deprecation_banner() {
    $QUIET && return 0
    [[ "${AGENT_CONFIG_FROM_ORCHESTRATOR:-0}" == "1" ]] && return 0
    [[ "${AGENT_CONFIG_SUPPRESS_DEPRECATION:-0}" == "1" ]] && return 0
    echo "  ⚠️  Direct \`bash install.sh\` is deprecated (ADR-016 § Distribution)." >&2
    echo "      Prefer:  npx @event4u/agent-config init" >&2
    echo "      Or:      bash src/scripts/install   (orchestrator, suppresses this banner)" >&2
    echo "" >&2
}

main() {
    parse_args "$@"
    emit_deprecation_banner

    # Minimal-init short-circuit (Step 7 Phase 2): skip every payload-sync
    # stage and only install the project-local `./agent-config` wrapper.
    # The bridge stage (install.py) handles the .agent-settings.yml stub
    # + nested-install guard. No .augment/, no AGENTS.md, no symlinks.
    if $MINIMAL; then
        if ! $QUIET; then
            echo "🔧  Minimal init — installing ./agent-config wrapper only"
            echo "    Target: $TARGET_DIR"
            $DRY_RUN && echo "    Mode: DRY RUN"
        fi
        install_cli_wrapper "$TARGET_DIR"
        $QUIET || echo "✅  Wrapper installed (payload sync skipped)."
        return 0
    fi

    # First-run detection: gate the verbose source/target banner behind the
    # absence of .agent-settings.yml. Re-runs print a single status line.
    local is_first_run=false
    [[ ! -f "$TARGET_DIR/.agent-settings.yml" ]] && is_first_run=true

    if $is_first_run && ! $QUIET; then
        echo "🔧  Syncing agent-config payload..."
        echo "    Source: $SOURCE_DIR"
        echo "    Target: $TARGET_DIR"
        $DRY_RUN && echo "    Mode: DRY RUN"
        echo ""
    fi

    # 0a. Cross-scope drift pre-flight (Phase B Step 3). Detect prior installs
    #     of the same package at the OTHER scope (user-global ↔ project-local).
    #     On DRIFT the function surfaces a numbered-options gate per the
    #     non-destructive-by-default contract. SCOPE_GUARD_BYPASS=1 from the
    #     orchestrator or a CI run skips the gate so non-interactive paths do
    #     not hang.
    run_scope_guard "$TARGET_DIR"

    # 0b. Migrate legacy infra files (root → agents/) before any content sync.
    migrate_legacy_root_infra "$TARGET_DIR"
    migrate_legacy_low_impact_decisions "$TARGET_DIR"
    migrate_legacy_prices_file "$TARGET_DIR"
    migrate_legacy_council_yml "$TARGET_DIR"

    # 0b. Resolve settings (e.g. augment.rules_use_symlinks). On first
    #     install the file does not exist yet → defaults preserved.
    resolve_settings

    # 1. Hybrid sync payload → target/.augment/
    sync_hybrid "$SOURCE_PAYLOAD" "$TARGET_DIR/.augment"
    if $USE_RULES_SYMLINKS; then
        log_info "Synced .augment/ (rules symlinked, rest symlinked)"
    else
        log_info "Synced .augment/ (rules copied, rest symlinked)"
    fi

    # 2. Copy standalone files from templates if missing on the target.
    #    We copy from templates/ (generic placeholders), NOT from the package's
    #    own root AGENTS.md / copilot-instructions.md — those are meta docs
    #    about the package itself and would leak package-specific content
    #    into consumer projects.
    #    AGENTS.md is the universal cross-tool contract (aider, codex, claude,
    #    etc.) and is always written. copilot-instructions.md is gated on the
    #    copilot tool selection.
    copy_if_missing "$SOURCE_PAYLOAD/templates/AGENTS.md" "$TARGET_DIR/AGENTS.md"
    if is_tool_enabled "copilot"; then
        copy_if_missing "$SOURCE_PAYLOAD/templates/copilot-instructions.md" "$TARGET_DIR/.github/copilot-instructions.md"
    else
        log_verbose "skip .github/copilot-instructions.md (copilot not selected)"
    fi

    # 3. Create tool-specific symlinks
    create_tool_symlinks "$TARGET_DIR"
    create_skill_symlinks "$TARGET_DIR"

    # 3b. Optionally project the Claude plugin manifest (--legacy-both).
    project_legacy_plugin_manifest "$TARGET_DIR"

    # 4. Generate files
    generate_windsurfrules "$TARGET_DIR"
    create_gemini_md "$TARGET_DIR"

    # 5. Install consumer CLI wrapper (gitignored, overwritten on every install)
    install_cli_wrapper "$TARGET_DIR"

    # 5b. Post-install registration probe (Phase C Step 6). Surfaces any
    #     duplicate / drifting skill registrations the new install would
    #     conflict with. PROBE_STRICT=1 (set by release installs) flips
    #     informational output into a non-zero exit so a release stops on
    #     drift findings.
    run_post_install_probe "$TARGET_DIR"

    # 6. Manage .gitignore
    ensure_gitignore "$TARGET_DIR"

    if $is_first_run && ! $QUIET; then
        echo ""
        echo "✅  agent-config payload synced."
        echo "    Run src/scripts/install (or ./scripts-run src/scripts/install) to render .agent-settings.yml and bridges."
        # step-9 P11 · U1 — airgap detection. Probe DNS for provider hosts;
        # on first-run with no reachable backend, surface the banner so the
        # installer caller can flip defaults.member_mode to `api`.
        local _airgap_tsx
        if _airgap_tsx="$(resolve_tsx_bin)"; then
            local airgap_mode
            # shellcheck disable=SC2086
            airgap_mode="$($_airgap_tsx "$SOURCE_DIR/src/scripts/ai_council/airgap.ts" 2>/dev/null || true)"
            if [[ "$airgap_mode" == "api" ]]; then
                echo ""
                echo "⚠️  airgapped environment detected — defaulting to mode: api"
                echo "    Set defaults.member_mode: api in agents/settings/.ai-council.yml when configuring the council."
            fi
        fi
    elif ! $QUIET; then
        echo "✅  agent-config payload synced."
    fi
}

main "$@"
