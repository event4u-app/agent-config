#!/usr/bin/env python3
"""File-first memory retrieval.

Implements the shared `retrieve(types, keys, limit)` abstraction used
by skills. Reads YAML under `agents/memory/<type>/` (curated, hand-
reviewed) and JSONL under `agents/memory/intake/*.jsonl` (agent-written,
append-only, supersede-chain aware), plus user-ingested `knowledge`
chunks and opted-in `cross-repo` matches.

Retrieval is entirely repo-side and file-backed — there is no external
backend. (The former optional `@event4u/agent-memory` package routing
was removed; see `docs/decisions/` for the agent-memory removal ADR.)

Usage:
    python3 scripts/memory_lookup.py --types domain-invariants,ownership \\
        --key "app/Http/Controllers/Foo" --limit 5
    python3 scripts/memory_lookup.py --types incident-learnings --format json

    from scripts.memory_lookup import retrieve
    hits = retrieve(types=["ownership"], keys=["app/Http"], limit=3)
"""

from __future__ import annotations

import argparse
import datetime
import fnmatch
import json
import sys
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Iterable, Union

MEMORY_ROOT = Path("agents/memory")
INTAKE_ROOT = MEMORY_ROOT / "intake"
KNOWLEDGE_ROOT = MEMORY_ROOT / "knowledge"

CURATED_TYPES = {
    "ownership",
    "historical-patterns",
    "domain-invariants",
    "incident-learnings",
    "product-rules",
}

# `knowledge` is its own type: user-ingested local documents that live
# under `agents/memory/knowledge/<ingest-id>/chunks/*.md`. They are
# repo-side (file-backed) but not "curated" and not intake.
KNOWLEDGE_TYPE = "knowledge"

# Cross-repo retrieval (road-to-leaner-core-and-discovery Phase 4). When this
# type is requested AND opted-in linked-project siblings exist, matches from
# scripts/cross_repo_retrieve.py are projected as `source="cross-repo"` Hits,
# scored below curated/knowledge so cross-repo context never outranks the
# project's own truth (mirrors the 0.85× knowledge discount, then floored
# further). Opt-in by caller (type must be requested) + lazy import → existing
# call sites and consumers without the script are unaffected.
CROSS_REPO_TYPE = "cross-repo"


@dataclass
class Hit:
    id: str
    type: str
    source: str            # "curated" | "intake" | "knowledge" | "cross-repo"
    path: str              # file (or logical locator) that produced the hit
    score: float           # naive, content-match based [0..1]
    entry: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class RetrievalResult:
    """Full retrieval payload."""
    hits: list

    def as_dict(self) -> dict:
        return {"hits": [h.as_dict() for h in self.hits]}


def _load_yaml(path: Path):
    try:
        import yaml
    except ImportError:
        print("error: PyYAML not installed. `pip install pyyaml`.",
              file=sys.stderr)
        sys.exit(2)
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


_CURATED_STATUS_EXCLUDE = {"deprecated", "archived", "superseded"}


def _iter_curated_entries(mtype: str) -> Iterable[tuple[Path, dict]]:
    """Yield (file, entry) pairs for curated files of `mtype`.

    Supports both the content-addressed layout (`agents/memory/<type>/
    <hash>.yml` — one entry per file) and the single-file layout
    (`agents/memory/<type>.yml` or `<type>/entries.yml` with an
    ``entries:`` list), so consumers can adopt either.

    Entries with status in ``_CURATED_STATUS_EXCLUDE`` are silently
    skipped — they are yielded only by :func:`_iter_curated_entries_all`
    (used by :func:`retrieve_with_meta` to populate the ``skipped`` list).
    """
    type_dir = MEMORY_ROOT / mtype
    single_file = MEMORY_ROOT / f"{mtype}.yml"
    if single_file.is_file():
        data = _load_yaml(single_file)
        for e in data.get("entries") or []:
            if isinstance(e, dict):
                if e.get("status") in _CURATED_STATUS_EXCLUDE:
                    continue
                yield single_file, e
    if type_dir.is_dir():
        for yml in sorted(type_dir.rglob("*.yml")):
            data = _load_yaml(yml) or {}
            entries = data.get("entries")
            if isinstance(entries, list):
                for e in entries:
                    if isinstance(e, dict):
                        if e.get("status") in _CURATED_STATUS_EXCLUDE:
                            continue
                        yield yml, e
            elif isinstance(data, dict) and data.get("id"):
                # Flat, one-entry-per-file layout (content-addressed).
                if data.get("status") in _CURATED_STATUS_EXCLUDE:
                    continue
                yield yml, data


