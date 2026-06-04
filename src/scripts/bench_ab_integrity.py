#!/usr/bin/env python3
"""Assert the two A/B clones differ only in the agent-config surface.

Phase 1 Step 3 of `agents/roadmaps/road-to-package-impact-benchmark.md`.

The bench's whole validity hinges on the two clones being identical except for
whether the agent-config surface is present. This script enumerates the file
trees of both clones and compares byte-by-byte, allowing differences only at
the documented surface paths (`.claude/`, `.augment/`, `AGENTS.md`,
`CLAUDE.md`) and the variant manifest.

Exit code:
    0  — clones are identical except at the allowed surface
    1  — clone is missing, or a task-target file diverges between variants
    2  — usage error
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
AB_ROOT = REPO_ROOT / "internal" / "bench" / "ab"
CLONES = AB_ROOT / "clones"

# Surfaces where divergence is expected (variant-bearing).
ALLOWED_DELTA_PATHS = (
    ".claude",
    ".augment",
    "AGENTS.md",
    "CLAUDE.md",
)
# Variant-distinguishing manifest written by bench_ab_clone.
ALLOWED_DELTA_FILES = (
    ".bench-ab-manifest.json",
)


def is_under_allowed_path(rel: Path) -> bool:
    parts = rel.parts
    if not parts:
        return False
    head = parts[0]
    if head in ALLOWED_DELTA_PATHS:
        return True
    return rel.as_posix() in ALLOWED_DELTA_FILES


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def index_clone(root: Path) -> dict[str, str]:
    """Return {relpath: sha256} for every regular file under `root`."""
    out: dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        out[rel.as_posix()] = file_hash(path)
    return out


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify the A/B clones differ only in the agent-config surface."
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print every checked file (default: only divergences)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])

    with_root = CLONES / "with"
    without_root = CLONES / "without"
    for label, root in (("with", with_root), ("without", without_root)):
        if not root.exists():
            sys.stderr.write(
                f"bench_ab_integrity: {label} clone missing at {root} — run scripts/bench_ab_clone.py first\n"
            )
            return 1

    with_index = index_clone(with_root)
    without_index = index_clone(without_root)

    # Files only in `with` — must all sit under the allowed surface
    only_in_with = sorted(set(with_index) - set(without_index))
    bad_only_with = [
        rel for rel in only_in_with if not is_under_allowed_path(Path(rel))
    ]
    # Files only in `without` — there should be none
    only_in_without = sorted(set(without_index) - set(with_index))
    bad_only_without = [
        rel for rel in only_in_without if not is_under_allowed_path(Path(rel))
    ]
    # Files present in both — must match byte-for-byte unless under the surface
    shared = sorted(set(with_index) & set(without_index))
    bad_diff = [
        rel
        for rel in shared
        if with_index[rel] != without_index[rel] and not is_under_allowed_path(Path(rel))
    ]

    if args.verbose:
        sys.stdout.write(
            f"bench_ab_integrity: with={len(with_index)} files, without={len(without_index)} files, shared={len(shared)}\n"
        )

    if not bad_only_with and not bad_only_without and not bad_diff:
        sys.stdout.write(
            "bench_ab_integrity: clones differ only at the allowed surface (.claude, .augment, AGENTS.md, CLAUDE.md, manifest).\n"
        )
        return 0

    sys.stderr.write("bench_ab_integrity: INTEGRITY FAILURE\n")
    if bad_only_with:
        sys.stderr.write("  files only in `with` (NOT in allowed surface):\n")
        for rel in bad_only_with:
            sys.stderr.write(f"    + {rel}\n")
    if bad_only_without:
        sys.stderr.write("  files only in `without` (NOT in allowed surface):\n")
        for rel in bad_only_without:
            sys.stderr.write(f"    - {rel}\n")
    if bad_diff:
        sys.stderr.write("  files present in both but byte-divergent:\n")
        for rel in bad_diff:
            sys.stderr.write(f"    ~ {rel}\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
