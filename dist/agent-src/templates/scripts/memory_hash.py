#!/usr/bin/env python3
"""Content-addressed hash for a curated memory entry.

The hash is SHA-256 over the canonical-JSON-serialized entry, truncated
to the first 12 hex chars. Canonical JSON sorts object keys, uses no
extra whitespace, and normalises types so two equivalent entries hash
identically regardless of YAML formatting.

Used by `/memory-promote` to pick the filename
`agents/memory/<type>/<hash>.yml` so the same entry promoted on two
branches converges to a single file after `git merge`.

Usage:
    python3 scripts/memory_hash.py --yaml path/to/entry.yml
    echo '{"id":"x"}' | python3 scripts/memory_hash.py --json-stdin
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

HASH_LEN = 12


def canonical_json(obj: Any) -> bytes:
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    ).encode("utf-8")


def hash_entry(obj: Any) -> str:
    return hashlib.sha256(canonical_json(obj)).hexdigest()[:HASH_LEN]


def _load_yaml(path: Path) -> Any:
    try:
        import yaml
    except ImportError:
        print("error: PyYAML not installed. `pip install pyyaml`.",
              file=sys.stderr)
        sys.exit(2)
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    grp = ap.add_mutually_exclusive_group(required=True)
    grp.add_argument("--yaml", help="YAML file containing one entry")
    grp.add_argument("--json-stdin", action="store_true",
                     help="Read JSON object from stdin")
    args = ap.parse_args()
    if args.yaml:
        entry = _load_yaml(Path(args.yaml))
    else:
        entry = json.load(sys.stdin)
    if not isinstance(entry, (dict, list)):
        print(f"error: expected object/array, got {type(entry).__name__}",
              file=sys.stderr)
        return 1
    print(hash_entry(entry))
    return 0


if __name__ == "__main__":
    sys.exit(main())
