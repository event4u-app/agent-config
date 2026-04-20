#!/usr/bin/env python3
"""
Lint .claude-plugin/marketplace.json for the event4u/agent-config package.

Validates the Claude Code Plugin Marketplace manifest against the canonical
shape used by anthropics/skills:

  - Required top-level fields: name, owner, metadata, plugins
  - owner must have name + email
  - metadata must have description + version
  - metadata.version must match package.json (single source of truth)
  - every plugins[].skills[] entry must exist on disk and carry a SKILL.md

Exit codes: 0 = clean, 1 = problems found, 3 = internal error.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(".")
MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"
PACKAGE_JSON = ROOT / "package.json"


def fail(errors: list[str]) -> int:
    print("❌  marketplace.json has problems:")
    for e in errors:
        print(f"  - {e}")
    return 1


def require_key(obj: dict, key: str, where: str, errors: list[str]) -> bool:
    if key not in obj:
        errors.append(f"missing key `{key}` in {where}")
        return False
    return True


def main() -> int:
    if not MARKETPLACE.exists():
        print(f"❌  {MARKETPLACE} not found")
        return 1

    try:
        data = json.loads(MARKETPLACE.read_text())
    except json.JSONDecodeError as e:
        print(f"❌  {MARKETPLACE} is not valid JSON: {e}")
        return 1

    errors: list[str] = []

    # Top-level required fields
    for k in ("name", "owner", "metadata", "plugins"):
        require_key(data, k, "marketplace root", errors)

    # Owner
    owner = data.get("owner", {})
    if isinstance(owner, dict):
        for k in ("name", "email"):
            require_key(owner, k, "owner", errors)
    else:
        errors.append("`owner` must be an object")

    # Metadata + version sync
    metadata = data.get("metadata", {})
    if isinstance(metadata, dict):
        for k in ("description", "version"):
            require_key(metadata, k, "metadata", errors)
        mp_version = metadata.get("version")
        if mp_version and PACKAGE_JSON.exists():
            pkg = json.loads(PACKAGE_JSON.read_text())
            pkg_version = pkg.get("version")
            if pkg_version and mp_version != pkg_version:
                errors.append(
                    f"metadata.version `{mp_version}` does not match "
                    f"package.json version `{pkg_version}`"
                )
    else:
        errors.append("`metadata` must be an object")

    # Plugins
    plugins = data.get("plugins", [])
    if not isinstance(plugins, list) or not plugins:
        errors.append("`plugins` must be a non-empty array")
        plugins = []

    for idx, plugin in enumerate(plugins):
        where = f"plugins[{idx}]"
        if not isinstance(plugin, dict):
            errors.append(f"{where} must be an object")
            continue
        for k in ("name", "description", "source", "skills"):
            require_key(plugin, k, where, errors)

        skills = plugin.get("skills", [])
        if not isinstance(skills, list):
            errors.append(f"{where}.skills must be an array")
            continue

        seen: set[str] = set()
        for s_idx, path in enumerate(skills):
            entry = f"{where}.skills[{s_idx}]"
            if not isinstance(path, str):
                errors.append(f"{entry} must be a string")
                continue
            if path in seen:
                errors.append(f"{entry} is a duplicate: `{path}`")
            seen.add(path)

            # Resolve path relative to repo root (strip leading "./" only,
            # NOT every "." and "/" character)
            rel = path.removeprefix("./")
            skill_dir = ROOT / rel
            if not skill_dir.exists():
                errors.append(f"{entry} path does not exist: `{path}`")
                continue
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                errors.append(f"{entry} has no SKILL.md: `{path}`")

    if errors:
        return fail(errors)

    plugin_count = len(plugins)
    skill_count = sum(len(p.get("skills", [])) for p in plugins if isinstance(p, dict))
    print(
        f"✅  marketplace.json ({plugin_count} plugin"
        f"{'s' if plugin_count != 1 else ''}, {skill_count} skills total)"
    )
    print("  No issues found.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # pragma: no cover
        print(f"❌  internal error: {exc}", file=sys.stderr)
        sys.exit(3)
