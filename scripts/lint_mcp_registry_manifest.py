#!/usr/bin/env python3
"""Lint `dist/mcp/registry-manifest.json` against its JSON Schema.

Asserts:
  * file exists
  * validates against `docs/contracts/mcp-registry-manifest.schema.json`
  * `dist/mcp/awesome-mcp-servers.row.md` is non-empty and parses as a
    single Markdown table row (one `|`-delimited line)
  * `dist/mcp/mcp-cloudflare-catalogue.json` is valid JSON

Exits 0 on success, 1 on any failure. `--quiet` suppresses the OK line.

Roadmap: agents/roadmaps/strategic-visibility-mcp-topics-positioning.md Phase 2 exit gate.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "docs" / "contracts" / "mcp-registry-manifest.schema.json"
MANIFEST = ROOT / "dist" / "mcp" / "registry-manifest.json"
ROW_MD = ROOT / "dist" / "mcp" / "awesome-mcp-servers.row.md"
CF_JSON = ROOT / "dist" / "mcp" / "mcp-cloudflare-catalogue.json"


def _fail(msg: str) -> int:
    print(f"\u274c  {msg}", file=sys.stderr)
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    for p in (SCHEMA, MANIFEST, ROW_MD, CF_JSON):
        if not p.exists():
            return _fail(f"missing: {p.relative_to(ROOT)}")

    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    try:
        jsonschema.Draft202012Validator(schema).validate(manifest)
    except jsonschema.ValidationError as e:
        return _fail(f"schema validation: {e.message} at {list(e.absolute_path)}")

    row = ROW_MD.read_text(encoding="utf-8").strip()
    if not row:
        return _fail("awesome-mcp-servers.row.md is empty")
    if row.count("\n") != 0 or row.count("|") < 4:
        return _fail("awesome-mcp-servers.row.md must be a single `|`-delimited row")

    try:
        json.loads(CF_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return _fail(f"mcp-cloudflare-catalogue.json: {e}")

    if not args.quiet:
        print(f"\u2705  mcp registry manifest OK ({len(manifest['registries'])} registries)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
