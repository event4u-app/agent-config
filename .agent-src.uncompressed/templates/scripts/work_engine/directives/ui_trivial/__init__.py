"""UI-trivial directive set — stub.

Pre-listed for **Roadmap 3 V2** (``road-to-product-ui-track.md``).
The full UI flow is heavy — existing-UI audit, design-review polish
— and not every UI ticket warrants it. ``ui-trivial`` will be the
short-circuit path: small visual tweaks, copy changes, single-
component additions that go straight from plan → implement → test
without the audit/review loop.

The directory uses an underscore (``ui_trivial``) because Python
packages cannot contain hyphens. The schema carries the external
hyphenated name ``"ui-trivial"``; the dispatcher's loader is the
single place that translates between them.

Until R3 V2 lands, :func:`get_steps` raises a guided
``NotImplementedError``.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

DIRECTIVE_SET_NAME = "ui-trivial"
"""External name carried in ``state.directive_set`` for this set.

Note the hyphen — this is the schema/wire form, not the Python
module name. The module name (``ui_trivial``) is an implementation
detail of the loader.
"""

ROADMAP = "agents/roadmaps/road-to-product-ui-track.md"
"""Roadmap that promotes this stub to a working directive bundle."""


def get_steps() -> Mapping[str, Any]:
    """Raise — the ui-trivial directive set has no working handlers in R1."""
    raise NotImplementedError(
        f"directive_set={DIRECTIVE_SET_NAME!r} is not implemented in R1; "
        f"lands in Roadmap 3 V2 ({ROADMAP}). "
        "Use directive_set='backend' for the current engine.",
    )


__all__ = ["DIRECTIVE_SET_NAME", "ROADMAP", "get_steps"]
