#!/usr/bin/env bash
# Pack an unpacked docx directory back into a .docx and validate the result.
# Usage: docx_pack.sh <dir> <out.docx>
set -euo pipefail

DIR="${1:?usage: docx_pack.sh <dir> <out.docx>}"
OUT="${2:?usage: docx_pack.sh <dir> <out.docx>}"

[ -f "$DIR/[Content_Types].xml" ] || { echo "error: $DIR is not an unpacked docx (missing [Content_Types].xml)" >&2; exit 1; }

# zip stores paths relative to cwd; -X drops platform extra fields for clean OPC.
OUT_ABS="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
rm -f "$OUT_ABS"
(cd "$DIR" && zip -r -q -X "$OUT_ABS" . -x '.*')

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/docx_validate.sh" "$OUT_ABS"
