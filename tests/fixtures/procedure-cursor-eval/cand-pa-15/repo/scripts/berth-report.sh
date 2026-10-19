#!/bin/sh
set -eu

awk -F, '{ total += $3 } END { print "berth hours:", total }' "${1:-berths.csv}"
