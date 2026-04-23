#!/usr/bin/env python3
"""
Frontmatter validator (stdlib-only Draft-07 subset).

Validates the YAML frontmatter of an agent artefact (skill, rule, command,
persona) against its JSON-Schema in ``scripts/schemas/``.

Supported keywords: ``type``, ``required``, ``properties``,
``additionalProperties``, ``enum``, ``pattern``, ``items``, ``minLength``,
``maxLength``, ``minItems``, ``minimum``. No ``$ref``, no ``allOf``/``anyOf``
— the schemas in this repo deliberately stay flat.

The goal is a **better error surface**: each violation comes back as a
``SchemaError`` with ``path`` (dotted JSON pointer), ``rule`` (the schema
keyword that failed), and a human-readable message.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

__all__ = [
    "SchemaError",
    "validate",
    "load_schema",
    "parse_frontmatter",
]

_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


@dataclass(frozen=True)
class SchemaError:
    path: str
    rule: str
    message: str

    def format(self, file: str | None = None, line: int | None = None) -> str:
        prefix = file or "<data>"
        if line is not None:
            prefix = f"{prefix}:{line}"
        return f"{prefix} – {self.rule} at {self.path} – {self.message}"


# --- Frontmatter parser (stdlib-only, YAML subset) -------------------------

def parse_frontmatter(text: str) -> tuple[dict[str, Any] | None, int]:
    """Extract and parse the YAML frontmatter block.

    Returns (parsed_dict, line_offset). ``line_offset`` is the 1-based line
    number where the frontmatter body begins (so error lines can be mapped
    back to the source file).
    Supports: scalar key/value (quoted or bare), booleans (``true``/``false``),
    integers, inline lists (``[a, b]``), block lists (``- a``), and nested
    one-level blocks (``execution:``).
    """
    match = _FRONTMATTER_RE.search(text)
    if not match:
        return None, 0
    body = match.group(1)
    line_offset = text[: match.start()].count("\n") + 2  # +2 for `---\n`
    return _parse_yaml_block(body), line_offset


def _coerce(value: str) -> Any:
    value = value.strip()
    if value == "":
        return ""
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    if re.fullmatch(r"-?[0-9]+", value):
        return int(value)
    return value


def _parse_inline_list(value: str) -> list[Any]:
    inner = value.strip()[1:-1].strip()
    if not inner:
        return []
    return [_coerce(item) for item in _split_commas(inner)]


def _split_commas(text: str) -> list[str]:
    """Split on commas that aren't inside quotes. Stdlib-only."""
    parts: list[str] = []
    buf: list[str] = []
    quote: str | None = None
    for ch in text:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
        elif ch in ('"', "'"):
            quote = ch
            buf.append(ch)
        elif ch == ",":
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf).strip())
    return parts


