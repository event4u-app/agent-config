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
from typing import Any, Callable, Iterable, Optional, Union

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
    source: str            # "curated" | "intake" | "operational"
    path: str              # file (or logical locator) that produced the hit
    score: float           # naive, content-match based [0..1]
    entry: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class Shadow:
    """An operational entry suppressed by the conflict rule."""
    id: str
    type: str
    reason: str                    # "same-id" | "repo-deprecated"
    operational_path: str          # where the suppressed entry came from
    repo_path: str                 # repo entry that shadowed it

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class RetrievalResult:
    """Full retrieval payload with conflict-rule observability."""
    hits: list
    shadows: list = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "hits": [h.as_dict() for h in self.hits],
            "shadows": [s.as_dict() for s in self.shadows],
        }


# An operational provider returns repo-shaped Hit objects with
# source="operational". Backend adapters (e.g. @event4u/agent-memory)
# are expected to translate their native payload into this shape.
OperationalProvider = Callable[[list[str], list[str]], Iterable[Hit]]


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


def _apply_conflict_rule(
    repo_hits: list[Hit],
    operational_hits: list[Hit],
) -> tuple[list[Hit], list[Shadow]]:
    """Enforce REPO WINS / OPERATIONAL AUGMENTS / NEVER CONTRADICTS SILENTLY.

    Reference: `agents/roadmaps/road-to-memory-self-consumption.md` §
    "Conflict rule: repo vs. operational". The four cases mapped below
    are covered by `tests/test_conflict_rule.py`.
    """
    # Repo entries index — curated AND intake both count as "repo" for
    # the conflict rule. The operational store is the only non-repo side.
    repo_by_id: dict[str, Hit] = {h.id: h for h in repo_hits if h.id}

    merged: list[Hit] = list(repo_hits)
    shadows: list[Shadow] = []

    for op in operational_hits:
        if op.id and op.id in repo_by_id:
            # Case 1+2: same id → repo wins (including when repo is
            # status:deprecated — operational cannot revive a retired
            # entry). Suppress the operational entry and record shadow.
            repo = repo_by_id[op.id]
            reason = (
                "repo-deprecated"
                if repo.entry.get("status") == "deprecated"
                else "same-id"
            )
            shadows.append(Shadow(
                id=op.id,
                type=op.type,
                reason=reason,
                operational_path=op.path,
                repo_path=repo.path,
            ))
            continue
        # Case 3 (different ids on same logical key) and Case 4 (repo
        # has no entry) — both simply include the operational hit.
        # Repo entries naturally rank higher because their score is not
        # discounted (see _score / operational scoring in retrieve()).
        merged.append(op)

    return merged, shadows


def retrieve(
    types: list[str],
    keys: list[str],
    limit: int = 5,
    operational_provider: Optional[OperationalProvider] = None,
    with_shadows: bool = False,
) -> Union[list[Hit], RetrievalResult]:
    """Return up to `limit` hits across the requested types, highest score first.

    Repo entries (curated + intake) are preferred on ties — they are
    hand-reviewed or session-captured against the repo itself. When an
    `operational_provider` is supplied (the `present` path of the
    backend-detection contract), its results are merged under the
    REPO WINS conflict rule; suppressed operational entries surface as
    `shadows` when `with_shadows=True`.

    The return type stays `list[Hit]` by default for backward
    compatibility with existing skill call sites.
    """
    repo_hits: list[Hit] = []
    for mtype in types:
        if mtype not in CURATED_TYPES:
            continue
        for path, entry in _iter_curated_entries(mtype):
            repo_hits.append(Hit(
                id=str(entry.get("id", "")),
                type=mtype,
                source="curated",
                path=str(path),
                score=_score(entry, keys),
                entry=entry,
            ))
        for path, entry in _iter_intake_entries(mtype):
            repo_hits.append(Hit(
                id=str(entry.get("id", "")),
                type=mtype,
                source="intake",
                path=str(path),
                score=_score(entry, keys) * 0.9,  # slight discount vs curated
                entry=entry,
            ))

    operational_hits: list[Hit] = []
    if operational_provider is not None:
        try:
            for oh in operational_provider(list(types), list(keys)) or []:
                # Discount operational vs curated/intake so repo ranks
                # higher on equal relevance. Providers may already return
                # trust-adjusted scores; we only apply a floor discount.
                oh.score = min(oh.score, 0.85)
                operational_hits.append(oh)
        except Exception as exc:  # noqa: BLE001 — providers are external
            print(f"warning: operational_provider raised "
                  f"{exc.__class__.__name__}: {exc}", file=sys.stderr)

    merged, shadows = _apply_conflict_rule(repo_hits, operational_hits)
    merged.sort(key=lambda h: (h.score, h.source == "curated"), reverse=True)
    positives = [h for h in merged if h.score > 0]
    final_hits = (positives or merged)[:limit]

    if with_shadows:
        return RetrievalResult(hits=final_hits, shadows=shadows)
    return final_hits


