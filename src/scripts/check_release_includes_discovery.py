#!/usr/bin/env python3
"""Assert dist/discovery/discovery-manifest.json ships with the package.

Phase 5.3 of R3 — wired as a `prepublishOnly` hook in package.json and
re-used by the publish workflow. Fails loudly when:
  - dist/discovery/discovery-manifest.json is missing
  - the file is empty or not valid JSON
  - the artefacts array is empty
  - the summary sibling is missing (release tarball ships both)

The intent is that `npm publish` (and `npm pack`) refuse to produce a
silently-broken artifact where the discovery contract surface
(ADR-013) is absent from the consumer install path.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "dist" / "discovery" / "discovery-manifest.json"
SUMMARY = ROOT / "dist" / "discovery" / "discovery-manifest.summary.md"


def _die(msg: str) -> int:
    sys.stderr.write(f"check-release-discovery: {msg}\n")
    sys.stderr.write(
        "  hint: run `python3 scripts/build_discovery_manifest.py --write --strict`"
        " before `npm pack` / `npm publish`.\n"
    )
    return 1


def main() -> int:
    if not MANIFEST.is_file():
        return _die(f"{MANIFEST.relative_to(ROOT)} is missing.")
    raw = MANIFEST.read_text(encoding="utf-8").strip()
    if not raw:
        return _die(f"{MANIFEST.relative_to(ROOT)} is empty.")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        return _die(f"{MANIFEST.relative_to(ROOT)} is not valid JSON: {exc}.")
    artefacts = data.get("artefacts")
    if not isinstance(artefacts, list) or not artefacts:
        return _die(
            f"{MANIFEST.relative_to(ROOT)} carries no artefacts — discovery"
            " scanner produced an empty manifest."
        )
    if not SUMMARY.is_file():
        return _die(f"{SUMMARY.relative_to(ROOT)} is missing.")
    sys.stdout.write(
        f"check-release-discovery: OK ({len(artefacts)} artefacts in"
        f" {MANIFEST.relative_to(ROOT)})\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
