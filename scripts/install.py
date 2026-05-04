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
import shlex
import subprocess
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

    Convenience wrapper: formats *value* as a YAML scalar (via
    :func:`_yaml_scalar`) and delegates to :func:`_replace_template_value_raw`.
    """
    return _replace_template_value_raw(template, dotted_path, _yaml_scalar(value))


def _replace_template_value_raw(template: str, dotted_path: str, raw_yaml: str) -> str:
    """Replace the value at *dotted_path* with the pre-formatted *raw_yaml*.

    Handles arbitrary nesting depth. The template uses 2-space indents;
    parent sections are tracked by indent level so the leaf scalar is
    only replaced when every parent matches the dotted path.

    Comments and indentation are preserved. Returns *template* unchanged
    if the path cannot be located.
    """
    parts = dotted_path.split(".")
    if not parts:
        return template

    sections = parts[:-1]
    key = parts[-1]
    target_indent = "  " * len(sections)

    header_re = re.compile(r"^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*$")
    scalar_re = re.compile(r"^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*\S.*$")

    # Stack of section names by depth; None entries mean "not yet seen
    # at this depth" or "left this section". For path a.b.c we need
    # current_path == ['a', 'b'] when scanning for key 'c' at indent 4.
    current_path: list[str | None] = [None] * len(sections)

    lines = template.splitlines()
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        m_header = header_re.match(line)
        if m_header:
            indent = m_header.group(1)
            name = m_header.group(2)
            depth = len(indent) // 2
            if depth < len(sections):
                current_path[depth] = name
                # Reset deeper levels — we just entered a new sub-tree.
                for d in range(depth + 1, len(sections)):
                    current_path[d] = None
            continue

        m_scalar = scalar_re.match(line)
        if not m_scalar:
            continue
        indent = m_scalar.group(1)
        name = m_scalar.group(2)
        if name != key or indent != target_indent:
            continue
        if current_path != list(sections):
            continue
        lines[idx] = f"{indent}{key}: {raw_yaml}"
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


# Augment lifecycle hooks live at user scope (~/.augment/settings.json) per
# https://docs.augmentcode.com/cli/hooks — that is the only path read by both
# the CLI and the IDE plugins (VSCode, IntelliJ). Project-local
# .augment/settings.json is plugin enablement, not hooks.
AUGMENT_USER_DIR = Path.home() / ".augment"
AUGMENT_USER_HOOKS_DIR = AUGMENT_USER_DIR / "hooks"

# Phase 7.3 (hook-architecture-v1.md): one universal trampoline per
# platform replaces the per-concern fan-out. The trampoline cd's into
# the consumer workspace and pipes stdin into
# `./agent-config dispatch:hook`, which reads scripts/hook_manifest.yaml
# to resolve which concerns fire on (platform, event).
AUGMENT_DISPATCHER_TRAMPOLINE = "augment-dispatcher.sh"

# Pre-Phase-7 trampolines deployed at ~/.augment/hooks/ — install removes
# them on rerun so the manifest stays the single source of truth.
AUGMENT_LEGACY_TRAMPOLINES = (
    "augment-chat-history.sh",
    "augment-roadmap-progress.sh",
    "augment-onboarding-gate.sh",
    "augment-context-hygiene.sh",
)

# (agent-config event, Augment native event). Augment fires the same
# trampoline once per binding; the trampoline forwards both names to the
# dispatcher so concerns can branch on either.
AUGMENT_DISPATCHER_BINDINGS = (
    ("session_start", "SessionStart"),
    ("session_end",   "SessionEnd"),
    ("stop",          "Stop"),
    ("post_tool_use", "PostToolUse"),
)


def _deploy_augment_trampoline(package_root: Path, name: str, force: bool) -> Path | None:
    src = package_root / "scripts" / "hooks" / name
    if not src.exists():
        skip(f"augment trampoline missing in package: {src}")
        return None
    AUGMENT_USER_HOOKS_DIR.mkdir(parents=True, exist_ok=True)
    dst = AUGMENT_USER_HOOKS_DIR / name
    src_text = src.read_text(encoding="utf-8")
    if dst.exists() and dst.read_text(encoding="utf-8") == src_text and not force:
        skip(f"~/.augment/hooks/{name} already up to date")
    else:
        dst.write_text(src_text, encoding="utf-8")
        dst.chmod(0o755)
        success(f"~/.augment/hooks/{name} installed")
    return dst


def _remove_legacy_augment_trampolines() -> None:
    """Phase 7.3 cleanup: drop pre-dispatcher trampolines on rerun.

    The manifest is now the single source of truth; leaving the old
    per-concern .sh files at ~/.augment/hooks/ would not break anything
    (settings.json no longer references them), but it produces stale
    artefacts that confuse `task hooks-status` and look like a partial
    install. Removal is best-effort and silent on missing files.
    """
    for name in AUGMENT_LEGACY_TRAMPOLINES:
        legacy = AUGMENT_USER_HOOKS_DIR / name
        try:
            if legacy.is_file():
                legacy.unlink()
                skip(f"removed legacy ~/.augment/hooks/{name}")
        except OSError:
            pass


def ensure_augment_user_hooks(package_root: Path, force: bool) -> None:
    """Deploy the Augment universal-dispatcher trampoline at user scope.

    Phase 7.3 (hook-architecture-v1.md): one trampoline replaces the
    four per-concern .sh files. The trampoline reads the event JSON
    from stdin, extracts workspace_roots[0], cd's there, and pipes the
    payload into `./agent-config dispatch:hook --platform augment
    --event <agent-config-event> --native-event <native>`. The
    dispatcher then loads scripts/hook_manifest.yaml and runs the
    resolved concern chain.

    Augment hook scripts must use the .sh extension and be referenced
    by absolute path; user scope is the only surface that fires for
    both the CLI and the IDE plugins. Installs once per developer.

    Settings entries (Phase 7.3, see AUGMENT_DISPATCHER_BINDINGS):
      - SessionStart → augment-dispatcher.sh session_start SessionStart
      - SessionEnd   → augment-dispatcher.sh session_end   SessionEnd
      - Stop         → augment-dispatcher.sh stop          Stop
      - PostToolUse  → augment-dispatcher.sh post_tool_use PostToolUse
    """
    dst = _deploy_augment_trampoline(package_root, AUGMENT_DISPATCHER_TRAMPOLINE, force)
    if dst is None:
        return

    _remove_legacy_augment_trampolines()

    per_event: dict[str, list] = {}
    for ac_event, native in AUGMENT_DISPATCHER_BINDINGS:
        # Augment's `command` is a shell line — pass agent-config event
        # and Augment-native event as positional args.
        cmd = f"{dst} {ac_event} {native}"
        entry = {"hooks": [{"type": "command", "command": cmd}]}
        per_event.setdefault(native, []).append(entry)

    settings_patch: dict = {"hooks": per_event}
    merge_json_file(
        AUGMENT_USER_DIR / "settings.json",
        settings_patch,
        force,
        "~/.augment/settings.json",
    )


# Claude Code lifecycle events → agent-config event vocabulary.
# Phase 7.3: one universal dispatch:hook entry per event replaces the
# per-concern subcommand fan-out. The dispatcher reads
# scripts/hook_manifest.yaml to resolve which concerns fire on each
# (platform, event) tuple. Mirrors AUGMENT_DISPATCHER_BINDINGS so each
# concern fires on the same logical surface across platforms — the
# contract from agents/contexts/hardening-pattern.md § Cross-platform
# parity.
CLAUDE_DISPATCHER_BINDINGS = (
    ("session_start",      "SessionStart"),
    ("session_end",        "SessionEnd"),
    ("stop",               "Stop"),
    ("user_prompt_submit", "UserPromptSubmit"),
    ("post_tool_use",      "PostToolUse"),
)


def _claude_dispatch_block(ac_event: str, native: str) -> dict:
    """Single hook entry routing the event through the universal dispatcher."""
    return {
        "hooks": [
            {
                "type": "command",
                "command": (
                    f"./agent-config dispatch:hook "
                    f"--platform claude --event {ac_event} "
                    f"--native-event {native}"
                ),
            },
        ],
    }


def ensure_claude_bridge(project_root: Path, force: bool) -> None:
    """Deploy .claude/settings.json with plugin enablement and the Phase 7
    universal dispatcher hooks.

    Each Claude Code lifecycle event is wired to a single
    `./agent-config dispatch:hook` invocation. The dispatcher reads
    scripts/hook_manifest.yaml at runtime and runs the resolved concern
    chain — concerns are no-ops when the relevant feature is disabled
    in .agent-settings.yml. Idempotent: reruns merge cleanly without
    duplicating entries (deep_merge replaces hook arrays rather than
    appending).
    """
    per_event: dict[str, list] = {}
    for ac_event, native in CLAUDE_DISPATCHER_BINDINGS:
        per_event.setdefault(native, []).append(
            _claude_dispatch_block(ac_event, native)
        )

    bridge = {
        "enabledPlugins": {"agent-conf@event4u": True},
        "hooks": per_event,
    }
    merge_json_file(project_root / ".claude" / "settings.json", bridge, force, ".claude/settings.json")


# Cursor lifecycle events → agent-config event vocabulary.
# Phase 7.5 (hook-architecture-v1.md, scripts/hook_manifest.yaml):
# Cursor's project-scope `.cursor/hooks.json` fires hooks with the
# project as cwd, so the dispatch:hook command runs directly with no
# trampoline. User-scope `~/.cursor/hooks.json` is a separate opt-in
# (--cursor-user-hooks) and routes through cursor-dispatcher.sh because
# the user-scope hooks fire across all projects.
#
# Native event names per https://cursor.com/docs/reference/third-party-hooks
# (camelCase). UserPromptSubmit lives at `beforeSubmitPrompt`. Stop is
# IDE-only — CLI-only Cursor users get the rule-only checkpoint
# fallback per agents/contexts/chat-history-platform-hooks.md.
CURSOR_DISPATCHER_BINDINGS = (
    ("session_start",       "sessionStart"),
    ("session_end",         "sessionEnd"),
    ("stop",                "stop"),
    ("user_prompt_submit",  "beforeSubmitPrompt"),
    ("post_tool_use",       "postToolUse"),
)


def _cursor_dispatch_command(ac_event: str, native: str) -> str:
    return (
        f"./agent-config dispatch:hook "
        f"--platform cursor --event {ac_event} "
        f"--native-event {native}"
    )


def ensure_cursor_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.cursor/hooks.json` (project scope) with the Phase 7
    universal dispatcher hooks.

    Each Cursor lifecycle event is wired to a single
    `./agent-config dispatch:hook` invocation. Cursor fires project
    hooks with the project as cwd, so no trampoline is needed at this
    scope — concerns are no-ops when disabled in .agent-settings.yml.
    Idempotent: deep_merge replaces hook arrays on rerun rather than
    appending duplicates.
    """
    hooks: dict[str, list] = {}
    for ac_event, native in CURSOR_DISPATCHER_BINDINGS:
        hooks.setdefault(native, []).append(
            {"command": _cursor_dispatch_command(ac_event, native)}
        )

    bridge = {"version": 1, "hooks": hooks}
    merge_json_file(project_root / ".cursor" / "hooks.json", bridge, force, ".cursor/hooks.json")


