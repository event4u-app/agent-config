#!/usr/bin/env bash
# Validate a .docx: ZIP integrity, required OPC parts, XML well-formedness of every part.
# Usage: docx_validate.sh <file.docx>
# Exit 0 = valid; non-zero = broken (message on stderr).
set -euo pipefail

SRC="${1:?usage: docx_validate.sh <file.docx>}"
[ -f "$SRC" ] || { echo "error: not a file: $SRC" >&2; exit 1; }

# 1. ZIP integrity.
unzip -t -q "$SRC" > /dev/null || { echo "FAIL: zip integrity ($SRC)" >&2; exit 1; }

# 2. Required OPC parts.
LISTING="$(unzip -Z1 "$SRC")"
for part in '[Content_Types].xml' '_rels/.rels' 'word/document.xml'; do
  grep -qxF "$part" <<< "$LISTING" || { echo "FAIL: missing required part: $part" >&2; exit 1; }
done

# 3. XML well-formedness of every .xml part (xmllint preferred, python3 fallback).
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
unzip -o -q "$SRC" -d "$WORK"

check_xml() {
  if command -v xmllint > /dev/null 2>&1; then
    xmllint --noout "$1"
  else
    python3 -c 'import sys, xml.dom.minidom; xml.dom.minidom.parse(sys.argv[1])' "$1"
  fi
}

while IFS= read -r -d '' xml; do
  check_xml "$xml" || { echo "FAIL: malformed XML: ${xml#"$WORK"/}" >&2; exit 1; }
done < <(find "$WORK" -name '*.xml' -print0)

echo "OK: $SRC (zip integrity, required parts, XML well-formed)"
