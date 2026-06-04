"""Resolve the ``assumptions`` why-slot for the trace.

The work-engine writes ``state.input.data.assumptions[]`` at the end
of the ``refine`` step and on every ``halt``. Each entry is either a
plain string (legacy shape) or a dict with ``{id, accepted, source}``
(R2+ shape). Both shapes are normalised here so the schema gate sees a
uniform list of objects.
"""
from __future__ import annotations

from typing import Any

from scripts._cli.explain_last.scrubber import scrub_string


def _normalise(raw: Any, fallback_idx: int) -> dict[str, Any] | None:
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None
        return {
            "id": scrub_string(text)[:120] or f"assumption-{fallback_idx}",
            "accepted": True,
            "source": "refine",
        }
    if isinstance(raw, dict):
        ident = raw.get("id") or raw.get("text") or f"assumption-{fallback_idx}"
        if not isinstance(ident, str):
            ident = str(ident)
        ident = scrub_string(ident.strip()) or f"assumption-{fallback_idx}"
        accepted = bool(raw.get("accepted", True))
        source = raw.get("source") or raw.get("step") or "refine"
        return {
            "id": ident,
            "accepted": accepted,
            "source": scrub_string(str(source)),
        }
    return None


def build(state: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the assumptions list (possibly empty).

    Schema requires an array; ``null`` is not allowed. An empty list
    is the documented signal that no assumptions were captured.
    """
    data = (state.get("input") or {}).get("data") or {}
    raw_list = data.get("assumptions") or []
    if not isinstance(raw_list, list):
        return []
    out: list[dict[str, Any]] = []
    for idx, raw in enumerate(raw_list):
        entry = _normalise(raw, idx)
        if entry is not None:
            out.append(entry)
    return out


__all__ = ["build"]
