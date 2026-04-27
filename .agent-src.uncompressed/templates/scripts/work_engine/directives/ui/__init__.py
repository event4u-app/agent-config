"""UI directive set — stub.

The UI directive set lands in **Roadmap 3** (``road-to-product-ui-
track.md``). It will own the Blade/Livewire/Flux flow: existing-UI
audit pre-step, design-review polish loop, and front-end-aware
verification.

Schema and dispatcher pre-list this set so the engine schema does
not need a forward-incompatible bump when R3 ships. Until then,
:func:`get_steps` raises a guided ``NotImplementedError`` so anyone
who manually flips ``state.directive_set`` to ``"ui"`` gets a useful
message instead of a crash deep in the dispatcher.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

DIRECTIVE_SET_NAME = "ui"
"""External name carried in ``state.directive_set`` for this set."""

ROADMAP = "agents/roadmaps/road-to-product-ui-track.md"
"""Roadmap that promotes this stub to a working directive bundle."""


def get_steps() -> Mapping[str, Any]:
    """Raise — the UI directive set has no working handlers in R1.

    Returning an empty mapping or a mapping of stub handlers would
    let the dispatcher walk the flow and only fail mid-cycle. We
    raise immediately so callers get a clear, actionable error
    before any state mutation.
    """
    raise NotImplementedError(
        f"directive_set={DIRECTIVE_SET_NAME!r} is not implemented in R1; "
        f"lands in Roadmap 3 ({ROADMAP}). "
        "Use directive_set='backend' for the current engine.",
    )


__all__ = ["DIRECTIVE_SET_NAME", "ROADMAP", "get_steps"]
