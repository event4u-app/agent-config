#!/usr/bin/env bash
# road-to-source-silence Phase 4.3 — the local half of the metadata gate.
#
# `.github/workflows/pr-metadata-sources.yml` is the backstop, and by the time
# it runs the branch name and commit messages are already on the remote. This
# script gives the author the same verdict while the metadata is still private,
# which is the only point at which fixing it is free: a pushed branch ref and a
# pushed commit message are public, and the recorded decision of the
# `whether-history-gets-rewritten` blocker is that they are never rewritten.
#
# Checks the branch being pushed and the commit messages the push would add.
# The PR title and body do not exist yet locally, so those two surfaces are
# CI-only — stated rather than implied, because a local pass is not a full pass.
#
# Install (opt-in, a human action — this repo does not write to .git/hooks):
#
#   ln -s ../../src/scripts/hooks/prepush_metadata_sources.sh .git/hooks/pre-push
#
# or, if a pre-push hook already exists, call this from it:
#
#   src/scripts/hooks/prepush_metadata_sources.sh "$@" || exit 1
#
# Bypass, for a maintainer who needs it: AGENT_CONFIG_SKIP_METADATA_GATE=1.
# `git push --no-verify` also bypasses it and is blocked for agents by the
# `block-no-verify` guard; that asymmetry is deliberate — a human may bypass
# their own local hook, an agent may not.
set -euo pipefail

if [ -n "${AGENT_CONFIG_SKIP_METADATA_GATE:-}" ]; then
    exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

if [ ! -x ./scripts-run ]; then
    # No runner in this checkout: say so and let the push through rather than
    # blocking on our own missing tooling. CI still gates the same surfaces.
    echo "pre-push: ./scripts-run not found — skipping the source-metadata gate (CI still runs it)." >&2
    exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
RANGE=""

# git feeds pre-push `<local ref> <local sha> <remote ref> <remote sha>` on
# stdin, one line per ref. An all-zero remote sha means a new branch, for which
# there is no useful range — fall back to the merge base with the default trunk.
ZERO="0000000000000000000000000000000000000000"
while read -r _local_ref local_sha _remote_ref remote_sha; do
    [ -z "${local_sha:-}" ] && continue
    # An all-zero LOCAL sha is a branch DELETION: nothing is being added, so
    # there is no commit range, and building one from zeros made `git log` fail
    # and the failure read as a confidentiality finding.
    [ "${local_sha}" = "0000000000000000000000000000000000000000" ] && continue
    if [ "${remote_sha:-${ZERO}}" = "${ZERO}" ]; then
        base="$(git merge-base "${local_sha}" origin/main 2>/dev/null || true)"
        [ -n "${base}" ] && RANGE="${base}..${local_sha}"
    else
        RANGE="${remote_sha}..${local_sha}"
    fi
done || true

ARGS=(--gate-metadata --branch "${BRANCH}")
if [ -n "${RANGE}" ]; then
    ARGS+=(--commit-range "${RANGE}")
fi

# Exit codes are NOT interchangeable and were being conflated: 1 is a real
# finding, 2 is a usage error or an unreadable config, and anything else is the
# tool failing rather than the change failing. Reporting all of them as
# "carries source attribution" told an author to rewrite a clean branch name.
set +e
./scripts-run src/scripts/sweep_source_surfaces "${ARGS[@]}"
rc=$?
set -e

if [ "${rc}" -eq 2 ]; then
    echo "pre-push: the source-metadata gate could not RUN (exit 2 — usage or unreadable config)." >&2
    echo "          This is not a finding about your branch. CI runs the same check." >&2
    exit 0
fi

if [ "${rc}" -ne 0 ] && [ "${rc}" -ne 1 ]; then
    echo "pre-push: the source-metadata gate exited ${rc} — unexpected, and not a finding." >&2
    echo "          Letting the push through; CI runs the same check." >&2
    exit 0
fi

if [ "${rc}" -eq 1 ]; then
    cat >&2 <<'EOF'

pre-push: BLOCKED by the source-metadata gate.

A branch name or commit message in this push carries source attribution. Both
become public on push and are effectively permanent: the recorded decision is
that trunk history is NOT rewritten, so this is the last moment it is free to
fix.

  branch  -> git branch -m <opaque-name>
  commit  -> git commit --amend   (or an interactive rebase for an older one)

Opaque forms: inbox-2026-08-h · round-a91f3c · S17
Rule: src/rules/source-confidentiality.md
Bypass, deliberately: AGENT_CONFIG_SKIP_METADATA_GATE=1 git push ...
EOF
    exit 1
fi

exit 0
