#!/usr/bin/env python3
"""Materialise the `with` and `without` clones for the package-impact A/B bench.

Phase 1 Step 2 of `agents/roadmaps/road-to-package-impact-benchmark.md`.

The fixture lives at `internal/bench/ab/fixture/`. Both clones are byte-identical
copies of the fixture; the `with` clone additionally receives the agent-config
surface (`.claude/`, `.augment/`, `AGENTS.md`, `CLAUDE.md`) so a Claude Code
session run inside it sees the same files a consumer project would after
running the installer.

Idempotent: re-running without `--refresh` leaves an existing clone alone. With
`--refresh`, the target clone is removed and rebuilt from scratch.

The clones tree (`internal/bench/ab/clones/`) is gitignored — only this script's
output schema is committed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
AB_ROOT = REPO_ROOT / "internal" / "bench" / "ab"
FIXTURE = AB_ROOT / "fixture"
CLONES = AB_ROOT / "clones"

# Surfaces the `with` clone inherits from the package root.
WITH_SURFACES = (
    ".claude",
    ".augment",
    "AGENTS.md",
    "CLAUDE.md",
)


def die(msg: str) -> None:
    sys.stderr.write(f"bench_ab_clone: {msg}\n")
    raise SystemExit(1)


def copytree_preserve(src: Path, dst: Path) -> None:
    """Copy tree, preserving symlinks (Don't dereference)."""
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, symlinks=True)


def materialise_clone(variant: str, target: Path) -> None:
    """Copy the fixture into the target, then layer the variant-specific surface."""
    target.mkdir(parents=True, exist_ok=True)
    # Mirror the fixture
    for entry in FIXTURE.iterdir():
        dest = target / entry.name
        if entry.is_dir():
            copytree_preserve(entry, dest)
        else:
            shutil.copy2(entry, dest)
    # Layer the agent-config surface onto the `with` variant
    if variant == "with":
        for surface in WITH_SURFACES:
            src = REPO_ROOT / surface
            if not src.exists():
                # Best-effort: a missing surface is reported but does not fail
                sys.stderr.write(
                    f"bench_ab_clone: surface '{surface}' missing in package root; "
                    "with-clone may not be representative\n"
                )
                continue
            dest = target / surface
            if src.is_dir():
                copytree_preserve(src, dest)
            else:
                shutil.copy2(src, dest)


def target_shape_hash() -> str:
    """Stable hash of the fixture tree + the with-surface list.

    Used by Phase 2's cache key. Recomputing this here keeps the cache code
    and the clone code reading the same surface definition.
    """
    h = hashlib.sha256()
    h.update(b"with-surfaces:" + json.dumps(WITH_SURFACES).encode() + b"\n")
    for path in sorted(FIXTURE.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(FIXTURE).as_posix()
        h.update(f"{rel}\n".encode())
        h.update(path.read_bytes())
        h.update(b"\n")
    return h.hexdigest()[:16]


def write_manifest(variant: str, target: Path) -> None:
    """Drop a small manifest so other scripts can verify the clone shape."""
    manifest = {
        "variant": variant,
        "target_shape_hash": target_shape_hash(),
        "with_surfaces": list(WITH_SURFACES),
        "fixture_relpath": FIXTURE.relative_to(REPO_ROOT).as_posix(),
    }
    (target / ".bench-ab-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )


def clone(variant: str, *, refresh: bool) -> Path:
    target = CLONES / variant
    if target.exists() and not refresh:
        sys.stdout.write(f"bench_ab_clone: {variant} clone already present at {target} (use --refresh to rebuild)\n")
        return target
    if target.exists():
        shutil.rmtree(target)
    materialise_clone(variant, target)
    write_manifest(variant, target)
    sys.stdout.write(f"bench_ab_clone: built {variant} clone at {target}\n")
    return target


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Materialise `with` and `without` clones for the A/B bench."
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Force-rebuild even if the clone already exists.",
    )
    parser.add_argument(
        "--variant",
        choices=("with", "without", "both"),
        default="both",
        help="Which clone to materialise (default: both).",
    )
    parser.add_argument(
        "--print-shape-hash",
        action="store_true",
        help="Print the target-shape hash and exit without cloning.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    if not FIXTURE.exists():
        die(f"fixture missing at {FIXTURE}")
    if args.print_shape_hash:
        sys.stdout.write(target_shape_hash() + "\n")
        return 0
    variants = ("with", "without") if args.variant == "both" else (args.variant,)
    for v in variants:
        clone(v, refresh=args.refresh)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
