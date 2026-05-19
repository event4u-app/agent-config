#!/usr/bin/env python3
"""Lint a generated discovery-manifest.json against schema + checksum.

Checks:
1. File parses as JSON.
2. Validates against `docs/contracts/discovery-manifest.schema.json`.
3. Recomputes sha256 with the `checksum` field zeroed and compares.
4. Cross-references workspace / pack IDs against `config/discovery/*.yml`.

CLI:
  python scripts/lint_discovery_manifest.py [--manifest PATH]

Exit codes:
  0  clean
  1  schema or integrity failure
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import yaml

try:
    import jsonschema
except ImportError:
    print("error: jsonschema not installed (pip install jsonschema)", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "docs" / "contracts" / "discovery-manifest.schema.json"
VOCAB_DIR = ROOT / "config" / "discovery"
DEFAULT_MANIFEST = ROOT / "dist" / "discovery" / "discovery-manifest.json"


def _serialize(manifest: dict[str, Any]) -> str:
    return json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def _check_checksum(manifest: dict[str, Any]) -> str | None:
    actual = manifest.get("checksum", "")
    if not isinstance(actual, str) or not actual.startswith("sha256:"):
        return f"checksum: malformed value {actual!r}"
    snapshot = dict(manifest)
    snapshot["checksum"] = "sha256:" + "0" * 64
    raw = _serialize(snapshot).encode("utf-8")
    expected = "sha256:" + hashlib.sha256(raw).hexdigest()
    if expected != actual:
        return f"checksum mismatch: expected {expected}, got {actual}"
    return None


def _check_vocab(manifest: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    workspaces = yaml.safe_load((VOCAB_DIR / "workspaces.yml").read_text(encoding="utf-8")) or []
    packs = yaml.safe_load((VOCAB_DIR / "packs.yml").read_text(encoding="utf-8")) or []
    ws_ids = {w["id"] for w in workspaces}
    pack_ids = {p["id"] for p in packs}

    m_ws_ids = {w["id"] for w in manifest.get("workspaces", [])}
    m_pk_ids = {p["id"] for p in manifest.get("packs", [])}
    if m_ws_ids != ws_ids:
        diff = ws_ids ^ m_ws_ids
        errs.append(f"workspaces: vocabulary/manifest mismatch on {sorted(diff)}")
    if m_pk_ids != pack_ids:
        diff = pack_ids ^ m_pk_ids
        errs.append(f"packs: vocabulary/manifest mismatch on {sorted(diff)}")

    for a in manifest.get("artefacts", []):
        for w in a.get("workspaces", []):
            if w not in ws_ids:
                errs.append(f"{a['path']}: unknown workspace '{w}'")
        for p in a.get("packs", []):
            if p not in pack_ids:
                errs.append(f"{a['path']}: unknown pack '{p}'")
    return errs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)

    if not args.manifest.exists():
        print(f"error: manifest not found at {args.manifest}", file=sys.stderr)
        return 1

    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON: {exc}", file=sys.stderr)
        return 1

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    try:
        jsonschema.validate(manifest, schema)
    except jsonschema.ValidationError as exc:
        print(f"schema error: {exc.message}", file=sys.stderr)
        path = "/".join(str(p) for p in exc.absolute_path)
        if path:
            print(f"  at: {path}", file=sys.stderr)
        return 1

    if (err := _check_checksum(manifest)):
        print(f"error: {err}", file=sys.stderr)
        return 1

    vocab_errs = _check_vocab(manifest)
    if vocab_errs:
        for e in vocab_errs[:20]:
            print(f"error: {e}", file=sys.stderr)
        if len(vocab_errs) > 20:
            print(f"  ... and {len(vocab_errs) - 20} more", file=sys.stderr)
        return 1

    if not args.quiet:
        print(
            f"OK {args.manifest.relative_to(ROOT)}: "
            f"{len(manifest['artefacts'])} artefacts, "
            f"{len(manifest['unassigned'])} unassigned, "
            f"checksum verified"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
