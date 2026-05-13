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
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional

try:
    from scripts._lib.json_pointers import build_merge_entries  # noqa: PLC0415
except ImportError:  # pragma: no cover — alt sys.path layout
    from _lib.json_pointers import build_merge_entries  # type: ignore[no-redef]  # noqa: PLC0415

DEFAULT_PROFILE = "minimal"
SUPPORTED_PROFILES = ("minimal", "balanced", "full")
COST_PROFILE_PLACEHOLDER = "__COST_PROFILE__"

# Env-var equivalent of --force for CI / scripted installs (P3.4).
# When set to "1" the install run treats every conflict as
# force-overwrite; never enabled by default to keep destructive writes
# explicit.
ALLOW_OVERWRITE_ENV = "AGENT_CONFIG_ALLOW_OVERWRITE"

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
    npm_path = project_root / "node_modules" / "@event4u" / "agent-config"
    if npm_path.is_dir():
        return npm_path.resolve()

    # Running from within the package itself (development mode)
    if (project_root / "config" / "profiles" / "minimal.ini").exists():
        return project_root

    fail(
        "Could not find agent-config package. Install via "
        "`npx @event4u/agent-config init` or `npm install -g @event4u/agent-config`."
    )
    return project_root  # unreachable


def detect_package_type(package_root: Path) -> str:
    if "node_modules" in package_root.parts:
        return "npm"
    return "local"


def detect_package_type_for_project(project_root: Path, package_root: Path) -> str:
    """Determine package type based on where the package lives relative to the project."""
    npm_path = (project_root / "node_modules" / "@event4u" / "agent-config").resolve()
    package_resolved = package_root.resolve()

    if package_resolved == npm_path:
        return "npm"
    return detect_package_type(package_root)


# --- Conflict detection (P3.1 / P3.3) ---

class ConflictAbort(SystemExit):
    """Raised when a conflict resolution chose 'abort'.

    Inherits ``SystemExit`` so an unhandled abort terminates the
    install with a non-zero exit code without an opaque traceback.
    """

    def __init__(self, message: str):
        super().__init__(1)
        self.message = message


class ConflictPolicy:
    """Per-install conflict resolution policy (P3.1).

    Aggregates the inputs the resolver needs to decide whether to
    overwrite a target that exists on disk:

    * ``force``         — true when ``--force`` was passed OR the
      ``AGENT_CONFIG_ALLOW_OVERWRITE=1`` env-var is set (P3.4).
    * ``interactive``   — true when stdin AND stdout are TTYs; the
      only context where the 3-option prompt is meaningful.
    * ``known_paths``   — absolute path strings recorded as ours by
      the project-scope manifest (``files[]`` entries). A target at a
      known path is **not** a foreign collision — we own it and the
      existing skip/force behaviour applies.
    * ``known_pointers``— ``(file_label, json_pointer)`` pairs we
      previously merged into shared JSON files (P3.3). A pointer in
      this set is ours; one not in it that exists in the target is a
      foreign merge collision.
    """

    __slots__ = ("force", "interactive", "known_paths", "known_pointers")

    def __init__(
        self,
        *,
        force: bool,
        interactive: bool,
        known_paths: set[str],
        known_pointers: set[tuple[str, str]],
    ) -> None:
        self.force = force
        self.interactive = interactive
        self.known_paths = known_paths
        self.known_pointers = known_pointers


# Module-level singleton: configured once in main() (after --force +
# env-var resolution), consulted by every writer. When ``None`` the
# install runs in **legacy mode**: writers honor their local ``force``
# flag and skip-otherwise, no foreign-pointer detection. Set only by
# :func:`main` after loading the manifest so test callers that exercise
# writers directly keep the pre-P3 contract.
_CONFLICT_POLICY: Optional[ConflictPolicy] = None


def _conflict_policy_active() -> bool:
    return _CONFLICT_POLICY is not None


def _get_conflict_policy() -> ConflictPolicy:
    if _CONFLICT_POLICY is None:
        # Legacy-mode fallback: no manifest loaded, no foreign detection
        # surface. ``force=False`` here so the local ``force_hint`` from
        # the caller is the only signal; ``known_*`` stay empty.
        return ConflictPolicy(
            force=False, interactive=False,
            known_paths=set(), known_pointers=set(),
        )
    return _CONFLICT_POLICY


def _set_conflict_policy(policy: Optional[ConflictPolicy]) -> None:
    global _CONFLICT_POLICY
    _CONFLICT_POLICY = policy


def _allow_overwrite_env() -> bool:
    return os.environ.get(ALLOW_OVERWRITE_ENV) == "1"


def _is_interactive() -> bool:
    try:
        return sys.stdin.isatty() and sys.stdout.isatty()
    except (AttributeError, ValueError):  # pragma: no cover — closed streams
        return False


def _load_conflict_policy(project_root: Path, force: bool) -> ConflictPolicy:
    """Build a :class:`ConflictPolicy` from the on-disk manifest.

    Reads ``agents/installed-tools.lock`` once and folds every recorded
    ``files[].path`` into ``known_paths`` and every
    ``merged_keys[].{file, json_pointer}`` into ``known_pointers``. The
    manifest is the only source of truth for "this is ours"; if it's
    missing both sets stay empty and every existing target is treated
    as foreign.
    """
    known_paths: set[str] = set()
    known_pointers: set[tuple[str, str]] = set()
    try:
        tools_mod = _load_installed_tools_module()
        target = tools_mod.manifest_path(project_root)
        existing = tools_mod.read_manifest(target) or {}
        for tool in existing.get("tools", []) or []:
            for entry in tool.get("files", []) or []:
                path_val = entry.get("path")
                if isinstance(path_val, str) and path_val:
                    # Manifest paths may be absolute (production writers
                    # use ``str(Path)`` for ``files[].path``) or relative
                    # (portable manifests). Writers always pass absolute
                    # ``Path`` objects to ``_resolve_file_conflict``, so
                    # normalise here against ``project_root`` to keep the
                    # known-path silent-skip branch reachable.
                    p = Path(path_val)
                    if not p.is_absolute():
                        p = (project_root / p).resolve()
                    known_paths.add(str(p))
            for entry in tool.get("merged_keys", []) or []:
                file_label = entry.get("file")
                pointer = entry.get("json_pointer")
                if isinstance(file_label, str) and isinstance(pointer, str):
                    known_pointers.add((file_label, pointer))
    except Exception:  # pragma: no cover — fail-open on corrupt manifest
        # Don't block the install if the manifest is malformed; just
        # report nothing as ours so foreign-file detection stays strict.
        pass
    return ConflictPolicy(
        force=force or _allow_overwrite_env(),
        interactive=_is_interactive(),
        known_paths=known_paths,
        known_pointers=known_pointers,
    )


def prompt_file_conflict_choice(path: Path) -> str:
    """3-option resolution prompt for a foreign file at ``path``.

    Returns ``"force"`` / ``"skip"`` / ``"abort"``. Mirrors
    :func:`prompt_collision_choice` (loops on invalid input, aborts on
    EOF or 3 invalid replies). Only called when the policy is
    interactive AND ``--force`` was not specified.
    """
    print()
    warn(f"Foreign file at {path}")
    info("This path exists but is not recorded as ours in the manifest.")
    info("Choose how to handle the conflict:")
    print("  1) Force   — overwrite the file with our content")
    print("  2) Skip    — leave the file untouched, continue install")
    print("  3) Abort   — stop the install, exit non-zero")
    print()
    attempts = 0
    while attempts < 3:
        try:
            reply = _read_line("Choose [1/2/3]: ")
        except EOFError:
            fail(f"File-conflict prompt aborted (EOF on stdin) for {path}")
        if reply in ("1", "force", "f"):
            return "force"
        if reply in ("2", "skip", "s"):
            return "skip"
        if reply in ("3", "abort", "a"):
            return "abort"
        attempts += 1
        warn(f"Invalid choice '{reply}'. Enter 1, 2, or 3.")
    fail(f"File-conflict prompt aborted (3 invalid replies) for {path}")
    return "abort"  # unreachable


def _resolve_file_conflict(target: Path, *, force_hint: bool) -> str:
    """Decide what to do when ``target`` already exists on disk.

    Returns ``"write"`` (proceed with overwrite), ``"skip"`` (leave the
    target alone), or raises :class:`ConflictAbort`. ``force_hint`` is
    the caller's local ``force`` flag — typically the install-level
    ``--force``; we OR it with the global policy's ``force`` to honor
    ``AGENT_CONFIG_ALLOW_OVERWRITE=1`` in callers that have not yet
    been refactored to read the policy directly.

    Decision matrix:

    * target does not exist          → ``"write"``
    * target IS in ``known_paths``   → ``"write"`` if force else ``"skip"``
      (legacy behaviour — we own it, skip silently without --force)
    * target NOT in ``known_paths`` (foreign):
        * force                       → ``"write"`` (overwrite)
        * interactive                 → prompt → translate to write/skip/abort
        * non-interactive             → raise ``ConflictAbort``
    """
    if not target.exists():
        return "write"
    if not _conflict_policy_active():
        # Legacy mode (no manifest loaded): preserve the pre-P3 contract
        # — force overwrites, otherwise skip. No prompt, no abort.
        return "write" if force_hint else "skip"
    policy = _get_conflict_policy()
    effective_force = force_hint or policy.force
    if str(target) in policy.known_paths:
        return "write" if effective_force else "skip"
    if effective_force:
        return "write"
    if policy.interactive:
        choice = prompt_file_conflict_choice(target)
        if choice == "force":
            return "write"
        if choice == "skip":
            return "skip"
        raise ConflictAbort(f"User aborted on foreign file at {target}")
    raise ConflictAbort(
        f"Foreign file at {target}: refusing to overwrite. "
        f"Re-run with --force or set {ALLOW_OVERWRITE_ENV}=1 to allow. "
        f"Run `agent-config doctor` to inspect orphaned files first."
    )


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


def _pointer_target_exists(doc: dict, pointer: str) -> bool:
    """Return True when ``pointer`` resolves to an existing key in ``doc``.

    Walks the RFC-6901 segments without descending into lists (per the
    array-index ban in :mod:`scripts._lib.json_pointers`). Missing
    intermediate segments short-circuit to False.
    """
    if not pointer.startswith("/"):
        return False
    cursor: Any = doc
    segments = pointer.split("/")[1:]
    segments = [s.replace("~1", "/").replace("~0", "~") for s in segments]
    for seg in segments[:-1]:
        if not isinstance(cursor, dict) or seg not in cursor:
            return False
        cursor = cursor[seg]
    if not isinstance(cursor, dict):
        return False
    return segments[-1] in cursor


