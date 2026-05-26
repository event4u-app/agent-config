#!/usr/bin/env python3
"""Persist a ``modules:`` block into ``.agent-project-settings.yml``.

Phase E Step 1 of road-to-configurable-modules — the persistence side
of the GUI wizard's modules step. Reads a JSON payload (stdin or
``--input-file``) and patches the ``modules.*`` keys in the team file
while preserving comments, ordering, and surrounding YAML blocks.

The patch logic mirrors :func:`scripts.install._replace_template_value_raw`
so the wizard, ``/agents init``, and a hand-edit all converge on the
same on-disk shape. Comment-preserving by design — never round-trips
through PyYAML, which strips block comments.

Usage:
    cat payload.json | python3 scripts/apply_modules_config.py --project <root>
    python3 scripts/apply_modules_config.py --project <root> --input-file <path>

JSON payload shape (matches ``proposed_block`` from
``propose_modules_config.py --json``):

    {
      "enabled": true,
      "root_paths": ["app/Modules"],
      "namespace_template": "App\\\\Modules\\\\{ModuleName}\\\\App",
      "agent_folder": "agents",
      "skip_dirs": [".module-template", ".example"]
    }

Exit codes:
    0 — patched successfully (or no-op when payload says decline).
    2 — invalid arguments, unreachable project root, or malformed JSON.
    3 — template-resolve failure (cannot bootstrap a missing team file).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib.agent_src import resolve_logical  # noqa: E402

TEAM_FILE = ".agent-project-settings.yml"
TEMPLATE_LOGICAL = "templates/agents/agent-project-settings.example.yml"

_BARE_ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def _yaml_scalar(value: str) -> str:
    """Format a string as a YAML scalar with minimal quoting.

    Mirror of :func:`scripts.install._yaml_scalar` — duplicated here so
    the persistence helper stays self-contained (importing ``install``
    drags 4.8k lines of installer surface).
    """
    if value == "":
        return '""'
    if value in ("true", "false"):
        return value
    if value.isdigit():
        return value
    if _BARE_ID_RE.match(value):
        return value
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _replace_template_value_raw(template: str, dotted_path: str, raw_yaml: str) -> str:
    """Replace the value at *dotted_path* with the pre-formatted *raw_yaml*.

    Port of :func:`scripts.install._replace_template_value_raw`. Tracks
    parent sections by indent (2-space stride) so the leaf scalar is
    only patched when every parent matches. Comments + indentation are
    preserved. Returns *template* unchanged if the path is missing.
    """
    parts = dotted_path.split(".")
    if not parts:
        return template
    sections = parts[:-1]
    key = parts[-1]
    target_indent = "  " * len(sections)
    header_re = re.compile(r"^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*$")
    scalar_re = re.compile(r"^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*\S.*$")
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


def _yaml_flow_list(items: list[str]) -> str:
    """Render a list as a flow-style YAML sequence (`[a, b, c]`)."""
    if not items:
        return "[]"
    return "[" + ", ".join(_yaml_scalar(item) for item in items) + "]"


def _yaml_bool(value: bool) -> str:
    return "true" if value else "false"


def _resolve_template_path() -> Path | None:
    """Resolve the bundled ``agent-project-settings.example.yml``.

    Used to bootstrap the team file when the consumer project has not
    committed one yet. Mirrors :func:`scripts.check_template_pin_drift._template_files`
    so source-of-truth resolution is identical across helpers.
    """
    src = resolve_logical(TEMPLATE_LOGICAL)
    if src is not None and src.is_file():
        return src
    fallback = REPO_ROOT / ".agent-src.uncondensed" / TEMPLATE_LOGICAL
    if fallback.is_file():
        return fallback
    return None


def _load_payload(args: argparse.Namespace) -> dict[str, object]:
    if args.input_file:
        raw = Path(args.input_file).read_text(encoding="utf-8")
    else:
        raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON payload: {exc}", file=sys.stderr)
        sys.exit(2)
    if not isinstance(data, dict):
        print("error: payload must be a JSON object", file=sys.stderr)
        sys.exit(2)
    return data


def _coerce_str_list(value: object, field: str) -> list[str]:
    if not isinstance(value, list):
        print(f"error: payload.{field} must be a list", file=sys.stderr)
        sys.exit(2)
    out: list[str] = []
    for item in value:
        if not isinstance(item, str):
            print(f"error: payload.{field}[*] must be strings", file=sys.stderr)
            sys.exit(2)
        out.append(item)
    return out


def _patch_modules(template: str, payload: dict[str, object]) -> str:
    """Patch the four modules.* leaves in *template* per *payload*.

    Missing keys in *payload* fall back to safe defaults that match the
    bundled template (``enabled=false``, empty paths, ``agents``,
    template skip-dirs). Patching is no-op for any key whose dotted
    path is absent from *template* (returns the section untouched).
    """
    enabled = bool(payload.get("enabled", False))
    root_paths = _coerce_str_list(payload.get("root_paths", []), "root_paths")
    ns_template = payload.get("namespace_template", "")
    if not isinstance(ns_template, str):
        print("error: payload.namespace_template must be a string", file=sys.stderr)
        sys.exit(2)
    agent_folder = payload.get("agent_folder", "agents")
    if not isinstance(agent_folder, str) or agent_folder == "":
        agent_folder = "agents"
    skip_dirs = _coerce_str_list(
        payload.get("skip_dirs", [".module-template", ".example"]),
        "skip_dirs",
    )

    acknowledged = bool(payload.get("detection_acknowledged", False))

    out = template
    out = _replace_template_value_raw(out, "modules.enabled", _yaml_bool(enabled))
    out = _replace_template_value_raw(out, "modules.root_paths", _yaml_flow_list(root_paths))
    out = _replace_template_value_raw(out, "modules.namespace_template", _yaml_scalar(ns_template))
    out = _replace_template_value_raw(out, "modules.agent_folder", _yaml_scalar(agent_folder))
    out = _replace_template_value_raw(out, "modules.skip_dirs", _yaml_flow_list(skip_dirs))
    out = _replace_template_value_raw(
        out, "modules.detection_acknowledged", _yaml_bool(acknowledged)
    )
    return out


def _patch_acknowledge_only(template: str) -> str:
    """Flip ``modules.detection_acknowledged`` to ``true`` without touching siblings.

    Used by the ``--acknowledge-only`` flag: the user said "not now" to
    the on-the-fly prompt and we only want to silence future nags. Every
    other ``modules.*`` key stays at whatever the template / team file
    already had.
    """
    return _replace_template_value_raw(
        template, "modules.detection_acknowledged", _yaml_bool(True)
    )


def _bootstrap_team_file(team_path: Path) -> str:
    template_path = _resolve_template_path()
    if template_path is None:
        print(
            "error: cannot bootstrap .agent-project-settings.yml — "
            f"template missing at {TEMPLATE_LOGICAL}",
            file=sys.stderr,
        )
        sys.exit(3)
    return template_path.read_text(encoding="utf-8")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="apply_modules_config.py",
        description=(
            "Patch the modules: block in .agent-project-settings.yml "
            "from a JSON payload (stdin or --input-file). Comment- and "
            "ordering-preserving."
        ),
    )
    parser.add_argument(
        "--project",
        default=None,
        help="project root containing .agent-project-settings.yml (default: cwd)",
    )
    parser.add_argument(
        "--input-file",
        default=None,
        help="read JSON payload from this file instead of stdin",
    )
    parser.add_argument(
        "--decline",
        action="store_true",
        help="payload represents an explicit decline — write nothing, exit 0",
    )
    parser.add_argument(
        "--acknowledge-only",
        action="store_true",
        help=(
            "flip modules.detection_acknowledged=true without touching any "
            "other modules.* key — used by the on-the-fly detection skill "
            "when the user said 'not now'. Reads no payload."
        ),
    )
    args = parser.parse_args(argv)
    if args.decline:
        return 0
    root = Path(args.project).expanduser().resolve() if args.project else Path.cwd().resolve()
    if not root.is_dir():
        print(f"error: project root is not a directory: {root}", file=sys.stderr)
        return 2
    team_path = root / TEAM_FILE
    if team_path.is_file():
        template = team_path.read_text(encoding="utf-8")
    else:
        template = _bootstrap_team_file(team_path)
    if args.acknowledge_only:
        patched = _patch_acknowledge_only(template)
    else:
        payload = _load_payload(args)
        patched = _patch_modules(template, payload)
    team_path.write_text(patched, encoding="utf-8")
    print(str(team_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
