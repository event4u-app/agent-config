#!/usr/bin/env python3
"""
Release-published drift gate.

Catches the "release merged to main but never tagged/published" failure
mode — where ``main``'s ``package.json`` claims a version that has no
matching git tag, and npm's ``latest`` therefore lags behind main. This
is the backstop that would have surfaced the 5.8.0-stuck-on-5.7.0 state
the moment it happened, instead of weeks later.

Two independent invariants:

  1. **Tag invariant** (always checkable, no network): the version in
     ``package.json`` MUST have a matching git tag (local or remote).
  2. **npm invariant** (``--check-npm``, network): ``npm view <pkg>
     dist-tags.latest`` MUST equal the ``package.json`` version.

Scope guard: this only makes sense on the release trunk. Off ``main``
(e.g. a feature branch, or a ``release/X.Y.Z`` branch mid-flight where
the bump legitimately precedes the tag) the gate **no-ops** unless
``--strict`` is combined with an explicit on-main signal. The daily
scheduled workflow runs ``--strict --check-npm`` on ``main``; the local
``task check-release-published`` runs the tag invariant only.

Exit codes: 0 = pass / no-op · 1 = drift detected · 3 = internal error.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$")
REPO_ROOT = Path(__file__).resolve().parent.parent
PACKAGE_JSON = REPO_ROOT / "package.json"
MAIN_BRANCH = "main"


def _git(*args: str) -> tuple[int, str]:
    proc = subprocess.run(["git", *args], capture_output=True, text=True, check=False)
    return proc.returncode, (proc.stdout or "").strip()


def _package_version() -> str:
    data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    return str(data["version"])


def _package_name() -> str:
    data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    return str(data["name"])


def _tag_exists(tag: str) -> bool:
    rc, out = _git("tag", "-l", tag)
    if rc == 0 and tag in out.splitlines():
        return True
    rc, _ = _git("ls-remote", "--exit-code", "--tags", "origin", tag)
    return rc == 0


def _on_main() -> bool:
    # Local checkout, CI push ref, or CI scheduled ref all map to main.
    ref = os.environ.get("GITHUB_REF", "")
    if ref in ("refs/heads/main", "refs/heads/master"):
        return True
    rc, head = _git("rev-parse", "--abbrev-ref", "HEAD")
    return rc == 0 and head == MAIN_BRANCH


def _npm_latest(pkg: str) -> str | None:
    proc = subprocess.run(
        ["npm", "view", pkg, "dist-tags.latest"],
        capture_output=True, text=True, check=False,
    )
    if proc.returncode != 0:
        return None
    return (proc.stdout or "").strip() or None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Release-published drift gate.")
    ap.add_argument("--strict", action="store_true",
                    help="Fail on drift (default: informational, exit 0).")
    ap.add_argument("--check-npm", action="store_true",
                    help="Also assert npm dist-tags.latest == package.json version (network).")
    ap.add_argument("--require-main", action="store_true",
                    help="Only enforce when on main; no-op elsewhere (default for scheduled).")
    args = ap.parse_args(argv)

    try:
        version = _package_version()
    except (OSError, KeyError, json.JSONDecodeError) as exc:
        print(f"❌  cannot read package.json version: {exc}", file=sys.stderr)
        return 3
    if not SEMVER_RE.match(version):
        print(f"❌  package.json version is not semver: {version!r}", file=sys.stderr)
        return 3

    if args.require_main and not _on_main():
        print(f"ℹ️  not on {MAIN_BRANCH} — release-published gate skipped.")
        return 0

    problems: list[str] = []

    if not _tag_exists(version):
        problems.append(
            f"package.json is {version} but no git tag {version} exists "
            f"(local or origin) — the release was bumped/merged but never "
            f"tagged. Complete it: tag the release-merge commit and push "
            f"(triggers publish-npm.yml), e.g. `git tag {version} && git "
            f"push origin {version}`."
        )

    if args.check_npm:
        pkg = _package_name()
        latest = _npm_latest(pkg)
        if latest is None:
            print(f"⚠️  could not read npm dist-tags.latest for {pkg} "
                  f"(network/registry) — npm invariant not checked.", file=sys.stderr)
        elif latest != version:
            problems.append(
                f"npm {pkg}@latest is {latest} but package.json is {version} "
                f"— the published release lags main. Check publish-npm.yml "
                f"for tag {version}, or re-dispatch it."
            )

    if not problems:
        suffix = " + npm" if args.check_npm else ""
        print(f"✅  release-published: {version} is tagged{suffix} and in sync.")
        return 0

    header = "❌  Release-published drift:" if args.strict else "⚠️  Release-published drift (warn-only):"
    print(header, file=sys.stderr)
    for p in problems:
        print(f"  - {p}", file=sys.stderr)
    return 1 if args.strict else 0


if __name__ == "__main__":
    raise SystemExit(main())
