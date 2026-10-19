#!/bin/sh
set -eu

LOG_DIR="${LOG_DIR:-/var/log/harbour}"
find "$LOG_DIR" -name '*.log' -mtime +14 -exec gzip {} \;
