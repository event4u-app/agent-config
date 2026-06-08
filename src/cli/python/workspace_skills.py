#!/usr/bin/env python3
"""Skill-body resolution for host hand-off pre-rendering — ADR-066.

A role prompt carries a single ``skill_hint`` (e.g. ``doc-coauthoring``). Hosts
without skill resolution (Codex / Gemini Tier-1, and every Tier-3 host) can't
follow that dangling reference, so the workspace **pre-renders** the skill
context into the hand-off prompt. This module owns skill → prompt-section
rendering; the inbox store calls it.

v0 (AI-council 2026-06-08): include the skill **body + a one-line header**
(name + description from frontmatter) under a ``## Skill context: <name>``
section. Trust: ``skill_hint`` is package-controlled, but harden anyway —
charset-validate (no path traversal) + resolve strictly under a skills root;
a missing / malformed skill degrades to a one-line note, never a crash; the
body is size-capped. No transitive resolution (a skill body is included
verbatim; it never pulls other skills) → no cycles.

Deferred to v1 (debt, recorded in ADR-066): a generated skill-id **manifest**
allowlist (v0 uses the existence-under-root check as the de-facto allowlist),
a ``--dry-run`` mode, and success/kill-switch metrics.

CLI::

    workspace_skills.py resolve <skill-hint> [--format section|json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# This module lives at <repo>/src/cli/python/workspace_skills.py → the repo
# root is parents[3] (three dirs up: python → cli → src → repo).
ROOT = Path(__file__).resolve().parents[3]
# Mirror lint_role_experiences SKILL_SOURCES: source tree first, condensed
# projection second. Only the existing root(s) are consulted.
SKILL_SOURCES = [
    ROOT / ".agent-src.uncondensed" / "skills",
    ROOT / "dist" / "agent-src" / "skills",
]
SKILL_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
MAX_BODY_BYTES = 64 * 1024


def _strip_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    fm: dict = {}
    for line in text[3:end].splitlines():
        if not line.strip() or ":" not in line:
            continue
        k, _, v = line.partition(":")
        fm[k.strip()] = v.strip().strip("'\"")
    body = text[end + 4:].lstrip("\n")
    return fm, body


def _find_skill_md(skill_hint: str) -> Path | None:
    for src in SKILL_SOURCES:
        cand = src / skill_hint / "SKILL.md"
        # Defense in depth: the resolved path must stay under the root even if
        # the charset check is ever loosened.
        try:
            cand.resolve().relative_to(src.resolve())
        except (ValueError, OSError):
            continue
        if cand.is_file():
            return cand
    return None


def resolve(skill_hint: str) -> dict:
    """Resolve a skill_hint → ``{found, name, description, body, note}``.

    Never raises on a bad / missing id — returns ``found=False`` with a
    human-readable ``note`` the caller can surface inline.
    """
    if not SKILL_ID_RE.match(skill_hint or ""):
        return {"found": False, "note": f"skill `{skill_hint}` is not a valid id"}
    md = _find_skill_md(skill_hint)
    if md is None:
        return {"found": False, "note": f"skill `{skill_hint}` not found — proceed without it"}
    try:
        text = md.read_text(encoding="utf-8")
    except OSError as err:
        return {"found": False, "note": f"skill `{skill_hint}` unreadable ({err})"}
    fm, body = _strip_frontmatter(text)
    if len(body.encode("utf-8")) > MAX_BODY_BYTES:
        body = body.encode("utf-8")[:MAX_BODY_BYTES].decode("utf-8", "ignore") \
            + "\n\n… (skill body truncated)"
    return {
        "found": True,
        "name": fm.get("name", skill_hint),
        "description": fm.get("description", ""),
        "body": body,
    }


def resolve_section(skill_hint: str) -> str:
    """Render a skill_hint as a hand-off prompt section (body + one-line header).

    A missing / invalid skill yields a single-line note section so the host
    sees *why* the skill context is absent rather than a silent gap.
    """
    r = resolve(skill_hint)
    if not r["found"]:
        return f"\n\n## Skill context\n\n> {r['note']}.\n"
    header = f"## Skill context: {r['name']}"
    desc = f"\n_{r['description']}_\n" if r.get("description") else "\n"
    return f"\n\n{header}\n{desc}\n{r['body']}\n"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_skills")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("resolve")
    s.add_argument("skill_hint")
    s.add_argument("--format", choices=("section", "json"), default="section")
    args = p.parse_args(argv)
    if args.cmd == "resolve":
        if args.format == "json":
            print(json.dumps(resolve(args.skill_hint), sort_keys=True))
        else:
            sys.stdout.write(resolve_section(args.skill_hint))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
