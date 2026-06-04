#!/usr/bin/env python3
"""Reject commit subjects that would leak into the auto-generated changelog.

`scripts/release.py` reads commit subjects verbatim from
`<prev-tag>..HEAD` and writes them into `CHANGELOG.md` sections (notably
`### Breaking`). A sloppy subject — `wip`, `commit leftovers`, `fixup`,
short typos — becomes a sloppy public changelog line. Per
[ADR-033](../docs/decisions/ADR-033-distribution-identity-npm-primary.md)
and Phase 3 of `road-to-distribution-identity.md` this lint is the
CI-enforced gate that closes that surface.

Rules (PRO commit, range `<base>..<head>`):

- Subject length **after** stripping the Conventional-Commits type-prefix
  (`feat:` / `fix(scope):` / `chore!:` / …) must be ≥ 10 characters.
- Subject must not contain blocklist words as whole tokens:
  `leftover` / `leftovers` / `wip` / `temp` / `tmp` / `fixup`.
  Case-insensitive; matched on word boundaries so legitimate uses like
  `template` or `tempor­ary` (rare) survive — the linter targets the
  short hand-wave forms reviewers see in feedback rounds.

Carve-outs:

- Merge commits (`Merge pull request …`, `Merge branch …`) are skipped —
  they are GitHub-generated and not consumer-visible in the changelog.
- Revert commits (`Revert "…"`) are skipped — they ride the original
  subject's discipline.

Local invocation defaults to `origin/main..HEAD` (the "what I am about
to push" range). CI sets `--base $GITHUB_BASE_REF --head $GITHUB_SHA`.

Cap: ≤ 150 LOC, stdlib only. Hooked into `task ci` via
`task lint-commit-subjects`.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys

BLOCKLIST = frozenset({"leftover", "leftovers", "wip", "temp", "tmp", "fixup"})
MIN_SUBJECT_LEN = 10

# Conventional Commits prefix — `type(scope)!?: message`. Matches the
# heads our `scripts/release.py` and CHANGELOG section logic respect.
CONVENTIONAL_PREFIX = re.compile(
    r"^(feat|fix|chore|docs|refactor|test|perf|style|build|ci|revert)"
    r"(\([^)]+\))?!?:\s+",
    re.IGNORECASE,
)

# Skip lines — GitHub-generated merge subjects and revert commits.
SKIP_PREFIXES = ("Merge pull request", "Merge branch", "Merge remote-tracking",
                 'Revert "')


def fetch_subjects(base: str, head: str) -> list[str]:
    """Return one commit subject per element. Empty on no-range / no-commits."""
    try:
        result = subprocess.run(
            ["git", "log", f"{base}..{head}", "--format=%s", "--no-merges"],
            capture_output=True, text=True, check=True,
        )
    except subprocess.CalledProcessError as exc:
        # CI without a proper base ref (force-push, first commit, weird state).
        # Lint is advisory in that case — never block on git plumbing failures.
        print(f"⚠️  git log {base}..{head} failed: {exc.stderr.strip()}",
              file=sys.stderr)
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def check_subject(subject: str) -> list[str]:
    """Return list of issue strings for the subject; empty = clean."""
    if any(subject.startswith(p) for p in SKIP_PREFIXES):
        return []
    issues: list[str] = []
    body = CONVENTIONAL_PREFIX.sub("", subject, count=1)
    if len(body) < MIN_SUBJECT_LEN:
        issues.append(
            f"subject body < {MIN_SUBJECT_LEN} chars after Conventional-Commits "
            f"prefix: {subject!r}"
        )
    tokens = {t.lower() for t in re.findall(r"[A-Za-z]+", body)}
    hits = sorted(tokens & BLOCKLIST)
    if hits:
        issues.append(
            f"blocklist token(s) {hits} in subject: {subject!r}"
        )
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="origin/main",
                        help="base ref (default: origin/main)")
    parser.add_argument("--head", default="HEAD",
                        help="head ref (default: HEAD)")
    parser.add_argument("--quiet", action="store_true",
                        help="suppress the clean-pass success line")
    args = parser.parse_args()

    subjects = fetch_subjects(args.base, args.head)
    if not subjects:
        if not args.quiet:
            print(f"✅  No commit subjects to check in "
                  f"{args.base}..{args.head}.")
        return 0

    failures: list[tuple[str, str]] = []
    for subj in subjects:
        for issue in check_subject(subj):
            failures.append((subj, issue))

    if failures:
        print(f"❌  {len(failures)} commit-subject issue(s) in "
              f"{args.base}..{args.head}:", file=sys.stderr)
        for _, issue in failures:
            print(f"   - {issue}", file=sys.stderr)
        print(
            "\nThese subjects feed the auto-generated CHANGELOG.md via "
            "src/scripts/release.py — sloppy subjects become sloppy public "
            "changelog lines. Per ADR-033 + "
            "agents/roadmaps/road-to-distribution-identity.md § Phase 3.\n"
            "Fix: rewrite the offending commits (e.g. `git rebase -i "
            f"{args.base}` and `r`eword) with descriptive subjects, "
            "then re-push.",
            file=sys.stderr,
        )
        return 1

    if not args.quiet:
        print(f"✅  {len(subjects)} commit subject(s) clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
