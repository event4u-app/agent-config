#!/usr/bin/env python3
"""Generate `agents/index.md` (internal) and `docs/catalog.md` (public).

Scans `.agent-src.uncompressed/{skills,rules,commands}/` plus `docs/guidelines/`
and renders two artefact tables — one for maintainers, one for consumers.

Both files are sync-checked in CI via `--check`; drift = build break.

Usage:
    python3 scripts/generate_index.py            # write both files
    python3 scripts/generate_index.py --check    # exit 1 if drift
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".agent-src.uncompressed"
GUIDELINES = ROOT / "docs" / "guidelines"
INDEX_PATH = ROOT / "agents" / "index.md"
CATALOG_PATH = ROOT / "docs" / "catalog.md"

# Internal-only rules — excluded from the public catalog.
INTERNAL_RULES = {
    "augment-source-of-truth",
    "augment-portability",
    "docs-sync",
}

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


@dataclass(frozen=True)
class Entry:
    kind: str          # skill | rule | command | shim | guideline
    name: str
    description: str
    extra: str         # rule type · cluster · sub-folder, etc.
    path: str          # repo-relative link target


def _parse_frontmatter(text: str) -> dict[str, str]:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    out: dict[str, str] = {}
    for line in m.group(1).splitlines():
        if ":" not in line or line.startswith(" "):
            continue
        k, _, v = line.partition(":")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _truncate(text: str, limit: int = 200) -> str:
    text = text.replace("|", "\\|").replace("\n", " ").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _collect_skills() -> list[Entry]:
    out = []
    for skill_dir in sorted((SRC / "skills").iterdir()):
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue
        fm = _parse_frontmatter(skill_md.read_text(encoding="utf-8"))
        name = fm.get("name") or skill_dir.name
        out.append(Entry(
            kind="skill",
            name=name,
            description=_truncate(fm.get("description", "")),
            extra="",
            path=f".agent-src.uncompressed/skills/{skill_dir.name}/SKILL.md",
        ))
    return out


def _collect_rules() -> list[Entry]:
    out = []
    for rule_md in sorted((SRC / "rules").glob("*.md")):
        fm = _parse_frontmatter(rule_md.read_text(encoding="utf-8"))
        out.append(Entry(
            kind="rule",
            name=rule_md.stem,
            description=_truncate(fm.get("description", "")),
            extra=fm.get("type", "?"),
            path=f".agent-src.uncompressed/rules/{rule_md.name}",
        ))
    return out


def _collect_commands() -> list[Entry]:
    out = []
    cmd_dir = SRC / "commands"
    for cmd_md in sorted(cmd_dir.rglob("*.md")):
        if cmd_md.name == "AGENTS.md":
            continue
        fm = _parse_frontmatter(cmd_md.read_text(encoding="utf-8"))
        is_shim = bool(fm.get("superseded_by"))
        extra = ""
        if is_shim:
            extra = f"shim → /{fm['superseded_by']}"
        elif fm.get("cluster"):
            extra = f"cluster: {fm['cluster']}"
        rel = cmd_md.relative_to(cmd_dir)
        out.append(Entry(
            kind="shim" if is_shim else "command",
            name=fm.get("name") or cmd_md.stem,
            description=_truncate(fm.get("description", "")),
            extra=extra,
            path=f".agent-src.uncompressed/commands/{rel}",
        ))
    return out


def _collect_guidelines() -> list[Entry]:
    out = []
    if not GUIDELINES.exists():
        return out
    for g_md in sorted(GUIDELINES.rglob("*.md")):
        rel = g_md.relative_to(ROOT)
        category = g_md.parent.name if g_md.parent != GUIDELINES else "(root)"
        out.append(Entry(
            kind="guideline",
            name=g_md.stem,
            description="",
            extra=category,
            path=str(rel),
        ))
    return out


# Path rewriter for the public catalog: link to the shipped surface
# (`.agent-src/`) instead of the source-of-truth (`.agent-src.uncompressed/`),
# which is excluded from `package.json#files` and `composer.json` archives.
def _to_shipped_path(path: str) -> str:
    return path.replace(".agent-src.uncompressed/", ".agent-src/", 1)


def _render_table(
    entries: list[Entry],
    cols: list[str],
    link_prefix: str,
    path_rewrite=None,
) -> str:
    rows = ["| " + " | ".join(cols) + " |", "|" + "|".join(["---"] * len(cols)) + "|"]
    for e in entries:
        path = path_rewrite(e.path) if path_rewrite else e.path
        link = f"[`{e.name}`]({link_prefix}{path})"
        row = [e.kind, link, e.extra, e.description]
        rows.append("| " + " | ".join(row) + " |")
    return "\n".join(rows)



def _render_index(skills, rules, commands, guidelines) -> str:
    total = len(skills) + len(rules) + len(commands) + len(guidelines)
    parts = [
        "# Agent-Config Internal Index",
        "",
        f"Maintainer-facing index of all **{total} artefacts** in this package.",
        "Auto-generated from `.agent-src.uncompressed/` and `docs/guidelines/`.",
        "",
        "> **Regenerate:** `python3 scripts/generate_index.py`",
        "> **Drift check:** `python3 scripts/generate_index.py --check` (runs in `task ci`)",
        "> Do not edit manually.",
        "",
        f"## Skills ({len(skills)})",
        "",
        _render_table(skills, ["kind", "name", "extra", "description"], "../"),
        "",
        f"## Rules ({len(rules)})",
        "",
        _render_table(rules, ["kind", "name", "type", "description"], "../"),
        "",
        f"## Commands ({len(commands)})",
        "",
        _render_table(commands, ["kind", "name", "cluster/shim", "description"], "../"),
        "",
        f"## Guidelines ({len(guidelines)})",
        "",
        _render_table(guidelines, ["kind", "name", "category", "description"], "../"),
        "",
    ]
    return "\n".join(parts)


def _render_catalog(skills, rules, commands, guidelines) -> str:
    public_rules = [r for r in rules if r.name not in INTERNAL_RULES]
    public_commands = [c for c in commands if c.kind == "command"]
    total = len(skills) + len(public_rules) + len(public_commands) + len(guidelines)
    parts = [
        "# agent-config — Public Catalog",
        "",
        f"Consumer-facing catalog of all **{total} public artefacts** shipped by",
        "this package. Internal package-maintenance rules and deprecation shims",
        "are excluded.",
        "",
        "> **Regenerate:** `python3 scripts/generate_index.py`",
        "> Auto-generated — do not edit manually.",
        "",
        f"## Skills ({len(skills)})",
        "",
        _render_table(skills, ["kind", "name", "extra", "description"], "../", _to_shipped_path),
        "",
        f"## Rules ({len(public_rules)})",
        "",
        _render_table(public_rules, ["kind", "name", "type", "description"], "../", _to_shipped_path),
        "",
        f"## Commands ({len(public_commands)})",
        "",
        _render_table(public_commands, ["kind", "name", "cluster", "description"], "../", _to_shipped_path),
        "",
        f"## Guidelines ({len(guidelines)})",
        "",
        _render_table(guidelines, ["kind", "name", "category", "description"], "../", _to_shipped_path),
        "",
        "---",
        "",
        "← [Back to README](../README.md)",
        "",
    ]
    return "\n".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="Exit 1 if generated content differs from on-disk files.")
    args = parser.parse_args()

    skills = _collect_skills()
    rules = _collect_rules()
    commands = _collect_commands()
    guidelines = _collect_guidelines()

    index_text = _render_index(skills, rules, commands, guidelines)
    catalog_text = _render_catalog(skills, rules, commands, guidelines)

    if args.check:
        drift = []
        if not INDEX_PATH.exists() or INDEX_PATH.read_text(encoding="utf-8") != index_text:
            drift.append(str(INDEX_PATH.relative_to(ROOT)))
        if not CATALOG_PATH.exists() or CATALOG_PATH.read_text(encoding="utf-8") != catalog_text:
            drift.append(str(CATALOG_PATH.relative_to(ROOT)))
        if drift:
            print("❌  Index drift detected — regenerate with:")
            print("    python3 scripts/generate_index.py")
            for d in drift:
                print(f"    - {d}")
            return 1
        print("✅  Index files in sync.")
        return 0

    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(index_text, encoding="utf-8")
    CATALOG_PATH.write_text(catalog_text, encoding="utf-8")
    print(f"✅  Wrote {INDEX_PATH.relative_to(ROOT)} ({len(skills)} skills, "
          f"{len(rules)} rules, {len(commands)} commands, {len(guidelines)} guidelines)")
    print(f"✅  Wrote {CATALOG_PATH.relative_to(ROOT)} (public subset)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