# Cursor user-scope hooks fire across every project the developer opens
# in the Cursor IDE / CLI. The trampoline reads `workspace_roots[0]`
# from the event payload (per https://cursor.com/docs/hooks) and routes
# the JSON into the active project's `./agent-config dispatch:hook`,
# silent no-op when the workspace is not an agent-config consumer.
CURSOR_USER_DIR = Path.home() / ".cursor"
CURSOR_USER_HOOKS_DIR = CURSOR_USER_DIR / "hooks"
CURSOR_DISPATCHER_TRAMPOLINE = "cursor-dispatcher.sh"


def ensure_cursor_user_hooks(package_root: Path, force: bool) -> None:
    """Deploy the Cursor universal-dispatcher trampoline at user scope.

    Phase 7.5 (hook-architecture-v1.md): mirrors ensure_augment_user_hooks
    for the Cursor surface. Writes:
      - ~/.cursor/hooks/cursor-dispatcher.sh  (trampoline)
      - ~/.cursor/hooks.json                  (event → trampoline call)

    Each hooks.json command line is `<dispatcher> <ac_event> <native>`
    so the trampoline can forward both names to the dispatcher for
    traceability. Hooks fire across all projects the developer opens.
    """
    src = package_root / "scripts" / "hooks" / CURSOR_DISPATCHER_TRAMPOLINE
    if not src.exists():
        skip(f"cursor trampoline missing in package: {src}")
        return

    CURSOR_USER_HOOKS_DIR.mkdir(parents=True, exist_ok=True)
    dst = CURSOR_USER_HOOKS_DIR / CURSOR_DISPATCHER_TRAMPOLINE
    src_text = src.read_text(encoding="utf-8")
    if dst.exists() and dst.read_text(encoding="utf-8") == src_text and not force:
        skip(f"~/.cursor/hooks/{CURSOR_DISPATCHER_TRAMPOLINE} already up to date")
    else:
        dst.write_text(src_text, encoding="utf-8")
        dst.chmod(0o755)
        success(f"~/.cursor/hooks/{CURSOR_DISPATCHER_TRAMPOLINE} installed")

    hooks: dict[str, list] = {}
    for ac_event, native in CURSOR_DISPATCHER_BINDINGS:
        hooks.setdefault(native, []).append(
            {"command": f"{dst} {ac_event} {native}"}
        )

    settings_patch: dict = {"version": 1, "hooks": hooks}
    merge_json_file(
        CURSOR_USER_DIR / "hooks.json",
        settings_patch,
        force,
        "~/.cursor/hooks.json",
    )


