#!/bin/sh
set -eu
gh run download "$1" -n dist-bundle -D dist
