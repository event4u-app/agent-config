"""Contract tests for the ``implement_ticket`` deprecation shim.

The shim re-exports :mod:`work_engine` under the legacy package name
for one release. This file verifies the three guarantees the shim
makes during the deprecation window:

1. importing ``implement_ticket`` emits ``DeprecationWarning``;
2. the top-level public surface (``DeliveryState``, ``main``, …)
   resolves to the same objects as ``work_engine``;
3. dotted submodule paths (``implement_ticket.steps.plan``,
   ``implement_ticket.cli``, …) are aliased into ``sys.modules`` so
   ``import_module`` and ``from … import …`` both keep working.

When the shim is removed, this whole file disappears with it.
"""
from __future__ import annotations

import importlib
import sys

import pytest


_PUBLIC_SURFACE = (
    "AGENT_DIRECTIVE_PREFIX",
    "DEFAULT_PERSONA",
    "DEFAULT_STATE_FILE",
    "DeliveryState",
    "Outcome",
    "PersonaPolicy",
    "STEP_ORDER",
    "Step",
    "StepResult",
    "agent_directive",
    "dispatch",
    "is_agent_directive",
    "known_personas",
    "main",
    "resolve_policy",
)

_ALIASED_SUBMODULES = (
    "implement_ticket.cli",
    "implement_ticket.delivery_state",
    "implement_ticket.dispatcher",
    "implement_ticket.persona_policy",
    "implement_ticket.steps",
    "implement_ticket.steps.analyze",
    "implement_ticket.steps.implement",
    "implement_ticket.steps.memory",
    "implement_ticket.steps.plan",
    "implement_ticket.steps.refine",
    "implement_ticket.steps.report",
    "implement_ticket.steps.test",
    "implement_ticket.steps.verify",
)


def _reset_shim() -> None:
    """Drop cached shim entries so a fresh import re-runs ``__init__``."""
    for name in [
        key for key in list(sys.modules)
        if key == "implement_ticket" or key.startswith("implement_ticket.")
    ]:
        del sys.modules[name]


def test_import_emits_deprecation_warning() -> None:
    _reset_shim()
    with pytest.warns(DeprecationWarning, match="implement_ticket has moved"):
        importlib.import_module("implement_ticket")


@pytest.mark.parametrize("name", _PUBLIC_SURFACE)
def test_public_surface_is_re_exported(name: str) -> None:
    _reset_shim()
    with pytest.warns(DeprecationWarning):
        legacy = importlib.import_module("implement_ticket")
    canonical = importlib.import_module("work_engine")
    assert getattr(legacy, name) is getattr(canonical, name), (
        f"implement_ticket.{name} drifted from work_engine.{name}"
    )


@pytest.mark.parametrize("dotted", _ALIASED_SUBMODULES)
def test_submodule_aliases_resolve_to_work_engine(dotted: str) -> None:
    _reset_shim()
    with pytest.warns(DeprecationWarning):
        importlib.import_module("implement_ticket")
    legacy = importlib.import_module(dotted)
    canonical = importlib.import_module(
        dotted.replace("implement_ticket", "work_engine", 1)
    )
    assert legacy is canonical, (
        f"{dotted} did not alias to its work_engine counterpart"
    )


def test_main_entrypoint_delegates_to_work_engine() -> None:
    """``python3 -m implement_ticket`` must keep working — the
    Golden-Transcript freeze-guard pins this exact invocation."""
    _reset_shim()
    with pytest.warns(DeprecationWarning):
        legacy = importlib.import_module("implement_ticket")
    from work_engine.cli import main as canonical_main

    assert legacy.main is canonical_main