# Cline lifecycle events → agent-config event vocabulary.
# Phase 7.6 (hook-architecture-v1.md, scripts/hook_manifest.yaml):
# Cline reads scripts at `.clinerules/hooks/<HookName>` (project) or
# `~/Documents/Cline/Hooks/<HookName>` (global) — file names match
# the hook type exactly, no extension, executable bit required.
# Both TaskStart (new) and TaskResume (resumed) map to session_start;
# TaskCancel maps to stop because the session is interrupted with
# partial state (mirrors Augment Stop semantics).
CLINE_DISPATCHER_BINDINGS = (
    ("session_start",       "TaskStart"),
    ("session_start",       "TaskResume"),
    ("session_end",         "TaskComplete"),
    ("stop",                "TaskCancel"),
    ("user_prompt_submit",  "UserPromptSubmit"),
    ("post_tool_use",       "PostToolUse"),
)

# Each project-scope script is generated from this template — one file
# per native hook name. The script reads stdin (Cline's payload), forwards
# it into `./agent-config dispatch:hook`, then emits the empty JSON
# envelope Cline expects (`{}` = no cancel, no context modification).
# `cd "$WORKSPACE_ROOT"` is intentional even though Cline fires project
# hooks with cwd already set: the workspace path lands in $WORKSPACE_ROOT
# at install time and the cd guards against future Cline behaviour
# changes (cline#8073-class shifts in cwd handling).
CLINE_PROJECT_HOOK_TEMPLATE = """\
#!/usr/bin/env bash
# Generated by event4u/agent-config install.py — DO NOT EDIT.
# Project-scope Cline hook for {native_event} → agent-config {ac_event}.
# Phase 7.6 (docs/contracts/hook-architecture-v1.md).
set -u
EVENT_DATA="$(cat)"
WORKSPACE_ROOT={workspace_quoted}
cd "$WORKSPACE_ROOT" 2>/dev/null || {{ printf '%s\\n' '{{}}'; exit 0; }}
if [ ! -x ./agent-config ]; then
    printf '%s\\n' '{{}}'
    exit 0
fi
printf '%s' "$EVENT_DATA" \\
    | ./agent-config dispatch:hook \\
        --platform cline \\
        --event {ac_event} \\
        --native-event {native_event} \\
        >/dev/null 2>&1 || true
printf '%s\\n' '{{}}'
exit 0
"""


