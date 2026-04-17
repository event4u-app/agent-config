#!/usr/bin/env python3
"""
Agent Config — Project Bridge Installer (Python)

Generates project bridge files (.agent-settings, .vscode/settings.json, etc.)
so that supported AI tools can discover agent-config from the project.

Usage:
  python3 scripts/install.py                     # defaults: cost_profile=minimal
  python3 scripts/install.py --profile=balanced  # set cost_profile=balanced
  python3 scripts/install.py --force             # overwrite existing files
  python3 scripts/install.py --skip-bridges      # only create .agent-settings
  python3 scripts/install.py --project <dir>     # override project root

Idempotent — safe to run multiple times. Never overwrites files without --force.
Zero dependencies — standard library only.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
from pathlib import Path

DEFAULT_PROFILE = "minimal"
SUPPORTED_PROFILES = ("minimal", "balanced", "full")
COST_PROFILE_PLACEHOLDER = "__COST_PROFILE__"


# --- Output helpers ---

QUIET = False


def info(msg: str) -> None:
    if not QUIET:
        print(f"  {msg}")


def success(msg: str) -> None:
    if not QUIET:
        print(f"  ✅  {msg}")


def skip(msg: str) -> None:
    if not QUIET:
        print(f"  ⏭️  {msg}")


def warn(msg: str) -> None:
    print(f"  ⚠️  {msg}", file=sys.stderr)


def fail(msg: str) -> "None":
    print(f"  ❌  {msg}", file=sys.stderr)
    sys.exit(1)


# --- Package detection ---

def detect_package_root(project_root: Path) -> Path:
    candidates = [
        project_root / "vendor" / "event4u" / "agent-config",
        project_root / "node_modules" / "@event4u" / "agent-config",
    ]
    for path in candidates:
        if path.is_dir():
            return path.resolve()

    # Running from within the package itself (development mode)
    if (project_root / "config" / "profiles" / "minimal.ini").exists():
        return project_root

    fail("Could not find agent-config package. Run from a project with composer/npm install.")
    return project_root  # unreachable


def detect_package_type(package_root: Path) -> str:
    parts = package_root.parts
    if "vendor" in parts:
        return "composer"
    if "node_modules" in parts:
        return "npm"
    return "local"


def detect_package_type_for_project(project_root: Path, package_root: Path) -> str:
    """Determine package type based on where the package lives relative to the project."""
    composer_path = (project_root / "vendor" / "event4u" / "agent-config").resolve()
    npm_path = (project_root / "node_modules" / "@event4u" / "agent-config").resolve()
    package_resolved = package_root.resolve()

    if package_resolved == composer_path or composer_path.exists():
        if package_resolved == composer_path:
            return "composer"
    if package_resolved == npm_path or npm_path.exists():
        if package_resolved == npm_path:
            return "npm"
    return detect_package_type(package_root)


# --- File utilities ---

def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_file(path: Path, content: str) -> None:
    ensure_directory(path.parent)
    path.write_text(content, encoding="utf-8")


def read_json_file(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        warn(f"Invalid JSON in {path}, treating as empty")
        return {}
    if not isinstance(data, dict):
        warn(f"Unexpected JSON shape in {path}, treating as empty")
        return {}
    return data


def write_json_file(path: Path, data: dict) -> None:
    content = json.dumps(data, indent=4, ensure_ascii=False) + "\n"
    write_file(path, content)


def deep_merge(base: dict, overlay: dict) -> dict:
    """Recursive dict merge — overlay wins, nested dicts are merged, lists are replaced."""
    result = copy.deepcopy(base)
    for key, value in overlay.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def merge_json_file(path: Path, new_data: dict, force: bool, label: str) -> None:
    if not path.exists():
        write_json_file(path, new_data)
        success(f"{label} created")
        return

    existing = read_json_file(path)
    merged = deep_merge(existing, new_data)

    if merged == existing:
        skip(f"{label} already configured")
        return

    if not force:
        skip(f"{label} exists, needs update (use --force)")
        return

    write_json_file(path, merged)
    success(f"{label} updated")


# --- Bridge generators ---

def ensure_agent_settings(project_root: Path, package_root: Path, profile: str, force: bool) -> None:
    target = project_root / ".agent-settings"
    profile_source = package_root / "config" / "profiles" / f"{profile}.ini"
    template_source = package_root / "config" / "agent-settings.template.ini"

    if not profile_source.exists():
        fail(f"Missing profile preset: {profile_source}")
    if not template_source.exists():
        fail(f"Missing settings template: {template_source}")

    if target.exists() and not force:
        skip(".agent-settings already exists")
        return

    template = template_source.read_text(encoding="utf-8")
    if COST_PROFILE_PLACEHOLDER not in template:
        fail(f"Template is missing placeholder {COST_PROFILE_PLACEHOLDER}")

    rendered = template.replace(COST_PROFILE_PLACEHOLDER, profile)
    write_file(target, rendered)
    success(f".agent-settings created (cost_profile={profile})")


def ensure_vscode_bridge(project_root: Path, package_type: str, force: bool) -> None:
    plugin_paths = {
        "composer": "./vendor/event4u/agent-config/plugin/agent-config",
        "npm": "./node_modules/@event4u/agent-config/plugin/agent-config",
    }
    plugin_path = plugin_paths.get(package_type, "./plugin/agent-config")

    bridge = {"chat.pluginLocations": {plugin_path: True}}
    merge_json_file(project_root / ".vscode" / "settings.json", bridge, force, ".vscode/settings.json")


def ensure_augment_bridge(project_root: Path, force: bool) -> None:
    bridge = {"enabledPlugins": {"agent-config@event4u": True}}
    merge_json_file(project_root / ".augment" / "settings.json", bridge, force, ".augment/settings.json")


def ensure_copilot_bridge(project_root: Path, force: bool) -> None:
    target = project_root / ".github" / "plugin" / "marketplace.json"

    bridge = {
        "marketplace": {
            "name": "event4u-agent-marketplace",
            "plugins": [
                {
                    "id": "agent-config@event4u",
                    "repository": "https://github.com/event4u-app/agent-config",
                },
            ],
        },
    }

    if target.exists() and not force:
        skip(".github/plugin/marketplace.json already exists")
        return

    write_json_file(target, bridge)
    success(".github/plugin/marketplace.json created")


# --- Argument parsing ---

def parse_options(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="install.py",
        description="Agent Config — Project Bridge Installer",
        add_help=True,
    )
    parser.add_argument(
        "--profile",
        default=DEFAULT_PROFILE,
        help=f"cost_profile value ({'|'.join(SUPPORTED_PROFILES)}, default: {DEFAULT_PROFILE})",
    )
    parser.add_argument("--force", action="store_true", help="overwrite existing files")
    parser.add_argument("--skip-bridges", action="store_true", help="only create .agent-settings")
    parser.add_argument("--project", default=None, help="project root (default: cwd or PROJECT_ROOT env)")
    parser.add_argument("--package", default=None, help="package root (default: auto-detect under project)")
    parser.add_argument("--quiet", action="store_true", help="suppress info/success output (warnings/errors still shown)")
    return parser.parse_args(argv)


# --- Main ---

def main(argv: list[str]) -> int:
    global QUIET

    opts = parse_options(argv)
    QUIET = opts.quiet

    if opts.profile not in SUPPORTED_PROFILES:
        fail(f"Unsupported profile: {opts.profile}. Supported: {', '.join(SUPPORTED_PROFILES)}")

    project_root = Path(opts.project or os.environ.get("PROJECT_ROOT") or os.getcwd()).resolve()

    if opts.package:
        package_root = Path(opts.package).resolve()
        if not (package_root / "config" / "profiles" / "minimal.ini").exists():
            fail(f"Invalid --package path (missing config/profiles/minimal.ini): {package_root}")
        package_type = detect_package_type_for_project(project_root, package_root)
    else:
        package_root = detect_package_root(project_root)
        package_type = detect_package_type(package_root)

    if not QUIET:
        print()
        info("Agent Config — Project Bridge Installer")
        info(f"Project:  {project_root}")
        info(f"Package:  {package_root}")
        info(f"Type:     {package_type}")
        info(f"Profile:  {opts.profile}")
        print()

    ensure_agent_settings(project_root, package_root, opts.profile, opts.force)

    if not opts.skip_bridges:
        ensure_vscode_bridge(project_root, package_type, opts.force)
        ensure_augment_bridge(project_root, opts.force)
        ensure_copilot_bridge(project_root, opts.force)

    if not QUIET:
        print()
        success("Done.")
        print()
        print("  Try these 3 prompts with your agent:")
        print('    1. "Refactor this function"   → agent analyzes first')
        print('    2. "Add caching to this"      → agent asks instead of guessing')
        print('    3. "Implement this feature"   → agent respects your codebase')
        print()
        print("  Next steps:")
        print("    • Commit .agent-settings and bridge files to your repo")
        print("    • New team members just run composer install / npm install — done")
        print("    • Full walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
