"""``HookContext`` — payload carried into every hook callback.

One dataclass for both layers. Most fields are ``None`` for any given
event; the per-event subset is documented below and locked by the
roadmap's hook event surface table. Hooks must tolerate missing fields
gracefully — accessing a field that is ``None`` for the current event
is a hook bug, not an engine bug.

Per-event subset (mirrors the roadmap):

Dispatcher layer (``delivery`` is set; ``work`` is ``None``):
    - ``before_step``   → ``step_name``, ``delivery``
    - ``after_step``    → ``step_name``, ``delivery``, ``result``
    - ``on_halt``       → ``step_name``, ``delivery``, ``result``
    - ``on_error``      → ``step_name``, ``delivery``, ``exception``

CLI layer (``work`` is set; ``delivery`` may be set after load):
    - ``before_load``       → ``state_file``, ``args``
    - ``after_load``        → ``state_file``, ``work``, ``fmt``
    - ``before_dispatch``   → ``work``, ``delivery``, ``set_name``
    - ``after_dispatch``    → ``work``, ``delivery``, ``final``,
                              ``halting``
    - ``before_save``       → ``work``, ``delivery``, ``fmt``
    - ``after_save``        → ``work``, ``state_file``, ``fmt``
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class HookContext:
    """Per-event payload passed to every hook callback.

    Fields are intentionally optional — the runner does not validate
    which ones are populated for a given event. The contract is
    enforced by the call sites in ``dispatcher.py`` and ``cli.py``,
    not by the dataclass.

    ``extra`` exists as an escape hatch for hook-specific state that
    does not warrant a dedicated field. Use sparingly; if a piece of
    state is read by more than one hook, promote it to a real field.
    """

    # Dispatcher-layer refs.
    step_name: str | None = None
    delivery: Any = None  # DeliveryState — typed Any to avoid an import cycle.
    result: Any = None  # StepResult
    exception: BaseException | None = None

    # CLI-layer refs.
    work: Any = None  # WorkState — typed Any to avoid an import cycle.
    state_file: Path | None = None
    fmt: str | None = None
    set_name: str | None = None
    final: Any = None  # Outcome
    halting: str | None = None
    args: Any = None  # argparse.Namespace

    # Escape hatch for hook-specific state.
    extra: dict[str, Any] = field(default_factory=dict)


__all__ = ["HookContext"]
