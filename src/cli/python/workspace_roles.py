#!/usr/bin/env python3
"""Role + task discovery for the workspace launcher — Phase 4.

Reads ``agents/roles/<role>/index.md`` (frontmatter + first-task list) and
``agents/roles/<role>/skills.yml`` to populate the launcher pane.

CLI::

    workspace_roles.py list                          # list role slugs
    workspace_roles.py tasks <role>                  # list role's tasks
    workspace_roles.py show <role>                   # full role payload
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

DEFAULT_ROOT = Path("agents") / "roles"


@dataclass
class RoleTask:
    slug: str
    title: str
    prompt_path: str | None = None
    output_shape: str = "chat"
    document_type: str | None = None


@dataclass
class Role:
    slug: str
    title: str
    identity: str
    tasks: list[RoleTask]
    skills: list[str]
    explain_default: str = "plain"


def _parse_frontmatter(text: str) -> tuple[dict, str]:
    """Tiny stdlib YAML-frontmatter parser for the keys this module needs."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    block = text[3:end].strip()
    body = text[end + 4 :].lstrip("\n")
    meta: dict = {}
    for raw in block.splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#") or ":" not in line:
            continue
        if line.startswith(" "):
            continue
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip().strip("'\"")
    return meta, body


def _first_tasks_from_body(body: str) -> list[RoleTask]:
    """Find a ``## First tasks`` (or ``## Tasks``) bullet list."""
    lines = body.splitlines()
    in_tasks = False
    out: list[RoleTask] = []
    for raw in lines:
        line = raw.rstrip()
        s = line.lower()
        if s.startswith("## "):
            in_tasks = ("first task" in s or s == "## tasks")
            continue
        if not in_tasks:
            continue
        if line.startswith("- ") or line.startswith("* "):
            entry = line[2:].strip()
            slug = entry.split(" — ")[0].split(":")[0].strip().lower().replace(" ", "-")
            title = entry.split(" — ", 1)[-1] if " — " in entry else entry
            out.append(RoleTask(slug=slug, title=title))
    return out


def _parse_skills_yml(text: str) -> list[str]:
    """Read top-level ``skills:`` list (stdlib-only YAML peek)."""
    skills: list[str] = []
    in_block = False
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if line.startswith("skills:"):
            in_block = True
            continue
        if in_block:
            if line.startswith("  - ") or line.startswith("- "):
                item = line.split("-", 1)[1].strip().strip("'\"")
                skills.append(item)
            elif not line.startswith(" "):
                break
    return skills


def load_role(slug: str, *, root: Path | None = None) -> Role | None:
    base = (root if root is not None else DEFAULT_ROOT) / slug
    idx = base / "index.md"
    if not idx.exists():
        return None
    meta, body = _parse_frontmatter(idx.read_text(encoding="utf-8"))
    skills_path = base / "skills.yml"
    skills = _parse_skills_yml(skills_path.read_text(encoding="utf-8")) if skills_path.exists() else []
    return Role(
        slug=slug,
        title=meta.get("title") or slug.replace("-", " ").title(),
        identity=body.split("\n\n", 1)[0].strip()[:400],
        tasks=_first_tasks_from_body(body),
        skills=skills,
        explain_default=meta.get("explain_default", "plain"),
    )


def list_roles(*, root: Path | None = None) -> list[str]:
    base = root if root is not None else DEFAULT_ROOT
    if not base.exists():
        return []
    return sorted(p.name for p in base.iterdir() if p.is_dir() and (p / "index.md").exists())


def list_tasks(role: str, *, root: Path | None = None) -> list[RoleTask]:
    r = load_role(role, root=root)
    return r.tasks if r else []


def _role_to_json(r: Role) -> dict:
    return {
        "slug": r.slug,
        "title": r.title,
        "identity": r.identity,
        "explain_default": r.explain_default,
        "tasks": [asdict(t) for t in r.tasks],
        "skills": r.skills,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="workspace_roles")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    s_tasks = sub.add_parser("tasks")
    s_tasks.add_argument("role")
    s_show = sub.add_parser("show")
    s_show.add_argument("role")
    args = p.parse_args(argv)
    if args.cmd == "list":
        for slug in list_roles():
            print(slug)
        return 0
    if args.cmd == "tasks":
        for t in list_tasks(args.role):
            print(json.dumps(asdict(t), sort_keys=True))
        return 0
    if args.cmd == "show":
        r = load_role(args.role)
        if not r:
            print(f"unknown role: {args.role}", file=sys.stderr)
            return 1
        print(json.dumps(_role_to_json(r), sort_keys=True, indent=2))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
