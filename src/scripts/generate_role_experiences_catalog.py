#!/usr/bin/env python3
"""Generate the role-experience catalog (road-to-competitive-borrow P1.0).

Renders ``docs/role-experiences.md`` — a one-screen catalog of the role
experiences with their **existing** taglines, sourced from
``agents/roles/<role>/index.md`` frontmatter (the same taglines
``lint_role_experiences.py`` validates and the GUI WorkspacePage renders).

This surfaces the role taglines in a docs/catalog page without adding a
per-skill ``tagline`` field (the road-to-competitive-borrow Phase 3 drop:
227 hand-written strings + a locked schema change). It links to each role
experience, never duplicates its body — per docs/contracts/role-experience.md.

Output (deterministic — no timestamp, so ``--check`` is stable):
  - ``docs/role-experiences.md``

Usage:
    python3 scripts/generate_role_experiences_catalog.py
    python3 scripts/generate_role_experiences_catalog.py --check
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROLES_DIR = ROOT / "agents" / "roles"
OUT = ROOT / "docs" / "role-experiences.md"

_FM_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


def _fm_scalar(fm: str, key: str) -> str:
    m = re.search(rf"^{re.escape(key)}:\s*(.+)$", fm, re.MULTILINE)
    if not m:
        return ""
    return m.group(1).strip().strip('"').strip("'")


def load_roles() -> list[dict]:
    roles: list[dict] = []
    for index in sorted(ROLES_DIR.glob("*/index.md")):
        text = index.read_text(encoding="utf-8", errors="replace")
        m = _FM_RE.match(text)
        if not m:
            continue
        fm = m.group(1)
        roles.append({
            "slug": index.parent.name,
            "role": _fm_scalar(fm, "role") or index.parent.name,
            "display_name": _fm_scalar(fm, "display_name"),
            "tagline": _fm_scalar(fm, "tagline"),
            "status": _fm_scalar(fm, "status"),
            "rel": f"../agents/roles/{index.parent.name}/index.md",
        })
    return roles


def render() -> str:
    roles = load_roles()
    lines = [
        "# Role experiences — taglines at a glance",
        "",
        "> **Generated** by `scripts/generate_role_experiences_catalog.py` from",
        "> `agents/roles/<role>/index.md` — do NOT hand-edit. Taglines are the",
        "> existing role-level strings (validated by `lint_role_experiences.py`,",
        "> rendered in the GUI workspace); this page surfaces them in a catalog.",
        "",
        "Each row links to the full role experience (persona · three first tasks ·",
        "packs). The catalog never duplicates the body — see",
        "[`docs/contracts/role-experience.md`](contracts/role-experience.md).",
        "",
        "| Role | Tagline | Status |",
        "|---|---|---|",
    ]
    for r in roles:
        name = r["display_name"] or r["role"]
        lines.append(f"| [{name}]({r['rel']}) | {r['tagline']} | `{r['status']}` |")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="fail if docs/role-experiences.md is out of date")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    content = render()
    if args.check:
        current = OUT.read_text(encoding="utf-8") if OUT.is_file() else ""
        if current != content:
            print(
                "generate_role_experiences_catalog: docs/role-experiences.md is "
                "stale — run `python3 scripts/generate_role_experiences_catalog.py`",
                file=sys.stderr,
            )
            return 1
        if not args.quiet:
            print("generate_role_experiences_catalog: OK — up to date")
        return 0

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(content, encoding="utf-8")
    if not args.quiet:
        print(f"generate_role_experiences_catalog: wrote {OUT.relative_to(ROOT)} "
              f"({len(load_roles())} roles)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