def _iter_curated_entries_all(mtype: str) -> Iterable[tuple[Path, dict]]:
    """Like :func:`_iter_curated_entries` but yields ALL entries, including
    deprecated/archived/superseded ones.  Used by :func:`retrieve_with_meta`
    to build the ``skipped`` list.
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


def _iter_knowledge_entries() -> Iterable[tuple[Path, dict]]:
    """Yield (chunk-file, entry) pairs from `agents/memory/knowledge/`.

    Layout (frozen in `docs/contracts/local-knowledge-ingestion.md`):

        agents/memory/knowledge/<ingest-id>/
            manifest.json
            chunks/<n>.md

    Each chunk becomes one retrieval entry. The chunk body, the
    manifest source path, and pinned flag are surfaced into the entry
    so `_score()` can match on either the source path or the chunk
    text. The entry id is ``<ingest-id>:<chunk-stem>`` so callers can
    locate the exact file on disk.
    """
    if not KNOWLEDGE_ROOT.is_dir():
        return
    for ingest_dir in sorted(KNOWLEDGE_ROOT.iterdir()):
        if not ingest_dir.is_dir():
            continue
        manifest_path = ingest_dir / "manifest.json"
        manifest: dict = {}
        if manifest_path.is_file():
            try:
                manifest = json.loads(
                    manifest_path.read_text(encoding="utf-8")
                )
            except (ValueError, OSError):
                manifest = {}
        ingest_id = str(manifest.get("ingest_id") or ingest_dir.name)
        source = str(manifest.get("source") or "")
        pinned = bool(manifest.get("pinned", False))
        chunks_dir = ingest_dir / "chunks"
        if not chunks_dir.is_dir():
            continue
        for chunk in sorted(chunks_dir.glob("*.md")):
            try:
                body = chunk.read_text(encoding="utf-8")
            except OSError:
                continue
            entry = {
                "id": f"{ingest_id}:{chunk.stem}",
                "ingest_id": ingest_id,
                "source": source,
                "path": source,
                "body": body,
                "pinned": pinned,
                "source_kind": "knowledge",
            }
            yield chunk, entry


def _score(entry: dict, keys: list[str]) -> float:
    """Naive relevance score: max over keys of (glob-match | substring).

    Good enough for best-effort file retrieval.
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


def _cross_repo_hits(keys: list[str], limit: int) -> list[Hit]:
    """Project cross-repo matches into discounted, tagged Hits.

    Lazy + guarded: imports `cross_repo_retrieve` on demand and swallows any
    failure (script absent in a consumer install, no opted-in siblings) so the
    cross-repo type degrades to zero hits rather than breaking retrieval. Scores
    sit below curated/knowledge (0.85× floor, then a small per-rank decrement)
    so cross-repo context never outranks the project's own truth.
    """
    query = " ".join(k for k in keys if k).strip()
    if not query:
        return []
    try:
        import os
        import sys as _sys
        from pathlib import Path as _Path

        here = _Path(__file__).resolve().parent
        if str(here) not in _sys.path:
            _sys.path.insert(0, str(here))
        import cross_repo_retrieve  # type: ignore

        result = cross_repo_retrieve.retrieve(_Path(os.getcwd()), query, None, limit)
    except Exception:  # noqa: BLE001 — optional surface; never break retrieval
        return []

    hits: list[Hit] = []
    for i, m in enumerate(result.get("matches", [])):
        hits.append(Hit(
            id=f"cross-repo:{m.get('source_repo', '')}:{m.get('path', '')}",
            type=CROSS_REPO_TYPE,
            source="cross-repo",
            path=f"{m.get('source_repo', '')}/{m.get('path', '')}",
            score=round(0.7 * 0.85 - i * 0.01, 4),
            entry=m,
        ))
    return hits


def _is_stale(entry: dict, today: datetime.date) -> bool:
    """Return True when the entry's ``last_validated`` age exceeds ``review_after_days``.

    Both fields are optional; if either is absent or malformed the entry is
    treated as **not stale** (conservative — unknown freshness ≠ stale).
    """
    lv = entry.get("last_validated")
    rad = entry.get("review_after_days")
    if not lv or not isinstance(rad, int):
        return False
    try:
        validated = datetime.date.fromisoformat(str(lv))
    except ValueError:
        return False
    return (today - validated).days > rad


