#!/usr/bin/env python3
"""Phase-6 checksum-stability gate (monorepo Phase 2, ADR-015).

For every artefact in the committed
``dist/discovery/discovery-manifest.json``, recompute the per-artefact
sha256 using the same normalization as
``scripts/build_discovery_manifest.py::_artefact_checksum`` and assert
it matches the manifest entry.

Distinct from ``validate-discovery-manifest`` (which rebuilds the
whole manifest in memory and diffs): this gate is the focused
"does the committed checksum still match the source bytes?" check
that third-party consumers can run to verify the manifest contract.

CLI:
  python scripts/check_artefact_checksums.py [--manifest PATH] [--quiet]

Exit codes:
  0  every artefact checksum matches its source bytes
  1  one or more checksums drifted (manifest is stale, or source moved)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = ROOT / "dist" / "discovery" / "discovery-manifest.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
# Import the same hashing primitive the builder uses so normalisation
# stays in lockstep with the generator. (ADR-015 §Phase 6.)
from build_discovery_manifest import _CATEGORY_SCHEMA, _artefact_checksum  # noqa: E402
from validate_frontmatter import apply_schema_defaults, load_schema, parse_frontmatter  # noqa: E402


def _frontmatter(path: Path, category: str | None = None) -> dict | None:
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8", errors="replace")
    fm, _ = parse_frontmatter(text)
    # Inject the same schema defaults the builder injects, so the recomputed
    # checksum matches the committed manifest byte-for-byte even when the
    # artefact omits a defaulted field (preflight Decision B).
    if isinstance(fm, dict):
        schema_name = _CATEGORY_SCHEMA.get(category or "")
        if schema_name is not None:
            apply_schema_defaults(fm, load_schema(schema_name))
    return fm


def _check(manifest_path: Path) -> tuple[int, list[str]]:
    if not manifest_path.exists():
        return 1, [f"manifest not found at {manifest_path}"]

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return 1, [f"invalid JSON: {exc}"]

    errors: list[str] = []
    for art in manifest.get("artefacts", []):
        rel = art.get("path")
        recorded = art.get("checksum")
        if not isinstance(rel, str) or not isinstance(recorded, str):
            errors.append(f"malformed entry: {art!r}")
            continue
        src = ROOT / rel
        if not src.exists():
            errors.append(f"{rel}: source file missing")
            continue
        actual = _artefact_checksum(src, _frontmatter(src, art.get("category")))
        if actual != recorded:
            errors.append(
                f"{rel}: checksum drift "
                f"(manifest={recorded[:23]}…, source={actual[:23]}…)"
            )
    return (0 if not errors else 1), errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)

    code, errors = _check(args.manifest)
    if code != 0:
        for e in errors[:20]:
            print(f"error: {e}", file=sys.stderr)
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more", file=sys.stderr)
        print(
            "checksum-stability gate failed — run `task build-discovery` "
            "and commit dist/discovery/.",
            file=sys.stderr,
        )
        return 1
    if not args.quiet:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        print(
            f"OK {args.manifest.relative_to(ROOT)}: "
            f"{len(manifest['artefacts'])} artefact checksums verified."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
