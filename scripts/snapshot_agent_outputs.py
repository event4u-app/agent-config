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


# Runtime artefacts that never participate in byte-identity verification.
# Eval last-run.json + pytest caches are gitignored; including them just
# adds noise when the worktree is clean.
_SKIP_NAMES = frozenset({"last-run.json"})
_SKIP_DIRS = frozenset({".pytest_cache", "__pycache__", ".mypy_cache",
                         ".ruff_cache", "node_modules", ".DS_Store"})


def _hash_tree(root: Path) -> dict[str, str]:
    if not root.exists():
        return {}
    hashes: dict[str, str] = {}
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        if p.name in _SKIP_NAMES:
            continue
        if any(part in _SKIP_DIRS for part in p.parts):
            continue
        hashes[p.relative_to(ROOT).as_posix()] = _sha256(p)
    return hashes


def _logical_path(rel: str) -> str:
    """Strip any source-root prefix (legacy or packages/*) so the diff
    compares the artefact's logical identity, not its physical location.
    Non-source paths are returned unchanged.
    """
    posix = rel.replace("\\", "/")
    if posix.startswith(".agent-src.uncompressed/"):
        return posix[len(".agent-src.uncompressed/"):]
    if posix.startswith("packages/"):
        marker = "/.agent-src.uncompressed/"
        idx = posix.find(marker)
        if idx != -1:
            return posix[idx + len(marker):]
    return posix


def _manifest_path_stripped(manifest_path: Path) -> dict[str, Any] | None:
    if not manifest_path.exists():
        return None
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    # Strip `path` from every artefact so the diff is path-only, then
    # re-sort by (category, checksum) so the list order is content-stable
    # — the original sort is path-based, which shifts when files move
    # between roots even though no artefact body changed.
    artefacts = data.get("artefacts", []) or []
    for a in artefacts:
        a.pop("path", None)
    artefacts.sort(key=lambda a: (a.get("category", ""), a.get("checksum", "")))
    data["artefacts"] = artefacts
    # Normalise unassigned / documented_unassigned to logical paths and
    # re-sort so the post-move diff is content-only.
    for key in ("unassigned", "documented_unassigned"):
        entries = data.get(key) or []
        for e in entries:
            if isinstance(e, dict) and "path" in e:
                e["path"] = _logical_path(e["path"])
        entries.sort(key=lambda e: (e.get("path", ""), e.get("category", "")))
        data[key] = entries
    # Drop volatile fields: timestamp, the manifest's own checksum (which
    # covers everything above and changes with any path text), and the
    # scanner_version (sha of the build script — moves with code edits).
    data.pop("generated_at", None)
    data.pop("checksum", None)
    data.pop("scanner_version", None)
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
