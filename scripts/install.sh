#!/usr/bin/env bash
# install.sh — Portable agent-config installer
# Syncs .augment/ to target project: copies rules, symlinks everything else.
# Creates tool-specific directories for Claude Code, Cursor, Cline, Windsurf, Gemini.
#
# Usage:
#   bash scripts/install.sh [--source <dir>] [--target <dir>] [--dry-run] [--verbose] [--quiet]
#
# Environment:
#   PROJECT_ROOT  — override target directory (default: cwd)

set -euo pipefail

# --- Configuration ---
COPY_DIRS="rules"  # Subdirectories where files must be real copies (space-separated)
GITIGNORE_MARKER="# galawork/agent-config"

# Rules that are internal to the agent-config package and should NOT be shipped to consumers.
# These are only relevant when developing the agent-config package itself.
EXCLUDE_RULES="augment-source-of-truth.md augment-portability.md docs-sync.md"

# Files inside target/.augment/ that are NOT managed by sync (created by the bridge installer).
# Never remove them in clean_stale even though they are absent in the source manifest.
PRESERVE_TARGET="settings.json"

# --- Globals ---
SOURCE_DIR=""
TARGET_DIR=""
DRY_RUN=false
VERBOSE=false
QUIET=false

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
            --help|-h) show_help; exit 0 ;;
            *) log_error "Unknown argument: $1"; show_help; exit 1 ;;
        esac
    done

    # Auto-detect source: directory where this script lives (../  = package root)
    if [[ -z "$SOURCE_DIR" ]]; then
        SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    fi

    # Auto-detect target: PROJECT_ROOT env var, or derive from source location
    if [[ -z "$TARGET_DIR" ]]; then
        if [[ -n "${PROJECT_ROOT:-}" ]]; then
            TARGET_DIR="$PROJECT_ROOT"
        elif [[ "$SOURCE_DIR" == */vendor/event4u/agent-config ]]; then
            # Composer: vendor/event4u/agent-config → project root is 3 levels up
            TARGET_DIR="$(cd "$SOURCE_DIR/../../.." && pwd)"
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

    # Validate
    if [[ ! -d "$SOURCE_DIR/.augment" ]]; then
        log_error "Source directory not found: $SOURCE_DIR/.augment"
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
  --dry-run        Show what would happen without making changes
  --verbose        Show detailed output
  --quiet          Suppress all output except errors
  --help, -h       Show this help

Environment:
  PROJECT_ROOT     Override target directory
EOF
}

# --- Utility functions ---

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

    mkdir -p "$link_dir"

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
    local filename
    filename="$(basename "$rel_path")"

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

    # Sync each file
    while IFS= read -r rel_path; do
        [[ -z "$rel_path" ]] && continue

        # Skip package-internal rules that should not be shipped to consumers
        if is_excluded_rule "$rel_path"; then
            log_verbose "skip (internal): $rel_path"
            continue
        fi

        local source_file="$source_augment/$rel_path"
        local target_file="$target_augment/$rel_path"
        local target_dir
        target_dir="$(dirname "$target_file")"

        mkdir -p "$target_dir"

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
            local rel_dir
            rel_dir="$(dirname "$rel_path")"
            local depth_prefix=""
            if [[ "$rel_dir" != "." ]]; then
                # Count directory depth and prepend ../ for each level
                local depth
                depth=$(echo "$rel_dir" | tr '/' '\n' | wc -l | tr -d ' ')
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

    # Remove stale entries (in target but not in source) and excluded rules
    while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        if is_preserved_target "$entry"; then
            log_verbose "preserve: $entry"
            continue
        fi
        if is_excluded_rule "$entry" || ! echo "$source_manifest" | grep -qxF "$entry"; then
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