def ensure_cline_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.clinerules/hooks/<HookName>` per-event scripts.

    Phase 7.6: Cline project hooks are individual executable scripts
    named exactly after the hook (no extension). install writes one
    script per (ac_event, native_event) tuple in
    CLINE_DISPATCHER_BINDINGS; rerunning is idempotent — the script
    body is overwritten only when content differs (or --force).
    """
    hooks_dir = project_root / ".clinerules" / "hooks"
    hooks_dir.mkdir(parents=True, exist_ok=True)

    workspace_quoted = shlex.quote(str(project_root.resolve()))
    written = 0
    for ac_event, native_event in CLINE_DISPATCHER_BINDINGS:
        target = hooks_dir / native_event
        body = CLINE_PROJECT_HOOK_TEMPLATE.format(
            native_event=native_event,
            ac_event=ac_event,
            workspace_quoted=workspace_quoted,
        )
        if target.exists() and target.read_text(encoding="utf-8") == body and not force:
            continue
        if target.exists() and not force:
            skip(f".clinerules/hooks/{native_event} exists, needs update (use --force)")
            continue
        target.write_text(body, encoding="utf-8")
        target.chmod(0o755)
        written += 1
    if written:
        success(f".clinerules/hooks/ — {written} script(s) installed")
    else:
        skip(".clinerules/hooks/ already up to date")


# Cline user-scope hooks live at `~/Documents/Cline/Hooks/<HookName>`
# (per docs.cline.bot/customization/hooks) and fire across every
# project the developer opens. The trampoline reads `workspaceRoots[0]`
# from the event payload and routes the JSON into the active project's
# `./agent-config dispatch:hook`. Silent no-op when the workspace is
# not an agent-config consumer.
CLINE_USER_DIR = Path.home() / "Documents" / "Cline" / "Hooks"
CLINE_DISPATCHER_TRAMPOLINE = "cline-dispatcher.sh"


def ensure_cline_user_hooks(package_root: Path, force: bool) -> None:
    """Deploy the Cline universal-dispatcher trampoline at user scope.

    Phase 7.6 (hook-architecture-v1.md): mirrors ensure_cursor_user_hooks
    for Cline. Writes:
      - ~/Documents/Cline/Hooks/cline-dispatcher.sh   (shared trampoline)
      - ~/Documents/Cline/Hooks/<HookName>            (per-event wrapper)

    Each per-event wrapper is a tiny shim that exec's the trampoline
    with `<ac_event> <native_event>` arguments and re-pipes stdin —
    this matches Cline's "file name == hook name, no extension"
    convention while still routing through one shared dispatcher.
    """
    src = package_root / "scripts" / "hooks" / CLINE_DISPATCHER_TRAMPOLINE
    if not src.exists():
        skip(f"cline trampoline missing in package: {src}")
        return

    CLINE_USER_DIR.mkdir(parents=True, exist_ok=True)
    trampoline = CLINE_USER_DIR / CLINE_DISPATCHER_TRAMPOLINE
    src_text = src.read_text(encoding="utf-8")
    if trampoline.exists() and trampoline.read_text(encoding="utf-8") == src_text and not force:
        skip(f"~/Documents/Cline/Hooks/{CLINE_DISPATCHER_TRAMPOLINE} already up to date")
    else:
        trampoline.write_text(src_text, encoding="utf-8")
        trampoline.chmod(0o755)
        success(f"~/Documents/Cline/Hooks/{CLINE_DISPATCHER_TRAMPOLINE} installed")

    trampoline_quoted = shlex.quote(str(trampoline))
    for ac_event, native_event in CLINE_DISPATCHER_BINDINGS:
        wrapper = CLINE_USER_DIR / native_event
        body = (
            "#!/usr/bin/env bash\n"
            "# Generated by event4u/agent-config install.py — DO NOT EDIT.\n"
            f"# User-scope Cline hook for {native_event} → agent-config {ac_event}.\n"
            f"exec {trampoline_quoted} {ac_event} {native_event}\n"
        )
        if wrapper.exists() and wrapper.read_text(encoding="utf-8") == body and not force:
            continue
        wrapper.write_text(body, encoding="utf-8")
        wrapper.chmod(0o755)


# Windsurf (Cascade) lifecycle events → agent-config event vocabulary.
# Phase 7.7 (hook-architecture-v1.md, scripts/hook_manifest.yaml):
# Windsurf reads `.windsurf/hooks.json` (project) or
# `~/.codeium/windsurf/hooks.json` (user). Cascade has no generic
# post-tool-use surface — concerns gated to that slot don't fire on
# Windsurf (documented platform limitation in chat-history-platform-hooks.md).
WINDSURF_DISPATCHER_BINDINGS = (
    ("session_start",       "post_setup_worktree"),
    ("user_prompt_submit",  "pre_user_prompt"),
    ("stop",                "post_cascade_response"),
)


def _windsurf_dispatch_command(ac_event: str, native: str) -> str:
    return (
        f"./agent-config dispatch:hook "
        f"--platform windsurf --event {ac_event} "
        f"--native-event {native}"
    )


def ensure_windsurf_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.windsurf/hooks.json` (project scope) with the Phase 7
    universal dispatcher hooks.

    Each Windsurf lifecycle event is wired to a single
    `./agent-config dispatch:hook` invocation. Cascade fires project
    hooks with the workspace as cwd, so no trampoline is needed at this
    scope. Idempotent via deep_merge — rerunning replaces hook arrays
    rather than appending duplicates. `show_output: false` keeps post
    hooks silent (per Windsurf docs); concerns stream their own output
    via agents/state/.dispatcher/.
    """
    hooks: dict[str, list] = {}
    for ac_event, native in WINDSURF_DISPATCHER_BINDINGS:
        hooks.setdefault(native, []).append({
            "command": _windsurf_dispatch_command(ac_event, native),
            "show_output": False,
        })

    bridge = {"hooks": hooks}
    merge_json_file(
        project_root / ".windsurf" / "hooks.json",
        bridge,
        force,
        ".windsurf/hooks.json",
    )


# Windsurf user-scope hooks live at `~/.codeium/windsurf/hooks.json`
# (per docs.windsurf.com/windsurf/cascade/hooks). The trampoline
# resolves the active workspace from $PWD / .agent-settings.yml /
# tool_info.cwd|file_path / $ROOT_WORKSPACE_PATH and routes the JSON
# into that project's `./agent-config dispatch:hook`. Silent no-op
# when the workspace is not an agent-config consumer.
WINDSURF_USER_DIR = Path.home() / ".codeium" / "windsurf"
WINDSURF_USER_HOOKS_DIR = WINDSURF_USER_DIR / "hooks"
WINDSURF_DISPATCHER_TRAMPOLINE = "windsurf-dispatcher.sh"


def ensure_windsurf_user_hooks(package_root: Path, force: bool) -> None:
    """Deploy the Windsurf universal-dispatcher trampoline at user scope.

    Phase 7.7 (hook-architecture-v1.md): mirrors ensure_cursor_user_hooks
    for the Windsurf surface. Writes:
      - ~/.codeium/windsurf/hooks/windsurf-dispatcher.sh  (trampoline)
      - ~/.codeium/windsurf/hooks.json                    (event → trampoline call)

    Each hooks.json command line is `<dispatcher> <ac_event> <native>`
    so the trampoline forwards both names to the dispatcher for
    traceability. Hooks fire across all projects the developer opens.
    """
    src = package_root / "scripts" / "hooks" / WINDSURF_DISPATCHER_TRAMPOLINE
    if not src.exists():
        skip(f"windsurf trampoline missing in package: {src}")
        return

    WINDSURF_USER_HOOKS_DIR.mkdir(parents=True, exist_ok=True)
    dst = WINDSURF_USER_HOOKS_DIR / WINDSURF_DISPATCHER_TRAMPOLINE
    src_text = src.read_text(encoding="utf-8")
    if dst.exists() and dst.read_text(encoding="utf-8") == src_text and not force:
        skip(f"~/.codeium/windsurf/hooks/{WINDSURF_DISPATCHER_TRAMPOLINE} already up to date")
    else:
        dst.write_text(src_text, encoding="utf-8")
        dst.chmod(0o755)
        success(f"~/.codeium/windsurf/hooks/{WINDSURF_DISPATCHER_TRAMPOLINE} installed")

    hooks: dict[str, list] = {}
    for ac_event, native in WINDSURF_DISPATCHER_BINDINGS:
        hooks.setdefault(native, []).append({
            "command": f"{dst} {ac_event} {native}",
            "show_output": False,
        })

    settings_patch: dict = {"hooks": hooks}
    merge_json_file(
        WINDSURF_USER_DIR / "hooks.json",
        settings_patch,
        force,
        "~/.codeium/windsurf/hooks.json",
    )


# Gemini CLI lifecycle events → agent-config event vocabulary.
# Phase 7.8 (hook-architecture-v1.md, scripts/hook_manifest.yaml):
# Gemini reads `.gemini/settings.json` (project) or
# `~/.gemini/settings.json` (user). Each event maps to an array of
# hook groups; each group has a `matcher` (exact string for lifecycle,
# regex for tool events) and a `hooks` array of `{type: "command",
# command: "..."}`.
#
# Native event names per geminicli.com/docs/hooks/reference/
# (PascalCase). BeforeAgent fires after the user submits a prompt
# and before agent planning — our user_prompt_submit slot. AfterAgent
# fires when the agent loop ends — our stop slot. SessionStart /
# SessionEnd are advisory (continue/decision ignored). For lifecycle
# events the matcher filters on `source` ("startup"|"resume"|"clear"
# for SessionStart, etc.); empty matcher == match all.
GEMINI_DISPATCHER_BINDINGS = (
    ("session_start",       "SessionStart",  ""),
    ("session_end",         "SessionEnd",    ""),
    ("stop",                "AfterAgent",    ""),
    ("user_prompt_submit",  "BeforeAgent",   ""),
    ("post_tool_use",       "AfterTool",     ".*"),
)


def _gemini_dispatch_command(ac_event: str, native: str) -> str:
    return (
        f"./agent-config dispatch:hook "
        f"--platform gemini --event {ac_event} "
        f"--native-event {native}"
    )


def _gemini_hooks_dict(command_factory) -> dict[str, list]:
    """Build the nested {event: [{matcher, hooks: [{type, command}]}]}
    payload Gemini expects. command_factory(ac_event, native) returns
    the command string for one binding."""
    out: dict[str, list] = {}
    for ac_event, native, matcher in GEMINI_DISPATCHER_BINDINGS:
        out.setdefault(native, []).append({
            "matcher": matcher,
            "hooks": [
                {
                    "type": "command",
                    "command": command_factory(ac_event, native),
                },
            ],
        })
    return out


def ensure_gemini_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.gemini/settings.json` (project scope) with the Phase 7
    universal dispatcher hooks.

    Each Gemini lifecycle event is wired to a single
    `./agent-config dispatch:hook` invocation. Project-scope hooks
    fire with the project as cwd, so no trampoline is needed at this
    scope. Idempotent via deep_merge — rerunning replaces hook arrays
    rather than appending duplicates.
    """
    bridge = {"hooks": _gemini_hooks_dict(_gemini_dispatch_command)}
    merge_json_file(
        project_root / ".gemini" / "settings.json",
        bridge,
        force,
        ".gemini/settings.json",
    )


