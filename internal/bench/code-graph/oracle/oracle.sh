#!/usr/bin/env bash
# On-demand oracle container for the code-graph benchmark v3 (road-to-a-graph-that-wins 2.2).
#
#   internal/bench/code-graph/oracle/oracle.sh build
#   internal/bench/code-graph/oracle/oracle.sh deps  <subject-dir>
#   internal/bench/code-graph/oracle/oracle.sh run   <subject-dir> <cmd> [args…]
#
# `deps` installs the subject's composer and npm dependencies INTO <subject-dir>, with
# network. Point it at a throwaway copy of the pinned clone, never at the clone the
# benchmark arms read: vendor/ and node_modules/ must not exist there.
# `run` executes one command in the image with the subject mounted at /subject and
# --network none, so whatever the indexers load cannot reach out.
set -euo pipefail

IMAGE="agent-config-graph-oracle:v3"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    sed -n '4,6p' "$0" | sed 's/^# //' >&2
    exit 2
}

need_dir() {
    [[ -n "${1:-}" && -d "$1" ]] || { echo "oracle.sh: subject directory '${1:-}' does not exist" >&2; exit 2; }
    (cd "$1" && pwd)
}

cmd="${1:-}"
[[ -n "$cmd" ]] || usage
shift

case "$cmd" in
    build)
        docker build -t "$IMAGE" "$HERE"
        ;;
    deps)
        dir="$(need_dir "${1:-}")"
        docker run --rm -v "$dir:/subject" "$IMAGE" sh -c '
            set -e
            if [ -f composer.json ]; then
                composer install --no-interaction --no-progress --no-scripts --ignore-platform-reqs
            fi
            if [ -f package.json ]; then
                npm install --ignore-scripts --no-audit --no-fund
            fi'
        ;;
    run)
        dir="$(need_dir "${1:-}")"
        shift
        [[ $# -gt 0 ]] || usage
        docker run --rm -i --network none --memory 12g -v "$dir:/subject" "$IMAGE" "$@"
        ;;
    *)
        usage
        ;;
esac