def _retrieve_internal(
    types: list[str],
    keys: list[str],
    limit: int,
    _today: datetime.date,
) -> tuple[list[Hit], list[dict]]:
    """Core retrieval loop shared by :func:`retrieve` and :func:`retrieve_with_meta`.

    Returns ``(hits, skipped)`` where ``hits`` is the ranked result list and
    ``skipped`` is a list of ``{"id", "type", "reason", "details"}`` dicts for
    curated entries that were excluded due to staleness. (Status-excluded entries
    are filtered upstream in :func:`_iter_curated_entries`; *all* entries including
    deprecated/superseded ones are scanned here via ``_iter_curated_entries_all``
    so they can appear in ``skipped`` when ``retrieve_with_meta`` is the caller,
    but only active, non-stale entries are passed through ``_iter_curated_entries``
    in the normal path.)
    """
    repo_hits: list[Hit] = []
    skipped: list[dict] = []

    for mtype in types:
        if mtype == KNOWLEDGE_TYPE:
            for path, entry in _iter_knowledge_entries():
                base = _score(entry, keys)
                # Pinned entries get a slight ranking boost so the
                # `/knowledge:list --pin` flag has retrieval effect.
                if entry.get("pinned"):
                    base = min(1.0, base + 0.05)
                repo_hits.append(Hit(
                    id=str(entry.get("id", "")),
                    type=KNOWLEDGE_TYPE,
                    source="knowledge",
                    path=str(path),
                    # Discount vs curated/intake so hand-reviewed repo
                    # entries still win on equal relevance.
                    score=base * 0.85,
                    entry=entry,
                ))
            continue
        if mtype == CROSS_REPO_TYPE:
            repo_hits.extend(_cross_repo_hits(keys, limit))
            continue
        if mtype not in CURATED_TYPES:
            continue
        # Curated entries: status filtering happens inside _iter_curated_entries.
        # We additionally filter stale entries here and track them in skipped.
        for path, entry in _iter_curated_entries(mtype):
            if _is_stale(entry, _today):
                lv = entry.get("last_validated", "unknown")
                rad = entry.get("review_after_days", "?")
                skipped.append({
                    "id": str(entry.get("id", "")),
                    "type": mtype,
                    "reason": "stale",
                    "details": f"last_validated={lv}, review_after_days={rad}",
                })
                continue
            repo_hits.append(Hit(
                id=str(entry.get("id", "")),
                type=mtype,
                source="curated",
                path=str(path),
                score=_score(entry, keys),
                entry=entry,
            ))
        # Capture superseded/deprecated entries in skipped (for retrieve_with_meta).
        for path, entry in _iter_curated_entries_all(mtype):
            status = entry.get("status", "active")
            if status in _CURATED_STATUS_EXCLUDE:
                skipped.append({
                    "id": str(entry.get("id", "")),
                    "type": mtype,
                    "reason": "superseded",
                    "details": f"status={status}",
                })
        for path, entry in _iter_intake_entries(mtype):
            repo_hits.append(Hit(
                id=str(entry.get("id", "")),
                type=mtype,
                source="intake",
                path=str(path),
                score=_score(entry, keys) * 0.9,  # slight discount vs curated
                entry=entry,
            ))

    repo_hits.sort(key=lambda h: (h.score, h.source == "curated"), reverse=True)
    positives = [h for h in repo_hits if h.score > 0]
    hits = (positives or repo_hits)[:limit]
    return hits, skipped


def retrieve(
    types: list[str],
    keys: list[str],
    limit: int = 5,
) -> list[Hit]:
    """Return up to `limit` hits across the requested types, highest score first.

    Repo entries (curated + intake) are preferred on ties — they are
    hand-reviewed or session-captured against the repo itself. Knowledge
    and cross-repo hits are discounted so the project's own truth wins on
    equal relevance.

    Curated entries with status ``deprecated``, ``archived``, or
    ``superseded`` are excluded. Stale entries (age > ``review_after_days``)
    are also excluded. Use :func:`retrieve_with_meta` to see skipped entries.
    """
    hits, _ = _retrieve_internal(types, keys, limit, _today=datetime.date.today())
    return hits


def retrieve_with_meta(
    types: list[str],
    keys: list[str],
    limit: int = 5,
    _today: datetime.date | None = None,
) -> dict:
    """Like :func:`retrieve` but returns a dict with ``results`` and ``skipped``.

    ``skipped`` lists curated entries excluded due to staleness or supersession,
    each with ``id``, ``type``, ``reason`` (``"stale"`` | ``"superseded"``), and
    ``details``. Callers should surface stale entries to the user — silently
    ignoring them violates the :mod:`analysis-memory-loop` contract (§ 4).

    ``_today`` may be injected for deterministic testing.
    """
    if _today is None:
        _today = datetime.date.today()
    hits, skipped = _retrieve_internal(types, keys, limit, _today=_today)
    return {"results": hits, "skipped": skipped}


