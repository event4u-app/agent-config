"""Resolve the ``route`` why-slot for the trace.

Cross-references the persisted ``state.persona`` and ``state.directive_set``
against the project's ``router.json``. Kernel rules are always-on (no
trigger eval here); tier-1 rules are listed for the user to inspect via
``agent-config explain route <text>`` if they want trigger reasons.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from scripts._cli.explain_last.scrubber import scrub_string

ROUTER_FILENAME = "router.json"
ROUTER_RELATIVE = Path("dist") / ROUTER_FILENAME


def _load_router(project_root: Path) -> dict[str, Any] | None:
    path = project_root / ROUTER_RELATIVE
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def build(project_root: Path, state: dict[str, Any]) -> dict[str, Any] | None:
    """Return the ``route`` slot or ``None`` when ``router.json`` is absent.

    ``matched_rules`` is the tier-1 id list declared by the active
    directive set (read from ``state.directive_set``). For now this is
    the full tier-1 surface — trigger evaluation against the original
    prompt is not persisted in v1 state and would require replaying
    the dispatcher. ``kernel_rules`` always lists every kernel rule;
    those are the Iron-Law floor and load unconditionally.
    """
    router = _load_router(project_root)
    if router is None:
        return None
    kernel = [scrub_string(str(rid)) for rid in router.get("kernel", []) or []]
    tier_1 = []
    for entry in router.get("tier_1", []) or []:
        if isinstance(entry, dict):
            rid = entry.get("id")
            if isinstance(rid, str):
                tier_1.append(scrub_string(rid))
    persona = state.get("persona")
    persona_str = scrub_string(persona) if isinstance(persona, str) and persona else None
    return {
        "matched_rules": tier_1,
        "kernel_rules": kernel,
        "persona": persona_str,
    }


__all__ = ["build"]
