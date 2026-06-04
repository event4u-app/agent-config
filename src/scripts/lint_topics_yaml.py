#!/usr/bin/env python3
"""Linter for `.github/topics.yml`.

Asserts:
  * file exists and parses as YAML
  * `topics:` is a non-empty list
  * every topic matches `^[a-z0-9][a-z0-9-]*$` and is \u2264 50 chars
  * no duplicates
  * `notes:` key exists (may be empty mapping/string), so the
    rationale slot is never silently dropped
  * `equivalents:` (if present) is a mapping whose keys are all
    listed in `topics:`

Roadmap: agents/roadmaps/strategic-visibility-mcp-topics-positioning.md Phase 1.3.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
TOPICS_FILE = ROOT / ".github" / "topics.yml"
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
QUIET = "--quiet" in sys.argv


def _fail(msg: str) -> None:
    print(f"\u274c  topics.yml: {msg}", file=sys.stderr)


def main() -> int:
    if not TOPICS_FILE.exists():
        _fail(f"missing file: {TOPICS_FILE.relative_to(ROOT)}")
        return 1
    try:
        doc = yaml.safe_load(TOPICS_FILE.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as e:
        _fail(f"YAML parse error: {e}")
        return 1

    errors: list[str] = []

    topics = doc.get("topics")
    if not isinstance(topics, list) or not topics:
        errors.append("`topics:` must be a non-empty list")
        topics = []

    seen: set[str] = set()
    for t in topics:
        if not isinstance(t, str):
            errors.append(f"non-string topic entry: {t!r}")
            continue
        if len(t) > 50:
            errors.append(f"topic too long (>50 chars): {t!r}")
        if not SLUG_RE.match(t):
            errors.append(f"invalid slug (expect ^[a-z0-9][a-z0-9-]*$): {t!r}")
        if t in seen:
            errors.append(f"duplicate topic: {t!r}")
        seen.add(t)

    if "notes" not in doc:
        errors.append("`notes:` key missing (may be empty, but must be present)")

    equivalents = doc.get("equivalents")
    if equivalents is not None:
        if not isinstance(equivalents, dict):
            errors.append("`equivalents:` must be a mapping")
        else:
            for key, val in equivalents.items():
                if key not in seen:
                    errors.append(f"`equivalents:` key {key!r} not in `topics:`")
                if not isinstance(val, list) or not all(isinstance(v, str) for v in val):
                    errors.append(f"`equivalents.{key}` must be a list of strings")

    if errors:
        for e in errors:
            _fail(e)
        return 1

    if not QUIET:
        print(f"\u2705  topics.yml: {len(topics)} topic(s), all valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
