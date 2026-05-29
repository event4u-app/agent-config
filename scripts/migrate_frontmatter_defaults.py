#!/usr/bin/env python3
"""Migrate artefact frontmatter to omit fields equal to their schema default.

Phase 2 of `road-to-abstraction-reduction.md`. For every skill / rule /
command / persona, drop any frontmatter field whose value equals the
`default` declared in its `scripts/schemas/*.json` (preflight Decision C:
value-equals-default, type-safe). Fields without a schema default
(`skill.execution.type`, `command.type`, `rule.validator_ignore`) are never
touched.

The loader injects the same defaults at read time
(`validate_frontmatter.apply_schema_defaults`), so consumers see the field
present regardless. Idempotent: a second run is a no-op.

CLI:
  python3 scripts/migrate_frontmatter_defaults.py [--dry-run] [--deltas PATH]

Exit codes: 0 always (reports counts); non-zero only on I/O error.
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_frontmatter import load_schema, parse_frontmatter  # noqa: E402
from _lib.agent_src import artefact_roots  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DELTAS = ROOT / "agents" / "evidence" / "analysis" / "abstraction-reduction-deltas.md"

# (subdir, glob, schema name)
_CATEGORIES = [
    ("skills", "SKILL.md", "skill"),
    ("rules", "*.md", "rule"),
    ("commands", "*.md", "command"),
    ("personas", "*.md", "persona"),
]

_FM_RE_OPEN = "---\n"


def _same(value: Any, default: Any) -> bool:
    """Type-safe equality. `True == 1` and `1.0 == 1` must NOT match across
    types (preflight Decision C). bool is checked first because in Python
    `isinstance(True, int)` is True."""
    if isinstance(default, bool):
        return isinstance(value, bool) and value == default
    if isinstance(value, bool):
        return False
    return type(value) is type(default) and value == default


def _plan_drops(fm: dict[str, Any], schema: dict[str, Any]) -> tuple[set[str], set[str], dict[str, set[str]]]:
    """Return (top_level_drops, full_block_drops, partial_block_drops).

    - top_level_drops: scalar keys whose value == default → drop the line.
    - full_block_drops: object keys where every *present* sub-key is droppable
      → drop the whole block.
    - partial_block_drops: object key → set of droppable sub-keys (block kept).
    """
    top: set[str] = set()
    full: set[str] = set()
    partial: dict[str, set[str]] = {}
    props = schema.get("properties", {})
    for key, prop in props.items():
        if not isinstance(prop, dict):
            continue
        if "default" in prop:
            if key in fm and _same(fm[key], prop["default"]):
                top.add(key)
        elif prop.get("type") == "object" and isinstance(fm.get(key), dict):
            sub_props = prop.get("properties", {})
            droppable = {
                sk for sk, sp in sub_props.items()
                if isinstance(sp, dict) and "default" in sp
                and sk in fm[key] and _same(fm[key][sk], sp["default"])
            }
            if not droppable:
                continue
            present = set(fm[key].keys())
            if present <= droppable:
                full.add(key)
            else:
                partial[key] = droppable
    return top, full, partial


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _rewrite_fm_body(body: str, top: set[str], full: set[str], partial: dict[str, set[str]]) -> str:
    """Remove the planned lines from a frontmatter body, preserving everything
    else byte-for-byte."""
    lines = body.split("\n")
    out: list[str] = []
    skipping_block = False
    current_block: str | None = None
    for line in lines:
        stripped = line.strip()
        ind = _indent(line)
        if skipping_block:
            # Consume the block's indented children (and blank lines) until a
            # top-level (indent-0, non-blank) line appears.
            if stripped == "" or ind > 0:
                continue
            skipping_block = False
            current_block = None
        if ind == 0 and stripped and not stripped.startswith("#"):
            key = stripped.split(":", 1)[0].strip()
            if key in top:
                continue
            if key in full:
                skipping_block = True
                continue
            current_block = key if key in partial else None
            out.append(line)
            continue
        # Indented line belonging to current_block.
        if current_block is not None and ind > 0 and ":" in stripped:
            sub_key = stripped.split(":", 1)[0].strip()
            if sub_key in partial.get(current_block, set()):
                continue
        out.append(line)
    return "\n".join(out)


def _migrate_file(path: Path, schema: dict[str, Any]) -> int:
    text = path.read_text(encoding="utf-8")
    fm, _ = parse_frontmatter(text)
    if not isinstance(fm, dict):
        return 0
    top, full, partial = _plan_drops(fm, schema)
    if not (top or full or partial):
        return 0
    # Locate the frontmatter body span (after the opening `---\n`).
    if not text.startswith(_FM_RE_OPEN):
        return 0
    end = text.find("\n---\n", len(_FM_RE_OPEN))
    if end == -1:
        return 0
    body = text[len(_FM_RE_OPEN):end]
    new_body = _rewrite_fm_body(body, top, full, partial)
    if new_body == body:
        return 0
    new_text = _FM_RE_OPEN + new_body + text[end:]
    removed = body.count("\n") - new_body.count("\n")
    path.write_text(new_text, encoding="utf-8")
    return removed


def _iter(category_subdir: str, glob: str):
    """Mirror `validate_frontmatter._iter_artefacts` exactly: skills / rules /
    commands recurse; personas are **non-recursive** (`glob`, not `rglob`) so
    advisor personas (`personas/advisors/*.md`, a different schema) and the
    `_template-specialist/` scaffold are never migrated."""
    for root in artefact_roots():
        base = root / category_subdir
        if not base.exists():
            continue
        paths = base.glob(glob) if category_subdir == "personas" else base.rglob(glob)
        for p in sorted(paths):
            if p.is_file() and not p.is_symlink():
                if category_subdir == "personas" and p.name.lower() == "readme.md":
                    continue
                yield p


def run(apply: bool, deltas_path: Path) -> int:
    per_class_lines: dict[str, int] = defaultdict(int)
    per_class_files: dict[str, int] = defaultdict(int)
    for subdir, glob, schema_name in _CATEGORIES:
        schema = load_schema(schema_name)
        for path in _iter(subdir, glob):
            if apply:
                removed = _migrate_file(path, schema)
            else:
                # Dry-run: compute the delta without writing.
                text = path.read_text(encoding="utf-8")
                fm, _ = parse_frontmatter(text)
                if not isinstance(fm, dict) or not text.startswith(_FM_RE_OPEN):
                    continue
                end = text.find("\n---\n", len(_FM_RE_OPEN))
                if end == -1:
                    continue
                body = text[len(_FM_RE_OPEN):end]
                top, full, partial = _plan_drops(fm, schema)
                new_body = _rewrite_fm_body(body, top, full, partial)
                removed = body.count("\n") - new_body.count("\n")
            if removed:
                per_class_lines[schema_name] += removed
                per_class_files[schema_name] += 1

    total_lines = sum(per_class_lines.values())
    total_files = sum(per_class_files.values())
    verb = "would remove" if not apply else "removed"
    print(f"frontmatter-default migration ({'dry-run' if not apply else 'apply'}):")
    for schema_name, _glob, _sn in [(c[2], c[1], c[2]) for c in _CATEGORIES]:
        if per_class_files.get(schema_name):
            print(f"  {schema_name:8s}: {verb} {per_class_lines[schema_name]:5d} lines "
                  f"across {per_class_files[schema_name]} files")
    print(f"  {'TOTAL':8s}: {verb} {total_lines} lines across {total_files} files")

    if not apply:
        _write_deltas(deltas_path, per_class_lines, per_class_files, total_lines, total_files)
        print(f"  delta report → {deltas_path.relative_to(ROOT)}")
    return 0


def _write_deltas(path: Path, lines: dict[str, int], files: dict[str, int],
                  total_lines: int, total_files: int) -> None:
    rows = "\n".join(
        f"| {sn} | {files.get(sn, 0)} | {lines.get(sn, 0)} |"
        for _sd, _g, sn in _CATEGORIES if files.get(sn)
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "# Abstraction-reduction — frontmatter line-count delta\n\n"
        "> Dry-run prediction from `scripts/migrate_frontmatter_defaults.py "
        "--dry-run` (road-to-abstraction-reduction.md Phase 2 § Step 2). Lines\n"
        "> are frontmatter lines dropped because their value equalled the\n"
        "> schema default; the loader re-injects them at read time.\n\n"
        "| Class | Files touched | Lines removed |\n"
        "|---|---:|---:|\n"
        f"{rows}\n"
        f"| **TOTAL** | **{total_files}** | **{total_lines}** |\n",
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="report the delta; write nothing.")
    parser.add_argument("--deltas", type=Path, default=DEFAULT_DELTAS,
                        help="dry-run delta report output path.")
    args = parser.parse_args(argv)
    return run(apply=not args.dry_run, deltas_path=args.deltas)


if __name__ == "__main__":
    sys.exit(main())
