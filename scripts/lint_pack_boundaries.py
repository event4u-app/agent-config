#!/usr/bin/env python3
"""Enforce cross-pack reference boundaries.

Phase 4.4 of the monorepo migration (ADR-017). Walks every markdown
link in every artefact under ``packages/*/.agent-src.uncompressed/``
and verifies the link target's pack is either the same pack, ``core``
(always allowed), or listed in the source pack's ``requires``.

Reports every violation with ``source -> target`` plus the offending
pack edge. Exits non-zero if any are found.

CLI:
  --format text|json   default text
  --quiet              suppress per-file noise; only print violations
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = ROOT / "packages"

LINK_RE = re.compile(r"\[[^\]]*\]\(([^)#?]+)(?:[#?][^)]*)?\)")


def _load_pack_meta(pkg_dir: Path) -> dict[str, Any]:
    pack_yaml = pkg_dir / "pack.yaml"
    if not pack_yaml.exists():
        return {}
    data = yaml.safe_load(pack_yaml.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _build_artefact_index() -> dict[str, str]:
    """Map repo-relative POSIX artefact path -> pack id."""
    index: dict[str, str] = {}
    if not PACKAGES.exists():
        return index
    for pkg in sorted(PACKAGES.iterdir()):
        if not pkg.is_dir():
            continue
        src_root = pkg / ".agent-src.uncompressed"
        if not src_root.is_dir():
            continue
        pid = _load_pack_meta(pkg).get("id") or pkg.name.removeprefix("pack-")
        for p in src_root.rglob("*.md"):
            if p.is_file():
                index[p.relative_to(ROOT).as_posix()] = pid
    return index


def _resolve_link(source_file: Path, raw: str) -> Path | None:
    """Resolve a markdown link target to a repo-relative path, or None."""
    target = raw.strip()
    if not target or target.startswith(("http://", "https://", "mailto:", "ftp://")):
        return None
    if target.startswith("/"):
        return None  # absolute web paths, ignored
    try:
        resolved = (source_file.parent / target).resolve()
    except OSError:
        return None
    try:
        return resolved.relative_to(ROOT)
    except ValueError:
        return None


def _scan_file(path: Path) -> list[str]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return []
    return LINK_RE.findall(text)


def _is_allowed(source_pack: str, target_pack: str, requires: list[str]) -> bool:
    if source_pack == target_pack:
        return True
    if target_pack == "core":
        return True
    return target_pack in (requires or [])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--format", choices=["text", "json"], default="text")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    artefact_pack = _build_artefact_index()
    if not artefact_pack:
        print("no packages/ tree to lint — skipping", file=sys.stderr)
        return 0

    pack_requires: dict[str, list[str]] = {}
    for pkg in sorted(PACKAGES.iterdir()):
        if pkg.is_dir():
            meta = _load_pack_meta(pkg)
            pid = meta.get("id") or pkg.name.removeprefix("pack-")
            pack_requires[pid] = list(meta.get("requires") or [])

    violations: list[dict[str, str]] = []
    for rel_path, src_pack in artefact_pack.items():
        source_file = ROOT / rel_path
        for raw in _scan_file(source_file):
            target_rel = _resolve_link(source_file, raw)
            if target_rel is None:
                continue
            target_key = target_rel.as_posix()
            target_pack = artefact_pack.get(target_key)
            if target_pack is None:
                continue  # link to docs/, scripts/, root files — not pack-scoped
            if _is_allowed(src_pack, target_pack, pack_requires.get(src_pack, [])):
                continue
            violations.append({
                "source_pack": src_pack,
                "target_pack": target_pack,
                "source": rel_path,
                "target": target_key,
                "link": raw,
            })

    if args.format == "json":
        json.dump({"violations": violations, "count": len(violations)}, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        if not args.quiet:
            print(f"lint_pack_boundaries: scanned {len(artefact_pack)} artefacts across {len(pack_requires)} packs")
        for v in violations:
            print(f"  ✗ {v['source_pack']} -> {v['target_pack']} : {v['source']} → {v['target']} (link: {v['link']})")
        if violations:
            print(f"\n{len(violations)} cross-pack violation(s) — declare 'requires' in pack.yaml or move the artefact")
        elif not args.quiet:
            print("OK — no cross-pack drift")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
