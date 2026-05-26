#!/usr/bin/env python3
"""Interactive scaffolder for new skills under the packages/ layout.

Phase 4.5 of the monorepo migration (ADR-017). Asks for pack, type,
name, workspaces, and description, then drops a templated artefact
into ``packages/<pack-dir>/.agent-src.uncondensed/<type>s/<name>/SKILL.md``.

Type → directory mapping:
  - skill    → skills/<name>/SKILL.md
  - rule     → rules/<name>.md
  - command  → commands/<name>.md

CLI (non-interactive overrides):
  --pack PACK         pack id (e.g. ``laravel`` or ``core``)
  --type TYPE         skill | rule | command (default: skill)
  --name NAME         artefact slug (kebab-case)
  --description TEXT  one-line description (trigger phrasing)
  --workspace WS      repeatable; defaults to pack's owner list
  --force             overwrite if file exists
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = ROOT / "packages"
PACKS_VOCAB = ROOT / "config" / "discovery" / "packs.yml"

TEMPLATES = {
    "skill": "skills/{name}/SKILL.md",
    "rule": "rules/{name}.md",
    "command": "commands/{name}.md",
}


def _load_vocab() -> dict[str, dict[str, Any]]:
    if not PACKS_VOCAB.exists():
        return {}
    data = yaml.safe_load(PACKS_VOCAB.read_text(encoding="utf-8")) or []
    return {p["id"]: p for p in data}


def _list_packs() -> list[str]:
    if not PACKAGES.exists():
        return []
    return sorted([
        ("core" if p.name == "core" else p.name.removeprefix("pack-"))
        for p in PACKAGES.iterdir() if p.is_dir()
    ])


def _pack_dir(pack_id: str) -> Path:
    return PACKAGES / ("core" if pack_id == "core" else f"pack-{pack_id}")


def _prompt(label: str, default: str | None = None, choices: list[str] | None = None) -> str:
    suffix = f" [{default}]" if default else ""
    if choices:
        suffix = f" ({'/'.join(choices)})" + suffix
    while True:
        raw = input(f"{label}{suffix}: ").strip()
        if not raw and default is not None:
            return default
        if choices and raw not in choices:
            print(f"  must be one of: {', '.join(choices)}")
            continue
        if raw:
            return raw


def _frontmatter(name: str, description: str, workspaces: list[str], pack: str) -> str:
    fm: dict[str, Any] = {
        "name": name,
        "description": description,
        "source": "package",
        "workspaces": workspaces,
        "packs": [pack] if pack != "core" else [],
        "lifecycle": "active",
        "trust": {"level": "professional", "confidence": "medium", "human_review_required": False},
        "install": {"default": False, "removable": True},
    }
    if not fm["packs"]:
        del fm["packs"]
    return "---\n" + yaml.safe_dump(fm, sort_keys=False, allow_unicode=True) + "---\n"


def _body(kind: str, name: str, description: str) -> str:
    if kind == "skill":
        return (
            f"\n# {name}\n\n## When to use\n\n{description}\n\n## Procedure\n\n"
            "1. _TODO: replace with the real step-by-step._\n\n"
            "## Examples\n\n_TODO: copy-pasteable example._\n"
        )
    if kind == "rule":
        return f"\n# {name}\n\n{description}\n\n## Iron Law\n\n```\nTODO\n```\n"
    return f"\n# {name}\n\n{description}\n\n## Steps\n\n1. _TODO_\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pack")
    ap.add_argument("--type", dest="kind", choices=list(TEMPLATES))
    ap.add_argument("--name")
    ap.add_argument("--description")
    ap.add_argument("--workspace", action="append", default=[])
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    packs = _list_packs()
    if not packs:
        print("error: no packages/ tree found", file=sys.stderr)
        return 2
    vocab = _load_vocab()
    interactive = sys.stdin.isatty()
    pack = args.pack or (_prompt("pack", default="core", choices=packs) if interactive else "core")
    if pack not in packs:
        print(f"error: pack '{pack}' not in {packs}", file=sys.stderr)
        return 2
    kind = args.kind or (_prompt("type", default="skill", choices=list(TEMPLATES)) if interactive else "skill")
    name = args.name or (_prompt("name (kebab-case)") if interactive else "")
    if not name or " " in name or name != name.lower():
        print(f"error: name '{name}' must be lowercase kebab-case", file=sys.stderr)
        return 2
    description = args.description or (_prompt("description (one line)") if interactive else "TODO: describe trigger")
    workspaces = args.workspace or vocab.get(pack, {}).get("workspaces") or ["engineering"]

    rel = TEMPLATES[kind].format(name=name)
    out = _pack_dir(pack) / ".agent-src.uncondensed" / rel
    if out.exists() and not args.force:
        print(f"error: {out.relative_to(ROOT)} exists (use --force)", file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(_frontmatter(name, description, workspaces, pack) + _body(kind, name, description), encoding="utf-8")
    print(f"created: {out.relative_to(ROOT)}")
    print("next steps:")
    print("  1. flesh out the body")
    print("  2. run `task sync` to project into .agent-src/ and .augment/")
    print("  3. run `task lint-skills` for validation")
    return 0


if __name__ == "__main__":
    sys.exit(main())
