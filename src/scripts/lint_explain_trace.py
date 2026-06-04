#!/usr/bin/env python3
"""Lint an ExplainTrace v1 JSON payload against the schema.

Reads a JSON file (or stdin via ``--stdin``) and validates it against
``docs/contracts/explain-trace.schema.json``. Exit 0 on success,
1 on validation failure, 2 on invocation error (missing schema, bad
JSON). Used by Phase 4 unit tests; called from the
``lint-explain-trace`` Taskfile target.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import jsonschema


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _load_schema() -> dict:
    schema_path = _repo_root() / "docs" / "contracts" / "explain-trace.schema.json"
    if not schema_path.exists():
        print(f"❌  explain-trace schema not found at {schema_path}", file=sys.stderr)
        raise SystemExit(2)
    with schema_path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _read_payload(path: str | None, *, from_stdin: bool) -> object:
    if from_stdin:
        try:
            return json.load(sys.stdin)
        except json.JSONDecodeError as exc:
            print(f"❌  stdin is not valid JSON: {exc}", file=sys.stderr)
            raise SystemExit(2) from exc
    if path is None:
        print("❌  pass a JSON file path or --stdin", file=sys.stderr)
        raise SystemExit(2)
    p = Path(path)
    if not p.exists():
        print(f"❌  trace file not found: {p}", file=sys.stderr)
        raise SystemExit(2)
    try:
        with p.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        print(f"❌  {p} is not valid JSON: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="lint_explain_trace",
        description="Validate an ExplainTrace v1 JSON payload against the schema.",
    )
    parser.add_argument("path", nargs="?", default=None, help="Path to a JSON trace file.")
    parser.add_argument("--stdin", action="store_true", help="Read the trace from stdin.")
    opts = parser.parse_args(argv)

    schema = _load_schema()
    jsonschema.Draft202012Validator.check_schema(schema)
    payload = _read_payload(opts.path, from_stdin=opts.stdin)

    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.absolute_path))
    if errors:
        for err in errors:
            loc = "/".join(str(p) for p in err.absolute_path) or "<root>"
            print(f"❌  {loc}: {err.message}", file=sys.stderr)
        return 1
    print("✅  explain-trace OK")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
