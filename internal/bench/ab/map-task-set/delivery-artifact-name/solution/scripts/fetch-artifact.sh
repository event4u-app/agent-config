#!/bin/sh
set -eu
gh run download "$1" -n web-dist -D dist
