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
  python3 scripts/install.py                     # defaults: cost_profile=balanced
  python3 scripts/install.py --profile=minimal   # set cost_profile=minimal (kernel only)
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
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

try:
    from scripts._lib.json_pointers import build_merge_entries  # noqa: PLC0415
except ImportError:  # pragma: no cover — alt sys.path layout
    from _lib.json_pointers import build_merge_entries  # type: ignore[no-redef]  # noqa: PLC0415

DEFAULT_PROFILE = "balanced"
SUPPORTED_PROFILES = ("minimal", "balanced", "full")
COST_PROFILE_PLACEHOLDER = "__COST_PROFILE__"
USER_TYPE_PLACEHOLDER = "__USER_TYPE__"
USER_TYPES_DIR = "user-types"

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

# Machine-readable progress stream for the wizard `--apply-payload` real-apply
# bridge (road-to-single-install-source-of-truth § Phase 1). When True,
# `_emit_progress` writes NDJSON lines to stdout so the GUI can stream install
# progress; human-readable `info`/`success` output is suppressed via QUIET so
# the two never interleave (`warn`/`fail` still surface on stderr). Off for
# every normal CLI install.
PROGRESS_NDJSON = False


def _emit_progress(obj: "dict[str, Any]") -> None:
    """Write one NDJSON progress line to stdout when PROGRESS_NDJSON is on.

    No-op for normal CLI installs. The line shapes mirror the wizard SSE
    frames the GUI already consumes: per-unit
    ``{"type":"file","file":...,"status":...,"written":N,"total":M}`` and the
    terminal ``{"type":"done"|"error",...}``.
    """
    if not PROGRESS_NDJSON:
        return
    sys.stdout.write(json.dumps(obj, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def _emit_progress_terminal(rc: int) -> None:
    """Emit the terminal NDJSON frame for a real-apply run.

    rc == 0 → ``{"type":"done"}``; otherwise ``{"type":"error",...}``. No-op
    unless PROGRESS_NDJSON is on, so it is safe to call from every install
    return path.
    """
    if not PROGRESS_NDJSON:
        return
    if rc == 0:
        _emit_progress({"type": "done"})
    else:
        _emit_progress({"type": "error", "code": "E_INSTALL", "exitCode": rc})


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
    print(
        "      Diagnose: `./agent-config doctor` "
        "(or `--check <id>` for a single category)",
        file=sys.stderr,
    )
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


def _load_valid_user_types(package_root: Path) -> list[str]:
    """Return the sorted user-type slugs shipped under ``user-types/``.

    Maps `user-types/<id>.yml` → `<id>`. The ``README.md`` is skipped.
    Empty list when the directory is absent (older package payloads).
    """
    directory = package_root / USER_TYPES_DIR
    if not directory.is_dir():
        return []
    return sorted(p.stem for p in directory.glob("*.yml"))


def _validate_user_type(package_root: Path, value: str) -> str:
    """Return the validated user-type slug (empty string allowed → no filter)."""
    cleaned = (value or "").strip()
    if not cleaned:
        return ""
    valid = _load_valid_user_types(package_root)
    if not valid:
        fail(
            f"--user-type={cleaned} requested but no user-types/*.yml present "
            f"under {package_root}"
        )
    if cleaned not in valid:
        fail(
            f"Unknown --user-type={cleaned}. Valid: {', '.join(valid)} "
            "(empty string disables the filter)."
        )
    return cleaned


def _inject_packs(body: str, packs: "list[str]") -> str:
    """Insert a top-level ``packs:`` block into a rendered settings body.

    Inserted directly after the ``cost_profile:`` line so the active pack
    selection sits beside the other install-time knobs. No-op when ``packs``
    is empty — non-pack installs stay byte-identical to the template render.
    """
    if not packs:
        return body
    block = "packs:\n" + "".join(f"  - {p}\n" for p in packs)
    lines = body.splitlines(keepends=True)
    out: list[str] = []
    inserted = False
    for line in lines:
        out.append(line)
        if not inserted and line.startswith("cost_profile:"):
            if not line.endswith("\n"):
                out[-1] = line + "\n"
            out.append(block)
            inserted = True
    if not inserted:
        # No cost_profile anchor (unexpected) — append at the end so the
        # selection is still recorded rather than silently dropped.
        if out and not out[-1].endswith("\n"):
            out[-1] = out[-1] + "\n"
        out.append(block)
    return "".join(out)


def ensure_agent_settings(
    project_root: Path,
    package_root: Path,
    profile: str,
    force: bool,
    user_type: str = "",
    packs: "list[str] | None" = None,
) -> None:
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
    if USER_TYPE_PLACEHOLDER not in template:
        fail(f"Template is missing placeholder {USER_TYPE_PLACEHOLDER}")
    profile_values = _parse_profile_ini(profile_source)
    if profile_values.get("cost_profile") != profile:
        fail(
            f"Profile preset {profile_source.name} has cost_profile="
            f"{profile_values.get('cost_profile')!r} but --profile={profile}"
        )
    # Inject runtime-only values (not part of the .ini profile presets).
    profile_values["user_type"] = _validate_user_type(package_root, user_type)
    template_body = _render_template(template, profile_values)
    template_body = _inject_packs(template_body, packs or [])

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
    user_type_value = profile_values.get("user_type", "")
    suffix = f", user_type={user_type_value}" if user_type_value else ""
    success(f"{SETTINGS_FILE} created (cost_profile={profile}{suffix})")


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
# contract from agents/settings/contexts/hardening-pattern.md § Cross-platform
# parity.
# Canonical Claude Code plugin id — must match `.claude-plugin/marketplace.json`
# (`<plugin>@<marketplace>` = `agent-config` + `event4u-agent-config`) and the
# install command documented in `docs/installation.md`.
CLAUDE_PLUGIN_ID = "agent-config@event4u-agent-config"

# Stale plugin ids written by pre-4.x installer versions. The bridge removes
# any of these from `enabledPlugins` on rerun so the canonical id alone
# survives. Claude Code silently ignores unresolvable ids (no marketplace
# match), so a stale entry leaves the plugin inactive without an error path
# the user can see — the heal is the only feedback loop.
CLAUDE_LEGACY_PLUGIN_IDS: tuple[str, ...] = (
    "agent-conf@event4u",      # abbreviated form — never matched a real marketplace
    "agent-config@event4u",    # pre-marketplace-rename form (missing `-agent-config` suffix)
)


def _heal_legacy_claude_plugin_ids(path: Path) -> list[str]:
    """Remove known-stale plugin ids from `.claude/settings.json` in place.

    Reads the existing settings file, drops any `enabledPlugins` key whose
    id appears in `CLAUDE_LEGACY_PLUGIN_IDS`, and writes the file back
    when anything changed. Returns the list of removed ids so the caller
    can surface a `success(...)` per heal and treat the operation as a
    forced refresh for the subsequent `merge_json_file` call.

    No-ops when the file is absent, malformed, or carries no stale ids.
    The canonical id is left untouched.
    """
    if not path.exists():
        return []
    data = read_json_file(path)
    enabled = data.get("enabledPlugins")
    if not isinstance(enabled, dict):
        return []
    removed = [pid for pid in CLAUDE_LEGACY_PLUGIN_IDS if pid in enabled]
    if not removed:
        return []
    for pid in removed:
        del enabled[pid]
    write_json_file(path, data)
    return removed


def ensure_claude_bridge(project_root: Path, force: bool) -> list[dict[str, Any]]:
    """Deploy .claude/settings.json with plugin enablement only.

    Claude lifecycle hooks are delivered via **plugin scope**
    (`hooks/hooks.json`, generated by `condense.generate_plugin_hooks`), not
    written into the shared `.claude/settings.json` `hooks` array. Writing
    them here would monopolise that array and collide with any neighbour
    tool's hooks or a developer's `settings.local.json` — Claude Code merges
    plugin-scope and settings-scope hooks at runtime and dedups by command
    string, so plugin delivery needs no `hooks` block here.

    The plugin id matches `.claude-plugin/marketplace.json`
    (`<plugin>@<marketplace>` = `agent-config@event4u-agent-config`) and the
    documented install command in docs/installation.md. Idempotent:
    `enabledPlugins` is a dict-merge, so the key coexists with any other
    plugin a neighbour tool enabled.

    Stale-id heal: before the merge, any pre-4.x ids listed in
    `CLAUDE_LEGACY_PLUGIN_IDS` are removed from `enabledPlugins`. A heal
    self-authorises the corrective merge — the merge runs with effective
    force so the canonical id lands in the same install, even without
    `--force` on the CLI.
    """
    target = project_root / ".claude" / "settings.json"
    healed = _heal_legacy_claude_plugin_ids(target)
    for pid in healed:
        success(f".claude/settings.json: removed stale plugin id `{pid}`")
    bridge = {
        "enabledPlugins": {CLAUDE_PLUGIN_ID: True},
    }
    return merge_json_file(
        target, bridge, force or bool(healed), ".claude/settings.json",
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
# fallback per agents/settings/contexts/chat-history-platform-hooks.md.
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
    via agents/runtime/state/.dispatcher/.
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
# Formalized as scope=global-only via SCOPE_SUPPORT (Phase 3.1 of
# road-to-global-only-install — consumer installs are global-only).
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


# Per-tool scope support per ADR-007 matrix + ADR-020 consumer global-only
# amendment. Values: "both" · "project" · "global". Used by _validate_scope()
# to reject explicit `--tools=X` selections that conflict with the chosen
# scope. `--tools=all` silently filters incompatible IDs so the default
# install path stays backward-compatible.
#
# road-to-global-only-install § Phase 3.1 — consumer installs are
# global-only. Every AI ID with a user-scope convention is pinned to
# "global". Maintainers can still drive project-scope installs by
# setting AGENT_CONFIG_DEV_MODE=1 — `_enforce_consumer_global_only`
# gates the scope before validation, so the SCOPE_SUPPORT matrix is the
# canonical declaration of "where this tool is allowed to write."
#
# Exception:
#   - copilot is "both" because GitHub Copilot has no user-scope
#     convention for instructions — `copilot-instructions.md` lives
#     in-repo by design. Project scope still requires
#     AGENT_CONFIG_DEV_MODE=1 (consumer-floor gate); the "both" value
#     keeps the gate at the env-flag layer rather than the matrix layer.
SCOPE_SUPPORT = {
    "claude-code":    "global",
    "claude-desktop": "global",
    "cursor":         "global",
    "windsurf":       "global",
    "cline":          "global",
    "gemini-cli":     "global",
    # GitHub Copilot ships `copilot-instructions.md` in-repo by design
    # — no user-scope convention exists. Project scope stays available
    # but is gated by AGENT_CONFIG_DEV_MODE=1 via the consumer-floor
    # check, not by the matrix.
    "copilot":        "both",
    # `augment` is global-only by design: a single user-scope deploy to
    # `~/.augment/` is the canonical surface. The package owner accepts
    # that the full rule set exceeds Augment's 49,512-char workspace-
    # guidelines limit — the overflow is a known, surfaced trade-off
    # (see ADR-007 § Amendment 2026-05-13 — global-only). Project-scope
    # installs are rejected so the per-repo `.augment/` surface stays
    # out of the install matrix entirely.
    "augment":        "global",
    "aider":          "global",
    "codex":          "global",
    "roocode":        "global",
    "continue":       "global",
    "kilocode":       "global",
    "zed":            "global",
    "jetbrains":      "global",
    "kiro":           "global",
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
# nextlevelbuilder/ui-ux-pro-max-skill) deploy the universal Anthropic-
# shaped skill bundle — sourced from ``.agent-src/`` (the npm-shipped
# canonical asset tree) — into ``<anchor>/skills/`` (or
# ``<anchor>/steering/`` for kiro). ``.agent-src/rules`` is also copied
# where the destination is a true rules-aware tool root.
#
# All source paths reference ``.agent-src/<subdir>`` because that is the
# only asset tree included in the npm tarball (see ``package.json#files``).
# The legacy ``.augment/``, ``.claude/``, ``.cursor/`` projections only
# exist in the development checkout — they are not shipped.
_CLAUDE_SKILL_BUNDLE: list[tuple[str, str]] = [
    (".agent-src/rules",    "rules"),
    (".agent-src/skills",   "skills"),
    # Commands ship to the native Claude Code user-scope slash-command
    # surface: `~/.claude/commands/<cluster>/<sub>.md` resolves as
    # `/<cluster>:<sub>` per Claude Code's filesystem-channel convention
    # (verified empirically 2026-05-28: top-level + nested + rich
    # frontmatter all route; heavyweight commands carrying
    # `disable-model-invocation: true` stay invokable when typed but are
    # hidden from auto-complete — desired UX). Council session
    # 2026-05-28 (claude-sonnet-4-5 + gpt-4o, design mode) verdict
    # Option B (native slash-only). See
    # `agents/runtime/council/responses/claude-code-distribution.json`.
    (".agent-src/commands", "commands"),
    (".agent-src/personas", "personas"),
]
GLOBAL_DEPLOY_SOURCES: dict[str, list[tuple[str, str]]] = {
    "claude-code": _CLAUDE_SKILL_BUNDLE,
    "augment": [
        (".agent-src/rules",     "rules"),
        (".agent-src/skills",    "skills"),
        (".agent-src/commands",  "commands"),
        (".agent-src/contexts",  "contexts"),
        (".agent-src/personas",  "personas"),
        (".agent-src/templates", "templates"),
    ],
    "cursor": [
        (".agent-src/rules",    "rules"),
        (".agent-src/commands", "commands"),
        (".agent-src/personas", "personas"),
    ],
    "windsurf": [
        (".agent-src/rules", "rules"),
    ],
    "cline": [
        (".agent-src/rules", ""),
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
        (".agent-src/rules",    "rules"),
        (".agent-src/skills",   "steering"),
        (".agent-src/personas", "personas"),
    ],
}


# Marker body written to the Claude Desktop user-scope directory. Claude
# Desktop has no rules/skills filesystem convention; the marker advertises
# the agent-config install for downstream tooling and gives users a stable
# pointer to the lockfile.
_CLAUDE_DESKTOP_MARKER_TEMPLATE = """\
# agent-config — Claude Desktop marker

Installed by `@event4u/agent-config` (user scope, ADR-007).

- Lockfile:    `{lockfile}`
- Anchor:      `{anchor}`
- Skill bundles: `{bundles_dir}` ({bundle_count} ZIPs)

## Import skills into Claude Desktop

Claude Desktop has no filesystem skill-discovery convention — skills are
imported manually via the Customize → Skills UI.

1. Open Claude Desktop → **Settings → Customize → Skills**.
2. Click the **Upload skill** button.
3. Browse to `{bundles_dir}` and pick the `<skill-name>.zip` files you
   want to install. One ZIP = one skill.
4. Repeat per skill. Claude Desktop keeps each upload until you remove it.

The bundle directory is regenerated on every
`npx @event4u/agent-config init --tools=claude-desktop` run (only
changed skills are rewritten — content-hash idempotency).

To remove this marker, delete this file.
"""

#: Subpath under ``~/.event4u/agent-config/`` where Claude Desktop ZIP
#: bundles are written. Kept separate from the per-tool USER_SCOPE_PATHS
#: anchor (which is the Claude Desktop config dir) because bundles are
#: package-owned, not Claude-owned, content.
_CLAUDE_DESKTOP_BUNDLES_SUBPATH = "claude-desktop/bundles"

#: road-to-global-only-install § Phase 2.1 — canonical global path
#: constants. Single source of truth for the user-scope settings file
#: locations. Used by the settings reader (Python + TypeScript via
#: docs/contracts/settings-api.md) to merge ``defaults < global <
#: project-overrides``.
GLOBAL_ROOT = Path.home() / ".event4u" / "agent-config"
GLOBAL_USER_SETTINGS_PATH = GLOBAL_ROOT / ".agent-user.yml"
GLOBAL_AGENT_SETTINGS_PATH = GLOBAL_ROOT / ".agent-settings.yml"


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

    Maintainer dev mode (``AGENT_CONFIG_DEV_MODE=1``) bypasses the matrix
    filter entirely. Per ``docs/maintainers/dev-mode.md`` the flag
    "allows project-scope writes back into the repo tree" — that
    contract requires the full bridge surface (cursor / cline / windsurf
    / gemini-cli / …) to remain reachable under ``--project`` so
    ``task dev:install-global`` can dogfood every projection. The
    consumer-facing gate already runs upstream via
    ``_enforce_consumer_global_only``; reaching this function with
    ``scope == "project"`` means the dev gate already approved the
    write, so the matrix filter would be double-gating maintainer flows.
    """
    if scope not in ("project", "global"):
        fail(f"_validate_scope: unknown scope '{scope}'")
    if os.environ.get("AGENT_CONFIG_DEV_MODE") == "1":
        return tools
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


def _enforce_consumer_global_only(scope: str) -> None:
    """road-to-global-only-install § Phase 3.2 — gate the project scope.

    Consumer installs ship global-only (ADR-020). The legacy project
    scope stays available for maintainers via ``AGENT_CONFIG_DEV_MODE=1``
    so the dogfood-on-this-repo loop keeps working. Anything else
    routing through the orchestrator with ``scope == "project"`` aborts
    with a directive error pointing at the maintainer doc.

    Pure side-effect gate — separate from ``_resolve_scope`` so the
    unit-tested resolver stays a pure function of its inputs.
    """
    if scope != "project":
        return
    if os.environ.get("AGENT_CONFIG_DEV_MODE") == "1":
        return
    fail(
        "--scope=project is reserved for maintainers (ADR-020 — consumer "
        "installs are global-only). Set AGENT_CONFIG_DEV_MODE=1 to opt in. "
        "See docs/maintainers/dev-mode.md."
    )


# --- road-to-global-only-install § Phase 2.2 — three-layer settings reader ---
#
# Merge order (per ADR-020 / D9):
#
#     defaults  <  global  <  project-overrides
#
# The defaults layer is the rendered template body in
# ``config/agent-settings.template.yml``. The global layer is
# ``~/.event4u/agent-config/.agent-settings.yml``. The project layer is
# ``<project_root>/.agent-settings.yml`` — tolerated but no longer
# required to exist. Any layer that is missing or unparseable falls back
# to an empty dict so the merge stays total.
#
# The TypeScript wizard route ``GET /api/v1/wizard/settings`` mirrors the
# same precedence (see :mod:`src.server.routes.wizard`) so the Python
# installer and the Fastify server agree on what *the user's effective
# settings* look like at any given moment.

def _load_yaml_doc(path: Path) -> dict:
    """Load a YAML file as a dict; return ``{}`` on every recoverable error.

    Used by the three-layer settings reader. Mirrors the defensive shape
    of :func:`scripts.config.profiles._load_yaml`: missing PyYAML, missing
    file, parse error, or non-dict root all collapse to an empty dict so
    callers can blindly :func:`deep_merge` the result without guards.
    """
    try:
        import yaml  # type: ignore[import-not-found]
    except ImportError:
        return {}
    if not path.exists() or not path.is_file():
        return {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return {}
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError:
        return {}
    return data if isinstance(data, dict) else {}


def _load_default_settings(package_root: Path) -> dict:
    """Parse the rendered settings template into a defaults dict.

    The template carries ``__COST_PROFILE__`` / ``__USER_TYPE__``
    placeholders that PyYAML cannot parse as scalars. We substitute the
    most permissive defaults (``balanced`` + empty user_type) before
    parsing — the resulting tree is the *defaults* layer of the merge,
    and downstream layers overwrite cost_profile / user_type as needed.
    """
    template_source = package_root / "config" / "agent-settings.template.yml"
    if not template_source.exists():
        return {}
    try:
        text = template_source.read_text(encoding="utf-8")
    except OSError:
        return {}
    rendered = text.replace(COST_PROFILE_PLACEHOLDER, DEFAULT_PROFILE).replace(
        USER_TYPE_PLACEHOLDER, ""
    )
    try:
        import yaml  # type: ignore[import-not-found]
    except ImportError:
        return {}
    try:
        data = yaml.safe_load(rendered)
    except yaml.YAMLError:
        return {}
    return data if isinstance(data, dict) else {}


def read_layered_settings(
    package_root: Path,
    project_root: "Path | None" = None,
) -> dict:
    """Three-layer settings merge — ``defaults < global < project``.

    ``project_root`` is optional: when ``None`` (or the project file is
    absent), the merge collapses to ``defaults < global`` so a consumer
    who installs global-only sees the same effective settings the
    Fastify server would surface. Always returns a dict — never raises.

    Used by :func:`main` to compute the effective configuration before
    rendering per-tool bridges, and by the Phase 2.4 ``settings migrate``
    subcommand to detect which keys are local-only overrides.
    """
    merged = _load_default_settings(package_root)
    merged = deep_merge(merged, _load_yaml_doc(GLOBAL_AGENT_SETTINGS_PATH))
    if project_root is not None:
        project_file = project_root / SETTINGS_FILE
        merged = deep_merge(merged, _load_yaml_doc(project_file))
    return merged


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


def _load_user_global_paths_module():
    """Lazy-import ``scripts._lib.user_global_paths`` (Phase 3 migration shim)."""
    pkg_root = str(Path(__file__).resolve().parents[1])
    if pkg_root not in sys.path:
        sys.path.insert(0, pkg_root)
    from scripts._lib import user_global_paths  # noqa: WPS433 — lazy by design
    return user_global_paths


def _load_claude_desktop_bundler_module():
    """Lazy-import ``scripts._lib.claude_desktop_bundler`` (Phase 4 ZIP bundler)."""
    pkg_root = str(Path(__file__).resolve().parents[1])
    if pkg_root not in sys.path:
        sys.path.insert(0, pkg_root)
    from scripts._lib import claude_desktop_bundler  # noqa: WPS433 — lazy by design
    return claude_desktop_bundler


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


#: Consumer bridge marker filename, relative to the project root.
#: Spec: docs/contracts/consumer-bridge.md (event4u-bridge/v1).
CONSUMER_BRIDGE_MARKER_RELPATH = Path("agents") / ".event4u-bridge.yml"


# ---------------------------------------------------------------------------
# First-run migration hook
# ---------------------------------------------------------------------------
#
# Legacy artefacts that signal a pre-ADR-020 install in the project root.
# Same surface the unified ``migrate`` command detects (see
# ``scripts/_cli/cmd_migrate.py`` and ``docs/contracts/migrate-command.md``).
# Kept in sync intentionally so the prompt and the migration tool agree on
# what counts as "legacy".
MIGRATE_LEGACY_YAML_FILES = (".agent-settings.yml", ".agent-user.yml")
MIGRATE_LEGACY_TOOL_DIRS = (".augment", ".claude", ".cursor")


# Package identity used by the maintainer auto-detect. Matches the npm
# package name declared in ``package.json`` at the agent-config source
# repo root. Refreshing this value requires a coordinated rename
# (package.json + this constant + the publish pipeline).
AGENT_CONFIG_PACKAGE_NAME = "@event4u/agent-config"


def _is_agent_config_source_repo(project_root: Path) -> tuple[bool, str]:
    """Return ``(is_source_repo, signature)`` for the maintainer auto-detect.

    Phase Q1 of road-to-claude-code-global-distribution (council Option D —
    Hybrid auto-detect): treat any of these high-specificity signatures as
    proof that ``project_root`` is the agent-config source repo, not a
    consumer project. Hits skip the ADR-020 migration prompt automatically
    so a maintainer running the wizard does not get their working tree
    moved into ``.legacy-pre-global-only/``.

    Signatures, in order of cost (cheap-first short-circuit):

    1. ``package.json`` declares ``"name": "@event4u/agent-config"``.
       Strongest signal — the npm-published identity of this repo.
    2. ``.agent-src.uncondensed/`` exists at ``project_root`` (legacy
       layout) OR under ``packages/*/`` (current layout). Both shapes
       are unique to the source repo.
    3. ``scripts/install.py`` exists at ``project_root`` AND the file
       name matches this module (``__file__``). Self-referential — if
       the installer code path is reading itself, the cwd is the repo
       that owns the installer.

    The user can force consumer behaviour via ``AGENT_CONFIG_CONSUMER_MODE=1``
    when testing the wizard's consumer flow from inside the maintainer
    checkout (end-to-end QA path).
    """
    if os.environ.get("AGENT_CONFIG_CONSUMER_MODE") == "1":
        return False, "consumer-mode-override"

    pkg_json = project_root / "package.json"
    if pkg_json.is_file():
        try:
            data = json.loads(pkg_json.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            data = {}
        if isinstance(data, dict) and data.get("name") == AGENT_CONFIG_PACKAGE_NAME:
            return True, "package.json:name"

    if (project_root / ".agent-src.uncondensed").is_dir():
        return True, ".agent-src.uncondensed/"
    packages_dir = project_root / "packages"
    if packages_dir.is_dir():
        for child in packages_dir.iterdir():
            if (child / ".agent-src.uncondensed").is_dir():
                return True, f"packages/{child.name}/.agent-src.uncondensed/"

    installer_self = project_root / "scripts" / "install.py"
    try:
        if installer_self.is_file() and installer_self.resolve() == Path(__file__).resolve():
            return True, "scripts/install.py (self)"
    except OSError:
        pass

    return False, ""


def _detect_legacy_for_migration(project_root: Path) -> list[str]:
    """Return a sorted list of legacy artefact relpaths present in ``project_root``.

    Skipped (returns ``[]``) when:

    - ``AGENT_CONFIG_DEV_MODE=1`` is set (maintainer dogfood loop),
    - ``project_root`` IS the agent-config source repo per
      :func:`_is_agent_config_source_repo` (council Option D auto-detect),
    - the bridge marker already exists (project is already global-only).
    """
    if os.environ.get("AGENT_CONFIG_DEV_MODE") == "1":
        return []

    is_source, signature = _is_agent_config_source_repo(project_root)
    if is_source:
        if not QUIET:
            warn(
                "Maintainer mode auto-detected — agent-config source repo "
                f"(signature: {signature}). Skipping ADR-020 migration "
                "prompt; the working tree stays intact. Set "
                "AGENT_CONFIG_CONSUMER_MODE=1 to override for end-to-end "
                "consumer-flow testing."
            )
        return []

    if (project_root / CONSUMER_BRIDGE_MARKER_RELPATH).is_file():
        return []

    found: list[str] = []
    for name in MIGRATE_LEGACY_YAML_FILES:
        if (project_root / name).is_file():
            found.append(name)
        elif (project_root / "settings" / name).is_file():
            found.append(f"settings/{name}")
    for name in MIGRATE_LEGACY_TOOL_DIRS:
        p = project_root / name
        if p.is_dir() and not p.is_symlink():
            found.append(f"{name}/")
    return sorted(found)


def _prompt_migrate_to_global(project_root: Path, artefacts: list[str]) -> bool:
    """Ask the user whether to run the unified ``migrate`` command now.

    Interactive TTY → ``[Y/n]`` prompt (Enter = yes). Non-interactive (CI
    or no TTY) → auto-yes. Three invalid replies short-circuit to "no"
    (defensive, never blocks the install). The function name is kept for
    compatibility with the install flow; the legacy ``migrate-to-global``
    command was collapsed into the unified ``migrate`` (see
    ``docs/contracts/migrate-command.md``).
    """
    if not QUIET:
        print()
        warn("Legacy project-local artefacts detected — pre-ADR-020 layout:")
        for rel in artefacts:
            info(f"  {project_root / rel}")
        info("The unified `agent-config migrate` sweeps these in one pass.")
        info("The wizard recreates fresh config afterwards.")

    if not _is_interactive():
        if not QUIET:
            info("Non-interactive mode → defaulting to YES (run migration).")
        return True

    attempts = 0
    while attempts < 3:
        try:
            reply = _read_line("Run `agent-config migrate` now? [Y/n]: ")
        except EOFError:
            return False
        if reply == "" or reply.lower() in ("y", "yes"):
            return True
        if reply.lower() in ("n", "no"):
            return False
        attempts += 1
        warn(f"Invalid choice '{reply}'. Enter Y or n.")
    return False


def _run_migrate_to_global(project_root: Path) -> int:
    """Invoke the unified ``cmd_migrate`` against ``project_root``.

    Returns the migrator's exit code so the caller can abort the install
    on failure. The function name is kept for compatibility with the
    install flow; the legacy ``migrate-to-global`` command was collapsed
    into the unified ``migrate`` (see ``docs/contracts/migrate-command.md``).
    """
    import importlib  # noqa: PLC0415 — local to keep startup lean.

    try:
        cmd_mod = importlib.import_module("scripts._cli.cmd_migrate")
    except ImportError as exc:
        warn(f"migrate unavailable: {exc}")
        return 1

    return cmd_mod.main([], cwd=project_root, out=sys.stdout)


def _format_global_root_for_marker(global_root: Path) -> str:
    """Render ``global_root`` for the bridge marker.

    Per ``docs/contracts/consumer-bridge.md``, readers MUST expand ``~``
    against the **current process's** ``$HOME``. To keep the marker
    portable across maintainer home dirs, render the path with a
    leading ``~/`` when it lives under ``Path.home()``; fall back to
    the absolute path otherwise (e.g. ``EVENT4U_CONFIG_HOME`` override
    pointing outside ``$HOME``).
    """
    try:
        rel = global_root.resolve().relative_to(Path.home().resolve())
    except ValueError:
        return str(global_root)
    return f"~/{rel.as_posix()}"


def _write_consumer_bridge_marker(
    project_root: Path,
    installer_version: str,
    *,
    env: Optional[dict] = None,
    now: Optional[datetime] = None,
) -> Optional[Path]:
    """Write ``agents/.event4u-bridge.yml`` at the consumer project root.

    Returns the written path, or ``None`` when the write was skipped per
    ``docs/contracts/consumer-bridge.md`` § Writer contract:

    - ``AGENT_CONFIG_DEV_MODE=1`` (maintainer dev installs never lay the
      bridge into the source repo).
    - The project root is the agent-config source repo itself
      (``.agent-src.uncondensed/`` present) — same rationale.

    Atomic write: ``tempfile`` in the same dir + ``os.replace``. Same
    pattern the lockfile uses (see ``scripts/_lib/installed_lock.py``).
    Mode ``0o644`` per contract — no secrets, world-readable.
    """
    import tempfile

    env_map = env if env is not None else os.environ
    if env_map.get("AGENT_CONFIG_DEV_MODE") == "1":
        return None
    if (project_root / ".agent-src.uncondensed").is_dir():
        return None

    paths_mod = _load_user_global_paths_module()
    global_root_str = _format_global_root_for_marker(paths_mod.event4u_root(env=env_map))
    stamp = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")

    body = (
        "# event4u/agent-config — consumer bridge marker (auto-written).\n"
        "# Spec: docs/contracts/consumer-bridge.md (event4u-bridge/v1).\n"
        "# Reader contract: expand ~ against the current $HOME; fail closed\n"
        "# when global_root is missing on disk; never write back through it.\n"
        "schema: event4u-bridge/v1\n"
        f"global_root: {global_root_str}\n"
        f"installed_at: {stamp}\n"
        f"installer_version: {installer_version}\n"
    )

    target = project_root / CONSUMER_BRIDGE_MARKER_RELPATH
    target.parent.mkdir(parents=True, exist_ok=True)

    fd, tmp_name = tempfile.mkstemp(
        prefix=".event4u-bridge.", suffix=".yml.tmp",
        dir=str(target.parent), text=False,
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(body)
        os.chmod(tmp_name, 0o644)
        os.replace(tmp_name, target)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
    return target


#: Per-tool project anchors (Phase 4.3). Some AI tools only load rules
#: when an anchor file is **inside** the workspace. For those IDs we
#: plant a thin pointer file under the tool's per-project directory
#: whose body references the bridge marker (``agents/.event4u-bridge.yml``).
#: Tools that load purely from user-scope (Claude Code, Cursor, Augment)
#: read the marker once and need no per-tool file — they are absent
#: from this map by design (see ``docs/contracts/consumer-bridge.md``
#: § Per-tool anchor strategy).
PROJECT_ANCHOR_TOOLS: dict[str, str] = {
    "windsurf":   ".windsurf/agent-config.bridge.yml",
    "cline":      ".clinerules/agent-config.bridge.yml",
    "gemini-cli": ".gemini/agent-config.bridge.yml",
}


def _write_per_tool_project_anchors(
    project_root: Path,
    tools: set[str],
    *,
    env: Optional[dict] = None,
    now: Optional[datetime] = None,
) -> list[Path]:
    """Plant thin pointer files for tools in :data:`PROJECT_ANCHOR_TOOLS`.

    Each pointer is a tiny YAML body that references the bridge marker
    at ``agents/.event4u-bridge.yml`` (relative from the pointer's
    location) plus the resolved ``global_root`` for convenience. Same
    gate semantics as :func:`_write_consumer_bridge_marker`:

    - Skipped under ``AGENT_CONFIG_DEV_MODE=1``.
    - Skipped inside the agent-config source repo
      (``.agent-src.uncondensed/`` present).
    - Skipped when the tool is not in ``tools``.

    Atomic write per file (temp file + ``os.replace``); ``0o644``
    permissions per ``docs/contracts/consumer-bridge.md`` (the pointers
    contain no secrets, only paths).
    """
    import tempfile

    env_map = env if env is not None else os.environ
    if env_map.get("AGENT_CONFIG_DEV_MODE") == "1":
        return []
    if (project_root / ".agent-src.uncondensed").is_dir():
        return []

    paths_mod = _load_user_global_paths_module()
    global_root_str = _format_global_root_for_marker(paths_mod.event4u_root(env=env_map))
    stamp = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")
    written: list[Path] = []

    for tool_id, rel_path in sorted(PROJECT_ANCHOR_TOOLS.items()):
        if tool_id not in tools:
            continue
        target = project_root / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)

        # Relative path from the pointer file back to the bridge marker.
        # Both live inside ``project_root``; ``os.path.relpath`` keeps the
        # result portable across machines (no absolute path leakage).
        bridge_abs = project_root / CONSUMER_BRIDGE_MARKER_RELPATH
        bridge_rel = os.path.relpath(bridge_abs, target.parent)

        body = (
            "# event4u/agent-config — per-tool project anchor (auto-written).\n"
            "# Spec: docs/contracts/consumer-bridge.md § Per-tool anchor strategy.\n"
            f"# Tool: {tool_id}. Bridge marker: agents/.event4u-bridge.yml.\n"
            "schema: event4u-bridge/v1\n"
            f"tool: {tool_id}\n"
            f"bridge: {bridge_rel}\n"
            f"global_root: {global_root_str}\n"
            f"installed_at: {stamp}\n"
        )

        fd, tmp_name = tempfile.mkstemp(
            prefix=".agent-config.bridge.", suffix=".yml.tmp",
            dir=str(target.parent), text=False,
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(body)
            os.chmod(tmp_name, 0o644)
            os.replace(tmp_name, target)
        except Exception:
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
            raise
        written.append(target)

    return written


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


def _claude_desktop_bundles_dir() -> Path:
    """Return the canonical bundle output dir under the event4u namespace.

    Located via :func:`user_global_paths.write_target` so the path
    honours the ``EVENT4U_HOME`` env override used by tests.
    """
    paths_mod = _load_user_global_paths_module()
    return paths_mod.write_target(_CLAUDE_DESKTOP_BUNDLES_SUBPATH)


def _write_claude_desktop_marker(
    force: bool,
    lockfile_path: Path,
    *,
    bundles_dir: Path,
    bundle_count: int,
) -> tuple[int, int, list[Path]]:
    """Write the Claude Desktop user-scope marker file.

    Returns ``(written, skipped, written_paths)`` for symmetry with the
    tree copier (P1.4). The marker points users at ``bundles_dir`` for
    the Customize → Skills import flow (Phase 4). Existing markers are
    overwritten unconditionally because the bundle count is part of the
    body and we want it to stay current.
    """
    anchor = Path(USER_SCOPE_PATHS["claude-desktop"]).expanduser()
    target = anchor / "agent-config.md"
    anchor.mkdir(parents=True, exist_ok=True)
    body = _CLAUDE_DESKTOP_MARKER_TEMPLATE.format(
        lockfile=str(lockfile_path),
        anchor=str(anchor),
        bundles_dir=str(bundles_dir),
        bundle_count=bundle_count,
    )
    target.write_text(body, encoding="utf-8")
    return (1, 0, [target])


def _deploy_claude_desktop(
    force: bool, package_root: Path, lockfile_path: Path,
) -> tuple[int, int, str, list[Path]]:
    """Build skill ZIP bundles + write the marker for ``claude-desktop``.

    Phase 4 of road-to-event4u-namespace-and-claude-desktop. Bundles
    land in ``~/.event4u/agent-config/claude-desktop/bundles/``; the
    marker file in the Claude Desktop config dir points at them with
    Customize → Skills import instructions.

    Returns ``(bundle_count, 0, "deployed", [bundles_dir, marker])``.
    The ``deployed`` status replaces the v2.3 ``marker``-only status.
    """
    bundler = _load_claude_desktop_bundler_module()
    bundles_dir = _claude_desktop_bundles_dir()
    bundler.build_skill_bundles(package_root, bundles_dir, force=force)
    bundler.build_command_bundles(package_root, bundles_dir, force=force)
    # Count total existing ZIPs (idempotent runs may not rewrite any).
    bundle_count = sum(1 for _ in bundles_dir.glob("*.zip")) if bundles_dir.is_dir() else 0
    _, _, marker_paths = _write_claude_desktop_marker(
        force, lockfile_path, bundles_dir=bundles_dir, bundle_count=bundle_count,
    )
    return (bundle_count, 0, "deployed", [bundles_dir, *marker_paths])


def _deploy_global_content(
    tools: set[str],
    force: bool,
    package_root: Path,
    lockfile_path: Path,
) -> dict[str, tuple[int, int, str, list[Path]]]:
    """Deploy per-tool content into user-scope anchors for ``tools``.

    For each tool in ``tools`` that has a ``GLOBAL_DEPLOY_SOURCES`` entry,
    copies the listed package subtrees into ``USER_SCOPE_PATHS[tool_id]``
    (expanded). For ``claude-desktop`` builds per-skill ZIP bundles under
    ``~/.event4u/agent-config/claude-desktop/bundles/`` and writes the
    marker file pointing at them (Phase 4). For tools without a deployment
    plan (e.g. ``copilot``), records a ``hint`` status so the caller can
    print an actionable next step.

    Returns ``{tool_id: (written, skipped, status, written_paths)}``
    where ``status`` is one of ``deployed``, ``hint``, ``unsupported``
    and ``written_paths`` is the absolute path list of every file the
    deploy actually wrote (P1.4).
    """
    results: dict[str, tuple[int, int, str, list[Path]]] = {}
    for tool_id in sorted(tools):
        if tool_id == "claude-desktop":
            results[tool_id] = _deploy_claude_desktop(force, package_root, lockfile_path)
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
        # Phase 5 (road-to-claude-code-global-distribution): postcheck.
        # Every entry in the deploy plan must end with the destination
        # subpath populated — directory exists AND is non-empty. A
        # silent partial deploy (no exception raised, no files written
        # for one of the bundle entries) is the silent-failure class
        # this phase exists to surface.
        missing_targets = _verify_deploy_targets(anchor, plan)
        if missing_targets:
            if not QUIET:
                warn(
                    f"{tool_id}: deploy postcheck failed — "
                    f"missing/empty: {', '.join(missing_targets)}"
                )
            _emit_progress({
                "type": "verify_failed",
                "tool": tool_id,
                "missing": missing_targets,
            })
            results[tool_id] = (
                written_total, skipped_total, "deploy_failed", written_paths,
            )
            continue
        _emit_progress({"type": "verified", "tool": tool_id})
        results[tool_id] = (written_total, skipped_total, "deployed", written_paths)
    return results


def _verify_deploy_targets(
    anchor: Path, plan: list[tuple[str, str]],
) -> list[str]:
    """Return the deploy-plan destination subpaths that did NOT materialise.

    A deploy plan entry ``(src_rel, dest_sub)`` is verified by checking
    that ``anchor / dest_sub`` (or ``anchor`` when ``dest_sub`` is empty)
    exists as a directory AND contains at least one entry. An empty
    directory counts as a failure — the agent-config bundle never
    legitimately ships an empty subtree, so "empty after deploy" means
    the copy step silently produced nothing.

    Returns the list of failing ``dest_sub`` values (empty string
    rewritten to ``"."`` for log clarity). An empty return list means
    every expected target is populated.
    """
    missing: list[str] = []
    for _, dest_sub in plan:
        target = anchor / dest_sub if dest_sub else anchor
        label = dest_sub or "."
        if not target.is_dir():
            missing.append(label)
            continue
        try:
            next(target.iterdir())
        except StopIteration:
            missing.append(label)
        except OSError:
            missing.append(label)
    return missing


def install_global(
    tools: set[str],
    force: bool,
    project_root: Path | None = None,
) -> int:
    """User-scope install path (ADR-007 + Phase 1.6 lockfile lifecycle).

    Reads ``~/.event4u/agent-config/installed.lock`` first (with a read
    fallback to the legacy ``~/.config/agent-config/installed.lock``). A
    recorded version that does not match the running package version refuses the
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

    Phase 3 namespace migration: before any lockfile read, the legacy
    ``~/.config/agent-config/`` tree (pre-2.4 installs) is migrated into
    ``~/.event4u/agent-config/`` so subsequent reads land on the canonical
    path. The migration is idempotent and leaves a ``MIGRATED.md``
    breadcrumb behind; the legacy tree is never auto-deleted.
    """
    paths_mod = _load_user_global_paths_module()
    migrated = paths_mod.migrate_legacy_namespace()
    if migrated and not QUIET:
        info(
            "🔁 Migrated user-global config to "
            f"{paths_mod.event4u_root()} (legacy "
            f"{paths_mod.legacy_xdg_root()} preserved as fallback)"
        )

    lock_mod = _load_installed_lock_module()
    installed_version = lock_mod.current_package_version()
    read_path = lock_mod.lockfile_path()
    write_path = lock_mod.lockfile_write_path()
    _, recorded = lock_mod.check_version(installed_version, path=read_path)
    classification = lock_mod.classify_mismatch(installed_version, recorded)

    # Phase 2 (roadmap road-to-claude-code-global-distribution.md): a stale
    # lockfile recording a *lower* (or unparseable legacy) version is the
    # upgrade path — auto-heal by claiming the new version slot and
    # continuing the install. Only a recorded version *higher* than the
    # running package is treated as a downgrade and still requires --force.
    # This kills the silent-refusal trap where users on pre-2.x (recorded:
    # 1.42.0) installs hit `install.py:3530` and exit 1 without ever
    # touching `~/.claude/`.
    if classification == "downgrade" and not force:
        if not QUIET:
            print()
            warn("Refusing global install: lockfile records a newer version.")
            info(f"  Lockfile:           {read_path}")
            info(f"  Recorded version:   {recorded}")
            info(f"  Current package:    {installed_version}")
            info("  Fix:                upgrade the package, or re-run with `--force`")
            print()
        return 1

    if classification in ("upgrade", "unparseable") and not QUIET:
        info(
            f"🔄 Upgrading lockfile from {recorded} to {installed_version}, "
            "redeploying tools"
        )

    if not QUIET:
        print()
        info("Agent Config — Global (user-scope) install [ADR-007]")
        info("Per-tool anchor paths:")
        for tool_id in sorted(tools):
            anchor = USER_SCOPE_PATHS.get(tool_id)
            if anchor is None:
                continue
            print(f"      {tool_id:<15} → {anchor}")

    # Claim the version slot BEFORE the deploy (Phase 2 Step 2 of the
    # road-to-claude-code-global-distribution roadmap). The deploy can
    # fail mid-way; the lockfile must stay on the new version regardless
    # so subsequent re-runs do not relitigate the upgrade refusal. A
    # partial deploy retries cleanly on the next invocation — the
    # lockfile staying stuck on an ancient version is the worse failure
    # mode this Phase exists to eliminate.
    existing = lock_mod.read_lockfile(path=read_path) or {}
    existing_tools = list(existing.get("tools", []))
    merged_tools = sorted(set(existing_tools) | set(tools))
    written = lock_mod.write_lockfile(installed_version, merged_tools, path=write_path)

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

    # Phase 5 (road-to-claude-code-global-distribution): postcheck-driven
    # lockfile correction. A tool whose deploy postcheck failed
    # (status="deploy_failed") MUST NOT remain in the lockfile's tools
    # list — claiming "tool X is installed" without the content on disk
    # is the silent-failure class this phase exists to surface. Tools
    # already recorded by a prior successful install stay (the
    # `failed_tools` set only filters this run's newly-attempted tools).
    failed_tools = {
        tool_id
        for tool_id, (_, _, status, _) in deploy_results.items()
        if status == "deploy_failed"
    }
    if failed_tools:
        corrected_tools = sorted(set(merged_tools) - failed_tools)
        if corrected_tools != merged_tools:
            lock_mod.write_lockfile(installed_version, corrected_tools, path=write_path)
            if not QUIET:
                warn(
                    "Lockfile corrected after deploy postcheck — dropped "
                    f"{', '.join(sorted(failed_tools))} (verification failed)."
                )

    # NDJSON progress for the wizard --apply-payload real-apply bridge. One
    # `file` frame per deployed tool unit (coarse, per AI-council 2026-05-27);
    # the GUI maps these to its SSE progress frames. No-op under normal CLI
    # installs (PROGRESS_NDJSON off). Emitted independent of QUIET because the
    # real-apply path sets QUIET=True to silence the human stream.
    if PROGRESS_NDJSON:
        ordered = sorted(deploy_results)
        total = len(ordered)
        for idx, tool_id in enumerate(ordered, start=1):
            w, _s, status, _ = deploy_results[tool_id]
            _emit_progress({
                "type": "file",
                "file": tool_id,
                "status": status,
                "written": idx,
                "total": total,
            })

    if not QUIET:
        print()
        info("Deployed per-tool content:")
        for tool_id in sorted(deploy_results):
            w, s, status, _ = deploy_results[tool_id]
            anchor = USER_SCOPE_PATHS.get(tool_id, "")
            if status == "deployed" and tool_id == "claude-desktop":
                bundles_dir = _claude_desktop_bundles_dir()
                print(f"      {tool_id:<15} → {bundles_dir} ({w} bundles)")
            elif status == "deployed":
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
    # `.agent-src.uncondensed/`) — maintainers dogfood with their own
    # `.agent-settings.yml` and the manifest would be untracked noise.
    if (
        project_root is not None
        and (project_root / SETTINGS_FILE).exists()
        and not (project_root / ".agent-src.uncondensed").is_dir()
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

        # Consumer bridge marker (Phase 4.2). One declarative pointer at
        # ``agents/.event4u-bridge.yml`` lets per-tool adapters locate
        # the global root from inside the repo. Skipped in maintainer
        # dev mode and in the source repo (see contract § Writer
        # contract; the surrounding ``.agent-src.uncondensed`` guard
        # already covers the source-repo case, the dev-mode skip is
        # enforced inside the writer).
        marker_path = _write_consumer_bridge_marker(project_root, installed_version)
        if marker_path is not None and not QUIET:
            rel = (
                marker_path.relative_to(project_root)
                if marker_path.is_relative_to(project_root)
                else marker_path
            )
            info(f"Bridge marker written: {rel}")

        # Per-tool project anchors (Phase 4.3). Plant thin pointer files
        # for tools that only load rules when an anchor exists inside
        # the workspace (Windsurf, Cline, Gemini-CLI). Same dev-mode +
        # source-repo gate as the bridge marker (enforced inside the
        # writer). Filter to the tools the caller actually selected so
        # we never plant anchors for tools the user excluded.
        anchor_paths = _write_per_tool_project_anchors(project_root, tools)
        if anchor_paths and not QUIET:
            for p in anchor_paths:
                rel = (
                    p.relative_to(project_root)
                    if p.is_relative_to(project_root)
                    else p
                )
                info(f"Project anchor written: {rel}")

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
    parser.add_argument(
        "--user-type",
        dest="user_type",
        default="",
        help=(
            "primary user-type for skill filtering (step-9 axis). "
            "Valid ids: consultant | creator | developer | finance | "
            "founder | gtm | ops. Default: empty (no filter, every skill "
            "surfaces). Written to personal.user_type in .agent-settings.yml."
        ),
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
        "--packs",
        default=None,
        help=(
            "comma-separated pack IDs to record as the active selection in "
            ".agent-settings.yml (project scope). Packs are a "
            "frontmatter/condense-time concept — recording the selection "
            "lets downstream condense/runtime honor it; install.py does not "
            "materialize packs. Default: none (base package only)."
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
    parser.add_argument(
        "--minimal",
        "--settings-only",
        dest="minimal",
        action="store_true",
        help=(
            "bootstrap only the project-local override layer: writes "
            "agents/.gitkeep and a .agent-settings.yml stub. No tool "
            "payload, no AGENTS.md, no symlinks. Refuses to install "
            "inside an existing agent-config project (nested-install "
            "guard). See docs/installation.md → Minimal init."
        ),
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help=(
            "after the install completes, run a short prompt to capture "
            "user-type / stack / verbosity and write `.agent-config.local.json` "
            "(forward-compatible stub for step-9 user-types axis — runtime "
            "skill filtering activates once that axis ships). TTY-only; "
            "no-op without an interactive stdin. See "
            "docs/contracts/universal-skills.md for the always-loaded set."
        ),
    )
    parser.add_argument(
        "--no-ui",
        dest="no_ui",
        action="store_true",
        help=(
            "suppress the post-install browser-wizard auto-launch. Also "
            "honored via AGENT_CONFIG_NO_UI=1 env. CI runners (CI=1) and "
            "non-TTY stdouts auto-suppress regardless of this flag. See "
            "agents/roadmaps/wizard-install-py-wiring.md."
        ),
    )
    parser.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        help=(
            "print a plan summary of what would be installed (profile, "
            "scope, tools, wizard auto-launch decision) and exit 0 "
            "without writing any files or spawning subprocesses. "
            "Distinct from the internal alias-resolution --dry-run "
            "passed to bridge sub-invocations."
        ),
    )
    parser.add_argument(
        "--apply-payload",
        dest="apply_payload",
        default=None,
        help=(
            "path to a WizardApplyPayload JSON file (internal/schemas/"
            "wizard-apply-payload.schema.json). When supplied, install.py "
            "reads the payload, validates schema_version, translates "
            "tools/packs/settings into CLI equivalents, and dispatches "
            "as if those flags were passed directly. Combine with "
            "--dry-run for the Phase 1.5 preview path "
            "(road-to-global-only-install § D12 / Phase 1.5)."
        ),
    )
    opts = parser.parse_args(argv)
    opts.tools = _merge_tools_aliases(opts.tools, opts.ai)
    # Normalize --packs (comma-separated string | None) to a list so the CLI
    # and the --apply-payload bridge agree on opts.packs being list[str].
    opts.packs = (
        [p.strip() for p in opts.packs.split(",") if p.strip()]
        if isinstance(opts.packs, str)
        else []
    )
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


# --- Minimal init (Step 7 Phase 2) ---


def _minimal_templates_root() -> Path:
    """Resolve the bundled ``templates/minimal/`` directory.

    Walks up from this file looking for ``templates/minimal/``; this
    works both in development mode (running the source tree) and from
    an ``npm install -g`` install (the script lives under the package
    root regardless).
    """
    for ancestor in (Path(__file__).resolve(), *Path(__file__).resolve().parents):
        candidate = ancestor / "templates" / "minimal"
        if candidate.is_dir():
            return candidate
    fail("Could not locate templates/minimal/ — package install is corrupt.")
    return Path()  # unreachable


#: Relative path of the install-mode marker file written by both the
#: minimal short-circuit and the full install path (Step 8 A5). Read by
#: ``doctor --context`` (and any future tooling) instead of inferring
#: install state from filesystem heuristics like ``AGENTS.md`` presence.
INSTALL_MODE_MARKER_REL = "agents/.agent-state/install-mode.txt"


def _write_install_mode_marker(project_root: Path, mode: str) -> None:
    """Write ``agents/.agent-state/install-mode.txt`` = ``mode\\n``.

    Idempotent: overwrites unconditionally so re-installs flip the
    state correctly (e.g. minimal → full upgrade). Failure to write
    is non-fatal — install proceeds and ``doctor --context`` falls
    back to the filesystem heuristic. ``mode`` must be ``minimal``
    or ``full``.
    """
    if mode not in ("minimal", "full"):
        return
    marker = project_root / INSTALL_MODE_MARKER_REL
    try:
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.write_text(f"{mode}\n", encoding="utf-8")
    except OSError:
        # Marker is advisory; install must not abort because the
        # state dir is unwritable (e.g. read-only mount in CI).
        pass


def install_minimal(target_root: Path, force: bool, user_type: str = "") -> int:
    """Bootstrap the project-local override layer only (ADR-020-compliant).

    Writes the global-only consumer scaffold:

    * ``agents/overrides/{rules,skills,commands}/.gitkeep`` so the
      override subdirs are committable in a fresh repo.
    * ``agents/overrides/README.md`` explaining the override layer and
      its resolution model.
    * ``agents/.event4u-bridge.yml`` (Phase 4.2) anchoring the project
      to the user-global ``~/.event4u/agent-config/`` install.
    * ``.agent-settings.yml`` — only when ``user_type`` is supplied
      (back-compat with the step-9 interactive flow); otherwise the
      project-local settings file is **not** written (global config
      is the source of truth per ADR-020 § D2).

    Refuses (exit 1) when ``target_root`` is **inside** an existing
    agent-config project (Phase-1 anchor walk above the target). The
    in-target case is allowed and treated as idempotent — re-running
    ``--minimal`` in a folder that already has the bridge marker does
    nothing unless ``--force`` is passed.

    Does **not** touch ``.gitignore`` (D2 — user owns the ignore file).
    The ``./agent-config`` wrapper is installed by ``scripts/install.sh``
    in its own minimal short-circuit.
    """
    try:
        from scripts._lib.agent_settings import find_project_root_with_anchor  # noqa: PLC0415
    except ImportError:  # pragma: no cover — alt sys.path layout
        from _lib.agent_settings import find_project_root_with_anchor  # type: ignore[no-redef]  # noqa: PLC0415

    target_root = target_root.resolve()
    target_root.mkdir(parents=True, exist_ok=True)

    # Nested-install guard: walk up from the *parent* of target_root.
    # An anchor at target_root itself is allowed (re-running --minimal
    # in the same project is idempotent); only a root *above* target
    # blocks the install.
    parent = target_root.parent
    if parent != target_root:  # not filesystem root
        existing = find_project_root_with_anchor(parent)
        if existing is not None and existing[0] != target_root:
            root, anchor = existing
            fail(
                "Refusing to nest an agent-config layer inside an existing "
                f"project (anchor: {anchor}). Existing root: {root}. "
                "Remove the parent layer first or run `--minimal` outside it."
            )
            return 1  # unreachable; fail() exits

    templates = _minimal_templates_root()
    settings_src = templates / SETTINGS_FILE
    overrides_gitkeep_src = templates / "overrides-gitkeep"
    overrides_readme_src = templates / "agents-overrides-readme.md"

    if not settings_src.is_file():
        fail(f"Bundled minimal settings template missing under {templates}")
    if not overrides_gitkeep_src.is_file() or not overrides_readme_src.is_file():
        fail(f"Bundled overrides scaffold templates missing under {templates}")

    info(f"Minimal init → {target_root}")

    # 1. agents/overrides/{rules,skills,commands}/.gitkeep — committable
    # scaffold for the project-local override layer (ADR-020 § Phase 4.5).
    overrides_root = target_root / "agents" / "overrides"
    overrides_root.mkdir(parents=True, exist_ok=True)
    gitkeep_body = overrides_gitkeep_src.read_text(encoding="utf-8")
    for sub in ("rules", "skills", "commands"):
        sub_dir = overrides_root / sub
        sub_dir.mkdir(exist_ok=True)
        gitkeep_dst = sub_dir / ".gitkeep"
        if gitkeep_dst.exists() and not force:
            skip(f"agents/overrides/{sub}/.gitkeep already exists (use --force to overwrite)")
        else:
            gitkeep_dst.write_text(gitkeep_body, encoding="utf-8")
            success(f"Wrote agents/overrides/{sub}/.gitkeep")

    # 2. agents/overrides/README.md — explains the override layer.
    readme_dst = overrides_root / "README.md"
    if readme_dst.exists() and not force:
        skip("agents/overrides/README.md already exists (use --force to overwrite)")
    else:
        readme_dst.write_text(overrides_readme_src.read_text(encoding="utf-8"), encoding="utf-8")
        success("Wrote agents/overrides/README.md")

    # 3. .agent-settings.yml stub — only when user_type is supplied
    # (back-compat with the step-9 interactive flow). Global config is
    # the source of truth per ADR-020 § D2; a fresh `--minimal` run
    # without user_type does not write a project-local settings file.
    if user_type:
        settings_dst = target_root / SETTINGS_FILE
        if settings_dst.exists() and not force:
            skip(f"{SETTINGS_FILE} already exists (use --force to overwrite)")
        else:
            body = settings_src.read_text(encoding="utf-8").rstrip() + (
                "\n\n# --- Personal (step-9 user-type axis) ---\n"
                "personal:\n"
                f"  user_type: {user_type}\n"
            )
            settings_dst.write_text(body, encoding="utf-8")
            success(f"Wrote {SETTINGS_FILE} (user_type={user_type})")

    # 4. Consumer bridge marker (Phase 4.2). Anchors the project to
    # the user-global ``~/.event4u/agent-config/`` install. The writer
    # itself enforces the dev-mode + source-repo skip contract.
    lock_mod = _load_installed_lock_module()
    installed_version = lock_mod.current_package_version()
    marker_path = _write_consumer_bridge_marker(target_root, installed_version)
    if marker_path is not None:
        rel = (
            marker_path.relative_to(target_root)
            if marker_path.is_relative_to(target_root)
            else marker_path
        )
        success(f"Wrote {rel}")

    # 5. install-mode marker (Step 8 A5) — authoritative state for
    # doctor --context and future install-aware tooling. Written even
    # on idempotent re-runs so the marker is repaired if removed.
    _write_install_mode_marker(target_root, "minimal")

    # Stderr upgrade hint (Step 8 A5) — minimal installs are intentionally
    # stripped; surface the upgrade path on stderr so it appears in
    # human terminals without polluting stdout-parsed output. Suppressed
    # under --quiet to honor scripted-install contracts.
    if not QUIET:
        print(
            "ℹ️   Minimal install — run `agent-config install --force` "
            "to add AGENTS.md, bridges, and tool integrations.",
            file=sys.stderr,
        )

    if not QUIET:
        print()
        info("Next steps:")
        info("  • Ensure `agent-config` is on $PATH: npm install -g @event4u/agent-config")
        info("  • Drop project-scoped overrides under `agents/overrides/{rules,skills,commands}/`.")
        info("  • Run `agent-config doctor` to verify the layer is picked up.")
    return 0


# --- Interactive init (step-12 Phase 3, forward-compatible stub) ---

_INTERACTIVE_USER_TYPES: tuple[tuple[str, str], ...] = (
    ("creator", "Content / writing / publishing"),
    ("founder", "Early-stage company building"),
    ("consultant", "Advisory / strategy / discovery"),
    ("gtm", "Sales / marketing / revenue ops"),
    ("finance", "Finance / FP&A / unit economics"),
    ("ops", "Operations / incident / compliance"),
    ("developer", "Engineering / code-heavy work"),
)

_INTERACTIVE_STACKS: tuple[tuple[str, str], ...] = (
    ("none", "No code project / pure content"),
    ("laravel", "PHP / Laravel"),
    ("nextjs", "TypeScript / Next.js / React"),
    ("python", "Python / FastAPI / Django"),
    ("symfony", "PHP / Symfony"),
    ("generic", "Other / mixed stack"),
)

_INTERACTIVE_VERBOSITIES: tuple[tuple[str, str], ...] = (
    ("quiet", "Telegraph / minimal output"),
    ("normal", "Default verbosity"),
    ("verbose", "Full intent announcements + play-by-play"),
)

_LOCAL_CONFIG_FILE = ".agent-config.local.json"


def _interactive_prompt_choice(label: str, options: tuple[tuple[str, str], ...]) -> str:
    """Render a numbered list and return the chosen id. Defaults to option 1 on empty input."""
    print()
    print(f"  {label}")
    for idx, (key, blurb) in enumerate(options, start=1):
        print(f"    {idx}. {key}  — {blurb}")
    print()
    while True:
        try:
            raw = input(f"  Choice [1-{len(options)}, default 1]: ").strip()
        except EOFError:
            return options[0][0]
        if not raw:
            return options[0][0]
        if raw.isdigit():
            i = int(raw)
            if 1 <= i <= len(options):
                return options[i - 1][0]
        # Allow typing the slug directly.
        for key, _ in options:
            if raw.lower() == key:
                return key
        print(f"  ⚠️  Pick a number 1-{len(options)} or one of: {', '.join(k for k, _ in options)}.")


def run_interactive_init(project_root: Path, force: bool) -> int:
    """Write ``.agent-config.local.json`` based on three TTY prompts.

    Forward-compatible stub for [`step-9-user-types-axis`](../agents/roadmaps/step-9-user-types-axis.md):
    runtime skill filtering activates once that axis ships its
    ``user-types/`` directory and ``--user-type`` flag. Until then,
    this file is metadata-only — read by ``doctor --context`` and the
    upcoming ``agent-config skills`` listing command.

    Universal-skills allowlist (see
    ``docs/contracts/universal-skills.md``) loads regardless of the
    captured ``user_type`` — the contract guarantees these 15 skills
    are never filtered out.

    Returns 0 on success, 1 on collision without ``--force``. No-op
    (returns 0) when stdin is not a TTY.
    """
    if not sys.stdin.isatty():
        warn(
            "--interactive requested but stdin is not a TTY; skipping the "
            f"prompt. Re-run interactively or hand-edit {_LOCAL_CONFIG_FILE}."
        )
        return 0

    target = project_root / _LOCAL_CONFIG_FILE
    if target.exists() and not force:
        warn(
            f"{_LOCAL_CONFIG_FILE} already exists; re-run with --force to "
            "overwrite. Skipping interactive init."
        )
        return 0

    print()
    info("Interactive init — captures user-type / stack / verbosity")
    info("(forward-compatible stub; runtime filtering activates with step-9)")

    user_type = _interactive_prompt_choice("Primary user type:", _INTERACTIVE_USER_TYPES)
    stack = _interactive_prompt_choice("Project stack:", _INTERACTIVE_STACKS)
    verbosity = _interactive_prompt_choice("Verbosity profile:", _INTERACTIVE_VERBOSITIES)

    payload: dict[str, Any] = {
        "$schema": "https://github.com/event4u-app/agent-config/scripts/schemas/local-config.schema.json",
        "version": 1,
        "user_type": user_type,
        "stack": stack,
        "verbosity": verbosity,
        "universal_skills_contract": "docs/contracts/universal-skills.md",
    }

    try:
        target.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    except OSError as exc:
        warn(f"Could not write {target}: {exc}")
        return 1

    success(f"Wrote {target.relative_to(project_root)} ({user_type} / {stack} / {verbosity})")
    return 0


# --- Wizard auto-launch (Phase 6 follow-up) ---
#
# Auto-launches the browser configuration wizard at the tail of a
# successful install. The unified CLI ships an `install` subcommand
# (`dist/cli/agent-config.js`); this Python parent acts as a supervisor that:
#
#   1. evaluates gate conditions (TTY, CI, --no-ui, env override),
#   2. validates the dist exists,
#   3. spawns `node <cli> install --no-open --project-root <root>` via subprocess.Popen,
#   4. captures stderr on a background thread (for failure surfacing),
#   5. reads stdout line-by-line with a progressive timeout
#      (10s → 20s → 40s → 80s) and matches the strict readiness regex
#      `^WIZARD_READY (http://(?:127.0.0.1|localhost):\d+/\S*)\r?$`
#      (the CLI prints `WIZARD_READY <url>` where url carries `?token=…`),
#   6. on success: prints the URL banner and waits for the child to
#      exit (Ctrl-C in the parent terminal propagates to the child),
#   7. on timeout: kills the child, prints captured stderr tail, falls
#      through to a fallback message; install itself is unaffected.
#
# Council synthesis: agents/runtime/council/responses/wizard-wiring-2026-05-22.synthesis.md
# Roadmap: agents/roadmaps/wizard-install-py-wiring.md Step 3.

_WIZARD_READY_RE = re.compile(
    r"^WIZARD_READY (http://(?:127\.0\.0\.1|localhost):\d+/\S*)\r?$"
)
_WIZARD_TIMEOUTS = (10.0, 20.0, 40.0, 80.0)  # cumulative budget 150s.


def _wizard_should_launch(opts: argparse.Namespace) -> tuple[bool, str]:
    """Evaluate gate conditions for the post-install wizard auto-launch.

    Returns (decision, reason). When decision is False the reason
    string explains why (CI / no-tty / --no-ui / env override / explicit
    --tools) and is suitable for the pre-install banner Council Tier 2 § 8.
    """
    if getattr(opts, "no_ui", False):
        return (False, "--no-ui flag set")
    env_no_ui = os.environ.get("AGENT_CONFIG_NO_UI", "").strip()
    if env_no_ui and env_no_ui != "0":
        return (False, "AGENT_CONFIG_NO_UI env set")
    if os.environ.get("CI", "").strip():
        return (False, "CI environment detected")
    if not sys.stdout.isatty():
        return (False, "stdout is not a TTY")
    # Explicit `--tools=<list>` means the caller already knows what to
    # install — run the non-interactive CLI install, don't open the GUI
    # (road-to-single-install-source-of-truth § Phase 4). The implicit/
    # explicit `all` default does NOT suppress the wizard.
    tools_raw = getattr(opts, "tools", None)
    if tools_raw and not _tools_was_all(tools_raw):
        return (False, "explicit --tools= selection (headless install)")
    return (True, "")


def _wizard_cli_dist(project_root: Path) -> Path | None:
    """Resolve the unified CLI dist path. Returns None if not built.

    Walks up from this file (scripts/install.py is at <pkg>/scripts/) to
    <pkg>/dist/cli/agent-config.js — the published bin entry (package.json
    `bin`). The dead `packages/core/installer/dist/cli.js` layout was
    retired in road-to-single-install-source-of-truth § Phase 4.
    """
    package_root = Path(__file__).resolve().parent.parent
    cli = package_root / "dist" / "cli" / "agent-config.js"
    return cli if cli.exists() else None


def _server_info_path() -> Path:
    """Path of the running-server record written by `ui:serve`."""
    return Path.home() / ".event4u" / "agent-config" / "local-server.json"


def _pid_is_agent_config(pid: int) -> bool:
    """Best-effort check that `pid` is one of our wizard servers.

    Guards against signalling an unrelated process that recycled the pid.
    Uses `ps` (POSIX); on platforms without it we conservatively return
    False so we never kill the wrong process.
    """
    try:
        out = subprocess.run(  # noqa: S603,S607 - fixed argv, pid is an int
            ["ps", "-p", str(pid), "-o", "command="],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return "agent-config" in out.stdout.lower()


def _kill_stale_wizard_server() -> None:
    """Terminate a previously-launched wizard server, if one is recorded.

    `agent-config init` should always start fresh: a stale server (left
    from an earlier run) is stopped so the new instance owns the port and
    the wizard re-enters at step 1. Best-effort — every failure is ignored.
    """
    path = _server_info_path()
    try:
        info = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    pid = info.get("pid")
    if not isinstance(pid, int):
        path.unlink(missing_ok=True)
        return
    try:
        os.kill(pid, 0)  # liveness probe
    except OSError:
        path.unlink(missing_ok=True)  # already gone
        return
    if not _pid_is_agent_config(pid):
        return  # pid reused by an unrelated process — leave it alone
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        path.unlink(missing_ok=True)
        return
    # Wait up to ~3s for a graceful exit, then force-kill.
    for _ in range(30):
        try:
            os.kill(pid, 0)
        except OSError:
            break
        time.sleep(0.1)
    else:
        try:
            os.kill(pid, getattr(signal, "SIGKILL", signal.SIGTERM))
        except OSError:
            pass
    path.unlink(missing_ok=True)
    print("(Stopped the previous wizard server.)")


def _wizard_spawn(project_root: Path) -> int:
    """Spawn the wizard, await readiness, hand off to the child.

    Returns the child's exit code on clean shutdown, 0 on
    readiness-timeout (install itself succeeded; wizard is best-effort).
    Never raises into the parent — every error surfaces as a printed
    fallback line and a 0 return.
    """
    # Always start fresh: stop any server left running by a prior init.
    _kill_stale_wizard_server()

    cli = _wizard_cli_dist(project_root)
    if cli is None:
        print(
            "(Wizard not available — CLI bundle not built. "
            "Run 'npm run build' at the package root to produce dist/cli/.)"
        )
        return 0

    # Spawn the unified CLI's `install` subcommand (boots the UI server,
    # lands on Step 1 / AI tools). `--no-open` keeps the Python parent in
    # charge of the user-facing URL print (Tier 2 § 8 ordering) — the dead
    # `gui` subcommand + AGENT_CONFIG_GUI_NO_OPEN env were retired in
    # road-to-single-install-source-of-truth § Phase 4.
    cmd = ["node", str(cli), "install", "--no-open", "--project-root", str(project_root)]
    env = os.environ.copy()

    try:
        child = subprocess.Popen(  # noqa: S603 - cmd is locally-built, not user input
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            bufsize=1,  # line-buffered
        )
    except OSError as exc:
        print(f"(Wizard failed to start: {exc}; run 'node {cli} install --no-open' manually.)")
        return 0

    # Drain stderr on a background thread so a chatty child can't
    # block the readline loop below. Cap at 80 lines to bound memory.
    stderr_tail: list[str] = []

    def _drain_stderr() -> None:
        if child.stderr is None:
            return
        for line in child.stderr:
            stderr_tail.append(line.rstrip("\r\n"))
            if len(stderr_tail) > 80:
                del stderr_tail[: len(stderr_tail) - 80]

    stderr_thread = threading.Thread(target=_drain_stderr, daemon=True)
    stderr_thread.start()

    return _wizard_await_ready(child, stderr_tail, cli)


def _wizard_await_ready(
    child: subprocess.Popen[str],
    stderr_tail: list[str],
    cli: Path,
) -> int:
    """Read child stdout until the WIZARD_READY regex matches.

    Progressive backoff per Council Tier 1 § 2. On match, prints the
    URL banner and blocks on child.wait() (parent Ctrl-C is forwarded
    to the child by the OS via the shared process group).
    """
    assert child.stdout is not None
    elapsed_total = 0.0
    matched_url: str | None = None

    for interim in _WIZARD_TIMEOUTS:
        deadline = time.monotonic() + interim
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            # readline blocks until \n or EOF; we cap total wait per
            # phase via deadline. Use poll() to detect child exit.
            if child.poll() is not None:
                break
            line = child.stdout.readline()
            if not line:
                # EOF — child closed stdout without WIZARD_READY.
                break
            m = _WIZARD_READY_RE.match(line)
            if m is not None:
                matched_url = m.group(1)
                break
        if matched_url is not None or child.poll() is not None:
            break
        elapsed_total += interim
        if elapsed_total < sum(_WIZARD_TIMEOUTS):
            print(f"(Wizard still booting after {int(elapsed_total)}s — waiting…)")

    if matched_url is None:
        try:
            child.terminate()
            child.wait(timeout=2)
        except (subprocess.TimeoutExpired, OSError):
            try:
                child.kill()
            except OSError:
                pass
        tail = "\n  ".join(stderr_tail[-20:]) if stderr_tail else "(no stderr captured)"
        print(
            f"(Wizard server boot timed out after {int(sum(_WIZARD_TIMEOUTS))}s; "
            f"run 'node {cli} install --no-open' manually.)\n"
            f"  Last stderr:\n  {tail}"
        )
        return 0

    print()
    print(f"Setup wizard ready: {matched_url}")
    print("(Wizard runs in the background; close the tab or press Ctrl-C to stop.)")
    try:
        return child.wait()
    except KeyboardInterrupt:
        try:
            child.terminate()
            return child.wait(timeout=5)
        except (subprocess.TimeoutExpired, OSError):
            try:
                child.kill()
            except OSError:
                pass
            return 130


def _dry_run_summary(opts: argparse.Namespace) -> int:
    """Print a one-block plan summary for --dry-run and exit 0.

    Lists profile, scope, tools, target root, and the wizard
    auto-launch decision. Writes nothing, spawns nothing. The wizard
    line is shown per Council Tier 3 § 10 user-requirement carve-out.
    """
    target = Path(
        opts.custom_path or opts.project or os.environ.get("PROJECT_ROOT") or os.getcwd()
    ).resolve()
    will_launch, why_not = _wizard_should_launch(opts)
    print()
    print("[dry-run] Plan summary — no files written, no subprocesses spawned:")
    print(f"  profile:     {opts.profile}")
    print(f"  user-type:   {opts.user_type or '(none)'}")
    print(f"  scope:       {opts.scope or ('global' if opts.global_install else 'auto')}")
    print(f"  tools:       {opts.tools or 'all'}")
    print(f"  target:      {target}")
    print(f"  minimal:     {opts.minimal}")
    print(f"  force:       {opts.force}")
    print(f"  offline:     {opts.offline}")
    if will_launch:
        print("  wizard:      Would auto-launch (pass --no-ui to suppress).")
    else:
        print(f"  wizard:      Suppressed ({why_not}).")
    print()
    return 0


# --- Main ---

def _apply_payload_preview(payload: dict[str, Any], opts: argparse.Namespace) -> int:
    """Render a Phase 1.5 dry-run preview for a WizardApplyPayload.

    Reads schema_version, lists tools / packs / settings keys, and
    exits 0 without spawning. Used by the wizard `/api/v1/wizard/apply`
    bridge to surface the apply diff before the maintainer commits.
    """
    schema_version = payload.get("schema_version", "<missing>")
    target = Path(
        opts.custom_path or opts.project or os.environ.get("PROJECT_ROOT") or os.getcwd()
    ).resolve()
    print()
    print("[apply-payload] Plan summary — no files written, no subprocesses spawned:")
    print(f"  schema:      {schema_version}")
    if schema_version == "wizard-v2":
        tools = payload.get("tools") or []
        packs = payload.get("packs") or []
        settings = payload.get("settings") or {}
        scope_to_project = bool(payload.get("scope_to_project_only", False))
        print(f"  tools:       {','.join(tools) if tools else '(none)'}")
        print(f"  packs:       {','.join(packs) if packs else '(base)'}")
        print(f"  settings:    {len(settings)} top-level key(s)")
        print(f"  scope:       {'project' if scope_to_project else 'global'}")
    elif schema_version == "installer-v1":
        ai_tools = payload.get("ai_tools") or []
        configs = payload.get("configs") or {}
        print(f"  ai_tools:    {','.join(ai_tools) if ai_tools else '(none)'}")
        print(f"  configs:     {len(configs)} tool config(s)")
    else:
        print(f"  error:       unsupported schema_version: {schema_version!r}")
        print()
        return 2
    print(f"  target:      {target}")
    print(f"  dry_run:     {bool(payload.get('dry_run', opts.dry_run))}")
    print()
    return 0


def main(argv: list[str]) -> int:
    global QUIET

    opts = parse_options(argv)
    QUIET = opts.quiet

    # road-to-global-only-install § Phase 1.5 — Wizard Apply bridge.
    # When --apply-payload <path> is supplied, read the WizardApplyPayload
    # JSON, validate schema_version, and (for dry-run) print a preview
    # block. The bridge calls install.py with `--dry-run` set, so the
    # short-circuit below this block keeps the run side-effect-free.
    if getattr(opts, "apply_payload", None):
        payload_path = Path(opts.apply_payload).resolve()
        if not payload_path.is_file():
            fail(f"--apply-payload path not found: {payload_path}")
        try:
            payload = json.loads(payload_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            fail(f"--apply-payload JSON parse error: {exc}")
        if not isinstance(payload, dict):
            fail("--apply-payload root must be a JSON object")
        schema_version = payload.get("schema_version")
        if schema_version not in ("wizard-v2", "installer-v1"):
            fail(
                f"--apply-payload schema_version must be 'wizard-v2' or "
                f"'installer-v1', got {schema_version!r}"
            )
        # Translate payload → opts so the SAME canonical install path
        # downstream sees the shape it would from CLI flags — no second
        # code path (road-to-single-install-source-of-truth § Phase 1).
        if schema_version == "wizard-v2":
            tools = payload.get("tools") or []
            if isinstance(tools, list) and tools:
                opts.tools = ",".join(t for t in tools if isinstance(t, str))
            if bool(payload.get("scope_to_project_only", False)):
                opts.scope = "project"
            else:
                opts.scope = "global"
            # settings{} → --profile / --user-type. `settings` is the
            # merged .agent-settings.yml body; pull the two install-time
            # knobs the canonical installer consumes. Everything else in
            # the settings body is written by the wizard `/finish` 2PC
            # commit, not by install.py.
            settings = payload.get("settings") or {}
            if isinstance(settings, dict):
                cost_profile = settings.get("cost_profile")
                if isinstance(cost_profile, str) and cost_profile:
                    opts.profile = cost_profile
                personal = settings.get("personal")
                if isinstance(personal, dict):
                    user_type = personal.get("user_type")
                    if isinstance(user_type, str) and user_type:
                        opts.user_type = user_type
            # packs[] → declarative selection persisted into
            # .agent-settings.yml on the project path (ensure_agent_settings).
            # Packs are a frontmatter/condense-time concept; there is no
            # install-time materialization — the selection is recorded so
            # downstream condense/runtime honors it (AI-council 2026-05-27).
            packs = payload.get("packs") or []
            if isinstance(packs, list):
                opts.packs = [p for p in packs if isinstance(p, str)]
            # Per-tool user-hook opts → ensure_*_hook flags: deliberately
            # NOT wired. The wizard-v2 payload carries no hook fields, and
            # auto-enabling user-scope hooks (which write to the global
            # user config) on tool selection would silently widen install
            # scope — a non-destructive-by-default violation. Maps only
            # once the schema grows an explicit hooks field (AI-council
            # 2026-05-27, Gemini + Codex converged).
        elif schema_version == "installer-v1":
            ai_tools = payload.get("ai_tools") or []
            if isinstance(ai_tools, list) and ai_tools:
                opts.tools = ",".join(t for t in ai_tools if isinstance(t, str))
        # Payload dry_run wins over CLI when explicitly set true.
        if bool(payload.get("dry_run", False)):
            opts.dry_run = True
        if opts.dry_run:
            return _apply_payload_preview(payload, opts)
        # Real apply: stream machine-readable NDJSON progress on stdout and
        # silence human output so the GUI gets a clean stream. Then fall
        # through to the canonical install path below — no separate apply
        # implementation.
        global PROGRESS_NDJSON
        PROGRESS_NDJSON = True
        QUIET = True

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

    # Dry-run short-circuit (Council Tier 2 § 9): print a plan summary
    # and exit 0 before any filesystem write or subprocess spawn.
    # Distinct from the internal `--dry-run` strings passed to
    # alias-resolution sub-invocations elsewhere in this file.
    if getattr(opts, "dry_run", False):
        return _dry_run_summary(opts)

    # Wizard auto-launch decision banner (Council Tier 2 § 8): print
    # the gate verdict BEFORE the install runs so the user knows what
    # will happen at the tail without having to wait through every
    # bridge write to find out.
    will_launch, why_not = _wizard_should_launch(opts)
    if will_launch:
        if not QUIET:
            info("Setup wizard will launch automatically after install.")
    elif not QUIET:
        info(f"Setup wizard auto-launch disabled ({why_not}).")

    # Minimal-init short-circuit (Step 7 Phase 2): bypass scope
    # detection, conflict policy, and the full bridge install. Writes
    # only the project-local override layer (agents/.gitkeep +
    # .agent-settings.yml stub). The bash wrapper handles the
    # `./agent-config` script; everything else is intentionally absent.
    if opts.minimal:
        target_root = Path(
            opts.custom_path or opts.project or os.environ.get("PROJECT_ROOT") or os.getcwd()
        ).resolve()
        # Validate --user-type early so the minimal short-circuit fails
        # fast on a bogus slug instead of writing a half-formed stub.
        # _minimal_templates_root() returns <package_root>/templates/minimal;
        # walk two parents up to reach the package root where user-types/ lives.
        minimal_package_root = _minimal_templates_root().parent.parent
        validated_user_type = _validate_user_type(minimal_package_root, opts.user_type)
        return install_minimal(target_root, opts.force, validated_user_type)

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
    _enforce_consumer_global_only(scope)

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
            # First-run hook: when legacy artefacts live in the project tree,
            # prompt before laying down the global surface so the user is
            # not left with a dual-stack install. Delegates to the unified
            # `agent-config migrate` (see docs/contracts/migrate-command.md).
            artefacts = _detect_legacy_for_migration(detect_root)
            if artefacts and _prompt_migrate_to_global(detect_root, artefacts):
                rc = _run_migrate_to_global(detect_root)
                if rc != 0:
                    return rc
            # Pass detect_root so the manifest refresh runs when --global is
            # invoked from within a project tree (ADR-008 Phase 3.2).
            rc = install_global(parsed_tools, opts.force, project_root=detect_root)
            _emit_progress_terminal(rc)
            return rc

        project_root = custom_path or Path(opts.project or os.environ.get("PROJECT_ROOT") or os.getcwd()).resolve()
        is_first_run = not (project_root / SETTINGS_FILE).exists()
        rc = _main_project_install(opts, project_root, parsed_tools, is_first_run)
        # Interactive post-install prompt (step-12 Phase 3, forward-compatible
        # stub). Runs only after a successful install so the local config
        # never ships ahead of the bridge files it parameterizes.
        if rc == 0 and getattr(opts, "interactive", False):
            run_interactive_init(project_root, opts.force)
        _emit_progress_terminal(rc)
        return rc
    except ConflictAbort as exc:
        warn(exc.message)
        _emit_progress({"type": "error", "code": "E_CONFLICT_UNRESOLVED", "message": exc.message})
        return 1
    finally:
        _set_conflict_policy(None)


def _propose_modules_config(project_root: Path, is_first_run: bool) -> None:
    """Surface module-root candidates as numbered options on first install.

    Phase B Step 2 of road-to-configurable-modules. Hooks into the
    project-install path: when the install is first-run, the terminal
    is a TTY, ``.agent-project-settings.yml`` exists without a populated
    ``modules:`` block, and the detection helper finds at least one
    candidate, the installer prints the proposed block and asks the
    user to paste it into the team file. No automatic write — the
    layered-settings contract treats ``.agent-project-settings.yml``
    as user-curated.

    Gates (any miss → silent no-op):

    * ``is_first_run`` must be True — re-runs never re-prompt.
    * stdin + stdout must be TTYs — non-interactive installs (CI,
      wizard apply-payload, ``--quiet``) skip silently.
    * ``QUIET`` must be False.
    * The detection helper must surface at least one candidate.
    """
    if not is_first_run or QUIET or not sys.stdin.isatty() or not sys.stdout.isatty():
        return
    try:
        from scripts._lib.module_detection import detect_module_roots
    except ImportError:
        return
    try:
        candidates = detect_module_roots(project_root)
    except OSError:
        return
    if not candidates:
        return
    print()
    info("Module-root candidates detected — propose `modules:` block")
    info(
        "Paste into .agent-project-settings.yml to enable module-aware "
        "skills (or skip; the block stays opt-in)."
    )
    print()
    print("  modules:")
    print("    enabled: true")
    print(
        "    root_paths: [" + ", ".join(c.path for c in candidates) + "]"
    )
    primary_ns = next(
        (c.namespace_template_guess for c in candidates if c.namespace_template_guess),
        "",
    )
    if primary_ns:
        print(f"    namespace_template: '{primary_ns}'")
    print("    agent_folder: agents")
    print("    skip_dirs: [.module-template, .example]")
    print()
    info(
        "Re-run anytime via `python3 scripts/propose_modules_config.py` "
        "(installed under <package>/scripts/)."
    )


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
        if opts.user_type:
            info(f"UserType: {opts.user_type}")
        print()

    ensure_agent_settings(
        project_root, package_root, opts.profile, opts.force, opts.user_type,
        packs=getattr(opts, "packs", None),
    )

    # Install-mode marker (Step 8 A5) — full path flips any prior
    # minimal marker to "full" so doctor --context reflects the
    # upgraded state. Idempotent on re-runs of the same scope.
    _write_install_mode_marker(project_root, "full")

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

    # NDJSON progress for the wizard --apply-payload real-apply bridge on the
    # project scope (scope_to_project_only=true). One `file` frame per enabled
    # tool unit, coarse per AI-council 2026-05-27. No-op under normal CLI.
    if PROGRESS_NDJSON and not opts.skip_bridges:
        ordered = sorted(tools)
        total = len(ordered)
        for idx, tool_id in enumerate(ordered, start=1):
            _emit_progress({
                "type": "file",
                "file": tool_id,
                "status": "deployed",
                "written": idx,
                "total": total,
            })

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

    # Module-root proposal (road-to-configurable-modules Phase B Step 2).
    # First-run TTY installs surface detected `modules:` candidates so
    # the user can paste an opt-in block into .agent-project-settings.yml.
    # Silent no-op on re-runs, CI, --quiet, and wizard apply-payload runs.
    _propose_modules_config(project_root, is_first_run)

    # Wizard auto-launch (Phase 6 follow-up). Runs after the success
    # banner so the user sees install completion even if the wizard
    # boot times out. Gate was already evaluated at the top of main()
    # for the pre-install banner; re-check here so the supervisor
    # logic stays the single source of truth.
    will_launch, _ = _wizard_should_launch(opts)
    if will_launch:
        return _wizard_spawn(project_root)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