def find_duplicate(
    types: list[str],
    keys: list[str],
    threshold: float = 0.6,
    _today: datetime.date | None = None,
) -> Hit | None:
    """Return the top hit if its score meets ``threshold``, else ``None``.

    Used by analysis skills for the dedup pre-check described in
    ``analysis-memory-loop`` § 2. A return value indicates an existing entry
    that should be reinforced or superseded rather than creating a new one.

    ``_today`` may be injected for deterministic testing.
    """
    result = retrieve_with_meta(types, keys, limit=1, _today=_today)
    hits = result.get("results", [])
    if hits and hits[0].score >= threshold:
        return hits[0]
    return None


CONTRACT_VERSION = 1

# Memory types this file-backed backend can answer. Types outside this
# set map to `unknown_type` per the retrieval contract.
_KNOWN_TYPES = CURATED_TYPES | {KNOWLEDGE_TYPE, CROSS_REPO_TYPE}


def retrieve_v1(
    types: list[str],
    keys: list[str],
    limit: int = 20,
) -> dict:
    """Return a v1 retrieval-contract envelope.

    Wraps :func:`retrieve` and projects the internal ``Hit`` shape into
    the shape defined by
    ``internal/schemas/retrieval-v1.schema.json``. Unknown types are reported as
    ``status: unknown_type`` for that slice only, rather than failing
    the whole call. All entries are file-backed (``source: "repo"``).
    """
    known = [t for t in types if t in _KNOWN_TYPES]
    unknown = [t for t in types if t not in _KNOWN_TYPES]

    hits = retrieve(known, keys, limit=limit)

    slice_counts: dict[str, int] = {t: 0 for t in known}
    entries: list[dict] = []
    for h in hits:
        envelope_entry: dict = {
            "id": h.id,
            "type": h.type,
            "source": "repo",
            "confidence": round(float(h.score), 4),
            "body": dict(h.entry) if isinstance(h.entry, dict) else {},
        }
        if h.type in slice_counts:
            slice_counts[h.type] += 1
        entries.append(envelope_entry)

    slices: dict[str, dict] = {
        t: {"status": "ok", "count": slice_counts.get(t, 0)}
        for t in known
    }
    errors: list[dict] = []
    for t in unknown:
        slices[t] = {"status": "unknown_type", "count": 0}
        errors.append({
            "type": t,
            "code": "unknown_type",
            "message": f"file-backed backend does not know type {t!r}",
        })

    oks = [s for s in slices.values() if s["status"] == "ok"]
    fails = [s for s in slices.values() if s["status"] != "ok"]
    envelope_status = (
        "ok" if not fails
        else "error" if not oks
        else "partial"
    )

    envelope: dict = {
        "contract_version": CONTRACT_VERSION,
        "status": envelope_status,
        "entries": entries,
        "slices": slices,
    }
    if errors:
        envelope["errors"] = errors
    return envelope


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--types", default="",
                    help="Comma-separated memory types (e.g., ownership,domain-invariants)")
    ap.add_argument("--key", action="append", default=[],
                    help="Retrieval key (repeatable)")
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--format", choices=["text", "json"], default="text")
    ap.add_argument("--envelope", choices=["legacy", "v1"], default="legacy",
                    help="Output shape: `legacy` (Hit list) or `v1` "
                         "(retrieval contract v1 envelope). `v1` implies JSON output.")
    args = ap.parse_args()
    types = [t.strip() for t in args.types.split(",") if t.strip()]
    if not types:
        print("error: --types is required", file=sys.stderr)
        return 2
    if args.envelope == "v1":
        envelope = retrieve_v1(types, args.key, args.limit)
        print(json.dumps(envelope, indent=2, default=str))
        return 0
    hits = retrieve(types, args.key, args.limit)
    if args.format == "json":
        payload = {"hits": [h.as_dict() for h in hits]}
        print(json.dumps(payload, indent=2, default=str))
    else:
        if not hits:
            print("  (no hits)")
        for h in hits:
            print(f"  [{h.source}] {h.type}  score={h.score:.2f}  "
                  f"id={h.id or '-'}  path={h.path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
