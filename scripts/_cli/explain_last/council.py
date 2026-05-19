"""Resolve the ``council`` why-slot for the trace.

Picks the most recent ``council-responses.json`` whose ``mtime`` lies
within the run window (state file mtime ± 1h). Cost-metadata fields
(``input_tokens``, ``output_tokens``, ``cost_usd``, ``latency_ms``) are
intentionally NOT surfaced — they leak business-intelligence about
spend rate per the security-engineer council fix.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts._cli.explain_last.scrubber import scrub_string

RUN_WINDOW_SECONDS = 3600


def _candidate_files(project_root: Path) -> list[Path]:
    """Return every council-response file the loader knows about.

    Implementation spec for the council loader; the glob path is the
    contract it implements.
    """
    # council-ref-allowed: council loader implementation per roadmap.
    sessions_root = project_root / "agents" / "council-sessions"
    tmp_root = project_root / "tmp"
    candidates: list[Path] = []
    if sessions_root.exists():
        for sub in sessions_root.iterdir():
            if sub.is_dir():
                candidate = sub / "council-responses.json"
                if candidate.exists():
                    candidates.append(candidate)
    if tmp_root.exists():
        candidates.extend(sorted(tmp_root.glob("council-*.json")))
    return candidates


def _pick_recent(candidates: list[Path], anchor_mtime: float) -> Path | None:
    best: tuple[float, Path] | None = None
    for path in candidates:
        try:
            mtime = path.stat().st_mtime
        except OSError:
            continue
        if abs(mtime - anchor_mtime) > RUN_WINDOW_SECONDS:
            continue
        if best is None or mtime > best[0]:
            best = (mtime, path)
    return best[1] if best else None


def _extract_member(entry: dict[str, Any]) -> dict[str, Any] | None:
    provider = entry.get("provider") or ""
    model = entry.get("model") or ""
    member_id = "/".join(part for part in (provider, model) if part) or "unknown"
    text = entry.get("text")
    if not isinstance(text, str) or not text.strip():
        return None
    verdict = scrub_string(text.strip().splitlines()[0][:200])
    citations = []
    for cite in entry.get("citations", []) or []:
        if isinstance(cite, str):
            citations.append(scrub_string(cite))
    return {
        "member_id": scrub_string(member_id),
        "verdict": verdict,
        "citations": citations,
    }


def build(
    project_root: Path,
    state_file: Path,
) -> list[dict[str, Any]] | None:
    """Return the ``council`` slot or ``None`` if no session matches."""
    try:
        anchor = state_file.stat().st_mtime
    except OSError:
        return None
    candidates = _candidate_files(project_root)
    if not candidates:
        return None
    picked = _pick_recent(candidates, anchor)
    if picked is None:
        return None
    try:
        raw = json.loads(picked.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(raw, dict):
        return None
    members: list[dict[str, Any]] = []
    for entry in raw.get("responses", []) or []:
        if not isinstance(entry, dict):
            continue
        member = _extract_member(entry)
        if member is not None:
            members.append(member)
    return members or None


__all__ = ["build"]
