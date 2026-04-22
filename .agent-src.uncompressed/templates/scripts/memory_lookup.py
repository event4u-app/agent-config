#!/usr/bin/env python3
"""File-based retrieval for the `absent` path.

Implements the shared `retrieve(types, keys, limit)` abstraction used
by skills. Reads YAML under `agents/memory/<type>/` (curated, hand-
reviewed) and JSONL under `agents/memory/intake/*.jsonl` (agent-written,
append-only, supersede-chain aware).

The returned shape is identical to the `present`-path adapter over the
`@event4u/agent-memory` API, so skills stay backend-agnostic.

Usage:
    python3 scripts/memory_lookup.py --types domain-invariants,ownership \\
        --key "app/Http/Controllers/Foo" --limit 5
    python3 scripts/memory_lookup.py --types incident-learnings --format json

    from scripts.memory_lookup import retrieve
    hits = retrieve(types=["ownership"], keys=["app/Http"], limit=3)
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import sys
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any, Iterable

MEMORY_ROOT = Path("agents/memory")
INTAKE_ROOT = MEMORY_ROOT / "intake"

CURATED_TYPES = {
    "ownership",
    "historical-patterns",
    "domain-invariants",
    "architecture-decisions",
    "incident-learnings",
    "product-rules",
}


@dataclass
class Hit:
    id: str
    type: str
    source: str            # "curated" or "intake"
    path: str              # file that produced the hit
    score: float           # naive, content-match based [0..1]
    entry: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return asdict(self)


def _load_yaml(path: Path):
    try:
        import yaml
    except ImportError:
        print("error: PyYAML not installed. `pip install pyyaml`.",
              file=sys.stderr)
        sys.exit(2)
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _iter_curated_entries(mtype: str) -> Iterable[tuple[Path, dict]]:
    """Yield (file, entry) pairs for curated files of `mtype`.

    Supports both the content-addressed layout (`agents/memory/<type>/
    <hash>.yml` — one entry per file) and the single-file layout
    (`agents/memory/<type>.yml` or `<type>/entries.yml` with an
    ``entries:`` list), so consumers can adopt either.
    """
    type_dir = MEMORY_ROOT / mtype
    single_file = MEMORY_ROOT / f"{mtype}.yml"
    if single_file.is_file():
        data = _load_yaml(single_file)
        for e in data.get("entries") or []:
            if isinstance(e, dict):
                yield single_file, e
    if type_dir.is_dir():
        for yml in sorted(type_dir.rglob("*.yml")):
            data = _load_yaml(yml) or {}
            entries = data.get("entries")
            if isinstance(entries, list):
                for e in entries:
                    if isinstance(e, dict):
                        yield yml, e
            elif isinstance(data, dict) and data.get("id"):
                # Flat, one-entry-per-file layout (content-addressed).
                yield yml, data


def _iter_intake_entries(mtype: str) -> Iterable[tuple[Path, dict]]:
    """Yield (file, entry) from intake JSONL, applying supersede chains."""
    if not INTAKE_ROOT.is_dir():
        return
    # Resolve supersede chains globally per file: later lines win.
    for jsonl in sorted(INTAKE_ROOT.glob("*.jsonl")):
        by_id: dict[str, dict] = {}
        superseded: set[str] = set()
        with jsonl.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except ValueError:
                    continue
                if obj.get("type") == "supersede":
                    target = obj.get("supersedes")
                    if isinstance(target, str):
                        superseded.add(target)
                    continue
                eid = obj.get("id")
                if isinstance(eid, str):
                    by_id[eid] = obj
        for eid, obj in by_id.items():
            if eid in superseded:
                continue
            if mtype and obj.get("entry_type") and obj["entry_type"] != mtype:
                continue
            yield jsonl, obj


def _score(entry: dict, keys: list[str]) -> float:
    """Naive relevance score: max over keys of (glob-match | substring).

    Good enough for the `absent` path where retrieval is best-effort.
    The `present` path returns a real score from agent-memory.
    """
    if not keys:
        return 0.1  # any hit beats no hit when there is no key
    hay_parts: list[str] = []
    for field_name in ("path", "key", "symptom", "feature", "rule", "body"):
        v = entry.get(field_name)
        if isinstance(v, str):
            hay_parts.append(v)
        elif isinstance(v, list):
            hay_parts.extend(str(x) for x in v)
    hay = " | ".join(hay_parts).lower()
    best = 0.0
    for k in keys:
        kl = k.lower()
        if fnmatch.fnmatch(hay, f"*{kl}*"):
            best = max(best, 0.8)
        elif kl in hay:
            best = max(best, 0.6)
    return best


def retrieve(types: list[str], keys: list[str], limit: int = 5) -> list[Hit]:
    """Return up to `limit` hits across the requested types, highest score first.

    Curated entries are preferred on ties — they are hand-reviewed.
    The shape (`Hit`) matches the `present` backend adapter so skills
    can treat both sources identically.
    """
    hits: list[Hit] = []
    for mtype in types:
        if mtype not in CURATED_TYPES:
            continue
        for path, entry in _iter_curated_entries(mtype):
            hits.append(Hit(
                id=str(entry.get("id", "")),
                type=mtype,
                source="curated",
                path=str(path),
                score=_score(entry, keys),
                entry=entry,
            ))
        for path, entry in _iter_intake_entries(mtype):
            hits.append(Hit(
                id=str(entry.get("id", "")),
                type=mtype,
                source="intake",
                path=str(path),
                score=_score(entry, keys) * 0.9,  # slight discount vs curated
                entry=entry,
            ))
    hits.sort(key=lambda h: (h.score, h.source == "curated"), reverse=True)
    # Drop zero-score hits unless no better option exists.
    positives = [h for h in hits if h.score > 0]
    return (positives or hits)[:limit]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--types", default="",
                    help="Comma-separated memory types (e.g., ownership,domain-invariants)")
    ap.add_argument("--key", action="append", default=[],
                    help="Retrieval key (repeatable)")
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--format", choices=["text", "json"], default="text")
    args = ap.parse_args()
    types = [t.strip() for t in args.types.split(",") if t.strip()]
    if not types:
        print("error: --types is required", file=sys.stderr)
        return 2
    hits = retrieve(types, args.key, args.limit)
    if args.format == "json":
        print(json.dumps([h.as_dict() for h in hits], indent=2, default=str))
    else:
        if not hits:
            print("  (no hits)")
        for h in hits:
            print(f"  [{h.source}] {h.type}  score={h.score:.2f}  "
                  f"id={h.id or '-'}  path={h.path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
