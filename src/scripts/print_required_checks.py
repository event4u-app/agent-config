#!/usr/bin/env python3
"""Print the expected required-check set for the current branch.

Contract: `docs/contracts/branch-protection-policy.md`. Per-PR-shape
required-check floor — feature PR vs release PR vs docs-only PR. The
script resolves the PR shape locally so the maintainer can sanity-check
before pushing, without round-tripping through the GitHub UI.

Resolution order:

  1. `--branch <name>` flag — explicit override.
  2. Current git branch — `git rev-parse --abbrev-ref HEAD`.
  3. Fail with exit 2 (usage error).

PR-shape classification:

  release   — branch matches `^release/\\d+\\.\\d+\\.\\d+$` AND
              `check_release_pr_shape.py` reports SHAPE-CLEAN for the
              local diff against `--base` (default `origin/main`).
  docs-only — diff vs base is entirely inside `docs/**` or top-level
              `.md` files (`README.md`, `CHANGELOG.md`,
              `CONTRIBUTING.md`, `AGENTS.md`).
  feature   — everything else (default).

The script never invokes `gh` and never touches the network — it works
offline against the local git index so pre-push previews stay fast.

Exit codes:

  0 — printed the expected required-check set.
  1 — release-PR shape detector reported OUT-OF-SHAPE; falls back to
      the feature-PR set, which is also printed, plus a warning.
  2 — usage / environment error.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import check_release_pr_shape as shape  # noqa: E402

RELEASE_BRANCH_RE = re.compile(r"^release/\d+\.\d+\.\d+$")

DOCS_ONLY_ALLOWED_TOP = {
    "README.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "AGENTS.md",
    "LICENSE",
    "llms.txt",
}

FEATURE_CHECKS = (
    "Consistency",
    "Smoke Contracts",
    "Skill Lint",
    "Tests / install-tests",
    "Tests / install-aux-tests",
    "Tests / python-tests",
    "Tests / node-tests",
    "Public Install Smoke / smoke",
)

RELEASE_CHECKS = (
    "Consistency",
    "Smoke Contracts",
    "Migration Dry-Run",
    "Release Validation / release-shape",
    "Release Validation / changelog-entry",
    "Release Validation / version-consistency",
    "Release Guard (post-tag)",
)

DOCS_ONLY_CHECKS = (
    "Consistency",
    "Smoke Contracts",
)


def _git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True
    ).stdout.strip()


def current_branch() -> str:
    return _git("rev-parse", "--abbrev-ref", "HEAD")


def diff_files(base: str) -> list[str]:
    out = subprocess.run(
        ["git", "diff", "--name-only", f"{base}...HEAD"],
        capture_output=True,
        text=True,
    )
    if out.returncode != 0:
        # Base ref unknown locally — fall back to staged + tracked
        # changes vs HEAD so the dry-run still tells the maintainer
        # something useful instead of crashing.
        out = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        )
    return [line for line in out.stdout.splitlines() if line.strip()]


def is_docs_only(files: list[str]) -> bool:
    if not files:
        return False
    for f in files:
        if f in DOCS_ONLY_ALLOWED_TOP:
            continue
        if f.startswith("docs/"):
            continue
        return False
    return True


def classify(branch: str, files: list[str]) -> tuple[str, int]:
    """Return (shape, exit_code)."""
    if RELEASE_BRANCH_RE.match(branch):
        # Release-shape predicate — re-uses the fail-closed allowlist.
        bad = [f for f in files if not shape._matches(f)]
        if bad:
            print(
                "WARNING: branch matches release/X.Y.Z but diff contains "
                f"{len(bad)} out-of-allowlist file(s):",
                file=sys.stderr,
            )
            for f in bad:
                print(f"  - {f}", file=sys.stderr)
            print(
                "Falling back to feature-PR required-check set.",
                file=sys.stderr,
            )
            return "feature", 1
        return "release", 0
    if is_docs_only(files):
        return "docs-only", 0
    return "feature", 0


def print_set(shape_label: str, files: list[str]) -> None:
    table = {
        "feature": FEATURE_CHECKS,
        "release": RELEASE_CHECKS,
        "docs-only": DOCS_ONLY_CHECKS,
    }[shape_label]
    print(f"PR shape: {shape_label}  ({len(files)} file(s) in diff)")
    print(f"Required checks ({len(table)}):")
    for name in table:
        print(f"  - {name}")
    print()
    print(
        "Contract: docs/contracts/branch-protection-policy.md "
        "(per-PR-shape matrix)"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Print the expected required-check set for the current branch."
        ),
    )
    parser.add_argument(
        "--branch",
        help="Branch name override (default: current git branch).",
    )
    parser.add_argument(
        "--base",
        default="origin/main",
        help="Base ref for the diff (default: origin/main).",
    )
    args = parser.parse_args(argv)

    branch = args.branch or current_branch()
    files = diff_files(args.base)
    shape_label, exit_code = classify(branch, files)
    print(f"Branch: {branch}")
    print(f"Base:   {args.base}")
    print_set(shape_label, files)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