CONTRACT_VERSION = 1

# Memory types this file-backed backend can answer. Types outside this
# set map to `unknown_type` per the retrieval contract.
_KNOWN_TYPES = CURATED_TYPES


def retrieve_v1(
    types: list[str],
    keys: list[str],
    limit: int = 20,
    operational_provider: Optional[OperationalProvider] = None,
) -> dict:
    """Return a v1 retrieval-contract envelope.

    Wraps :func:`retrieve` and projects the internal ``Hit`` shape into
    the shape defined by
    ``schemas/retrieval-v1.schema.json``. Unknown types are reported as
    ``status: unknown_type`` for that slice only, rather than failing
    the whole call.
    """
    known = [t for t in types if t in _KNOWN_TYPES]
    unknown = [t for t in types if t not in _KNOWN_TYPES]

    result = retrieve(known, keys, limit=limit,
                      operational_provider=operational_provider,
                      with_shadows=True)
    assert isinstance(result, RetrievalResult)
    hits, shadows = result.hits, result.shadows
    shadow_by_id = {s.id: s for s in shadows if s.id}

    slice_counts: dict[str, int] = {t: 0 for t in known}
    entries: list[dict] = []
    for h in hits:
        source = "operational" if h.source == "operational" else "repo"
        envelope_entry: dict = {
            "id": h.id,
            "type": h.type,
            "source": source,
            "confidence": round(float(h.score), 4),
            "body": dict(h.entry) if isinstance(h.entry, dict) else {},
            "shadowed_by": None,
        }
        if h.type in slice_counts:
            slice_counts[h.type] += 1
        entries.append(envelope_entry)

    # Surface shadowed operational entries as additional entries carrying
    # `shadowed_by`. The conformance harness checks that only
    # source="operational" entries ever set this field.
    for sid, s in shadow_by_id.items():
        entries.append({
            "id": sid,
            "type": s.type,
            "source": "operational",
            "confidence": 0.0,
            "body": {},
            "shadowed_by": f"repo:{sid}",
        })
        if s.type in slice_counts:
            slice_counts[s.type] += 1

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
    ap.add_argument("--with-shadows", action="store_true",
                    help="Include shadowed-operational entries in the output "
                         "(no-op until an operational backend is wired)")
    args = ap.parse_args()
    types = [t.strip() for t in args.types.split(",") if t.strip()]
    if not types:
        print("error: --types is required", file=sys.stderr)
        return 2
    if args.envelope == "v1":
        envelope = retrieve_v1(types, args.key, args.limit)
        print(json.dumps(envelope, indent=2, default=str))
        return 0
    result = retrieve(types, args.key, args.limit, with_shadows=args.with_shadows)
    if args.with_shadows:
        assert isinstance(result, RetrievalResult)
        hits, shadows = result.hits, result.shadows
    else:
        hits, shadows = result, []  # type: ignore[assignment]
    if args.format == "json":
        payload = {"hits": [h.as_dict() for h in hits],
                   "shadows": [s.as_dict() for s in shadows]}
        print(json.dumps(payload, indent=2, default=str))
    else:
        if not hits:
            print("  (no hits)")
        for h in hits:
            print(f"  [{h.source}] {h.type}  score={h.score:.2f}  "
                  f"id={h.id or '-'}  path={h.path}")
        if shadows:
            print(f"\n  shadows: {len(shadows)} operational entr"
                  f"{'y' if len(shadows) == 1 else 'ies'} suppressed by "
                  f"the conflict rule")
            for s in shadows:
                print(f"    [{s.reason}] {s.type}  id={s.id}  "
                      f"op={s.operational_path}  repo={s.repo_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
