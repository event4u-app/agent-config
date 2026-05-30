#!/usr/bin/env python3
"""Release-PR shape checker — fail-closed gate for `docs/contracts/release-pr-gating.md`.

Given a PR number, fetches the file list via `gh pr diff <n> --name-only`
and asserts every changed file matches the version-bump allowlist:

  * `package.json`
  * `CHANGELOG.md`
  * `.claude-plugin/marketplace.json`
  * `packages/*/pack.yaml`
  * `packages/*/README.md`
  * `docs/archive/CHANGELOG-pre-*.md`

Exit codes:

  0 — every file matches; release-PR is shape-clean and the heavy install /
      test matrices may skip per `release-pr-gating.md`.
  1 — at least one file outside the allowlist OR no files at all. Stdout
      lists each offending entry one per line with an "OUT-OF-SHAPE: " prefix
      so CI logs surface the precise reason.
  2 — usage / environment error (gh missing, invalid PR number, gh non-zero).

Design constraints from the roadmap:

  * stdlib-only — no jsonschema, no requests, no PyYAML
  * ≤ 150 LOC including this docstring
  * deterministic — same diff in, same exit
"""

from __future__ import annotations

import argparse
import fnmatch
import shutil
import subprocess
import sys

ALLOWLIST_GLOBS = (
    "package.json",
    "CHANGELOG.md",
    ".claude-plugin/marketplace.json",
    "packages/*/pack.yaml",
    "packages/*/README.md",
    # `scripts/release.py` auto-splits the CHANGELOG era before bumping
    # (perform_split / plan_split in `_lib/changelog_eras.py`) whenever the
    # current era body crosses CURRENT_ERA_BODY_CAP. The split emits a new
    # `docs/archive/CHANGELOG-pre-X.Y.Z.md` — part of the release surface,
    # so the shape gate must allow it. Test-enforced by test_changelog_eras.
    "docs/archive/CHANGELOG-pre-*.md",
)


def _matches(path: str) -> bool:
    return any(fnmatch.fnmatch(path, pat) for pat in ALLOWLIST_GLOBS)


def _gh_diff_files(pr: str) -> list[str]:
    """Return the list of files changed in `pr`, via `gh pr diff --name-only`."""
    if shutil.which("gh") is None:
        print("ERROR: gh CLI not on PATH; cannot fetch PR diff.", file=sys.stderr)
        sys.exit(2)
    try:
        out = subprocess.run(
            ["gh", "pr", "diff", pr, "--name-only"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        print(f"ERROR: gh pr diff {pr} failed: {stderr}", file=sys.stderr)
        sys.exit(2)
    return [line.strip() for line in out.splitlines() if line.strip()]


def check(files: list[str]) -> int:
    """Return exit code; print per-file diff to stdout on failure."""
    if not files:
        print("OUT-OF-SHAPE: empty diff — release PR must touch at least one file.")
        return 1
    bad = [f for f in files if not _matches(f)]
    if bad:
        for f in bad:
            print(f"OUT-OF-SHAPE: {f}")
        return 1
    print(f"SHAPE-CLEAN: {len(files)} file(s) — all within release-PR allowlist.")
    for f in files:
        print(f"  ok: {f}")
    return 0


def _read_files_arg(value: str) -> list[str]:
    """`--files` accepts comma-separated paths or `-` to read stdin (one per line)."""
    if value == "-":
        return [line.strip() for line in sys.stdin.read().splitlines() if line.strip()]
    return [v.strip() for v in value.split(",") if v.strip()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Fail-closed shape checker for release PRs.",
    )
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--pr", help="GitHub PR number; uses `gh pr diff --name-only`.")
    src.add_argument(
        "--files",
        help=(
            "Comma-separated file list, or '-' to read one path per line from "
            "stdin. Bypasses gh — useful for tests and local previews."
        ),
    )
    args = parser.parse_args(argv)

    files = _gh_diff_files(args.pr) if args.pr else _read_files_arg(args.files)
    return check(files)


if __name__ == "__main__":
    sys.exit(main())
