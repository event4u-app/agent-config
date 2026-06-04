"""Builder for the ``trace.provider`` slot.

Bounded to video runs (``state.directive_set == "video"``). The
work_engine does not yet ship a video directive set — this builder is
forward-compatible: when the engine eventually persists a provider
selection (``state.video_provider`` or
``state.contract.video_provider`` are both accepted shapes), the slot
populates; otherwise it returns ``None``.

The v1 schema requires ``{id, selection_reason}``. Both fields pass
through :func:`scripts._cli.explain_last.scrubber.scrub_string` so a
reason explaining "selected because user has $40/m budget on
provider-x.internal" never leaks billing or hostnames.
"""
from __future__ import annotations

from typing import Any

from scripts._cli.explain_last.scrubber import scrub_string


def _extract(state: dict[str, Any]) -> dict[str, Any] | None:
    direct = state.get("video_provider")
    if isinstance(direct, dict):
        return direct
    contract = state.get("contract")
    if isinstance(contract, dict):
        nested = contract.get("video_provider")
        if isinstance(nested, dict):
            return nested
    return None


def build(state: dict[str, Any]) -> dict[str, Any] | None:
    if (state.get("directive_set") or "") != "video":
        return None
    payload = _extract(state)
    if payload is None:
        return None
    pid = payload.get("id")
    reason = payload.get("selection_reason")
    if not isinstance(pid, str) or not pid:
        return None
    if not isinstance(reason, str) or not reason:
        reason = ""
    return {
        "id": scrub_string(pid),
        "selection_reason": scrub_string(reason),
    }


__all__ = ["build"]
