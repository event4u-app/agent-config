"""Resolve the ``memory`` why-slot for the trace.

Two sources are consulted:

* ``state.memory[]`` — the work-engine writes per-run memory hits here
  during the ``memory`` step. Each entry carries ``{entry_id,
  hit_score, used_in}`` already shaped to the trace contract.
* ``<root>/.agent-memory/hits.jsonl`` — optional sidecar produced by
  the memory-MCP integration. Filtered to entries tagged with the run
  id when present.

Returns ``null`` when neither source produced a non-empty list (the
schema accepts a null memory slot so the renderer can drop the
section cleanly).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts._cli.explain_last.scrubber import scrub_string

MEMORY_SIDECAR = Path(".agent-memory") / "hits.jsonl"


def _coerce_entry(raw: dict[str, Any]) -> dict[str, Any] | None:
    entry_id = raw.get("entry_id") or raw.get("id")
    if not isinstance(entry_id, str) or not entry_id.strip():
        return None
    hit_score = raw.get("hit_score")
    if hit_score is None:
        hit_score = raw.get("score", 0.0)
    try:
        hit_score = float(hit_score)
    except (TypeError, ValueError):
        hit_score = 0.0
    used_in = raw.get("used_in") or raw.get("step") or "unspecified"
    return {
        "entry_id": scrub_string(entry_id.strip()),
        "hit_score": hit_score,
        "used_in": scrub_string(str(used_in)),
    }


def _from_state(state: dict[str, Any]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for raw in state.get("memory", []) or []:
        if not isinstance(raw, dict):
            continue
        entry = _coerce_entry(raw)
        if entry is not None:
            entries.append(entry)
    return entries


def _from_sidecar(project_root: Path, run_id: str | None) -> list[dict[str, Any]]:
    path = project_root / MEMORY_SIDECAR
    if not path.exists():
        return []
    entries: list[dict[str, Any]] = []
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(raw, dict):
                continue
            if run_id and raw.get("run_id") not in (None, run_id):
                continue
            entry = _coerce_entry(raw)
            if entry is not None:
                entries.append(entry)
    except OSError:
        return []
    return entries


def build(
    project_root: Path,
    state: dict[str, Any],
) -> list[dict[str, Any]] | None:
    """Return the ``memory`` slot or ``None`` if no hits were captured."""
    run_id = (state.get("input") or {}).get("data", {}).get("id")
    entries = _from_state(state)
    entries.extend(_from_sidecar(project_root, run_id if isinstance(run_id, str) else None))
    return entries or None


__all__ = ["build"]
