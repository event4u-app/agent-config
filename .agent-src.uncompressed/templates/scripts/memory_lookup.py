#!/usr/bin/env python3
"""Hybrid retrieval — file-first with optional package augmentation.

Implements the shared `retrieve(types, keys, limit)` abstraction used
by skills. Reads YAML under `agents/memory/<type>/` (curated, hand-
reviewed) and JSONL under `agents/memory/intake/*.jsonl` (agent-written,
append-only, supersede-chain aware).

When the `@event4u/agent-memory` package is present (see
`scripts/memory_status.py`), callers can pass the result of
:func:`package_operational_provider` to route additional retrieval
through the package's semantic CLI. Repo entries always win on
conflict — see `_apply_conflict_rule`.

Usage:
    python3 scripts/memory_lookup.py --types domain-invariants,ownership \\
        --key "app/Http/Controllers/Foo" --limit 5
    python3 scripts/memory_lookup.py --types incident-learnings --format json
    python3 scripts/memory_lookup.py --types ownership --key billing --auto

    from scripts.memory_lookup import retrieve, package_operational_provider
    hits = retrieve(
        types=["ownership"], keys=["app/Http"], limit=3,
        operational_provider=package_operational_provider(),
    )
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import subprocess
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


# ---------------------------------------------------------------------------
# Package-backed operational provider (the `present` path)
# ---------------------------------------------------------------------------
#
# When `memory_status.status() == "present"` the consumer-facing contract
# says retrieval should route through `@event4u/agent-memory`. The package
# CLI is purely **semantic** (`memory retrieve <query> --type T …`); the
# shared `retrieve(types, keys, …)` API is **key-based**. The hybrid
# resolution agreed in `agents/contexts/agent-memory-contract.md` synthesises
# `keys` into a single natural-language query for the package call, while
# the file fallback continues to do glob/substring matching on the same
# keys. Both legs land in the same `Hit` shape so the conflict rule can
# merge them transparently.

_CLI_TIMEOUT_SECONDS = 5.0
_CLI_RETRIEVE_LIMIT_DEFAULT = 20


def _synthesize_query(keys: list[str]) -> str:
    """Turn a list of retrieval keys into one natural-language query.

    Keys are typically file paths (`app/Http/Controllers/Foo`), feature
    names (`billing`), or short identifiers — joining them with spaces
    gives the package's semantic search enough surface to score against
    without inventing structure. Empty or whitespace-only keys are
    dropped; if nothing remains the caller falls back to the file path.
    """
    cleaned = [k.strip() for k in keys if isinstance(k, str) and k.strip()]
    return " ".join(cleaned)


def _cli_operational_provider(
    types: list[str],
    keys: list[str],
    *,
    cli_path: str = "memory",
    timeout: float = _CLI_TIMEOUT_SECONDS,
    limit: int = _CLI_RETRIEVE_LIMIT_DEFAULT,
) -> Iterable[Hit]:
    """Run `memory retrieve` and yield operational `Hit` objects.

    Pino structured logs from the package go to stderr; stdout is a
    clean v1 retrieval envelope. Any non-zero exit, timeout, or parse
    failure degrades to "no operational hits" — `retrieve()` already
    treats provider exceptions as a soft warning, so the caller still
    gets the file-fallback result.
    """
    query = _synthesize_query(keys)
    if not query:
        return
    cmd: list[str] = [cli_path, "retrieve", query, "--limit", str(limit)]
    for t in types:
        cmd.extend(["--type", t])
    try:
        out = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=timeout,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return
    if out.returncode != 0:
        return
    try:
        envelope = json.loads(out.stdout)
    except (ValueError, TypeError):
        return
    entries = envelope.get("entries") if isinstance(envelope, dict) else None
    if not isinstance(entries, list):
        return
    for e in entries:
        if not isinstance(e, dict):
            continue
        eid = e.get("id")
        etype = e.get("type")
        if not isinstance(eid, str) or not isinstance(etype, str):
            continue
        # The package returns `confidence` (0..1) per the v1 envelope;
        # map it onto our internal `score` field so the conflict rule
        # and ranking work uniformly across providers.
        try:
            score = float(e.get("confidence", 0.0))
        except (TypeError, ValueError):
            score = 0.0
        body = e.get("body") if isinstance(e.get("body"), dict) else {}
        yield Hit(
            id=eid,
            type=etype,
            source="operational",
            path=f"agent-memory:{eid}",
            score=score,
            entry=body,
        )


def package_operational_provider() -> Optional[OperationalProvider]:
    """Return a CLI-backed provider when the package is `present`, else None.

    Callers who want automatic backend routing pass the result directly
    to :func:`retrieve` — `None` is a safe value that yields file-only
    retrieval, so this is the recommended one-liner for skills:

        retrieve(types, keys, operational_provider=package_operational_provider())

    The status probe is bounded (≤ 2s, cached per process) — see
    `scripts/memory_status.py`. We import lazily so pure file-fallback
    callers never pay for the probe.
    """
    # Late import: keeps `memory_lookup` importable even when
    # `memory_status` is missing in stripped consumer installs.
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import memory_status  # type: ignore[import-not-found]
    except ImportError:
        return None
    if memory_status.status().status != "present":
        return None
    return _cli_operational_provider


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
    ap.add_argument("--auto", action="store_true",
                    help="Auto-route to the @event4u/agent-memory package "
                         "when memory_status.status() == 'present'; "
                         "falls through to file-only retrieval otherwise")
    args = ap.parse_args()
    types = [t.strip() for t in args.types.split(",") if t.strip()]
    if not types:
        print("error: --types is required", file=sys.stderr)
        return 2
    op_provider = package_operational_provider() if args.auto else None
    if args.envelope == "v1":
        envelope = retrieve_v1(types, args.key, args.limit,
                               operational_provider=op_provider)
        print(json.dumps(envelope, indent=2, default=str))
        return 0
    result = retrieve(types, args.key, args.limit,
                      operational_provider=op_provider,
                      with_shadows=args.with_shadows)
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
