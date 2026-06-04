"""Read command frontmatter into `CommandSpec` instances.

Reuses the package's stdlib-only `validate_frontmatter.parse_frontmatter`
so the loader and the linter agree on what counts as well-formed.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from .types import CommandSpec

# Sibling stdlib parser — same one the linter calls.
_SCRIPTS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_SCRIPTS_DIR))
from validate_frontmatter import parse_frontmatter  # noqa: E402


def load_commands(commands_dir: Path) -> list[CommandSpec]:
    """Load every `*.md` under ``commands_dir`` as a `CommandSpec`.

    Files without a `suggestion` block are loaded as `eligible=False`
    with empty rationale — keeps tests deterministic on legacy data.
    Bad frontmatter is skipped silently; the linter is the gate, not
    this loader.
    """
    specs: list[CommandSpec] = []
    for path in sorted(commands_dir.rglob("*.md")):
        # Skip cluster authoring docs — not commands.
        if path.name == "AGENTS.md":
            continue
        text = path.read_text(encoding="utf-8")
        data, _offset = parse_frontmatter(text)
        if data is None:
            continue
        name = str(data.get("name") or path.stem)
        description = str(data.get("description") or "")
        spec = _spec_from_data(name, description, data.get("suggestion"))
        specs.append(spec)
    return specs


def _spec_from_data(
    name: str, description: str, suggestion: Any
) -> CommandSpec:
    if not isinstance(suggestion, dict):
        return CommandSpec(name=name, description=description, eligible=False)
    eligible = suggestion.get("eligible") is True
    if not eligible:
        return CommandSpec(
            name=name,
            description=description,
            eligible=False,
            rationale=str(suggestion.get("rationale") or ""),
        )
    floor = suggestion.get("confidence_floor")
    floor_f: float | None
    try:
        floor_f = float(floor) if floor is not None else None
    except (TypeError, ValueError):
        floor_f = None
    cooldown = suggestion.get("cooldown")
    cooldown_s = str(cooldown) if cooldown is not None else None
    return CommandSpec(
        name=name,
        description=description,
        eligible=True,
        trigger_description=str(suggestion.get("trigger_description") or ""),
        trigger_context=str(suggestion.get("trigger_context") or ""),
        confidence_floor=floor_f,
        cooldown=cooldown_s,
    )
