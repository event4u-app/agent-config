#!/usr/bin/env bash
# cleanup_other_scope.sh — remove a stale agent-config install at the OTHER
# scope (typically ~/.claude/skills/ when working in a project-local install).
#
# Roadmap: road-to-clean-skill-distribution-channels.md, Phase B Step 5.
# Companion to scripts/_lib/scope_guard.sh. Refuses to run without --confirm
# per `non-destructive-by-default`.
#
# Usage:
#   bash scripts/cleanup_other_scope.sh                      # dry-run, list what would be removed
#   bash scripts/cleanup_other_scope.sh --confirm            # actually delete
#   bash scripts/cleanup_other_scope.sh --confirm --user     # default — remove user-global tree
#   bash scripts/cleanup_other_scope.sh --confirm --project /path/to/proj
#                                                            # remove from a specific project root
#
# What it removes (subject to --tools selection):
#   .claude/skills/                — Claude project-local skill tree
#   .augment/                       — Augment substrate
#   .cursor/rules/                  — Cursor rules tree
#   .clinerules/                    — Cline rules tree
#   .windsurf/rules/                — Windsurf rules tree
#   .github/copilot-instructions.md — Copilot single-file
#
# What it NEVER removes without explicit overrides:
#   .agent-settings.yml             — settings the operator may have edited
#   agents/                          — project-local content authored by the user
#   any path outside the scoped roots

set -euo pipefail

SCOPE="user"
SCOPE_ROOT=""
TOOLS_FILTER="all"
DRY_RUN=true

usage() {
    cat <<'EOF'
Usage: bash scripts/cleanup_other_scope.sh [--confirm] [--user | --project <dir>] [--tools <list>]

Removes a stale agent-config install at the OTHER scope (user-global by default).
Refuses to delete anything without --confirm.

Options:
  --confirm              Actually remove files. Default is dry-run (lists only).
  --user                 Operate on $HOME (user-global scope). Default.
  --project <dir>        Operate on a specific project root.
  --tools <list>         Comma-separated tool IDs (default: all).
                         Choices: claude-code, augment, cursor, cline, windsurf, copilot.
  --help, -h             Show this help.

Examples:
  bash scripts/cleanup_other_scope.sh                                 # dry-run, user scope
  bash scripts/cleanup_other_scope.sh --confirm                       # delete user-global tree
  bash scripts/cleanup_other_scope.sh --confirm --tools=claude-code   # delete only ~/.claude/skills/
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --confirm)         DRY_RUN=false; shift ;;
        --user)            SCOPE="user"; shift ;;
        --project)
            if [[ $# -lt 2 ]] || [[ "$2" == --* ]]; then
                echo "❌  --project requires a path argument." >&2
                exit 1
            fi
            SCOPE="project"; SCOPE_ROOT="$2"; shift 2 ;;
        --project=*)       SCOPE="project"; SCOPE_ROOT="${1#*=}"; shift ;;
        --tools)           TOOLS_FILTER="$2"; shift 2 ;;
        --tools=*)         TOOLS_FILTER="${1#*=}"; shift ;;
        --help|-h)         usage; exit 0 ;;
        *)                 echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
    esac
done

is_tool() {
    [[ "$TOOLS_FILTER" == "all" ]] && return 0
    case ",$TOOLS_FILTER," in
        *,"$1",*) return 0 ;;
    esac
    return 1
}

# Resolve scope root.
if [[ "$SCOPE" == "user" ]]; then
    SCOPE_ROOT="${HOME:-/tmp}"
elif [[ -z "$SCOPE_ROOT" ]]; then
    echo "❌  --project requires a path." >&2
    exit 1
fi
if [[ ! -d "$SCOPE_ROOT" ]]; then
    echo "❌  Scope root not found: $SCOPE_ROOT" >&2
    exit 1
fi

declare -a targets=()
is_tool claude-code && {
    targets+=("$SCOPE_ROOT/.claude/skills")
    targets+=("$SCOPE_ROOT/.claude/rules")
    targets+=("$SCOPE_ROOT/.claude-plugin/marketplace.json")
}
is_tool augment      && {
    targets+=("$SCOPE_ROOT/.augment")
    targets+=("$SCOPE_ROOT/.augment-plugin")
}
is_tool cursor       && targets+=("$SCOPE_ROOT/.cursor/rules")
is_tool cline        && targets+=("$SCOPE_ROOT/.clinerules")
is_tool windsurf     && {
    targets+=("$SCOPE_ROOT/.windsurf/rules")
    targets+=("$SCOPE_ROOT/.windsurfrules")
}
is_tool copilot      && targets+=("$SCOPE_ROOT/.github/copilot-instructions.md")

if [[ ${#targets[@]} -eq 0 ]]; then
    echo "❌  No tools selected (--tools=$TOOLS_FILTER)." >&2
    exit 1
fi

echo "Scope:   $SCOPE ($SCOPE_ROOT)"
echo "Tools:   $TOOLS_FILTER"
echo "Mode:    $($DRY_RUN && echo 'DRY RUN (use --confirm to delete)' || echo 'DELETE')"
echo ""

removed=0
skipped=0
for t in "${targets[@]}"; do
    if [[ -e "$t" ]] || [[ -L "$t" ]]; then
        if $DRY_RUN; then
            echo "  would remove: $t"
        else
            rm -rf "$t"
            echo "  removed:      $t"
        fi
        ((removed++)) || true
    else
        ((skipped++)) || true
    fi
done

echo ""
if $DRY_RUN; then
    echo "✅  Dry-run complete: $removed entries would be removed, $skipped already absent."
    echo "    Re-run with --confirm to apply."
else
    echo "✅  Cleanup complete: $removed entries removed, $skipped already absent."
fi