def _detect_foreign_pointers(
    existing: dict,
    overlay_entries: list[dict[str, Any]],
    label: str,
    policy: ConflictPolicy,
) -> list[str]:
    """Return overlay pointers that exist in ``existing`` but aren't ours.

    P3.3 — pointer-level foreign-merge detection. A pointer is foreign
    when it would overwrite a value already on disk that the manifest
    does NOT record as ours (``(label, pointer) not in known_pointers``).
    Returns the list of foreign pointer strings (sorted, deduped) for
    use in the conflict-resolution prompt. In legacy mode (no manifest
    loaded) the function returns an empty list so callers fall back to
    the pre-P3 update flow.
    """
    if not _conflict_policy_active():
        return []
    foreign: list[str] = []
    seen: set[str] = set()
    for entry in overlay_entries:
        pointer = entry.get("json_pointer")
        if not isinstance(pointer, str) or pointer in seen:
            continue
        seen.add(pointer)
        if not _pointer_target_exists(existing, pointer):
            continue
        if (label, pointer) in policy.known_pointers:
            continue
        foreign.append(pointer)
    foreign.sort()
    return foreign


def prompt_json_conflict_choice(path: Path, foreign: list[str]) -> str:
    """3-option resolution prompt for foreign JSON pointers at ``path``.

    Returns ``"force"`` / ``"skip"`` / ``"abort"``. Shows the foreign
    pointer list so the user knows what will be overwritten.
    """
    print()
    warn(f"Foreign JSON keys at {path}")
    info("The following pointers exist in the file but are not recorded as ours:")
    for pointer in foreign[:10]:
        print(f"      {pointer}")
    if len(foreign) > 10:
        print(f"      ... and {len(foreign) - 10} more")
    info("Choose how to handle the conflict:")
    print("  1) Force   — overwrite the listed pointers with our values")
    print("  2) Skip    — leave the file untouched, continue install")
    print("  3) Abort   — stop the install, exit non-zero")
    print()
    attempts = 0
    while attempts < 3:
        try:
            reply = _read_line("Choose [1/2/3]: ")
        except EOFError:
            fail(f"JSON-conflict prompt aborted (EOF on stdin) for {path}")
        if reply in ("1", "force", "f"):
            return "force"
        if reply in ("2", "skip", "s"):
            return "skip"
        if reply in ("3", "abort", "a"):
            return "abort"
        attempts += 1
        warn(f"Invalid choice '{reply}'. Enter 1, 2, or 3.")
    fail(f"JSON-conflict prompt aborted (3 invalid replies) for {path}")
    return "abort"  # unreachable


def _resolve_json_conflict(
    path: Path, label: str, foreign: list[str], *, force_hint: bool,
) -> str:
    """Decide what to do when ``label`` has foreign pointers (P3.3).

    Returns ``"write"`` or ``"skip"``; raises :class:`ConflictAbort`.
    Same resolution matrix as :func:`_resolve_file_conflict` but with a
    pointer-aware prompt.
    """
    policy = _get_conflict_policy()
    effective_force = force_hint or policy.force
    if effective_force:
        return "write"
    if policy.interactive:
        choice = prompt_json_conflict_choice(path, foreign)
        if choice == "force":
            return "write"
        if choice == "skip":
            return "skip"
        raise ConflictAbort(f"User aborted on foreign JSON pointers at {path}")
    raise ConflictAbort(
        f"Foreign JSON pointers at {path}: refusing to overwrite "
        f"({len(foreign)} key(s)). Re-run with --force or set "
        f"{ALLOW_OVERWRITE_ENV}=1 to allow. "
        f"Run `agent-config doctor` to inspect orphaned pointers first."
    )


def merge_json_file(
    path: Path, new_data: dict, force: bool, label: str,
) -> list[dict[str, Any]]:
    """Merge ``new_data`` into ``path``; return v2 ``merged_keys[]`` entries.

    P1.5 + P3.2 + P3.3 of road-to-multi-package-coexistence: every JSON
    pointer the install writes lands in the manifest so uninstall can
    subtract it cleanly. The merge uses leaf-level pointer-replace
    semantics (``deep_merge`` recurses into dicts, replaces at leaves)
    so sibling keys owned by neighbour packages survive. Before any
    write that would overwrite a pre-existing pointer NOT recorded as
    ours, the conflict policy is consulted (force / interactive prompt
    / non-interactive abort).

    Returns the v2 entries on a successful create / update; returns
    ``[]`` when the file was already in sync or the update was
    suppressed without ``--force`` / on a skip choice.
    """
    new_entries = build_merge_entries(label, new_data)

    if not path.exists():
        write_json_file(path, new_data)
        success(f"{label} created")
        return new_entries

    existing = read_json_file(path)
    merged = deep_merge(existing, new_data)

    if merged == existing:
        skip(f"{label} already configured")
        return new_entries

    policy = _get_conflict_policy()
    foreign = _detect_foreign_pointers(existing, new_entries, label, policy)

    if foreign:
        # Foreign-pointer collision: ask the policy. On "write" we fall
        # through and let deep_merge produce the leaf-level pointer-
        # replace; on "skip" we bail without changing the file.
        decision = _resolve_json_conflict(path, label, foreign, force_hint=force)
        if decision == "skip":
            skip(f"{label} has foreign keys, skipped")
            return []
    elif not (force or policy.force):
        # No foreign collision but file needs an update — preserve the
        # legacy "needs --force" contract so existing test expectations
        # and the project-bridge flow stay intact.
        skip(f"{label} exists, needs update (use --force)")
        return []

    write_json_file(path, merged)
    success(f"{label} updated")
    return new_entries


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
        "npm": "./node_modules/@event4u/agent-config/plugin/agent-config",
    }
    plugin_path = plugin_paths.get(package_type, "./plugin/agent-config")

    bridge = {"chat.pluginLocations": {plugin_path: True}}
    # Substrate bridge — not tracked in the manifest, so merged_keys
    # are computed but discarded.
    merge_json_file(project_root / ".vscode" / "settings.json", bridge, force, ".vscode/settings.json")


def ensure_augment_bridge(project_root: Path, force: bool) -> list[dict[str, Any]]:
    bridge = {"enabledPlugins": {"agent-config@event4u": True}}
    return merge_json_file(
        project_root / ".augment" / "settings.json", bridge, force, ".augment/settings.json",
    )


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


