"""Mixed (backend + UI) directive set — stub.

Pre-listed for **Roadmap 3** (``road-to-product-ui-track.md``).
``mixed`` is the directive set for tickets that touch both layers:
its plan step enforces backend-contract-first sequencing (data
shape, API surface, persistence) before any UI work to keep the
front-end honest about what the back-end can deliver.

Until R3 lands, :func:`get_steps` raises a guided
``NotImplementedError``.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

DIRECTIVE_SET_NAME = "mixed"
"""External name carried in ``state.directive_set`` for this set."""

ROADMAP = "agents/roadmaps/road-to-product-ui-track.md"
"""Roadmap that promotes this stub to a working directive bundle."""


def get_steps() -> Mapping[str, Any]:
    """Raise — the mixed directive set has no working handlers in R1."""
    raise NotImplementedError(
        f"directive_set={DIRECTIVE_SET_NAME!r} is not implemented in R1; "
        f"lands in Roadmap 3 ({ROADMAP}). "
        "Use directive_set='backend' for the current engine.",
    )


__all__ = ["DIRECTIVE_SET_NAME", "ROADMAP", "get_steps"]
