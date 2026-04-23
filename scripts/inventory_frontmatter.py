#!/usr/bin/env python3
"""
Inventory frontmatter keys across all agent artefacts.

Reads .agent-src.uncompressed/{skills,rules,commands,personas}, parses the
YAML frontmatter of every file, and prints per-type:

- total file count
- every key observed, with count and percentage
- sample values (up to 3) per key

Output is Markdown on stdout, intended to be captured into
`agents/docs/frontmatter-contract.md` as raw material for Phase 1 of the
frontmatter-schema roadmap.

Stdlib-only. No PyYAML — we do a simple line-based parse sufficient for
our frontmatter shapes (flat keys, inline lists, block lists, one nested
`execution:` block).
"""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".agent-src.uncompressed"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def extract_frontmatter(text: str) -> str | None:
    match = FRONTMATTER_RE.search(text)
    return match.group(1) if match else None


def parse_frontmatter_keys(fm: str) -> dict[str, str]:
    """Return a flat {key: raw_value_string} for a frontmatter block.

    For nested blocks (e.g. `execution:`), the nested keys are flattened
    with a dot notation: `execution.type`, `execution.handler`, etc.
    Inline lists (`personas: [a, b]`) and block lists (`- a\n- b`) are
    rendered as their raw value.
    """
    result: dict[str, str] = {}
    lines = fm.splitlines()
    i = 0
    current_nested: str | None = None
    current_list_key: str | None = None
    list_buffer: list[str] = []

    def flush_list() -> None:
        nonlocal current_list_key, list_buffer
        if current_list_key is not None:
            result[current_list_key] = "[" + ", ".join(list_buffer) + "]"
        current_list_key = None
        list_buffer = []

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped or stripped.startswith("#"):
            i += 1
            continue

        # Top-level key (no leading whitespace)
        if line and not line[0].isspace():
            flush_list()
            current_nested = None
            m = re.match(r"^([\w-]+):\s*(.*?)\s*$", line)
            if m:
                key, value = m.group(1), m.group(2)
                if value == "" or value == "|":
                    # Could start a nested block OR a list. Look ahead.
                    nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
                    if nxt.startswith("- "):
                        current_list_key = key
                    else:
                        current_nested = key
                        result[key] = "{nested}"
                else:
                    result[key] = value
        # Nested (indented) key
        elif current_nested is not None:
            m = re.match(r"^\s+([\w-]+):\s*(.*?)\s*$", line)
            if m:
                key, value = m.group(1), m.group(2)
                result[f"{current_nested}.{key}"] = value or "{nested}"
        # Block list item
        elif current_list_key is not None and stripped.startswith("- "):
            list_buffer.append(stripped[2:].strip())

        i += 1

    flush_list()
    return result


def gather_files(artefact_dir: Path, pattern: str) -> list[Path]:
    if not artefact_dir.exists():
        return []
    files = [f for f in artefact_dir.rglob(pattern) if not f.is_symlink()]
    return sorted(files)


def inventory_type(name: str, files: list[Path]) -> None:
    total = len(files)
    print(f"### {name} — {total} files\n")
    if total == 0:
        print("_(no files)_\n")
        return

    key_counts: Counter[str] = Counter()
    key_value_counts: dict[str, Counter[str]] = defaultdict(Counter)

    for f in files:
        text = f.read_text(encoding="utf-8")
        fm = extract_frontmatter(text)
        if fm is None:
            continue
        parsed = parse_frontmatter_keys(fm)
        for k, v in parsed.items():
            key_counts[k] += 1
            # Record distinct values for enum detection; truncate to keep
            # the table readable and strip surrounding quotes.
            normalized = v.strip('"').strip("'")[:80] if v else "{empty}"
            key_value_counts[k][normalized] += 1

    print("| key | count | % | status | distinct values (count) |")
    print("|---|---:|---:|---|---|")
    for key, count in sorted(key_counts.items(), key=lambda kv: (-kv[1], kv[0])):
        pct = count * 100 // total
        status = "required" if pct >= 95 else "optional"
        values = key_value_counts[key]
        if len(values) <= 8:
            rendered = " · ".join(f"`{val}` ({n})" for val, n in values.most_common())
        else:
            top = values.most_common(5)
            rendered = " · ".join(f"`{val}` ({n})" for val, n in top)
            rendered += f" · … +{len(values) - 5} more"
        print(f"| `{key}` | {count} | {pct}% | {status} | {rendered} |")
    print()


def main() -> int:
    print("# Frontmatter inventory (generated)\n")
    print("Generated by `scripts/inventory_frontmatter.py`. Raw material for")
    print("Phase 1 of the frontmatter-schema roadmap. Do not edit by hand.\n")

    inventory_type("skills", gather_files(SRC / "skills", "SKILL.md"))
    inventory_type("rules", gather_files(SRC / "rules", "*.md"))
    inventory_type("commands", gather_files(SRC / "commands", "*.md"))
    inventory_type("personas", [
        f for f in gather_files(SRC / "personas", "*.md")
        if f.name.lower() != "readme.md"
    ])
    return 0


if __name__ == "__main__":
    sys.exit(main())
