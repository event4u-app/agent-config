"""Compile the human-edited low-impact corpus Markdown to a YAML lockfile.

Step-10 — see ``agents/roadmaps/step-10-corpus-yaml-lockfile.md``.

Markdown (`agents/decisions/low-impact-decisions.md`) stays the
human-authored source-of-truth for PR review. This script reads it
through the hardened
:func:`scripts.ai_council.low_impact_corpus.parse_corpus_strict`
parser and writes a YAML lockfile that becomes the **runtime**
source-of-truth. The pattern mirrors `dist/agent-src/` vs
`.agent-src.uncondensed/`: human edits Markdown, `task consistency`
enforces lockfile parity via the same ``git diff --quiet`` gate.

YAML schema (`schema_version: 1`)::

    schema_version: 1
    provenance:
      source_path: agents/decisions/low-impact-decisions.md
      source_sha256: <hex>             # SHA-256 of the parsed Markdown bytes
      last_upstreamed: <40-hex sha>     # mirrored from the Markdown footer
    validated:
      - phrase: "raw bullet text"
        normalised: "raw bullet text"
        line_no: 42
        trailing_metadata: "validated 2025-01-15"
    probation: [...]
    anti_examples: [...]

Determinism: sorted keys disabled (preserve schema order), entries
ordered by ``line_no``, single trailing newline. PyYAML ``safe_dump``
with ``allow_unicode=True`` so phrases with non-ASCII characters
round-trip unchanged.

Failure-mode contract:

- Parser raises ``CorpusParseError`` -> compiler exits non-zero, does
  NOT write a partial lockfile.
- ``--check`` mode compares the freshly compiled output against the
  committed lockfile and exits non-zero on drift (CI gate).
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

import yaml

from scripts.ai_council.low_impact_corpus import (
    CorpusEntry,
    CorpusParseError,
    CorpusParseResult,
    parse_corpus_strict,
)

SCHEMA_VERSION = 1

_LAST_UPSTREAMED_RE = re.compile(r"^last-upstreamed:\s*([0-9a-f]{40})\s*$", re.MULTILINE)

_DEFAULT_SOURCE = Path("agents/decisions/low-impact-decisions.md")
_DEFAULT_OUT = Path("agents/decisions/low-impact-decisions.lock.yaml")


def _entry_to_dict(entry: CorpusEntry) -> dict[str, Any]:
    """Serialise a :class:`CorpusEntry` to schema-stable mapping."""
    data = asdict(entry)
    # ``section`` is implicit by parent key; drop to keep the YAML lean.
    data.pop("section", None)
    return data


def _extract_last_upstreamed(text: str) -> str:
    """Read the provenance SHA from the Markdown footer; ``"" `` if absent."""
    m = _LAST_UPSTREAMED_RE.search(text)
    return m.group(1) if m else ""


def _normalise_source_path(path: Path) -> str:
    """Return ``path`` as a POSIX string relative to cwd when possible.

    Absolute paths inside the current working directory are stripped to
    their relative form so the committed lockfile carries
    ``agents/decisions/low-impact-decisions.md`` regardless of how the
    compiler was invoked (CLI default, absolute path from a test, etc.).
    """
    try:
        rel = path.resolve().relative_to(Path.cwd().resolve())
    except (ValueError, OSError):
        rel = Path(path.name)
    return str(rel).replace("\\", "/")


def build_lock_document(
    source_path: Path,
    parse_result: CorpusParseResult,
    source_text: str,
) -> dict[str, Any]:
    """Return the schema-v1 mapping for ``parse_result``."""
    sha256 = hashlib.sha256(source_text.encode("utf-8")).hexdigest()
    return {
        "schema_version": SCHEMA_VERSION,
        "provenance": {
            "source_path": _normalise_source_path(source_path),
            "source_sha256": sha256,
            "last_upstreamed": _extract_last_upstreamed(source_text),
        },
        "validated": [_entry_to_dict(e) for e in parse_result.validated],
        "probation": [_entry_to_dict(e) for e in parse_result.probation],
        "anti_examples": [_entry_to_dict(e) for e in parse_result.anti_examples],
    }


def dump_lock_yaml(document: dict[str, Any]) -> str:
    """Serialise ``document`` deterministically to YAML text."""
    return yaml.safe_dump(
        document,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
        width=10_000,
    )


def compile_corpus(source_path: Path, out_path: Path) -> str:
    """Read ``source_path`` Markdown, write YAML lockfile to ``out_path``.

    Returns the YAML text that was written. Raises
    :class:`CorpusParseError` if the Markdown source has structural
    drift — caller is responsible for surfacing the error; no partial
    lockfile is written.
    """
    source_text = source_path.read_text(encoding="utf-8") if source_path.exists() else ""
    parse_result = parse_corpus_strict(source_path)
    document = build_lock_document(source_path, parse_result, source_text)
    yaml_text = dump_lock_yaml(document)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(yaml_text, encoding="utf-8")
    return yaml_text


def _main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="compile_corpus",
        description="Compile low-impact-decisions.md to YAML lockfile.",
    )
    parser.add_argument("--source", type=Path, default=_DEFAULT_SOURCE)
    parser.add_argument("--out", type=Path, default=_DEFAULT_OUT)
    parser.add_argument(
        "--check", action="store_true",
        help="Exit non-zero if the lockfile is stale (CI gate).",
    )
    args = parser.parse_args(argv)
    try:
        fresh = compile_corpus(args.source, args.out) if not args.check else None
        if args.check:
            source_text = args.source.read_text(encoding="utf-8") if args.source.exists() else ""
            parse_result = parse_corpus_strict(args.source)
            document = build_lock_document(args.source, parse_result, source_text)
            fresh = dump_lock_yaml(document)
            existing = args.out.read_text(encoding="utf-8") if args.out.exists() else ""
            if fresh != existing:
                sys.stderr.write(
                    f"low-impact corpus lockfile is stale: {args.out}\n"
                    f"  run: python3 -m scripts.ai_council.compile_corpus\n",
                )
                return 1
    except CorpusParseError as exc:
        sys.stderr.write(f"corpus parse failed: {exc}\n")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