# Gemini user-scope hooks live at `~/.gemini/settings.json` and fire
# across every project the developer opens. The trampoline resolves
# the active workspace from $PWD / .agent-settings.yml / payload.cwd
# and routes the JSON into that project's `./agent-config dispatch:hook`.
# Silent no-op when the workspace is not an agent-config consumer.
GEMINI_USER_DIR = Path.home() / ".gemini"
GEMINI_USER_HOOKS_DIR = GEMINI_USER_DIR / "hooks"
GEMINI_DISPATCHER_TRAMPOLINE = "gemini-dispatcher.sh"


def ensure_gemini_user_hooks(package_root: Path, force: bool) -> None:
    """Deploy the Gemini universal-dispatcher trampoline at user scope.

    Phase 7.8 (hook-architecture-v1.md): mirrors ensure_windsurf_user_hooks
    for the Gemini surface. Writes:
      - ~/.gemini/hooks/gemini-dispatcher.sh  (trampoline)
      - ~/.gemini/settings.json               (event → trampoline call)

    Each settings.json command line is `<dispatcher> <ac_event> <native>`
    so the trampoline forwards both names to the dispatcher for
    traceability. Hooks fire across all projects the developer opens.
    """
    src = package_root / "scripts" / "hooks" / GEMINI_DISPATCHER_TRAMPOLINE
    if not src.exists():
        skip(f"gemini trampoline missing in package: {src}")
        return

    GEMINI_USER_HOOKS_DIR.mkdir(parents=True, exist_ok=True)
    dst = GEMINI_USER_HOOKS_DIR / GEMINI_DISPATCHER_TRAMPOLINE
    src_text = src.read_text(encoding="utf-8")
    if dst.exists() and dst.read_text(encoding="utf-8") == src_text and not force:
        skip(f"~/.gemini/hooks/{GEMINI_DISPATCHER_TRAMPOLINE} already up to date")
    else:
        dst.write_text(src_text, encoding="utf-8")
        dst.chmod(0o755)
        success(f"~/.gemini/hooks/{GEMINI_DISPATCHER_TRAMPOLINE} installed")

    settings_patch = {
        "hooks": _gemini_hooks_dict(
            lambda ac_event, native: f"{dst} {ac_event} {native}",
        ),
    }
    merge_json_file(
        GEMINI_USER_DIR / "settings.json",
        settings_patch,
        force,
        "~/.gemini/settings.json",
    )


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


