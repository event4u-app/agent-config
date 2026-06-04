"""Section renderers for the ``explain last`` Markdown projection.

Each module exports a single ``render(trace) -> str`` function. The
orchestrator at :mod:`scripts._cli.explain_last.render` calls them in
fixed order so the Markdown output stays byte-deterministic for the
same input ``ExplainTrace``.

Splitting per CONCERN council fix — Phase 3 added ``halt`` and
``provider`` sections without disturbing the existing ones.
"""
from __future__ import annotations

from scripts._cli.explain_last.sections import (
    assumptions as assumptions,
    council as council,
    halt as halt,
    header as header,
    inputs as inputs,
    memory as memory,
    pack as pack,
    provider as provider,
    route as route,
)

__all__ = [
    "assumptions",
    "council",
    "halt",
    "header",
    "inputs",
    "memory",
    "pack",
    "provider",
    "route",
]
