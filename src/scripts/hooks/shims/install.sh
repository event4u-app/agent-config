#!/usr/bin/env bash
# Session-scoped shim installer — road-to-skill-ecosystem-runtime-enforcement
# Phase 1 Step 1.
#
# Prepends this directory to PATH **for the current shell session only**.
#
# WHY SESSION-ONLY, AND WHY THAT IS THE WHOLE DESIGN. This script never writes
# to a profile, a login file, or any shell rc. A shim changes what a developer's
# shell resolves, so an installer that persists it changes their machine until
# they find the line and remove it. Session scope makes the whole mechanism
# reversible by closing the terminal, which is the property that let the AI
# council scope Phase 1 to a shim at all: the reversible option is the one that
# ships first.
#
# USAGE — it must be SOURCED, not executed. A child process cannot alter its
# parent's PATH, so running it does nothing observable, and saying so is better
# than appearing to work:
#
#     . src/scripts/hooks/shims/install.sh      # sh / bash / zsh
#
# UNINSTALL: close the shell, or `. src/scripts/hooks/shims/install.sh --off`.

_shims_self() {
    # BASH_SOURCE under bash, $0 under a POSIX sh that sourced us. Resolved to a
    # physical path so a symlinked checkout does not produce a PATH entry that
    # fails to match on removal.
    if [ -n "${BASH_SOURCE:-}" ]; then
        printf '%s' "${BASH_SOURCE[0]}"
    else
        printf '%s' "$0"
    fi
}

_shims_dir=$(CDPATH= cd -- "$(dirname -- "$(_shims_self)")" && pwd -P)

# Rebuild PATH without this directory. Used by both paths: --off removes it, and
# the install path uses it so sourcing twice does not stack duplicates.
_shims_path_without() {
    printf '%s' "${PATH:-}" | tr ':' '\n' | while IFS= read -r _p; do
        [ -n "$_p" ] || continue
        _rp=$(CDPATH= cd -- "$_p" 2>/dev/null && pwd -P) || _rp="$_p"
        [ "$_rp" = "$_shims_dir" ] && continue
        printf '%s:' "$_p"
    done
}

if [ "${1:-}" = "--off" ]; then
    _clean=$(_shims_path_without)
    PATH="${_clean%:}"
    export PATH
    printf 'shims: removed %s from PATH for this session\n' "$_shims_dir" >&2
else
    _clean=$(_shims_path_without)
    PATH="$_shims_dir:${_clean%:}"
    export PATH
    printf 'shims: %s is first on PATH for this session only.\n' "$_shims_dir" >&2
    printf 'shims: nothing was written to a profile. Close the shell, or pass --off, to undo.\n' >&2
    printf 'shims: AGENT_CONFIG_DISABLE_HOOKS=1 bypasses every shim for one command.\n' >&2
fi

unset _clean