# Create tool-specific rule symlinks
create_tool_symlinks() {
    local project_root="$1"
    local rules_dir="$project_root/.augment/rules"

    [[ -d "$rules_dir" ]] || return

    local -a tool_dirs=(".claude/rules" ".cursor/rules" ".clinerules")
    local -a rel_prefixes=("../../.augment/rules" "../../.augment/rules" "../.augment/rules")

    local count=0
    for i in "${!tool_dirs[@]}"; do
        local dir="${tool_dirs[$i]}"
        local rel_prefix="${rel_prefixes[$i]}"
        local target_dir="$project_root/$dir"

        mkdir -p "$target_dir"

        for rule_file in "$rules_dir"/*.md; do
            [[ -f "$rule_file" ]] || continue
            local filename
            filename="$(basename "$rule_file")"
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
            local entry_name
            entry_name="$(basename "$entry")"
            # If no matching source rule exists, remove the stale symlink
            if [[ ! -f "$rules_dir/$entry_name" ]]; then
                $DRY_RUN || rm -f "$entry"
                log_verbose "Removed stale tool symlink: $dir/$entry_name"
            fi
        done
    done

    log_info "Created $count rule symlinks across ${#tool_dirs[@]} tool directories"
}

# Create .claude/skills/ directory symlinks
create_skill_symlinks() {
    local project_root="$1"
    local skills_dir="$project_root/.augment/skills"

    [[ -d "$skills_dir" ]] || return

    local target_dir="$project_root/.claude/skills"
    mkdir -p "$target_dir"

    local count=0
    for skill_dir in "$skills_dir"/*/; do
        [[ -d "$skill_dir" ]] || continue
        local skill_name
        skill_name="$(basename "$skill_dir")"
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
        local entry_name
        entry_name="$(basename "$entry")"
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

    [[ -d "$rules_dir" ]] || return

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


# Create GEMINI.md symlink
create_gemini_md() {
    local project_root="$1"
    local link="$project_root/GEMINI.md"

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

    [[ -f "$source" ]] || return
    [[ -f "$target" ]] && return

    if $DRY_RUN; then
        log_verbose "copy $(basename "$target") (missing)"
        return
    fi

    mkdir -p "$(dirname "$target")"
    cp "$source" "$target"
}

# Ensure .gitignore contains agent-config entries
ensure_gitignore() {
    local project_root="$1"
    local gitignore="$project_root/.gitignore"

    if [[ ! -f "$gitignore" ]]; then
        return 0
    fi

    if grep -qF "$GITIGNORE_MARKER" "$gitignore"; then
        return 0  # Already present
    fi

    if $DRY_RUN; then
        log_verbose "append .gitignore block"
        return
    fi

    cat >> "$gitignore" << 'BLOCK'

# galawork/agent-config
# Agent config — symlinked from vendor (auto-managed)
.augment/skills/
.augment/commands/
.augment/guidelines/
.augment/templates/
.augment/contexts/
.augment/scripts/
.augment/README.md

# Agent config — NOT ignored (real copies, may contain project overrides)
# .augment/rules/
BLOCK
}

# Detect python3 (or python, if it is Python 3) — returns the binary path or empty
find_python() {
    local candidate
    for candidate in python3 python; do
        local path
        path="$(command -v "$candidate" 2>/dev/null || true)"
        [[ -z "$path" ]] && continue
        if "$path" -c 'import sys; exit(0 if sys.version_info[0] >= 3 else 1)' 2>/dev/null; then
            echo "$path"
            return 0
        fi
    done
    return 1
}

# Render .agent-settings + JSON bridges using the Python installer
run_bridge_installer() {
    local source_dir="$1"
    local target_dir="$2"
    local installer="$source_dir/scripts/install.py"

    if [[ ! -f "$installer" ]]; then
        log_verbose "Skipping bridge installer (not found): $installer"
        return
    fi

    local python_bin
    if ! python_bin="$(find_python)"; then
        log_warn "Python 3 not found — skipping .agent-settings and bridge files."
        log_warn "Install python3 and re-run, or: python3 $installer"
        return
    fi

    if $DRY_RUN; then
        log_verbose "would run: $python_bin $installer --project $target_dir"
        return
    fi

    if $QUIET; then
        "$python_bin" "$installer" --project "$target_dir" --package "$source_dir" --quiet || \
            log_warn "Bridge installer exited with errors (continuing)."
    else
        "$python_bin" "$installer" --project "$target_dir" --package "$source_dir" || \
            log_warn "Bridge installer exited with errors (continuing)."
    fi
}

# --- Main ---
main() {
    parse_args "$@"

    $QUIET || echo "🔧  Installing agent-config..."
    $QUIET || echo "    Source: $SOURCE_DIR"
    $QUIET || echo "    Target: $TARGET_DIR"
    $DRY_RUN && ! $QUIET && echo "    Mode: DRY RUN"
    echo ""

    # 1. Hybrid sync .augment/
    sync_hybrid "$SOURCE_DIR/.augment" "$TARGET_DIR/.augment"
    log_info "Synced .augment/ (rules copied, rest symlinked)"

    # 2. Copy standalone files if missing
    copy_if_missing "$SOURCE_DIR/AGENTS.md" "$TARGET_DIR/AGENTS.md"
    copy_if_missing "$SOURCE_DIR/.github/copilot-instructions.md" "$TARGET_DIR/.github/copilot-instructions.md"

    # 3. Create tool-specific symlinks
    create_tool_symlinks "$TARGET_DIR"
    create_skill_symlinks "$TARGET_DIR"

    # 4. Generate files
    generate_windsurfrules "$TARGET_DIR"
    create_gemini_md "$TARGET_DIR"

    # 5. Manage .gitignore
    ensure_gitignore "$TARGET_DIR"

    # 6. Render .agent-settings + JSON bridges via Python installer
    run_bridge_installer "$SOURCE_DIR" "$TARGET_DIR"

    echo ""
    $QUIET || echo "✅  agent-config installed successfully."
}

main "$@"
