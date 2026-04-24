#!/usr/bin/env python3
"""
Agent Config — Project Bridge Installer (Python)

Generates project bridge files (.agent-settings.yml, .vscode/settings.json,
etc.) so that supported AI tools can discover agent-config from the project.

On first run in a project that still has the legacy flat-file
`.agent-settings` (key=value), the installer migrates it to the new YAML
format in `.agent-settings.yml`, leaves a one-shot backup as
`.agent-settings.backup.key-value`, and deletes the legacy file. This runs
exactly once; subsequent runs are idempotent.

Usage:
  python3 scripts/install.py                     # defaults: cost_profile=minimal
  python3 scripts/install.py --profile=balanced  # set cost_profile=balanced
  python3 scripts/install.py --force             # overwrite existing files
  python3 scripts/install.py --skip-bridges      # only create .agent-settings.yml
  python3 scripts/install.py --project <dir>     # override project root

Idempotent — safe to run multiple times. Never overwrites files without --force.
Zero dependencies — standard library only.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import re
import sys
from pathlib import Path

DEFAULT_PROFILE = "minimal"
SUPPORTED_PROFILES = ("minimal", "balanced", "full")
COST_PROFILE_PLACEHOLDER = "__COST_PROFILE__"

SETTINGS_FILE = ".agent-settings.yml"
LEGACY_SETTINGS_FILE = ".agent-settings"
LEGACY_BACKUP_FILE = ".agent-settings.backup.key-value"

# Maps legacy flat keys (.agent-settings, key=value) to the new dotted YAML
# paths in .agent-settings.yml. Applied once during auto-migration.
LEGACY_RENAME_MAP = {
    "cost_profile": "cost_profile",
    "ide": "personal.ide",
    "open_edited_files": "personal.open_edited_files",
    "user_name": "personal.user_name",
    "rtk_installed": "personal.rtk_installed",
    "minimal_output": "personal.minimal_output",
    "play_by_play": "personal.play_by_play",
    "pr_comment_bot_icon": "project.pr_comment_bot_icon",
    "pr_template": "project.pr_template",
    "upstream_repo": "project.upstream_repo",
    "improvement_pr_branch_prefix": "project.improvement_pr_branch_prefix",
    "github_pr_reply_method": "github.pr_reply_method",
    "eloquent_access_style": "eloquent.access_style",
    "skill_improvement_pipeline": "pipelines.skill_improvement",
    "subagent_implementer_model": "subagents.implementer_model",
    "subagent_judge_model": "subagents.judge_model",
    "subagent_max_parallel": "subagents.max_parallel",
}


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


# --- Legacy settings migration ---

def _parse_legacy_settings(text: str) -> "tuple[dict, list]":
    """Parse a legacy .agent-settings (key=value) file.

    Returns (values, unknown) where values is a dict mapping legacy flat
    keys to string values, and unknown is a list of keys NOT in
    LEGACY_RENAME_MAP (preserved under `_legacy:` after migration).
    """
    values: dict = {}
    unknown: list = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        values[key] = value
        if key not in LEGACY_RENAME_MAP:
            unknown.append(key)
    return values, unknown


_BARE_ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def _yaml_scalar(value: str) -> str:
    """Format a string value as a YAML scalar with minimal quoting.

    Booleans and non-negative integers are emitted unquoted. Bare
    lowercase identifiers (``per_turn``, ``rotate``, ``getters_setters``
    — the shape of profile values and enum-like strings) are emitted
    unquoted so `sync_agent_settings.py` stays idempotent against its
    own output. Everything else is double-quoted.
    """
    if value == "":
        return '""'
    if value in ("true", "false"):
        return value
    if value.isdigit():
        return value
    if _BARE_ID_RE.match(value):
        return value
    # Escape backslashes and double-quotes, then wrap
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _replace_template_value(template: str, dotted_path: str, value: str) -> str:
    """Replace the default value for a dotted-path key in the YAML template.

    Strategy: walk the template lines, track the current top-level
    section, and replace the first matching line. Comments and indentation
    are preserved.
    """
    parts = dotted_path.split(".")
    if len(parts) == 1:
        section, key = None, parts[0]
    elif len(parts) == 2:
        section, key = parts[0], parts[1]
    else:
        return template  # deeper nesting not supported in current schema

    lines = template.splitlines()
    current_section: "str | None" = None
    section_re = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*):\s*$")
    scalar_top_re = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*):\s*.*$")
    scalar_sub_re = re.compile(r"^(\s+)([A-Za-z_][A-Za-z0-9_]*):\s*.*$")

    replacement = _yaml_scalar(value)
    for idx, line in enumerate(lines):
        # Top-level section header
        m_section = section_re.match(line)
        if m_section:
            current_section = m_section.group(1)
            continue
        if section is None:
            # Top-level scalar target
            m_top = scalar_top_re.match(line)
            if m_top and m_top.group(1) == key and not line.startswith((" ", "\t")):
                lines[idx] = f"{key}: {replacement}"
                return "\n".join(lines) + ("\n" if template.endswith("\n") else "")
        else:
            if current_section != section:
                continue
            m_sub = scalar_sub_re.match(line)
            if m_sub and m_sub.group(2) == key:
                indent = m_sub.group(1)
                lines[idx] = f"{indent}{key}: {replacement}"
                return "\n".join(lines) + ("\n" if template.endswith("\n") else "")
    return template


def _append_unknown_legacy(rendered: str, legacy_values: dict, unknown_keys: list) -> str:
    if not unknown_keys:
        return rendered
    block = [
        "",
        "# Unknown keys from the legacy .agent-settings — review and drop.",
        "_legacy:",
    ]
    for key in sorted(unknown_keys):
        block.append(f"  {key}: {_yaml_scalar(legacy_values[key])}")
    suffix = "\n".join(block) + "\n"
    if rendered.endswith("\n"):
        return rendered + suffix
    return rendered + "\n" + suffix


def _migrate_legacy_if_present(project_root: Path, template_body: str) -> "str | None":
    """If a legacy .agent-settings exists, migrate it and return the new
    YAML body. Returns None if no legacy file exists."""
    legacy_target = project_root / LEGACY_SETTINGS_FILE
    if not legacy_target.is_file():
        return None

    legacy_text = legacy_target.read_text(encoding="utf-8")
    values, unknown = _parse_legacy_settings(legacy_text)

    rendered = template_body
    for flat_key, value in values.items():
        if flat_key in LEGACY_RENAME_MAP:
            rendered = _replace_template_value(rendered, LEGACY_RENAME_MAP[flat_key], value)
    rendered = _append_unknown_legacy(rendered, values, unknown)

    backup_target = project_root / LEGACY_BACKUP_FILE
    backup_target.write_text(legacy_text, encoding="utf-8")
    legacy_target.unlink()

    info(f"Migrated legacy {LEGACY_SETTINGS_FILE} → {SETTINGS_FILE}")
    info(f"Backup saved to {LEGACY_BACKUP_FILE}")
    if unknown:
        warn(f"Legacy keys not in rename map preserved under _legacy: {', '.join(sorted(unknown))}")
    return rendered


# --- Bridge generators ---

def _parse_profile_ini(path: Path) -> "dict[str, str]":
    """Parse a simple key=value profile preset (comments start with ; or #)."""
    values: "dict[str, str]" = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith(";") or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        values[key.strip()] = val.strip()
    return values


_PLACEHOLDER_RE = re.compile(r"__[A-Z][A-Z0-9_]*__")


def _render_template(template: str, profile_values: "dict[str, str]") -> str:
    """Substitute __UPPER_KEY__ placeholders using ini values.

    Each ini key `foo_bar` maps to the `__FOO_BAR__` placeholder. Fails
    if any placeholder remains unfilled — catches typos and missing
    profile entries early.
    """
    body = template
    for key, value in profile_values.items():
        placeholder = f"__{key.upper()}__"
        if placeholder in body:
            body = body.replace(placeholder, value)
    leftover = sorted(set(_PLACEHOLDER_RE.findall(body)))
    if leftover:
        fail(
            "Template has unfilled placeholders after profile render: "
            + ", ".join(leftover)
        )
    return body


def ensure_agent_settings(project_root: Path, package_root: Path, profile: str, force: bool) -> None:
    target = project_root / SETTINGS_FILE
    profile_source = package_root / "config" / "profiles" / f"{profile}.ini"
    template_source = package_root / "config" / "agent-settings.template.yml"

    if not profile_source.exists():
        fail(f"Missing profile preset: {profile_source}")
    if not template_source.exists():
        fail(f"Missing settings template: {template_source}")

    template = template_source.read_text(encoding="utf-8")
    if COST_PROFILE_PLACEHOLDER not in template:
        fail(f"Template is missing placeholder {COST_PROFILE_PLACEHOLDER}")
    profile_values = _parse_profile_ini(profile_source)
    if profile_values.get("cost_profile") != profile:
        fail(
            f"Profile preset {profile_source.name} has cost_profile="
            f"{profile_values.get('cost_profile')!r} but --profile={profile}"
        )
    template_body = _render_template(template, profile_values)

    legacy_target = project_root / LEGACY_SETTINGS_FILE
    if legacy_target.is_file() and target.exists():
        warn(
            f"Both {SETTINGS_FILE} and legacy {LEGACY_SETTINGS_FILE} exist. "
            f"Skipping migration to avoid overwriting {SETTINGS_FILE}. "
            f"Delete one of them manually and re-run."
        )
        return

    migrated = _migrate_legacy_if_present(project_root, template_body)
    if migrated is not None:
        write_file(target, migrated)
        success(f"{SETTINGS_FILE} migrated from legacy key=value")
        return

    if target.exists() and not force:
        skip(f"{SETTINGS_FILE} already exists")
        return

    write_file(target, template_body)
    success(f"{SETTINGS_FILE} created (cost_profile={profile})")


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
    parser.add_argument("--skip-bridges", action="store_true", help="only create .agent-settings.yml")
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
        print("    • Commit .agent-settings.yml and bridge files to your repo")
        print("    • New team members just run composer install / npm install — done")
        print("    • Full walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
