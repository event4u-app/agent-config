"""Section renderers for the ``explain last`` Markdown projection.

Each module exports a single ``render(trace) -> str`` function. The
orchestrator at :mod:`scripts._cli.explain_last.render` calls them in
fixed order so the Markdown output stays byte-deterministic for the
same input ``ExplainTrace``.

Splitting per CONCERN council fix — Phase 3 will add ``halt`` and
``provider`` sections without disturbing the existing ones.
"""
from __future__ import annotations

from scripts._cli.explain_last.sections import (
    assumptions as assumptions,
    council as council,
    header as header,
    inputs as inputs,
    memory as memory,
    pack as pack,
    route as route,
)

__all__ = [
    "assumptions",
    "council",
    "header",
    "inputs",
    "memory",
    "pack",
    "route",
]
