#!/usr/bin/env bash
# Unpack a .docx (an OOXML file is a ZIP of XML parts) into a directory for XML editing.
# Usage: docx_unpack.sh <file.docx> <target-dir>
set -euo pipefail

SRC="${1:?usage: docx_unpack.sh <file.docx> <target-dir>}"
DIR="${2:?usage: docx_unpack.sh <file.docx> <target-dir>}"

[ -f "$SRC" ] || { echo "error: not a file: $SRC" >&2; exit 1; }
mkdir -p "$DIR"
unzip -o -q "$SRC" -d "$DIR"
echo "unpacked: $SRC -> $DIR"
find "$DIR" -name '*.xml' | sed 's/^/  /'
