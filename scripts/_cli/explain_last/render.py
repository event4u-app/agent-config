"""Deterministic Markdown projection of an :class:`ExplainTrace`.

Pure-function ``render(trace) -> str``. Same input ``ExplainTrace``
always yields byte-identical Markdown — Phase 4 snapshot tests rely on
this. Each section lives in its own module under :mod:`sections/`; the
orchestrator only fixes the order. Phase 3 will append ``halt`` and
``provider`` sections without invalidating existing snapshots.
"""
from __future__ import annotations

from typing import Any

from scripts._cli.explain_last import sections

_SECTION_ORDER = (
    sections.header,
    sections.route,
    sections.inputs,
    sections.memory,
    sections.council,
    sections.assumptions,
    sections.pack,
)

TIP_FOOTER = (
    "_tip: pass `--json` to emit machine-readable trace; "
    "`--quiet` to drop this footer._\n"
)


def render(trace: dict[str, Any], *, with_footer: bool = True) -> str:
    """Render ``trace`` to Markdown.

    ``with_footer=False`` suppresses the trailing tip line (council
    fix: CI scripts parse the output and choke on a stray footer).
    """
    parts: list[str] = []
    for section in _SECTION_ORDER:
        chunk = section.render(trace)
        if chunk:
            parts.append(chunk)
    body = "\n".join(parts).rstrip() + "\n"
    if with_footer:
        body += "\n" + TIP_FOOTER
    return body


__all__ = ["TIP_FOOTER", "render"]
