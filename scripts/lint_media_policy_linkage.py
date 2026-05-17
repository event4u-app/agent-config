#!/usr/bin/env python3
"""Lint structural reachability of media governance policies.

Every policy file under `agents/policies/media/` (except README) must
be linked from at least one of:

  * a skill SKILL.md (any .agent-src.uncompressed/skills/*/SKILL.md
    or .claude/skills/*/SKILL.md),
  * a routing rule under .agent-src.uncompressed/rules/, or
  * a sibling policy file under agents/policies/media/.

A policy that no surface references is a silent policy and a silent
policy is a failed policy. This is the CI-side reachability guarantee
the agent-in-the-loop enforcement model rests on (see
agents/policies/media/README.md § Enforcement model).

Exit codes:
  0  all policies linked
  1  one or more orphan policies
"""
from __future__ import annotations

import sys
from pathlib import Path

QUIET = "--quiet" in sys.argv

REPO = Path(__file__).resolve().parents[1]
POLICY_DIR = REPO / "agents" / "policies" / "media"
EXEMPT_STEMS = frozenset({"README"})

# Surfaces scanned for inbound references to policy files.
SCAN_ROOTS: tuple[Path, ...] = (
    REPO / ".agent-src.uncompressed" / "skills",
    REPO / ".agent-src.uncompressed" / "rules",
    REPO / ".agent-src.uncompressed" / "commands",
    REPO / ".claude" / "skills",
    REPO / "agents" / "policies" / "media",
)


def emit(msg: str) -> None:
    if not QUIET:
        print(msg)


def collect_policies() -> list[Path]:
    if not POLICY_DIR.exists():
        return []
    return sorted(
        p
        for p in POLICY_DIR.glob("*.md")
        if p.stem not in EXEMPT_STEMS
    )


def collect_scan_files() -> list[Path]:
    files: list[Path] = []
    for root in SCAN_ROOTS:
        if not root.exists():
            continue
        files.extend(root.rglob("*.md"))
    return files


def referrers_for(policy: Path, scan_files: list[Path]) -> list[Path]:
    """Return files that reference `policy` by its repo-relative name
    or basename. We accept both the full path token
    (`agents/policies/media/likeness.md`) and the bare basename
    (`likeness.md`) inside a markdown link, because sibling policies
    link via relative `[likeness.md](likeness.md)` form.
    """
    needles = (
        f"policies/media/{policy.name}",
        f"]({policy.name})",
    )
    referrers: list[Path] = []
    for scan_file in scan_files:
        # A policy can't satisfy its own linkage requirement.
        if scan_file.resolve() == policy.resolve():
            continue
        try:
            text = scan_file.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if any(n in text for n in needles):
            referrers.append(scan_file)
    return referrers


def main() -> int:
    if not POLICY_DIR.exists():
        emit(
            "media-policy-linkage: agents/policies/media/ missing — "
            "nothing to lint."
        )
        return 0

    policies = collect_policies()
    if not policies:
        emit(
            "media-policy-linkage: agents/policies/media/ has no policy "
            "files — nothing to lint."
        )
        return 0

    scan_files = collect_scan_files()
    orphans: list[Path] = []
    for policy in policies:
        referrers = referrers_for(policy, scan_files)
        rel = policy.relative_to(REPO)
        if not referrers:
            orphans.append(policy)
            emit(f"❌  ORPHAN  {rel}")
            continue
        emit(f"✅  {rel}  ({len(referrers)} referrer(s))")

    if orphans:
        print(
            f"\nmedia-policy-linkage: {len(orphans)} orphan policy "
            f"file(s) — every policy must be linked from a skill, rule, "
            f"or sibling policy.",
            file=sys.stderr,
        )
        for o in orphans:
            print(
                f"  - {o.relative_to(REPO)}",
                file=sys.stderr,
            )
        return 1

    emit(
        f"media-policy-linkage: {len(policies)} policy file(s) — all "
        f"linked."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