# --- Post-install smoke test ---

# (platform, native event used for the dry-fire). Probe events are
# chosen so the dispatcher resolves at least one concern per platform
# from the canonical manifest. Copilot is intentionally excluded —
# rule-only fallback per Phase 7.9.
SMOKE_PROBE_EVENTS = (
    ("augment",  "session_start"),
    ("claude",   "SessionStart"),
    ("cursor",   "beforeShellExecution"),
    ("cline",    "session_start"),
    ("windsurf", "post_setup_worktree"),
    ("gemini",   "SessionStart"),
)

# Map platform → bridge file/dir we expect to exist before probing.
# Mirrors PLATFORM_BRIDGES in scripts/hooks_status.py.
SMOKE_BRIDGE_PATHS = {
    "augment":  ".augment/settings.json",
    "claude":   ".claude/settings.json",
    "cursor":   ".cursor/hooks.json",
    "cline":    ".clinerules/hooks",
    "windsurf": ".windsurf/hooks.json",
    "gemini":   ".gemini/settings.json",
}


def _smoke_test_hooks(project_root: Path, package_root: Path) -> int:
    """Dry-fire dispatch_hook.py against every installed bridge.

    Per Phase 7.12: uses `--dry-run` so resolution-only — no concern
    invocation, no state writes outside the dispatcher's own report.
    Failure is non-fatal (warn only); install always exits 0 even
    when smoke fails so consumers in restricted CI sandboxes are not
    blocked. CI-side strict mode lives in `hooks_status --strict`.
    """
    dispatcher = package_root / "scripts" / "hooks" / "dispatch_hook.py"
    manifest = package_root / "scripts" / "hook_manifest.yaml"
    if not dispatcher.is_file() or not manifest.is_file():
        return 0  # package layout doesn't ship the dispatcher; skip silently

    failed: list[str] = []
    skipped: list[str] = []
    passed: list[str] = []

    for platform, native in SMOKE_PROBE_EVENTS:
        rel_bridge = SMOKE_BRIDGE_PATHS.get(platform, "")
        bridge_path = project_root / rel_bridge if rel_bridge else None
        bridge_present = bool(
            bridge_path and (bridge_path.is_file() or
                             (bridge_path.is_dir() and any(bridge_path.iterdir())))
        )
        if not bridge_present:
            skipped.append(platform)
            continue
        # Map native → agent-config event using the dispatcher's own
        # alias resolution. We re-use the dispatcher in --dry-run mode,
        # passing both --platform + --event=<canonical>. Since the
        # canonical event is what the manifest binds against, we feed
        # it directly: 'session_start' is the cross-platform anchor
        # that every bridge wires up. This avoids re-implementing
        # alias resolution here.
        cmd = [
            sys.executable, str(dispatcher),
            "--manifest", str(manifest),
            "--platform", platform,
            "--event", "session_start",
            "--native-event", native,
            "--dry-run",
        ]
        try:
            proc = subprocess.run(
                cmd, input="{}", capture_output=True, text=True,
                cwd=str(project_root), timeout=10, check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            failed.append(f"{platform}: {exc}")
            continue
        if proc.returncode != 0:
            failed.append(f"{platform}: exit={proc.returncode} {proc.stderr.strip()[:120]}")
            continue
        try:
            plan = json.loads(proc.stdout or "{}")
        except json.JSONDecodeError:
            failed.append(f"{platform}: dispatcher did not emit JSON plan")
            continue
        if not isinstance(plan.get("concerns"), list):
            failed.append(f"{platform}: plan.concerns missing or not a list")
            continue
        passed.append(platform)

    if not QUIET:
        if passed:
            success(f"hook smoke passed: {', '.join(passed)}")
        if skipped:
            skip(f"hook smoke skipped (bridge not installed): {', '.join(skipped)}")
        for line in failed:
            warn(f"hook smoke failed — {line}")
    return 1 if failed else 0


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
    parser.add_argument(
        "--augment-user-hooks",
        action="store_true",
        help="also deploy ~/.augment/settings.json + ~/.augment/hooks/ (user-scope, all projects)",
    )
    parser.add_argument(
        "--cursor-user-hooks",
        action="store_true",
        help="also deploy ~/.cursor/hooks.json + ~/.cursor/hooks/cursor-dispatcher.sh (user-scope, all projects)",
    )
    parser.add_argument(
        "--cline-user-hooks",
        action="store_true",
        help="also deploy ~/Documents/Cline/Hooks/ trampoline + per-event wrappers (user-scope, all projects)",
    )
    parser.add_argument(
        "--windsurf-user-hooks",
        action="store_true",
        help="also deploy ~/.codeium/windsurf/hooks.json + hooks/windsurf-dispatcher.sh (user-scope, all projects)",
    )
    parser.add_argument(
        "--gemini-user-hooks",
        action="store_true",
        help="also deploy ~/.gemini/settings.json + ~/.gemini/hooks/gemini-dispatcher.sh (user-scope, all projects)",
    )
    parser.add_argument("--project", default=None, help="project root (default: cwd or PROJECT_ROOT env)")
    parser.add_argument("--package", default=None, help="package root (default: auto-detect under project)")
    parser.add_argument("--quiet", action="store_true", help="suppress info/success output (warnings/errors still shown)")
    parser.add_argument(
        "--no-smoke",
        action="store_true",
        help="skip the post-install hook smoke test (default: dry-fire dispatch:hook against every installed bridge)",
    )
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
        ensure_claude_bridge(project_root, opts.force)
        ensure_cursor_bridge(project_root, opts.force)
        ensure_cline_bridge(project_root, opts.force)
        ensure_windsurf_bridge(project_root, opts.force)
        ensure_gemini_bridge(project_root, opts.force)
        ensure_copilot_bridge(project_root, opts.force)

    if opts.augment_user_hooks:
        ensure_augment_user_hooks(package_root, opts.force)

    if opts.cursor_user_hooks:
        ensure_cursor_user_hooks(package_root, opts.force)

    if opts.cline_user_hooks:
        ensure_cline_user_hooks(package_root, opts.force)

    if opts.windsurf_user_hooks:
        ensure_windsurf_user_hooks(package_root, opts.force)

    if opts.gemini_user_hooks:
        ensure_gemini_user_hooks(package_root, opts.force)

    if not opts.skip_bridges and not opts.no_smoke:
        if not QUIET:
            print()
            info("Smoke-testing installed hook bridges (dry-run)")
        _smoke_test_hooks(project_root, package_root)

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
        print("    • Inspect hook coverage: ./agent-config hooks:status")
        print("    • Full walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
