#!/usr/bin/env python3
"""Snapshot the agent-config build outputs for byte-identity verification.

Used by monorepo Phase 4 (physical layout move) to assert that the
pre-move and post-move `task sync` + `task build-discovery` outputs
match byte-for-byte except for `artefacts[].path` values.

Captures sha256 of every file under:
  - .agent-src/
  - .augment/
  - dist/discovery/discovery-manifest.json (also stores parsed copy
    with paths stripped so the post-move diff is path-only)

CLI:
  --out PATH    write JSON to this path (default: dist/migration/pre-move-snapshot.json)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "dist" / "migration" / "pre-move-snapshot.json"

TARGETS = (
    ROOT / ".agent-src",
    ROOT / ".augment",
)
MANIFEST = ROOT / "dist" / "discovery" / "discovery-manifest.json"


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _hash_tree(root: Path) -> dict[str, str]:
    if not root.exists():
        return {}
    hashes: dict[str, str] = {}
    for p in sorted(root.rglob("*")):
        if p.is_file():
            hashes[p.relative_to(ROOT).as_posix()] = _sha256(p)
    return hashes


def _manifest_path_stripped(manifest_path: Path) -> dict[str, Any] | None:
    if not manifest_path.exists():
        return None
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    # Strip `path` from every artefact so the diff is path-only.
    for a in data.get("artefacts", []):
        a.pop("path", None)
    # Drop `generated_at` (timestamp drift expected) and recompute totals.
    data.pop("generated_at", None)
    return data


def _build_snapshot() -> dict[str, Any]:
    snap: dict[str, Any] = {"schema_version": "1", "trees": {}}
    for tgt in TARGETS:
        key = tgt.relative_to(ROOT).as_posix()
        snap["trees"][key] = _hash_tree(tgt)
    snap["manifest_sha256"] = _sha256(MANIFEST) if MANIFEST.exists() else None
    snap["manifest_path_stripped"] = _manifest_path_stripped(MANIFEST)
    return snap


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    snap = _build_snapshot()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(snap, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    n_files = sum(len(t) for t in snap["trees"].values())
    print(f"Snapshot: {args.out.relative_to(ROOT)}")
    print(f"  files hashed     : {n_files}")
    print(f"  trees            : {list(snap['trees'])}")
    print(f"  manifest sha256  : {snap['manifest_sha256'][:16] if snap['manifest_sha256'] else 'MISSING'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
