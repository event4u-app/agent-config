# Divergence: build_cloud_bundle

## Script

- Python: `src/scripts/build_cloud_bundle.py`
- TypeScript: `src/scripts/build_cloud_bundle.ts`

## Symptom

The `.zip` bundles produced by `--skill` / `--all` are **not byte-identical**
between the Python and TypeScript implementations, although every
**decompressed entry** is byte-identical (verified across all 227 skills,
0/227 content mismatches).

- **Python output:** `zipfile.ZIP_DEFLATED` archive — CPython zlib deflate
  parameters, fixed entry timestamp, PyYAML-era header fields
  (version-needed, extra-field, external-attr), entry order from `Path.rglob`.
- **TS output:** `_lib/zip_min` deflate archive — Node zlib deflate
  parameters and ZIP header field defaults differ; sibling entry order is
  sorted deterministically.
- Affected channel(s): the raw bytes of the written `.zip` file only. stdout,
  exit code, `manifest.json` (modulo the tmp out-path), and every decompressed
  entry's content are byte-identical.

## Root cause

The ZIP container is an envelope, not the payload. The two ecosystems' deflate
encoders (CPython `zlib` vs Node `zlib`) choose different compression block
boundaries and Huffman tables for the same input, and the two ZIP writers
populate optional local/central-directory header fields
(version-needed-to-extract, extra field, external file attributes, the fixed
mod-time) differently. None of this changes what a consumer extracts — only
the on-disk archive bytes. The migration contract for this script is the
**extracted content** (what the Claude.ai cloud bundle delivers), which is
preserved exactly.

## Verdict

`formatting-only` — byte difference in the archive container with no semantic
or consumer impact. The bundle's delivered content (per-entry decompressed
bytes), the `manifest.json`, the console output, and the exit code are all
byte-identical.

## Evidence

`tests/scripts/build_cloud_bundle.test.ts` — the golden-parity layer builds
the bundle with both `python3` and `tsx` into separate tmp out-dirs, then
asserts: (1) console output byte-identical, (2) `manifest.json` byte-identical
after normalizing the tmp path, (3) the **decompressed ZIP entry map**
byte-identical across all 227 skills (0 mismatches). The raw-archive-bytes
difference is explicitly not asserted, by design, and is documented in the
module header.

A second, latent behavior was found and faithfully replicated (not a
divergence in itself): the docstring claims exit codes 2/3/4/5 for
budget/source failures, but the Python actually raises
`SystemExit("❌ …")` with a string argument, which prints to stderr and exits
**1**. The TS twin reproduces the real behavior (message → stderr, exit 1).

## Approval

- Reviewer: matze4u
- Date: 2026-06-12