def ensure_augment_user_hooks(package_root: Path, force: bool) -> list[dict[str, Any]]:
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
        return []

    _remove_legacy_augment_trampolines()

    per_event: dict[str, list] = {}
    for ac_event, native in AUGMENT_DISPATCHER_BINDINGS:
        # Augment's `command` is a shell line — pass agent-config event
        # and Augment-native event as positional args.
        cmd = f"{dst} {ac_event} {native}"
        entry = {"hooks": [{"type": "command", "command": cmd}]}
        per_event.setdefault(native, []).append(entry)

    settings_patch: dict = {"hooks": per_event}
    return merge_json_file(
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


def ensure_claude_bridge(project_root: Path, force: bool) -> list[dict[str, Any]]:
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
    return merge_json_file(
        project_root / ".claude" / "settings.json", bridge, force, ".claude/settings.json",
    )


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


def ensure_cursor_bridge(project_root: Path, force: bool) -> list[dict[str, Any]]:
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
    return merge_json_file(
        project_root / ".cursor" / "hooks.json", bridge, force, ".cursor/hooks.json",
    )


# Cursor user-scope hooks fire across every project the developer opens
# in the Cursor IDE / CLI. The trampoline reads `workspace_roots[0]`
# from the event payload (per https://cursor.com/docs/hooks) and routes
# the JSON into the active project's `./agent-config dispatch:hook`,
# silent no-op when the workspace is not an agent-config consumer.
CURSOR_USER_DIR = Path.home() / ".cursor"
CURSOR_USER_HOOKS_DIR = CURSOR_USER_DIR / "hooks"
CURSOR_DISPATCHER_TRAMPOLINE = "cursor-dispatcher.sh"


def ensure_cursor_user_hooks(package_root: Path, force: bool) -> list[dict[str, Any]]:
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
        return []

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
    return merge_json_file(
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


def ensure_windsurf_bridge(project_root: Path, force: bool) -> list[dict[str, Any]]:
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
    return merge_json_file(
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


def ensure_windsurf_user_hooks(package_root: Path, force: bool) -> list[dict[str, Any]]:
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
        return []

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
    return merge_json_file(
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


def ensure_gemini_bridge(project_root: Path, force: bool) -> list[dict[str, Any]]:
    """Deploy `.gemini/settings.json` (project scope) with the Phase 7
    universal dispatcher hooks.

    Each Gemini lifecycle event is wired to a single
    `./agent-config dispatch:hook` invocation. Project-scope hooks
    fire with the project as cwd, so no trampoline is needed at this
    scope. Idempotent via deep_merge — rerunning replaces hook arrays
    rather than appending duplicates.
    """
    bridge = {"hooks": _gemini_hooks_dict(_gemini_dispatch_command)}
    return merge_json_file(
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


def ensure_gemini_user_hooks(package_root: Path, force: bool) -> list[dict[str, Any]]:
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
        return []

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
    return merge_json_file(
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


# Roo Code (https://docs.roocode.com/) is a Cline-derived VS Code extension
# that auto-discovers `.roo/rules/*.md` as system-level instructions per
# project. No hook protocol is exposed yet (2026-05), so the bridge is a
# minimal marker file pointing the user at the canonical rule source. Phase
# 2.0 validation gate — keep imperative and minimal; revisit when Roo Code
# ships a programmatic hook surface.
ROOCODE_MARKER = """# Agent Config bridge

This file marks the project as an `event4u/agent-config` consumer.

Roo Code reads `.roo/rules/*.md` as system-level instructions. The
canonical rule and skill source lives under `.augment/` (Augment
portability mirror — see `AGENTS.md` for orientation).

## How to use

- These rules load automatically on every Roo Code session — no
  manual action required.
- Switch Roo Code modes (Architect / Code / Ask / Debug / Custom)
  via the mode switcher to invoke different cognition profiles;
  every mode still sees these rules.
- Slash commands and skills live under `.augment/commands/` and
  `.augment/skills/`. Roo Code does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See `docs/setup/per-ide/roocode.md` for the full activation guide.

Run `./agent-config --help` for available commands.
"""


def ensure_roocode_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.roo/rules/agent-config.md` (project scope) marker.

    Roo Code auto-discovers `.roo/rules/*.md` as system instructions — no
    hook protocol exposed yet. Bridge is intentionally minimal: a single
    marker file pointing developers at the canonical rule source. Phase
    2.0 validation gate (road-to-global-first-install § 2.0).
    """
    target = project_root / ".roo" / "rules" / "agent-config.md"

    if target.exists() and not force:
        skip(".roo/rules/agent-config.md already exists")
        return

    write_file(target, ROOCODE_MARKER)
    success(".roo/rules/agent-config.md created")


# Claude Desktop (https://claude.ai/download) reads config from
# `~/Library/Application Support/Claude/` on macOS — no project-local
# discovery. The project bridge is informational only: a marker file that
# documents the link and tells humans where the canonical rules live.
# Phase 2.3 will formalize this as scope=global-only via SCOPE_SUPPORT.
CLAUDE_DESKTOP_MARKER = """# Agent Config bridge — Claude Desktop

This file marks the project as an `event4u/agent-config` consumer.

Claude Desktop is a **global-scope** tool — it reads config from
`~/Library/Application Support/Claude/` (macOS) and does not
auto-discover project files. This marker is informational only.

To wire Claude Desktop to this project's rules, run:
`npx @event4u/agent-config init --ai claude-desktop --global`

Canonical rule and skill source: `.augment/` (see `AGENTS.md`).
"""


def ensure_claude_desktop_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.claude-desktop/agent-config.md` informational marker.

    Claude Desktop has no project-local discovery (global config only,
    macOS path `~/Library/Application Support/Claude/`). The marker is
    informational — Phase 2.3 will gate this bridge behind scope=global.
    """
    target = project_root / ".claude-desktop" / "agent-config.md"

    if target.exists() and not force:
        skip(".claude-desktop/agent-config.md already exists")
        return

    write_file(target, CLAUDE_DESKTOP_MARKER)
    success(".claude-desktop/agent-config.md created")


# Aider (https://aider.chat) reads `.aider.conf.yml` per project and a
# `CONVENTIONS.md` (or any path declared in `read:`) for system-level
# instructions. The bridge drops a marker and documents the `read:`
# wiring; we do not mutate `.aider.conf.yml` to avoid clobbering user
# overrides. Phase 2.5 may upgrade this to a declarative emitter.
AIDER_MARKER = """# Agent Config bridge — Aider

This file marks the project as an `event4u/agent-config` consumer.

Aider does not auto-discover this file. To activate it, add the
following to `.aider.conf.yml` (create if missing):

```yaml
read:
  - .aider/agent-config.md
```

Or pass `--read .aider/agent-config.md` on the command line.

Canonical rule and skill source: `.augment/` (see `AGENTS.md`).
"""


def ensure_aider_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.aider/agent-config.md` marker; do not touch `.aider.conf.yml`.

    Aider reads `read:` entries from `.aider.conf.yml`. We intentionally
    avoid mutating that file — the marker documents the manual wiring so
    user overrides stay intact. Phase 2.5 may declarative-emit if needed.
    """
    target = project_root / ".aider" / "agent-config.md"

    if target.exists() and not force:
        skip(".aider/agent-config.md already exists")
        return

    write_file(target, AIDER_MARKER)
    success(".aider/agent-config.md created")


# OpenAI Codex CLI (https://github.com/openai/codex) auto-discovers
# `AGENTS.md` at the project root as system instructions. The repo
# already ships an `AGENTS.md` (Thin-Root contract), so the bridge is a
# secondary marker confirming agent-config ownership — Codex will read
# `AGENTS.md` directly regardless. Phase 2.5 may collapse if redundant.
CODEX_MARKER = """# Agent Config bridge — Codex CLI

This file marks the project as an `event4u/agent-config` consumer.

Codex CLI auto-discovers `AGENTS.md` at the project root — that file
is the canonical entry point. This marker is informational and tells
developers where the rules and skills live.

Canonical rule and skill source: `.augment/` (see project `AGENTS.md`).
"""


def ensure_codex_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.codex/agent-config.md` informational marker.

    Codex CLI reads `AGENTS.md` at project root directly — the marker
    is informational. Phase 2.5 may collapse if redundant with AGENTS.md.
    """
    target = project_root / ".codex" / "agent-config.md"

    if target.exists() and not force:
        skip(".codex/agent-config.md already exists")
        return

    write_file(target, CODEX_MARKER)
    success(".codex/agent-config.md created")


# Continue.dev (https://continue.dev) auto-discovers `.continue/rules/*.md`
# as system-level rules per project — same pattern as Roo Code. Bridge is
# a single marker file in the rules directory; Continue will read it
# directly on every session.
CONTINUE_MARKER = """# Agent Config bridge — Continue.dev

This file marks the project as an `event4u/agent-config` consumer.

Continue.dev auto-discovers `.continue/rules/*.md` as system-level
rules per session. The canonical rule and skill source lives under
`.augment/` (Augment portability mirror — see `AGENTS.md` for
orientation).
"""


def ensure_continue_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.continue/rules/agent-config.md` (project scope) marker.

    Continue.dev auto-discovers `.continue/rules/*.md` per project —
    mirror of the Roo Code pattern. Single marker file pointing
    developers at the canonical rule source under `.augment/`.
    """
    target = project_root / ".continue" / "rules" / "agent-config.md"

    if target.exists() and not force:
        skip(".continue/rules/agent-config.md already exists")
        return

    write_file(target, CONTINUE_MARKER)
    success(".continue/rules/agent-config.md created")


# Kilo Code (https://kilocode.ai/) is a Cline-derived VS Code extension —
# Roo Code's fork-cousin. Auto-discovers `.kilocode/rules/*.md` as
# system-level instructions per project. Marker-only bridge in the same
# spirit as Roo Code / Continue.dev.
KILOCODE_MARKER = """# Agent Config bridge — Kilo Code

This file marks the project as an `event4u/agent-config` consumer.

Kilo Code auto-discovers `.kilocode/rules/*.md` as system-level rules
per session. The canonical rule and skill source lives under
`.augment/` (Augment portability mirror — see `AGENTS.md` for
orientation).

## How to use

- These rules load automatically on every Kilo Code session — no
  manual action required.
- Switch Kilo Code modes (Architect / Code / Ask / Debug /
  Orchestrator) via the mode switcher to invoke different
  cognition profiles; every mode still sees these rules.
- Slash commands and skills live under `.augment/commands/` and
  `.augment/skills/`. Kilo Code does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See `docs/setup/per-ide/kilocode.md` for the full activation guide.
"""


def ensure_kilocode_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.kilocode/rules/agent-config.md` (project scope) marker.

    Kilo Code auto-discovers `.kilocode/rules/*.md` per project — Cline
    fork pattern mirroring Roo Code. Single marker file pointing
    developers at the canonical rule source under `.augment/`.
    """
    target = project_root / ".kilocode" / "rules" / "agent-config.md"

    if target.exists() and not force:
        skip(".kilocode/rules/agent-config.md already exists")
        return

    write_file(target, KILOCODE_MARKER)
    success(".kilocode/rules/agent-config.md created")


# Zed (https://zed.dev) reads `.rules` at the project root as the
# canonical system-instruction file. The bridge drops an informational
# marker under `.zed/` documenting agent-config ownership — Zed itself
# does not auto-discover `.zed/agent-config.md`. Phase 2.5 may upgrade
# to a `.rules` emitter, but mirrors the AGENTS.md story until then.
ZED_MARKER = """# Agent Config bridge — Zed

This file marks the project as an `event4u/agent-config` consumer.

Zed reads `.rules` at the project root as system-level instructions —
that file is the canonical entry point. This marker is informational
and tells developers where the rules and skills live.

To activate agent-config under Zed, point Zed's `.rules` at the
canonical source (or symlink it):

```
# Append to .rules at project root
@.augment/AGENTS.md
```

Canonical rule and skill source: `.augment/` (see `AGENTS.md`).
"""


def ensure_zed_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.zed/agent-config.md` informational marker.

    Zed reads `.rules` at the project root directly — the marker is
    informational and documents the wiring. Phase 2.5 may upgrade to a
    declarative `.rules` emitter.
    """
    target = project_root / ".zed" / "agent-config.md"

    if target.exists() and not force:
        skip(".zed/agent-config.md already exists")
        return

    write_file(target, ZED_MARKER)
    success(".zed/agent-config.md created")


# JetBrains AI Assistant (https://www.jetbrains.com/ai/) reads guidelines
# from project-level config files under `.idea/`. To avoid colliding with
# the team-shared `.idea/` workspace, the bridge writes to
# `.jetbrains/agent-config.md` (informational marker) and documents the
# manual wiring step. Phase 2.5 may automate the `.idea/` write behind a
# `--force` gate.
JETBRAINS_MARKER = """# Agent Config bridge — JetBrains AI Assistant

This file marks the project as an `event4u/agent-config` consumer.

JetBrains AI Assistant reads custom prompts and guidelines from
project-level config (`.idea/`) and user-scope settings. This marker
is informational — to wire agent-config into JetBrains AI, point the
assistant's custom-prompts path at `.augment/` or copy the relevant
rules into your JetBrains profile.

Canonical rule and skill source: `.augment/` (see `AGENTS.md`).
"""


def ensure_jetbrains_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.jetbrains/agent-config.md` informational marker.

    JetBrains AI reads config from `.idea/` and user-scope paths — we
    avoid mutating `.idea/` (team-shared workspace) and ship a marker
    documenting the manual wiring instead.
    """
    target = project_root / ".jetbrains" / "agent-config.md"

    if target.exists() and not force:
        skip(".jetbrains/agent-config.md already exists")
        return

    write_file(target, JETBRAINS_MARKER)
    success(".jetbrains/agent-config.md created")


# Kiro (https://kiro.dev) is Amazon's agentic IDE. It auto-discovers
# `.kiro/steering/*.md` as steering documents per project — same pattern
# as Roo Code / Continue.dev / Kilo Code. Bridge is a single marker
# under the steering directory.
KIRO_MARKER = """# Agent Config bridge — Kiro

This file marks the project as an `event4u/agent-config` consumer.

Kiro auto-discovers `.kiro/steering/*.md` as steering documents per
session. The canonical rule and skill source lives under `.augment/`
(Augment portability mirror — see `AGENTS.md` for orientation).

## How to use

- Steering documents load automatically on every Kiro session — no
  manual action required.
- For structured, plan-first work, use Kiro's **Spec** workflow
  (the agent produces a spec → tasks → implementation under your
  review). For free-form work, use **Vibe**. Both honor these
  steering documents.
- Slash commands and skills live under `.augment/commands/` and
  `.augment/skills/`. Kiro does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See `docs/setup/per-ide/kiro.md` for the full activation guide.
"""


def ensure_kiro_bridge(project_root: Path, force: bool) -> None:
    """Deploy `.kiro/steering/agent-config.md` (project scope) marker.

    Kiro auto-discovers `.kiro/steering/*.md` per project — Cline /
    Continue.dev pattern. Single marker file pointing developers at
    the canonical rule source under `.augment/`.
    """
    target = project_root / ".kiro" / "steering" / "agent-config.md"

    if target.exists() and not force:
        skip(".kiro/steering/agent-config.md already exists")
        return

    write_file(target, KIRO_MARKER)
    success(".kiro/steering/agent-config.md created")


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


# --- Global user-level install — re-introduced under ADR-007 ---
#
# The pre-`5388de25` `--global` was an in-project symlink scheme driven by
# `templates/global-install-manifest.yml`. ADR-007 (2026-05-12) rebuilds the
# flag as a real-file user-scope install — writes to `~/.claude/`,
# `~/.cursor/`, `~/.augment/`, etc. per the per-agent discovery matrix. No
# symlinks; no manifest revival. This module currently exposes the dispatch
# scaffold; concrete file writes are owned by later roadmap tasks
# (export subcommand, lockfile lifecycle).

# Per-tool user-scope anchor paths per ADR-007 matrix. Listed in tool-ID
# order matching `_VALID_TOOLS` so the scaffold output stays predictable.
USER_SCOPE_PATHS = {
    "claude-code":    "~/.claude/",
    "claude-desktop": "~/Library/Application Support/Claude/",
    "cursor":         "~/.cursor/",
    "windsurf":       "~/.codeium/windsurf/",
    "cline":          "~/Documents/Cline/Rules/",
    "gemini-cli":     "~/.gemini/",
    "copilot":        "~/.copilot/",
    "augment":        "~/.augment/",
    "aider":          "~/.aider.conf.yml",
    "codex":          "~/.codex/",
    "roocode":        "~/.roo/",
    "continue":       "~/.continue/",
    "kilocode":       "~/.kilocode/",
    "zed":            "~/.config/zed/",
    "jetbrains":      "~/.config/JetBrains/",
    "kiro":           "~/.kiro/",
    # Phase 2.4 expansion — anchors lifted from
    # nextlevelbuilder/ui-ux-pro-max-skill (cli/assets/templates/platforms/*.json)
    # so `--global` covers every tool that ships a markdown-skills convention.
    "qoder":          "~/.qoder/",
    "opencode":       "~/.opencode/",
    "trae":           "~/.trae/",
    "antigravity":    "~/.agents/",
    "codebuddy":      "~/.codebuddy/",
    "droid":          "~/.factory/",
    "warp":           "~/.warp/",
}


# Per-tool scope support per ADR-007 matrix + Tier-1/2 verification.
# Values: "both" · "project" · "global". Used by _validate_scope() to
# reject explicit `--tools=X` selections that conflict with the chosen
# scope (project default or `--global`). `--tools=all` silently filters
# incompatible IDs so the default install path stays backward-compatible.
#
# Rationale:
#   - claude-desktop has no project discovery (informational marker only
#     in project trees); --project rejects it explicitly.
#   - jetbrains avoids mutating team-shared .idea/; --project marker is
#     informational only; canonical scope is global.
#   - roocode / kilocode auto-discover `.roo/rules/` and `.kilocode/rules/`
#     per project; no user-scope discovery convention; --global rejects.
SCOPE_SUPPORT = {
    "claude-code":    "both",
    "claude-desktop": "global",
    "cursor":         "both",
    "windsurf":       "both",
    "cline":          "both",
    "gemini-cli":     "both",
    "copilot":        "both",
    "augment":        "both",
    "aider":          "both",
    "codex":          "both",
    # Phase 2.4: roocode / kilocode lifted to "both" — global deploys
    # write to `~/.roo/skills/` and `~/.kilocode/skills/` matching the
    # nextlevelbuilder/ui-ux-pro-max-skill anchors.
    "roocode":        "both",
    "continue":       "both",
    "kilocode":       "both",
    "zed":            "both",
    "jetbrains":      "global",
    "kiro":           "both",
    # Phase 2.4 expansion — global-only for new anchors; project bridges
    # are not yet implemented for these IDs.
    "qoder":          "global",
    "opencode":       "global",
    "trae":           "global",
    "antigravity":    "global",
    "codebuddy":      "global",
    "droid":          "global",
    "warp":           "global",
}


# Per-tool bridge marker paths used by the project-scope manifest (ADR-008
# Phase 3.2). The value is the relative path inside the project tree (for
# `scope=project`) or the absolute / `~`-prefixed user-scope path (for
# `scope=global`). `validate` (Phase 3.4) checks that this file exists; the
# manifest stores the path verbatim so a relocation of a bridge stays visible
# in the lockfile.
PROJECT_BRIDGE_MARKERS = {
    "claude-code":    ".claude/settings.json",
    "claude-desktop": ".claude-desktop/agent-config.md",
    "cursor":         ".cursor/hooks.json",
    "windsurf":       ".windsurf/hooks.json",
    "cline":          ".clinerules/hooks",
    "gemini-cli":     ".gemini/settings.json",
    "copilot":        ".github/plugin/marketplace.json",
    "augment":        ".augment/settings.json",
    "aider":          ".aider/agent-config.md",
    "codex":          ".codex/agent-config.md",
    "roocode":        ".roo/rules/agent-config.md",
    "continue":       ".continue/rules/agent-config.md",
    "kilocode":       ".kilocode/rules/agent-config.md",
    "zed":            ".zed/agent-config.md",
    "jetbrains":      ".jetbrains/agent-config.md",
    "kiro":           ".kiro/steering/agent-config.md",
}


# Per-tool content deployment plan for `--global` installs. Each entry is a
# list of ``(package_src_relative, dest_subpath)`` tuples. ``package_src_relative``
# resolves against the agent-config package root; ``dest_subpath`` is appended
# to ``USER_SCOPE_PATHS[tool_id]`` (expanded). Symlinks in the source are
# dereferenced so the user-scope copy stays valid after npx cache eviction
# (Council Round 3 Q1 rejected cross-scope symlinks).
#
# Tools absent from this map have no deployable content yet in global scope:
# - ``copilot`` has no user-scope convention (rules live in
#   ``.github/copilot-instructions.md`` per project); users export per-project
#   via ``agent-config export --tool=copilot``.
# - ``aider`` config is a single YAML file (``~/.aider.conf.yml``), not a
#   directory; --global prints a hint rather than synthesizing a file.
# - ``zed`` / ``jetbrains`` have no markdown-skills convention; --global
#   prints a hint.
# - ``claude-desktop`` is a marker-only deployment, handled in
#   ``_write_claude_desktop_marker`` rather than via this map.
#
# Tools that follow the markdown-skills convention (anchors lifted from
# nextlevelbuilder/ui-ux-pro-max-skill) deploy ``.claude/skills`` —
# the universal Anthropic-shaped skill bundle — into ``<anchor>/skills/``
# (or ``<anchor>/steering/`` for kiro). ``.claude/rules`` is also copied
# where the destination is a true rules-aware tool root.
_CLAUDE_SKILL_BUNDLE: list[tuple[str, str]] = [
    (".claude/rules",    "rules"),
    (".claude/skills",   "skills"),
    (".claude/personas", "personas"),
]
GLOBAL_DEPLOY_SOURCES: dict[str, list[tuple[str, str]]] = {
    "claude-code": _CLAUDE_SKILL_BUNDLE,
    "augment": [
        (".augment/rules",     "rules"),
        (".augment/skills",    "skills"),
        (".augment/commands",  "commands"),
        (".augment/contexts",  "contexts"),
        (".augment/personas",  "personas"),
        (".augment/templates", "templates"),
    ],
    "cursor": [
        (".cursor/rules",    "rules"),
        (".cursor/commands", "commands"),
        (".cursor/personas", "personas"),
    ],
    "windsurf": [
        (".windsurf/rules",     "rules"),
        (".windsurf/workflows", "workflows"),
    ],
    "cline": [
        (".clinerules", ""),
    ],
    # Markdown-skills tools — mirror the universal skill bundle into the
    # tool-specific anchor. Subpath matches the reference repo's
    # platform JSON `folderStructure.skillPath` (with the skill-name
    # tail stripped — we deploy the entire bundle, not a single skill).
    "gemini-cli":  _CLAUDE_SKILL_BUNDLE,
    "codex":       _CLAUDE_SKILL_BUNDLE,
    "continue":    _CLAUDE_SKILL_BUNDLE,
    "roocode":     _CLAUDE_SKILL_BUNDLE,
    "kilocode":    _CLAUDE_SKILL_BUNDLE,
    "qoder":       _CLAUDE_SKILL_BUNDLE,
    "opencode":    _CLAUDE_SKILL_BUNDLE,
    "trae":        _CLAUDE_SKILL_BUNDLE,
    "antigravity": _CLAUDE_SKILL_BUNDLE,
    "codebuddy":   _CLAUDE_SKILL_BUNDLE,
    "droid":       _CLAUDE_SKILL_BUNDLE,
    "warp":        _CLAUDE_SKILL_BUNDLE,
    # Kiro reads from `steering/` not `skills/` (per
    # platforms/kiro.json#folderStructure.skillPath).
    "kiro": [
        (".claude/rules",    "rules"),
        (".claude/skills",   "steering"),
        (".claude/personas", "personas"),
    ],
}


# Marker body written to the Claude Desktop user-scope directory. Claude
# Desktop has no rules/skills filesystem convention; the marker advertises
# the agent-config install for downstream tooling and gives users a stable
# pointer to the lockfile.
_CLAUDE_DESKTOP_MARKER_TEMPLATE = """\
# agent-config — Claude Desktop marker

Installed by `@event4u/agent-config` (user scope, ADR-007).

- Lockfile: `{lockfile}`
- Anchor:   `{anchor}`

Claude Desktop has no native rules / skills filesystem convention; this
file is informational. Rules and skills for AI coding tools are deployed
to their respective user-scope directories (`~/.claude/`, `~/.augment/`,
`~/.cursor/`, `~/.codeium/windsurf/`, `~/Documents/Cline/Rules/`).

To remove this marker, delete this file.
"""


def _bridge_marker(tool_id: str, scope: str) -> str:
    """Return the canonical bridge-marker path for ``(tool_id, scope)``.

    Project scope returns the repo-relative marker (e.g. ``.roo/rules/agent-
    config.md``). Global scope returns the user-scope anchor from
    :data:`USER_SCOPE_PATHS` (e.g. ``~/.claude/``). ADR-008 stores both as
    opaque strings; `validate` (Phase 3.4) handles the existence check.
    """
    if scope == "global":
        return USER_SCOPE_PATHS.get(tool_id, "")
    return PROJECT_BRIDGE_MARKERS.get(tool_id, "")


def _validate_scope(tools: set[str], scope: str, was_all: bool) -> set[str]:
    """Validate tools against requested scope per SCOPE_SUPPORT.

    `scope` is "project" or "global". When `was_all` is True (user passed
    `--tools=all` or omitted the flag), incompatible tools are silently
    filtered so the default install stays backward-compatible. Explicit
    tool lists hard-reject with a directive error per Phase 2.3.
    """
    if scope not in ("project", "global"):
        fail(f"_validate_scope: unknown scope '{scope}'")
    incompatible = sorted(
        t for t in tools
        if SCOPE_SUPPORT.get(t, "both") not in ("both", scope)
    )
    if not incompatible:
        return tools
    if was_all:
        return {t for t in tools if t not in incompatible}
    hint = (
        "drop --global (project is the default scope)"
        if scope == "global" else "use --global"
    )
    fail(
        f"--tools: {', '.join(incompatible)} does not support "
        f"--{scope} scope ({hint})"
    )
    return tools  # unreachable; fail() exits


def _resolve_scope(
    opts: "argparse.Namespace",
    detected: str,
    detect_reason: str,
    custom_path: "Path | None",
) -> str:
    """Phase 1.4 — turn flags + detection into a concrete scope.

    Precedence:

    1. ``--scope=project|global`` — explicit override; ``--custom-path``
       may steer the project root.
    2. ``--scope=prompt`` — force the interactive chooser; ``--custom-path``
       pre-fills the Custom branch.
    3. ``--scope=auto`` — honor detection; trigger the prompt on
       ``"prompt"``.
    4. ``--global`` — legacy alias for ``--scope=global``.
    5. No flag — backward-compatible default of ``project``, EXCEPT
       when detection returns ``"prompt"``, in which case the
       interactive chooser fires (matches ADR-007 D2 collision UX).

    Returns ``"project"`` or ``"global"``. Never returns ``"prompt"`` —
    that intermediate state is resolved here. Aborts via ``fail()`` if
    a prompt is required but stdin is not a TTY.
    """
    # Explicit --scope wins.
    if opts.scope == "project":
        return "project"
    if opts.scope == "global":
        return "global"
    if opts.scope == "prompt":
        return _run_scope_prompt(opts, detect_reason or "forced by --scope=prompt", custom_path)
    if opts.scope == "auto":
        if detected == "prompt":
            return _run_scope_prompt(opts, detect_reason, custom_path)
        if not QUIET:
            info(f"Scope: {detected} (auto-detected; {detect_reason})")
        return detected

    # --global legacy alias.
    if opts.global_install:
        return "global"

    # No flag — legacy default with collision auto-prompt.
    if detected == "prompt":
        return _run_scope_prompt(opts, detect_reason, custom_path)
    if not QUIET:
        info(f"Scope detection: {detected} ({detect_reason}). Using project default for backward compatibility; pass --scope=auto to honor detection.")
    return "project"


def _run_scope_prompt(
    opts: "argparse.Namespace",
    reason: str,
    custom_path: "Path | None",
) -> str:
    """Drive the interactive scope chooser, mutating ``opts.custom_path``
    when the user picks the Custom branch.

    Fails fast (no prompt) when stdin is not a TTY and ``--custom-path``
    was not pre-supplied — CI callers must use ``--scope=project|global``.
    """
    if not sys.stdin.isatty() and custom_path is None:
        fail(
            "Ambiguous install scope detected and stdin is not a TTY. "
            "Pass --scope=project|global (or --custom-path=<dir>) to override."
        )
    choice = prompt_scope_choice(reason)
    if choice == "project":
        return "project"
    if choice == "global":
        return "global"
    # SCOPE_CUSTOM — resolve a destination path.
    if custom_path is None:
        try:
            raw = _read_line("Custom destination path: ")
        except EOFError:
            fail("Custom-path prompt aborted (EOF on stdin)")
        if not raw:
            fail("Custom-path prompt requires a non-empty path")
        custom_path = Path(raw).expanduser().resolve()
        opts.custom_path = str(custom_path)
    if not QUIET:
        info(f"Custom destination: {custom_path}")
    return "project"


# Manifest files used by multi-signal scope detection (Phase 1.3). Listed
# in the order they are most commonly the canonical project signal; the
# detector short-circuits on the first hit. `.git/` is intentionally
# absent — monorepos, dotfile-git repos and Hg/SVN workspaces all break
# that signal (ADR-007 D2).
SCOPE_DETECT_MANIFESTS = (
    "package.json", "composer.json", "pyproject.toml",
    "Cargo.toml", "go.mod", "Gemfile",
)

# Project-local AI-tool config that, if present alongside a manifest,
# triggers the ambiguity prompt. Directories first, then well-known
# top-level files. Conservative on purpose: false negatives (skip prompt,
# install global) are recoverable via `--project`; false positives (prompt
# in an empty dir) are a UX paper-cut.
SCOPE_DETECT_AI_DIRS = (
    ".claude", ".cursor", ".windsurf", ".augment",
    ".clinerules", ".copilot", ".gemini", ".codex",
    ".aider", ".continue", ".roo", ".kilocode",
)
SCOPE_DETECT_AI_FILES = (
    "CLAUDE.md", "AGENTS.md", "GEMINI.md",
    ".windsurfrules", ".aider.conf.yml",
)


def detect_scope(cwd: Path) -> tuple[str, str]:
    """Multi-signal scope detection per ADR-007 D2 / Phase 1.3.

    Returns ``(scope, reason)`` where ``scope`` is one of:

    * ``"project"`` — install into ``cwd`` (current behaviour preserved).
      Triggered by an existing ``.agent-settings.yml`` in ``cwd``.
    * ``"prompt"`` — caller MUST resolve the ambiguity (interactive
      prompt in 1.4 / ``--scope=<x>`` override for CI). Triggered by
      a manifest file (``package.json`` / ``composer.json`` / etc.)
      combined with at least one project-local AI-tool config marker.
    * ``"global"`` — install to user-scope paths. Default when no other
      signal fires (including ``cwd == ~``, empty dir, dotfile-git).

    ``.git/`` is explicitly NOT a signal — monorepos, dotfile managers,
    and non-Git workspaces all break it. Pure function; no side effects.
    """
    if (cwd / SETTINGS_FILE).exists():
        return "project", f"existing {SETTINGS_FILE}"

    has_manifest = next(
        (m for m in SCOPE_DETECT_MANIFESTS if (cwd / m).exists()),
        None,
    )
    has_ai_dir = next(
        (d for d in SCOPE_DETECT_AI_DIRS if (cwd / d).is_dir()),
        None,
    )
    has_ai_file = next(
        (f for f in SCOPE_DETECT_AI_FILES if (cwd / f).exists()),
        None,
    )

    if has_manifest and (has_ai_dir or has_ai_file):
        marker = has_ai_dir or has_ai_file
        return "prompt", f"manifest ({has_manifest}) + AI-tool config ({marker})"

    return "global", "no project-scope signals"


# --- Interactive prompts (Phase 1.4) ---

# Sentinel returned by `prompt_scope_choice` for the "Custom path" branch.
# The caller must follow up by reading a path (CLI: `--custom-path`; TTY:
# a second prompt line). Kept as a constant so call sites can match on
# identity rather than the string literal.
SCOPE_CUSTOM = "custom"


def _read_line(prompt_text: str) -> str:
    """Thin wrapper over `input()` so tests can monkey-patch a single point.

    Returns the user's stripped reply. Raises ``EOFError`` on Ctrl-D so
    callers can fail-fast rather than loop on closed stdin.
    """
    return input(prompt_text).strip()


def prompt_scope_choice(reason: str) -> str:
    """Interactive 3-option scope chooser per ADR-007 D2 / Phase 1.4.

    Returns one of ``"project"``, ``"global"``, ``SCOPE_CUSTOM``. The
    caller is responsible for resolving ``SCOPE_CUSTOM`` to an actual
    path (e.g. by reading ``--custom-path`` or a follow-up prompt).

    Loops on invalid input; aborts the install via ``fail()`` on EOF
    (Ctrl-D) or three consecutive invalid replies so a stuck CI run
    cannot hang the parent process.
    """
    print()
    info(f"Ambiguous install scope: {reason}.")
    info("Choose where to install:")
    print("  1) Project — install into the current directory")
    print("  2) User    — install into ~/ (recommended; one install per machine)")
    print("  3) Custom  — specify an explicit destination path")
    print()
    attempts = 0
    while attempts < 3:
        try:
            reply = _read_line("Choose [1/2/3]: ")
        except EOFError:
            fail("Scope prompt aborted (EOF on stdin); pass --scope=project|global to override")
        if reply in ("1", "project", "p"):
            return "project"
        if reply in ("2", "global", "user", "u", "g"):
            return "global"
        if reply in ("3", "custom", "c"):
            return SCOPE_CUSTOM
        attempts += 1
        warn(f"Invalid choice '{reply}'. Enter 1, 2, or 3.")
    fail("Scope prompt aborted (3 invalid replies); pass --scope=project|global to override")
    return "project"  # unreachable; fail() exits


def prompt_collision_choice(path: Path) -> str:
    """Hard-Floor 3-option prompt for an existing user-scope config file.

    Returns one of ``"merge"``, ``"backup"``, ``"abort"``. Used by future
    write code paths (1.5 export, 1.6 lockfile) before clobbering an
    existing ``~/.claude/CLAUDE.md`` / ``~/.codex/AGENTS.md`` / etc. The
    helper itself does not touch the filesystem; the caller owns the
    merge / rename-to-`.bak.<ts>` / exit-1 action.
    """
    print()
    warn(f"Existing file at {path}")
    info("Choose how to handle the collision:")
    print("  1) Merge              — append our content, preserve theirs")
    print("  2) Backup and replace — rename existing to .bak.<ts>, write fresh")
    print("  3) Abort              — leave the file untouched, exit non-zero")
    print()
    attempts = 0
    while attempts < 3:
        try:
            reply = _read_line("Choose [1/2/3]: ")
        except EOFError:
            fail(f"Collision prompt aborted (EOF on stdin) for {path}")
        if reply in ("1", "merge", "m"):
            return "merge"
        if reply in ("2", "backup", "b"):
            return "backup"
        if reply in ("3", "abort", "a"):
            return "abort"
        attempts += 1
        warn(f"Invalid choice '{reply}'. Enter 1, 2, or 3.")
    fail(f"Collision prompt aborted (3 invalid replies) for {path}")
    return "abort"  # unreachable


def _load_installed_lock_module():
    """Lazy-import ``scripts._lib.installed_lock`` regardless of load mode.

    ``install.py`` runs both as a top-level script (``python3 scripts/install.py``)
    and as ``scripts.install`` (via ``from scripts.install import …``). The
    repo root has to be on ``sys.path`` for the package-qualified import to
    resolve in the script case.
    """
    pkg_root = str(Path(__file__).resolve().parents[1])
    if pkg_root not in sys.path:
        sys.path.insert(0, pkg_root)
    from scripts._lib import installed_lock  # noqa: WPS433 — lazy by design
    return installed_lock


def _load_installed_tools_module():
    """Lazy-import ``scripts._lib.installed_tools`` (ADR-008 manifest)."""
    pkg_root = str(Path(__file__).resolve().parents[1])
    if pkg_root not in sys.path:
        sys.path.insert(0, pkg_root)
    from scripts._lib import installed_tools  # noqa: WPS433 — lazy by design
    return installed_tools


def _sha256_of_file(path: Path) -> Optional[str]:
    """Return the hex SHA-256 of ``path`` content, or ``None`` if unreadable.

    Used by the v2 manifest (P1.4) to record content hashes for
    ``deployed`` and ``marker`` files so drift can be detected later.
    Bridge files intentionally pass ``None`` (their content is a
    pointer, not committed bytes).
    """
    try:
        data = path.read_bytes()
    except OSError:
        return None
    return hashlib.sha256(data).hexdigest()


def _file_entry(path: Path, kind: str, *, hash_content: bool) -> dict[str, Any]:
    """Build a v2 ``files[]`` entry from an absolute path.

    ``hash_content`` toggles SHA-256 computation; bridges pass ``False``
    (sha256 stays ``None``), deployed / marker files pass ``True``.
    The manifest is path-only at the wire level — we serialise the
    absolute path because user-scope files are not under ``project_root``.
    """
    return {
        "path": str(path),
        "kind": kind,
        "sha256": _sha256_of_file(path) if hash_content else None,
    }


def _files_by_tool_from_deploy(
    deploy_results: dict[str, tuple[int, int, str, list[Path]]],
    project_root: Path,
) -> dict[str, list[dict[str, Any]]]:
    """Translate ``_deploy_global_content`` output into v2 manifest entries.

    Returns ``{tool_id: [files[]]}``. ``status=deployed`` paths get
    ``kind=deployed``; ``status=marker`` paths get ``kind=marker``.
    ``hint`` / ``unsupported`` tools produce no entries (nothing was
    written). Empty path lists are emitted as empty lists so the
    inventory replaces rather than preserves a stale prior set.
    """
    out: dict[str, list[dict[str, Any]]] = {}
    for tool_id, (_, _, status, paths) in deploy_results.items():
        if status == "deployed":
            out[tool_id] = [
                _file_entry(p, "deployed", hash_content=True) for p in paths
            ]
        elif status == "marker":
            out[tool_id] = [
                _file_entry(p, "marker", hash_content=True) for p in paths
            ]
        else:
            # No files written — record empty list so a re-install with
            # a smaller set actually shrinks the recorded inventory.
            out[tool_id] = []
    return out


def _files_by_tool_from_bridges(
    tools: set[str],
    project_root: Path,
    scope: str,
) -> dict[str, list[dict[str, Any]]]:
    """Build v2 ``files[]`` entries from project-scope bridge markers.

    Each project-scope tool contributes a single ``kind=bridge`` entry
    pointing at its marker file. Bridges are pointers (not content we
    own bytes-for-bytes), so ``sha256`` stays ``None`` per the schema.
    """
    out: dict[str, list[dict[str, Any]]] = {}
    for tool_id in sorted(tools):
        marker = _bridge_marker(tool_id, scope)
        if not marker:
            continue
        marker_path = Path(marker)
        if not marker_path.is_absolute():
            marker_path = project_root / marker_path
        out[tool_id] = [
            _file_entry(marker_path, "bridge", hash_content=False),
        ]
    return out


def _update_installed_tools_manifest(
    project_root: Path,
    tools: set[str],
    scope: str,
    force: bool,
    *,
    files_by_tool: Optional[dict[str, list[dict[str, Any]]]] = None,
    merged_keys_by_tool: Optional[dict[str, list[dict[str, Any]]]] = None,
) -> int:
    """Append / refresh project-scope manifest entries (ADR-008 Phase 3.2).

    Called after the bridge-write phase succeeds. The manifest lives at
    ``<project_root>/agents/installed-tools.lock`` and tracks which AI tools
    this project expects, separate from ``.agent-project-settings.yml``
    (behaviour). Idempotent on (name, scope) match; refuses scope changes
    without ``--force`` per ADR-008 § Lifecycle.

    ``files_by_tool`` (P1.4) is the per-tool inventory of paths the
    install just wrote. When omitted the manifest preserves any prior
    ``files[]`` on idempotent re-installs and emits none on first write.

    ``merged_keys_by_tool`` (P1.5) is the per-tool inventory of JSON
    pointers the install merged into shared files (e.g. ``.cursor/hooks.json``).
    Same idempotency contract as ``files_by_tool``.

    Returns 0 on success, 1 on refusal (scope mismatch without ``--force``).
    """
    tools_mod = _load_installed_tools_module()
    target = tools_mod.manifest_path(project_root)
    existing = tools_mod.read_manifest(target) or {}
    entries = list(existing.get("tools", []))

    lock_mod = _load_installed_lock_module()
    version = lock_mod.current_package_version()

    for tool_id in sorted(tools):
        marker = _bridge_marker(tool_id, scope)
        if not marker:
            # Substrate (vscode) or unknown — not tracked in the manifest.
            continue
        files = files_by_tool.get(tool_id) if files_by_tool else None
        merged_keys = (
            merged_keys_by_tool.get(tool_id) if merged_keys_by_tool else None
        )
        try:
            entries = tools_mod.upsert_tool(
                entries,
                name=tool_id,
                scope=scope,
                bridge_marker=marker,
                force=force,
                files=files,
                merged_keys=merged_keys,
            )
        except tools_mod.ScopeMismatchError as exc:
            if not QUIET:
                warn(str(exc))
                info(f"  Manifest: {target}")
                info("  Override: re-run with `--force` to rewrite the entry")
            return 1

    tools_mod.write_manifest(target, version, entries)
    if not QUIET:
        info(f"Manifest updated: {target.relative_to(project_root) if target.is_relative_to(project_root) else target}")
    return 0


# --- Global content deployment (ADR-007 user-scope file writes) ---


def _resolve_package_root_for_global() -> Path:
    """Locate the agent-config package root for global content deployment.

    Resolves relative to ``scripts/install.py`` (one level up). Verified by
    the presence of ``config/profiles/minimal.ini`` so a misplaced copy of
    install.py outside the package fails loudly instead of writing nothing.
    """
    here = Path(__file__).resolve()
    candidate = here.parent.parent
    if not (candidate / "config" / "profiles" / "minimal.ini").exists():
        fail(
            f"Could not locate agent-config package root from {here}. "
            "Expected config/profiles/minimal.ini at the parent directory."
        )
    return candidate


#: Inline package identifier injected into deployed Markdown
#: frontmatter (P5.1). Human-readable provenance only; the manifest
#: remains the authoritative ownership source (see P5.3).
PACKAGE_TAG_ID = "event4u/agent-config"


def _inject_package_tag(
    target: Path, source: Path | None, package_root: Path | None,
) -> None:
    """Inject ``package:`` / ``source_path:`` keys into existing frontmatter.

    No-ops for files that don't end in ``.md`` or that lack a leading
    ``---`` frontmatter block (P5.1: don't synthesise frontmatter where
    none exists). Idempotent: running on an already-tagged file
    rewrites the same values without growing the block.

    ``source`` is the file we copied **from** (post-symlink-resolution
    when applicable); when ``package_root`` is supplied and contains
    ``source``, the recorded value is the path relative to the package
    root, otherwise the absolute path. ``source=None`` skips the
    ``source_path`` key but still maintains the ``package`` key.

    The injected key is ``source_path:`` (not ``source:``) to avoid
    colliding with the established ``source: package`` origin-type
    convention used by 200+ rule files in this and downstream packages.
    """
    if target.suffix != ".md":
        return
    try:
        text = target.read_text(encoding="utf-8")
    except OSError:
        return
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return
    # Locate the closing fence — second ``---`` on its own line.
    lines = text.splitlines(keepends=True)
    close_idx: int | None = None
    for i in range(1, len(lines)):
        if lines[i].rstrip("\r\n") == "---":
            close_idx = i
            break
    if close_idx is None:
        return
    fm_lines = lines[1:close_idx]
    body_lines = lines[close_idx:]

    source_value: str | None = None
    if source is not None:
        try:
            resolved_src = source.resolve()
        except OSError:
            resolved_src = source
        if package_root is not None:
            try:
                source_value = str(
                    resolved_src.relative_to(package_root.resolve()),
                )
            except ValueError:
                source_value = str(resolved_src)
        else:
            source_value = str(resolved_src)

    def _set_key(block: list[str], key: str, value: str) -> list[str]:
        prefix = f"{key}:"
        rendered = f"{key}: {value}\n"
        for idx, line in enumerate(block):
            if line.startswith(prefix):
                block[idx] = rendered
                return block
        block.append(rendered)
        return block

    fm_lines = _set_key(fm_lines, "package", PACKAGE_TAG_ID)
    if source_value is not None:
        fm_lines = _set_key(fm_lines, "source_path", source_value)
    new_text = "".join(lines[:1] + fm_lines + body_lines)
    if new_text != text:
        target.write_text(new_text, encoding="utf-8")


def _copy_dir_dereferencing_symlinks(
    src: Path, dest: Path, force: bool,
    *,
    package_root: Path | None = None,
) -> tuple[int, int, list[Path]]:
    """Recursively copy ``src`` into ``dest``, dereferencing every symlink.

    Returns ``(files_written, files_skipped, written_paths)``. The third
    element is the absolute path list of every file the copy actually
    wrote (P1.4 — manifest needs to record the inventory). ``dest`` is
    created if missing. Existing files at ``dest`` are overwritten only
    when ``force=True``; otherwise skipped silently and counted as
    ``skipped``. Symlinks in ``src`` are resolved so the user-scope copy
    survives npx cache eviction (the source tree under
    ``~/.npm/_npx/<hash>/`` is transient).

    When ``package_root`` is supplied, deployed ``.md`` files get an
    inline package tag injected into their frontmatter (P5.1).
    """
    written = 0
    skipped = 0
    written_paths: list[Path] = []
    if not src.exists():
        return (0, 0, written_paths)
    if not src.is_dir():
        # Single-file source (e.g. .windsurfrules): copy as one file.
        dest.parent.mkdir(parents=True, exist_ok=True)
        decision = _resolve_file_conflict(dest, force_hint=force)
        if decision == "skip":
            return (0, 1, written_paths)
        shutil.copyfile(src, dest, follow_symlinks=True)
        _inject_package_tag(dest, src, package_root)
        written_paths.append(dest)
        return (1, 0, written_paths)
    dest.mkdir(parents=True, exist_ok=True)
    for entry in src.rglob("*"):
        rel = entry.relative_to(src)
        target = dest / rel
        if entry.is_dir() and not entry.is_symlink():
            target.mkdir(parents=True, exist_ok=True)
            continue
        # Resolve symlinks to their real targets. ``follow_symlinks=True``
        # on copyfile produces a real file at the destination.
        resolved = entry.resolve()
        if resolved.is_dir():
            # Symlinked subdir — recurse into the resolved path.
            target.mkdir(parents=True, exist_ok=True)
            sub_w, sub_s, sub_p = _copy_dir_dereferencing_symlinks(
                resolved, target, force, package_root=package_root,
            )
            written += sub_w
            skipped += sub_s
            written_paths.extend(sub_p)
            continue
        decision = _resolve_file_conflict(target, force_hint=force)
        if decision == "skip":
            skipped += 1
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(resolved, target, follow_symlinks=True)
        _inject_package_tag(target, resolved, package_root)
        written += 1
        written_paths.append(target)
    return (written, skipped, written_paths)


def _write_claude_desktop_marker(
    force: bool, lockfile_path: Path,
) -> tuple[int, int, list[Path]]:
    """Write the Claude Desktop user-scope marker file.

    Returns ``(written, skipped, written_paths)`` for symmetry with the
    tree copier (P1.4). The marker is a single Markdown file; existing
    files are preserved unless ``force=True``.
    """
    anchor = Path(USER_SCOPE_PATHS["claude-desktop"]).expanduser()
    target = anchor / "agent-config.md"
    decision = _resolve_file_conflict(target, force_hint=force)
    if decision == "skip":
        return (0, 1, [])
    anchor.mkdir(parents=True, exist_ok=True)
    body = _CLAUDE_DESKTOP_MARKER_TEMPLATE.format(
        lockfile=str(lockfile_path),
        anchor=str(anchor),
    )
    target.write_text(body, encoding="utf-8")
    return (1, 0, [target])


def _deploy_global_content(
    tools: set[str],
    force: bool,
    package_root: Path,
    lockfile_path: Path,
) -> dict[str, tuple[int, int, str, list[Path]]]:
    """Deploy per-tool content into user-scope anchors for ``tools``.

    For each tool in ``tools`` that has a ``GLOBAL_DEPLOY_SOURCES`` entry,
    copies the listed package subtrees into ``USER_SCOPE_PATHS[tool_id]``
    (expanded). For ``claude-desktop`` writes the marker file. For tools
    without a deployment plan (e.g. ``copilot``), records a ``hint`` status
    so the caller can print an actionable next step.

    Returns ``{tool_id: (written, skipped, status, written_paths)}``
    where ``status`` is one of ``deployed``, ``marker``, ``hint``,
    ``unsupported`` and ``written_paths`` is the absolute path list of
    every file the deploy actually wrote (P1.4).
    """
    results: dict[str, tuple[int, int, str, list[Path]]] = {}
    for tool_id in sorted(tools):
        if tool_id == "claude-desktop":
            w, s, paths = _write_claude_desktop_marker(force, lockfile_path)
            results[tool_id] = (w, s, "marker", paths)
            continue
        plan = GLOBAL_DEPLOY_SOURCES.get(tool_id)
        if plan is None:
            # No deployable content yet for this tool in global scope.
            # `copilot` has no user-scope convention. `aider` is a single
            # YAML file (not a directory). `zed` / `jetbrains` have no
            # markdown-skills convention. Each prints an actionable hint.
            status = "hint" if tool_id in {"copilot", "aider", "zed", "jetbrains"} else "unsupported"
            results[tool_id] = (0, 0, status, [])
            continue
        anchor_raw = USER_SCOPE_PATHS.get(tool_id)
        if not anchor_raw:
            results[tool_id] = (0, 0, "unsupported", [])
            continue
        anchor = Path(anchor_raw).expanduser()
        written_total = 0
        skipped_total = 0
        written_paths: list[Path] = []
        for src_rel, dest_sub in plan:
            src = package_root / src_rel
            dest = anchor / dest_sub if dest_sub else anchor
            w, s, paths = _copy_dir_dereferencing_symlinks(
                src, dest, force, package_root=package_root,
            )
            written_total += w
            skipped_total += s
            written_paths.extend(paths)
        results[tool_id] = (written_total, skipped_total, "deployed", written_paths)
    return results


def install_global(
    tools: set[str],
    force: bool,
    project_root: Path | None = None,
) -> int:
    """User-scope install path (ADR-007 + Phase 1.6 lockfile lifecycle).

    Reads ``~/.config/agent-config/installed.lock`` first. A recorded
    version that does not match the running package version refuses the
    install with a remediation hint unless ``--force`` is passed. On
    success the lockfile is rewritten atomically with the current
    package version + the union of previously-recorded and now-installed
    tool IDs, then per-tool content (rules / skills / personas / etc.) is
    copied from the agent-config package into each tool's user-scope
    anchor (``GLOBAL_DEPLOY_SOURCES``). ``copilot`` is the lone headline
    exception — it has no user-scope convention, so it is reported with a
    hint pointing at ``agent-config export --tool=copilot``.

    When ``project_root`` points at a project tree (detected by the
    presence of ``.agent-settings.yml``), the project-scope manifest at
    ``agents/installed-tools.lock`` is also refreshed with ``scope=global``
    entries per ADR-008 Phase 3.2.
    """
    lock_mod = _load_installed_lock_module()
    installed_version = lock_mod.current_package_version()
    lock_path = lock_mod.lockfile_path()
    ok, recorded = lock_mod.check_version(installed_version, path=lock_path)

    if not ok and not force:
        if not QUIET:
            print()
            warn("Refusing global install: lockfile version mismatch.")
            info(f"  Lockfile:           {lock_path}")
            info(f"  Recorded version:   {recorded}")
            info(f"  Current package:    {installed_version}")
            info("  Fix:                run `agent-config update`")
            info("  Override:           re-run with `--force` (replaces the lockfile)")
            print()
        return 1

    if not QUIET:
        print()
        info("Agent Config — Global (user-scope) install [ADR-007]")
        info("Per-tool anchor paths:")
        for tool_id in sorted(tools):
            anchor = USER_SCOPE_PATHS.get(tool_id)
            if anchor is None:
                continue
            print(f"      {tool_id:<15} → {anchor}")

    existing = lock_mod.read_lockfile(path=lock_path) or {}
    existing_tools = list(existing.get("tools", []))
    merged_tools = sorted(set(existing_tools) | set(tools))
    written = lock_mod.write_lockfile(installed_version, merged_tools, path=lock_path)

    if not QUIET:
        print()
        info(f"Lockfile written: {written}")
        info(f"  schema_version=1, agent_config_version={installed_version}")
        info(f"  tools={','.join(merged_tools)}")

    # Deploy per-tool content into user-scope anchors. Sources resolve from
    # the agent-config package root (located via `__file__`, not the
    # caller's CWD); destinations are `USER_SCOPE_PATHS[tool_id]` (expanded).
    package_root = _resolve_package_root_for_global()
    deploy_results = _deploy_global_content(tools, force, package_root, written)

    if not QUIET:
        print()
        info("Deployed per-tool content:")
        for tool_id in sorted(deploy_results):
            w, s, status, _ = deploy_results[tool_id]
            anchor = USER_SCOPE_PATHS.get(tool_id, "")
            if status == "deployed":
                print(f"      {tool_id:<15} → {anchor} ({w} files, {s} skipped)")
            elif status == "marker":
                print(f"      {tool_id:<15} → {anchor}agent-config.md ({'written' if w else 'skipped'})")
            elif status == "hint":
                print(f"      {tool_id:<15} → no user-scope convention; use `agent-config export --tool={tool_id}`")
            else:
                print(f"      {tool_id:<15} → no global-scope content yet (project-scope install supported)")
        if not force and any(s > 0 for _, s, _, _ in deploy_results.values()):
            info("  Re-run with --force to overwrite existing files.")

    # Refresh the project-scope manifest when running inside a project tree
    # (ADR-008 Phase 3.2). Outside a project (e.g. plain `~/`) there is no
    # manifest to write and the global lockfile alone is the source of truth.
    # Skipped inside the agent-config source repo (detected by
    # `.agent-src.uncompressed/`) — maintainers dogfood with their own
    # `.agent-settings.yml` and the manifest would be untracked noise.
    if (
        project_root is not None
        and (project_root / SETTINGS_FILE).exists()
        and not (project_root / ".agent-src.uncompressed").is_dir()
    ):
        # Collect deployed/marker paths per tool so the manifest records
        # the v2 ``files[]`` inventory (P1.4).
        files_by_tool = _files_by_tool_from_deploy(
            deploy_results, project_root,
        )
        rc = _update_installed_tools_manifest(
            project_root, tools, "global", force,
            files_by_tool=files_by_tool,
        )
        if rc != 0:
            return rc

    if not QUIET:
        print()
        success("Global install completed.")
        print()
    return 0

# --- Argument parsing ---

def _merge_tools_aliases(tools: str | None, ai: str | None) -> str:
    """Merge --tools and --ai into a single comma-separated value.

    `--ai` is an alias for `--tools` (Phase 2.4 of the global-first
    roadmap). Both accepted; when both are passed the comma-separated
    values are unioned (order-preserving, deduplicated). When neither
    is passed the default `all` keeps the backward-compatible behaviour.
    """
    items: list[str] = []
    for raw in (tools, ai):
        if not raw:
            continue
        for piece in raw.split(","):
            stripped = piece.strip()
            if stripped and stripped not in items:
                items.append(stripped)
    return ",".join(items) if items else "all"


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
        "--tools",
        default=None,
        help=(
            "comma-separated tool IDs to install bridges for "
            "(claude-code,claude-desktop,cursor,windsurf,cline,gemini-cli,"
            "copilot,augment,aider,codex,roocode,continue,kilocode,zed,"
            "jetbrains,kiro,all). "
            "Default: all (backward-compatible)."
        ),
    )
    parser.add_argument(
        "--ai",
        default=None,
        help=(
            "alias for --tools (same IDs accepted). When both are passed "
            "the comma-separated values are unioned. Default: all."
        ),
    )
    parser.add_argument(
        "--no-smoke",
        action="store_true",
        help="skip the post-install hook smoke test (default: dry-fire dispatch:hook against every installed bridge)",
    )
    parser.add_argument(
        "--global",
        dest="global_install",
        action="store_true",
        help="install to user-scope paths (~/.claude/, ~/.cursor/, …) per ADR-007 instead of project-locally",
    )
    parser.add_argument(
        "--scope",
        choices=("project", "global", "prompt", "auto"),
        default=None,
        help=(
            "force install scope (overrides --global and detection): "
            "project = install into cwd; global = install into user-scope paths; "
            "prompt = force the interactive 3-option chooser; "
            "auto = honor detect_scope() output. Default: legacy "
            "(project unless --global, with auto-prompt on collision detection)."
        ),
    )
    parser.add_argument(
        "--custom-path",
        default=None,
        help=(
            "destination root for --scope=project when not the cwd "
            "(used by the 'Custom' branch of the scope chooser; ignored "
            "for --scope=global)."
        ),
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help=(
            "skip every network call: suppress the post-install update "
            "banner and set AGENT_CONFIG_OFFLINE=1 for downstream "
            "subprocesses (versions / update / future fetchers). "
            "All bridge content is bundled in the package, so install "
            "itself never touches the network — this flag is the "
            "explicit guarantee for air-gapped / CI runs."
        ),
    )
    opts = parser.parse_args(argv)
    opts.tools = _merge_tools_aliases(opts.tools, opts.ai)
    if opts.scope == "global" and opts.custom_path:
        fail("--custom-path is incompatible with --scope=global")
    if opts.global_install and opts.custom_path:
        fail("--custom-path is incompatible with --global")
    if opts.scope is not None and opts.global_install and opts.scope != "global":
        fail(f"--scope={opts.scope} conflicts with --global; pick one")
    return opts


# Mapping of --tools IDs accepted by install.py. Mirrors VALID_TOOLS in
# scripts/install. Bridges keyed off these IDs are gated; substrate
# bridges (vscode, augment) always run.
_VALID_TOOLS = {
    "claude-code", "claude-desktop", "cursor", "windsurf", "cline",
    "gemini-cli", "copilot", "augment", "aider", "codex", "roocode",
    "continue", "kilocode", "zed", "jetbrains", "kiro",
    # Phase 2.4 expansion (nextlevelbuilder/ui-ux-pro-max-skill anchors).
    "qoder", "opencode", "trae", "antigravity", "codebuddy", "droid", "warp",
    "all",
}


def _parse_tools(raw: str) -> set[str]:
    """Parse and validate --tools value. Returns set of normalized IDs.

    "all" expands to every concrete ID. Empty input is rejected.
    Unknown IDs raise SystemExit so the caller's message reaches stderr.
    """
    if not raw or not raw.strip():
        fail("--tools requires a non-empty value")
    items = [s.strip() for s in raw.split(",") if s.strip()]
    if not items:
        fail("--tools requires at least one ID")
    unknown = [s for s in items if s not in _VALID_TOOLS]
    if unknown:
        fail(f"--tools: unknown ID(s): {', '.join(unknown)} (valid: {', '.join(sorted(_VALID_TOOLS))})")
    if "all" in items:
        return {t for t in _VALID_TOOLS if t != "all"}
    return set(items)


def _tools_was_all(raw: str) -> bool:
    """True when the raw --tools value is the implicit/explicit `all` set.

    Used by _validate_scope() to decide between silent-filter (default
    install backward-compatible) and hard-reject (explicit list).
    """
    if not raw or not raw.strip():
        return False
    items = [s.strip() for s in raw.split(",") if s.strip()]
    return "all" in items


def _is_tool_enabled(tools: set[str], tool_id: str) -> bool:
    return tool_id in tools


# --- Main ---

def main(argv: list[str]) -> int:
    global QUIET

    opts = parse_options(argv)
    QUIET = opts.quiet

    # --offline: propagate via env so child subprocesses (versions /
    # update / check_update_banner) honor the air-gap guarantee
    # without each one needing its own flag. AGENT_CONFIG_NO_UPDATE_CHECK
    # is the canonical kill-switch for the post-install banner; the
    # broader AGENT_CONFIG_OFFLINE signals intent to future fetchers.
    if opts.offline:
        os.environ["AGENT_CONFIG_OFFLINE"] = "1"
        os.environ["AGENT_CONFIG_NO_UPDATE_CHECK"] = "1"

    if opts.profile not in SUPPORTED_PROFILES:
        fail(f"Unsupported profile: {opts.profile}. Supported: {', '.join(SUPPORTED_PROFILES)}")

    # Multi-signal scope detection (Phase 1.3) + scope resolution
    # (Phase 1.4). Order of precedence (highest first):
    #   1. --scope=<x>  — explicit user override (CI-friendly; auto = honor detection)
    #   2. --global     — legacy alias for --scope=global
    #   3. detect_scope() == "prompt" → interactive 3-option chooser (TTY only)
    #   4. Legacy default → project (preserved for backward compatibility)
    detect_root = Path(opts.project or os.environ.get("PROJECT_ROOT") or os.getcwd()).resolve()
    detected, detect_reason = detect_scope(detect_root)
    custom_path: Path | None = Path(opts.custom_path).resolve() if opts.custom_path else None
    scope = _resolve_scope(opts, detected, detect_reason, custom_path)

    # Scope validation runs before filesystem / package detection so
    # --tools=X / --scope conflicts fail fast with a directive error
    # instead of partial-state side effects (Phase 2.3).
    parsed_tools = _parse_tools(opts.tools)
    tools_was_all = _tools_was_all(opts.tools)
    parsed_tools = _validate_scope(parsed_tools, scope, tools_was_all)

    # Conflict policy: load known paths/pointers from the manifest once
    # so every writer can ask "is this ours?" before clobbering (P3.1 /
    # P3.3). Built from the project-scope manifest because that's the
    # only on-disk source of truth across both install scopes.
    policy_root = detect_root if scope == "global" else (
        custom_path or Path(opts.project or os.environ.get("PROJECT_ROOT") or os.getcwd()).resolve()
    )
    _set_conflict_policy(_load_conflict_policy(policy_root, opts.force))

    try:
        if scope == "global":
            # Pass detect_root so the manifest refresh runs when --global is
            # invoked from within a project tree (ADR-008 Phase 3.2).
            return install_global(parsed_tools, opts.force, project_root=detect_root)

        project_root = custom_path or Path(opts.project or os.environ.get("PROJECT_ROOT") or os.getcwd()).resolve()
        is_first_run = not (project_root / SETTINGS_FILE).exists()
        return _main_project_install(opts, project_root, parsed_tools, is_first_run)
    except ConflictAbort as exc:
        warn(exc.message)
        return 1
    finally:
        _set_conflict_policy(None)


def _main_project_install(
    opts: argparse.Namespace,
    project_root: Path,
    parsed_tools: set[str],
    is_first_run: bool,
) -> int:
    """Project-scope install body extracted from :func:`main`.

    Kept as a private helper so ``main()`` can wrap the entire install
    in a ``try/except ConflictAbort`` without rewriting indentation.
    """
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

    tools = parsed_tools

    # Per-tool merged_keys collected from JSON bridge merges (P1.5).
    merged_keys_by_tool: dict[str, list[dict[str, Any]]] = {}

    if not opts.skip_bridges:
        # Substrate bridges (always written; other tools symlink/depend on them).
        ensure_vscode_bridge(project_root, package_type, opts.force)
        merged_keys_by_tool["augment"] = ensure_augment_bridge(project_root, opts.force)
        # Tool-specific bridges (gated by --tools selection).
        if _is_tool_enabled(tools, "claude-code"):
            merged_keys_by_tool["claude-code"] = ensure_claude_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "cursor"):
            merged_keys_by_tool["cursor"] = ensure_cursor_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "cline"):
            ensure_cline_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "windsurf"):
            merged_keys_by_tool["windsurf"] = ensure_windsurf_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "gemini-cli"):
            merged_keys_by_tool["gemini-cli"] = ensure_gemini_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "copilot"):
            ensure_copilot_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "roocode"):
            ensure_roocode_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "claude-desktop"):
            ensure_claude_desktop_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "aider"):
            ensure_aider_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "codex"):
            ensure_codex_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "continue"):
            ensure_continue_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "kilocode"):
            ensure_kilocode_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "zed"):
            ensure_zed_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "jetbrains"):
            ensure_jetbrains_bridge(project_root, opts.force)
        if _is_tool_enabled(tools, "kiro"):
            ensure_kiro_bridge(project_root, opts.force)

    # User-scope hook bridges contribute additional merged_keys to the
    # same tool entry (P1.5) — the manifest tracks every JSON pointer
    # the install wrote, regardless of which file owns it.
    if opts.augment_user_hooks:
        merged_keys_by_tool.setdefault("augment", []).extend(
            ensure_augment_user_hooks(package_root, opts.force),
        )

    if opts.cursor_user_hooks and _is_tool_enabled(tools, "cursor"):
        merged_keys_by_tool.setdefault("cursor", []).extend(
            ensure_cursor_user_hooks(package_root, opts.force),
        )

    if opts.cline_user_hooks and _is_tool_enabled(tools, "cline"):
        ensure_cline_user_hooks(package_root, opts.force)

    if opts.windsurf_user_hooks and _is_tool_enabled(tools, "windsurf"):
        merged_keys_by_tool.setdefault("windsurf", []).extend(
            ensure_windsurf_user_hooks(package_root, opts.force),
        )

    if opts.gemini_user_hooks and _is_tool_enabled(tools, "gemini-cli"):
        merged_keys_by_tool.setdefault("gemini-cli", []).extend(
            ensure_gemini_user_hooks(package_root, opts.force),
        )

    if not opts.skip_bridges and not opts.no_smoke:
        if not QUIET:
            print()
            info("Smoke-testing installed hook bridges (dry-run)")
        _smoke_test_hooks(project_root, package_root)

    # Refresh the project-scope installed-tools manifest (ADR-008 Phase 3.2).
    # Runs after bridges are on disk so the manifest only lists tools whose
    # markers actually exist. Skipped when `--skip-bridges` was used (the
    # caller is exercising the install plan, not committing to it).
    if not opts.skip_bridges:
        files_by_tool = _files_by_tool_from_bridges(
            parsed_tools, project_root, "project",
        )
        rc = _update_installed_tools_manifest(
            project_root, parsed_tools, "project", opts.force,
            files_by_tool=files_by_tool,
            merged_keys_by_tool=merged_keys_by_tool,
        )
        if rc != 0:
            return rc

    if not QUIET:
        print()
        success("Done.")
        if is_first_run:
            print()
            print("  Try these 3 prompts with your agent:")
            print('    1. "Refactor this function"   → agent analyzes first')
            print('    2. "Add caching to this"      → agent asks instead of guessing')
            print('    3. "Implement this feature"   → agent respects your codebase')
            print()
            print("  Next steps:")
            print("    • Commit .agent-settings.yml and bridge files to your repo")
            print("    • New team members run `npx @event4u/agent-config init` — done")
            print("    • Inspect hook coverage: ./agent-config hooks:status")
            print("    • Full walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md")
            print()
        else:
            print("  Re-run complete. Walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md")
            print()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
