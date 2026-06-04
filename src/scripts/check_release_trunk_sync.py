#!/usr/bin/env python3
"""
Release-trunk-sync CI gate (road-to-productization P1.3).

Fails if `main` is more than one tagged release behind the current
release-prep branch's target version. No-ops on every other branch
class. Owner contract: `docs/contracts/release-trunk-sync.md`.

Exit codes: 0 = pass / no-op, 1 = main is too far behind, 3 = internal
error (git unavailable, malformed tag, etc.).
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

RELEASE_BRANCH_RE = re.compile(r"^release/(\d+)\.(\d+)\.(\d+)$")
SEMVER_TAG_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
BOOTSTRAP_FILE = Path("docs/contracts/release-trunk-sync.bootstrap")


def _git(*args: str) -> str:
    proc = subprocess.run(
        ["git", *args], capture_output=True, text=True, check=False
    )
    if proc.returncode != 0:
        return ""
    return proc.stdout.strip()


def _current_branch() -> str:
    return _git("rev-parse", "--abbrev-ref", "HEAD")


def _parse_semver(text: str) -> tuple[int, int, int] | None:
    m = SEMVER_TAG_RE.match(text)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def _all_tags() -> list[tuple[int, int, int]]:
    raw = _git("tag", "--list")
    tags = []
    for line in raw.splitlines():
        parsed = _parse_semver(line.strip())
        if parsed is not None:
            tags.append(parsed)
    tags.sort()
    return tags


def _main_tag() -> tuple[int, int, int] | None:
    """Highest semver tag whose commit is reachable from main."""
    # Try local main, fall back to origin/main.
    for ref in ("refs/heads/main", "refs/remotes/origin/main"):
        head = _git("rev-parse", "--verify", ref)
        if head:
            break
    else:
        return None
    # `git tag --merged <main>` lists tags reachable from main.
    raw = _git("tag", "--merged", head)
    reachable: list[tuple[int, int, int]] = []
    for line in raw.splitlines():
        parsed = _parse_semver(line.strip())
        if parsed is not None:
            reachable.append(parsed)
    if not reachable:
        return None
    return max(reachable)


def _prior_release(
    target: tuple[int, int, int], tags: list[tuple[int, int, int]]
) -> tuple[int, int, int] | None:
    earlier = [t for t in tags if t < target]
    return max(earlier) if earlier else None


def _bootstrap_ok(target: tuple[int, int, int]) -> bool:
    if not BOOTSTRAP_FILE.exists():
        return False
    target_s = "{0}.{1}.{2}".format(*target)
    for line in BOOTSTRAP_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line == target_s:
            return True
    return False


def main() -> int:
    branch = _current_branch()
    if branch == "HEAD" or not branch:
        print("::warning::detached HEAD — release-trunk-sync gate skipped")
        return 0
    # CI override: GitHub Actions sometimes runs on the merge ref.
    ci_ref = os.environ.get("GITHUB_HEAD_REF") or os.environ.get(
        "GITHUB_REF_NAME"
    )
    if ci_ref:
        branch = ci_ref
    m = RELEASE_BRANCH_RE.match(branch)
    if not m:
        return 0  # non-release branch class — gate is a no-op
    target = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    tags = _all_tags()
    if not tags:
        print(
            "::warning::no semver tags found — release-trunk-sync gate skipped"
        )
        return 0
    main_tag = _main_tag()
    if main_tag is None:
        print(
            "::warning::no semver tag reachable from main — gate skipped"
        )
        return 0
    if main_tag >= target:
        return 0  # main already at or ahead of release target
    prior = _prior_release(target, tags)
    if prior is not None and main_tag >= prior:
        return 0  # within the one-release tolerance
    if _bootstrap_ok(target):
        target_s = "{0}.{1}.{2}".format(*target)
        print(
            f"::warning::release-trunk-sync gate suppressed for {target_s} "
            "via bootstrap file"
        )
        return 0
    main_s = "{0}.{1}.{2}".format(*main_tag)
    target_s = "{0}.{1}.{2}".format(*target)
    print(
        f"::error::main is at {main_s}; release-prep branch targets "
        f"{target_s}. Main must be no more than one tagged release behind. "
        "See docs/contracts/release-trunk-sync.md."
    )
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"::error::release-trunk-sync gate internal error: {exc}")
        sys.exit(3)