def _parse_yaml_block(body: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    lines = body.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.rstrip()
        if not stripped.strip() or stripped.lstrip().startswith("#"):
            i += 1
            continue
        if line[0].isspace():  # orphan indented line — skip
            i += 1
            continue
        m = re.match(r"^([\w-]+):\s*(.*)$", stripped)
        if not m:
            i += 1
            continue
        key, raw = m.group(1), m.group(2).strip()
        if raw == "":
            # Nested block or block list — peek ahead.
            peek = lines[i + 1] if i + 1 < len(lines) else ""
            if peek.lstrip().startswith("- "):
                items, consumed = _consume_block_list(lines, i + 1)
                result[key] = items
                i += 1 + consumed
                continue
            if peek and peek[0].isspace():
                nested, consumed = _consume_nested_block(lines, i + 1)
                result[key] = nested
                i += 1 + consumed
                continue
            result[key] = ""
        elif raw.startswith("[") and raw.endswith("]"):
            result[key] = _parse_inline_list(raw)
        else:
            result[key] = _coerce(raw)
        i += 1
    return result


def _consume_block_list(lines: list[str], start: int) -> tuple[list[Any], int]:
    items: list[Any] = []
    i = start
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        stripped = line.lstrip()
        if not stripped.startswith("- "):
            break
        items.append(_coerce(stripped[2:]))
        i += 1
    return items, i - start


# --- Schema loader ---------------------------------------------------------

_SCHEMA_DIR = Path(__file__).resolve().parent / "schemas"
_SCHEMA_CACHE: dict[str, dict[str, Any]] = {}


def load_schema(artefact_type: str) -> dict[str, Any]:
    """Load and cache a schema by artefact type (skill, rule, command, persona)."""
    if artefact_type in _SCHEMA_CACHE:
        return _SCHEMA_CACHE[artefact_type]
    path = _SCHEMA_DIR / f"{artefact_type}.schema.json"
    if not path.exists():
        raise FileNotFoundError(f"No schema for artefact type '{artefact_type}' at {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    _SCHEMA_CACHE[artefact_type] = data
    return data


# --- Validator core (Draft-07 subset) --------------------------------------

_JSON_TYPES: dict[str, tuple[type, ...]] = {
    "object": (dict,),
    "array": (list,),
    "string": (str,),
    "integer": (int,),
    "number": (int, float),
    "boolean": (bool,),
    "null": (type(None),),
}


def validate(data: Any, schema: dict[str, Any]) -> list[SchemaError]:
    """Validate ``data`` against ``schema``; return a list of errors (empty = pass)."""
    errors: list[SchemaError] = []
    _validate_node(data, schema, "$", errors)
    return errors


def _validate_node(data: Any, schema: dict[str, Any], path: str, errors: list[SchemaError]) -> None:
    # type
    expected_type = schema.get("type")
    if expected_type is not None:
        allowed = _JSON_TYPES.get(expected_type)
        if allowed is None:
            errors.append(SchemaError(path, "type", f"Unsupported schema type '{expected_type}'"))
            return
        # Booleans are a subtype of int in Python — exclude them from integer/number.
        if expected_type in ("integer", "number") and isinstance(data, bool):
            errors.append(SchemaError(path, "type", f"Expected {expected_type}, got boolean"))
            return
        if not isinstance(data, allowed):
            errors.append(SchemaError(
                path, "type",
                f"Expected {expected_type}, got {_typename(data)}",
            ))
            return

    if isinstance(data, dict):
        _validate_object(data, schema, path, errors)
    elif isinstance(data, list):
        _validate_array(data, schema, path, errors)
    elif isinstance(data, str):
        _validate_string(data, schema, path, errors)
    elif isinstance(data, int) and not isinstance(data, bool):
        _validate_integer(data, schema, path, errors)

    # enum is type-independent
    if "enum" in schema and data not in schema["enum"]:
        errors.append(SchemaError(
            path, "enum",
            f"Value {data!r} is not one of {schema['enum']}",
        ))


def _validate_object(data: dict[str, Any], schema: dict[str, Any], path: str, errors: list[SchemaError]) -> None:
    required = schema.get("required", [])
    for key in required:
        if key not in data:
            errors.append(SchemaError(f"{path}.{key}", "required", f"Missing required property '{key}'"))

    properties = schema.get("properties", {})
    additional = schema.get("additionalProperties", True)

    for key, value in data.items():
        child_path = f"{path}.{key}"
        if key in properties:
            _validate_node(value, properties[key], child_path, errors)
        elif additional is False:
            errors.append(SchemaError(
                child_path, "additionalProperties",
                f"Unknown property '{key}' not allowed",
            ))


def _validate_array(data: list[Any], schema: dict[str, Any], path: str, errors: list[SchemaError]) -> None:
    items_schema = schema.get("items")
    if items_schema is not None:
        for index, item in enumerate(data):
            _validate_node(item, items_schema, f"{path}[{index}]", errors)
    min_items = schema.get("minItems")
    if min_items is not None and len(data) < min_items:
        errors.append(SchemaError(path, "minItems", f"Array has {len(data)} items, need ≥ {min_items}"))


def _validate_string(data: str, schema: dict[str, Any], path: str, errors: list[SchemaError]) -> None:
    pattern = schema.get("pattern")
    if pattern is not None and not re.search(pattern, data):
        errors.append(SchemaError(path, "pattern", f"Value {data!r} does not match /{pattern}/"))
    min_len = schema.get("minLength")
    if min_len is not None and len(data) < min_len:
        errors.append(SchemaError(path, "minLength", f"String length {len(data)} < {min_len}"))
    max_len = schema.get("maxLength")
    if max_len is not None and len(data) > max_len:
        errors.append(SchemaError(path, "maxLength", f"String length {len(data)} > {max_len}"))


def _validate_integer(data: int, schema: dict[str, Any], path: str, errors: list[SchemaError]) -> None:
    minimum = schema.get("minimum")
    if minimum is not None and data < minimum:
        errors.append(SchemaError(path, "minimum", f"{data} < {minimum}"))


def _typename(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _consume_nested_block(lines: list[str], start: int) -> tuple[dict[str, Any], int]:
    nested: dict[str, Any] = {}
    i = start
    # Lock in the indent of the outer nested block from the first content
    # line so we know when the block ends.
    block_indent: int | None = None
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if not line[0].isspace():
            break
        indent = len(line) - len(line.lstrip())
        if block_indent is None:
            block_indent = indent
        elif indent < block_indent:
            break
        stripped = line.strip()
        if stripped.startswith("#"):
            i += 1
            continue
        m = re.match(r"^([\w-]+):\s*(.*)$", stripped)
        if not m:
            i += 1
            continue
        key, raw = m.group(1), m.group(2).strip()
        if raw.startswith("[") and raw.endswith("]"):
            nested[key] = _parse_inline_list(raw)
        elif raw == "":
            # Value continues on the next line(s). Peek ahead: a block list
            # at deeper indent means this key holds a list; anything else
            # treated as empty string (one-level nesting only).
            peek = lines[i + 1] if i + 1 < len(lines) else ""
            peek_stripped = peek.lstrip()
            peek_indent = len(peek) - len(peek_stripped) if peek_stripped else -1
            if peek_stripped.startswith("- ") and peek_indent > indent:
                items, consumed = _consume_block_list(lines, i + 1)
                nested[key] = items
                i += 1 + consumed
                continue
            nested[key] = ""
        else:
            nested[key] = _coerce(raw)
        i += 1
    return nested, i - start


# --- CLI entry point -------------------------------------------------------

def _iter_artefacts(root: Path) -> list[tuple[str, Path]]:
    """Yield ``(artefact_type, path)`` pairs for all lintable artefacts."""
    targets: list[tuple[str, Path]] = []
    mapping = (
        ("skill",   sorted(root.joinpath("skills").rglob("SKILL.md"))),
        ("rule",    sorted(root.joinpath("rules").rglob("*.md"))),
        ("command", sorted(root.joinpath("commands").rglob("*.md"))),
        ("persona", [
            f for f in sorted(root.joinpath("personas").glob("*.md"))
            if f.name.lower() != "readme.md"
        ]),
    )
    for artefact_type, files in mapping:
        for f in files:
            if f.is_symlink():
                continue
            targets.append((artefact_type, f))
    return targets


def _main() -> int:
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate agent-artefact frontmatter against JSON-Schema.",
    )
    parser.add_argument(
        "--root",
        default=".agent-src.uncompressed",
        help="Source root to scan (default: .agent-src.uncompressed).",
    )
    args = parser.parse_args()

    root = Path(args.root)
    if not root.is_dir():
        print(f"error: source root not found: {root}", file=sys.stderr)
        return 2

    total = 0
    failing = 0
    for artefact_type, path in _iter_artefacts(root):
        total += 1
        text = path.read_text(encoding="utf-8")
        data, _offset = parse_frontmatter(text)
        if data is None:
            # Other tooling flags missing frontmatter; don't double-report.
            continue
        schema = load_schema(artefact_type)
        errors = validate(data, schema)
        if errors:
            failing += 1
            for error in errors:
                print(f"[{artefact_type}] {path}: {error.rule} at "
                      f"{error.path} – {error.message}")

    print(f"\n== Frontmatter schema: {total} artefacts, "
          f"{failing} failing ==")
    return 1 if failing else 0


if __name__ == "__main__":
    sys.exit(_main())
