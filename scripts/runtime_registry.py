#!/usr/bin/env python3
"""
Runtime Registry — discovers skills with execution metadata.

Responsibilities:
- Discover skills with execution blocks in frontmatter
- Validate handler support
- Expose list of runtime-capable skills
- Provide skill metadata lookup

Usage:
    python3 scripts/runtime_registry.py [--root ROOT] [--format text|json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional

# Import shared parsing from skill_linter
sys.path.insert(0, str(Path(__file__).resolve().parent))
from skill_linter import (
    FRONTMATTER_PATTERN,
    DESCRIPTION_PATTERN,
    NAME_PATTERN,
    VALID_EXECUTION_TYPES,
    VALID_EXECUTION_HANDLERS,
    parse_execution_block,
    extract_frontmatter,
)


@dataclass
class SkillRuntime:
    """Runtime metadata for a single skill."""
    name: str
    path: str
    description: str
    execution_type: str
    handler: str
    timeout_seconds: int
    safety_mode: Optional[str]
    allowed_tools: List[str]

    @property
    def is_executable(self) -> bool:
        return self.execution_type in ("assisted", "automated")

    @property
    def is_automated(self) -> bool:
        return self.execution_type == "automated"


def discover_skills(root: Path) -> List[Path]:
    """Find all SKILL.md files, preferring .agent-src.uncompressed/."""
    uncompressed = root / ".agent-src.uncompressed" / "skills"
    compressed = root / ".agent-src" / "skills"
    base = uncompressed if uncompressed.exists() else compressed
    if not base.exists():
        return []
    return sorted(f for f in base.rglob("SKILL.md") if not f.is_symlink())


def parse_skill_runtime(path: Path) -> Optional[SkillRuntime]:
    """Parse a skill file and return its runtime metadata, or None if no execution block."""
    text = path.read_text(encoding="utf-8")
    frontmatter = extract_frontmatter(text)
    if frontmatter is None:
        return None

    execution = parse_execution_block(frontmatter)
    if execution is None:
        return None

    # Extract name and description
    name_match = NAME_PATTERN.search(frontmatter)
    name = name_match.group(1).strip() if name_match else path.parent.name
    desc_match = DESCRIPTION_PATTERN.search(frontmatter)
    description = desc_match.group(1).strip() if desc_match else ""

    return SkillRuntime(
        name=name,
        path=str(path),
        description=description,
        execution_type=execution.get("type", "manual"),
        handler=execution.get("handler", "none"),
        timeout_seconds=execution.get("timeout_seconds", 30),
        safety_mode=execution.get("safety_mode"),
        allowed_tools=execution.get("allowed_tools", []),
    )


def build_registry(root: Path) -> List[SkillRuntime]:
    """Build the full runtime registry from all skills."""
    skills = discover_skills(root)
    registry: List[SkillRuntime] = []
    for skill_path in skills:
        runtime = parse_skill_runtime(skill_path)
        if runtime is not None:
            registry.append(runtime)
    return registry


def validate_registry(registry: List[SkillRuntime]) -> List[str]:
    """Validate the registry for consistency issues."""
    errors: List[str] = []
    for skill in registry:
        if skill.execution_type not in VALID_EXECUTION_TYPES:
            errors.append(f"{skill.name}: invalid execution type '{skill.execution_type}'")
        if skill.handler not in VALID_EXECUTION_HANDLERS:
            errors.append(f"{skill.name}: invalid handler '{skill.handler}'")
        if skill.is_automated:
            if skill.handler == "none":
                errors.append(f"{skill.name}: automated skill has handler 'none'")
            if skill.safety_mode != "strict":
                errors.append(f"{skill.name}: automated skill missing safety_mode 'strict'")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Runtime Registry — list runtime-capable skills")
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    parser.add_argument("--format", choices=["text", "json"], default="text", help="Output format")
    parser.add_argument("--validate", action="store_true", help="Validate registry consistency")
    args = parser.parse_args()

    registry = build_registry(args.root)

    if args.validate:
        errors = validate_registry(registry)
        if errors:
            for e in errors:
                print(f"ERROR: {e}", file=sys.stderr)
            return 1
        print(f"Registry valid: {len(registry)} runtime-capable skills")
        return 0

    if args.format == "json":
        print(json.dumps([asdict(s) for s in registry], indent=2))
    else:
        if not registry:
            print("No runtime-capable skills found.")
        else:
            print(f"Runtime-capable skills: {len(registry)}\n")
            for s in registry:
                tools = ", ".join(s.allowed_tools) if s.allowed_tools else "none"
                print(f"  {s.name}")
                print(f"    type: {s.execution_type} | handler: {s.handler} | "
                      f"timeout: {s.timeout_seconds}s | tools: {tools}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
