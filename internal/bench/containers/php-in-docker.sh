#!/bin/sh
# A `php` for the artifact graders on a host without PHP:
#   BENCH_PHP_BIN=internal/bench/containers/php-in-docker.sh
# Pull the image once first (`docker pull php:8.3-cli`): the grader's `-v`
# probe allows five seconds.
#
# Handles the two calls the graders make: `php -v`, and
# `php -S 127.0.0.1:<port> -t <docroot> [router]` with the working directory a
# throwaway copy of the workspace. The server binds 0.0.0.0 inside the container
# and is published on 127.0.0.1 only. The grader stops a server with SIGTERM,
# which `docker run` forwards to the container; as a backstop against a SIGKILL
# nothing can forward, each container ends itself after BENCH_PHP_TTL seconds
# (default 120), and `--rm` removes it.
set -eu
IMAGE="${BENCH_PHP_IMAGE:-php@sha256:7d334491cf2f46f6c93ac63f5e16664d8edb46bd016b40a67e089fe9a6c893cd}"
TTL="${BENCH_PHP_TTL:-120}"

if [ "${1:-}" = "-v" ]; then
    exec docker run --rm "$IMAGE" php -v
fi

if [ "${1:-}" != "-S" ] || [ $# -lt 2 ]; then
    echo "php-in-docker: only 'php -v' and 'php -S 127.0.0.1:<port> ...' are supported" >&2
    exit 2
fi
port="${2##*:}"
shift 2
here="$(pwd -P)"
# The grader passes paths under the unresolved temp dir (/var/folders on macOS,
# a symlink to /private/var/folders); mount the copy under both spellings.
also=""
case "$here" in /private/*) also="-v ${here}:${here#/private}" ;; esac
# shellcheck disable=SC2086
exec docker run --rm --init -p "127.0.0.1:${port}:${port}" -v "${here}:${here}" $also -w "${here}" "$IMAGE" \
    timeout "$TTL" php -S "0.0.0.0:${port}" "$@"
