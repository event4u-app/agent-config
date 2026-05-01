"""Tests for the CLI-layer hook surface (P3 of road-to-work-engine-hooks).

Covers the six CLI events (``before_load``, ``after_load``,
``before_dispatch``, ``after_dispatch``, ``before_save``, ``after_save``)
plus the halt branch table from the roadmap: every halt yields exit
code ``2``, and only ``after_save`` halts leave state persisted.
"""
from __future__ import annotations

import json
import sys
import types
from pathlib import Path

import pytest

from work_engine import main
from work_engine.cli import _build_hook_registry
from work_engine.hooks import (
    HookContext,
    HookEvent,
    HookHalt,
    HookRegistry,
    HookRunner,
)


@pytest.fixture()
def fake_memory_lookup(monkeypatch):
    """Stub ``memory_lookup.retrieve`` so the CLI runs without disk I/O."""
    stub = types.ModuleType("memory_lookup")
    stub.retrieve = lambda types_, keys, limit: []
    monkeypatch.setitem(sys.modules, "memory_lookup", stub)
    return stub


def _write_ticket(tmp_path: Path) -> Path:
    ticket = tmp_path / "ticket.json"
    ticket.write_text(
        json.dumps(
            {
                "id": "HOOK-1",
                "title": "Wire CLI hooks",
                "acceptance_criteria": ["CLI fires the six lifecycle events."],
            },
        ),
        encoding="utf-8",
    )
    return ticket


def _install_hooks(monkeypatch, **events) -> list[tuple[str, HookEvent]]:
    """Patch ``_build_hook_registry`` to return a registry seeded with ``events``.

    Records every fired event into the returned list (insertion order).
    """
    trace: list[tuple[str, HookEvent]] = []

    def _make_recorder(label: str, event: HookEvent, halt: HookHalt | None):
        def _cb(ctx: HookContext) -> None:
            trace.append((label, event))
            if halt is not None:
                raise halt

        return _cb

    def _factory(args):  # noqa: ARG001
        registry = HookRegistry()
        for event, halt in events.items():
            ev = HookEvent[event]
            registry.register(ev, _make_recorder("trace", ev, halt))
        return registry

    monkeypatch.setattr("work_engine.cli._build_hook_registry", _factory)
    return trace


def test_build_hook_registry_returns_empty_registry_by_default() -> None:
    """Phase 3 ships an empty registry; concrete hooks land in Phase 4."""
    import argparse  # noqa: PLC0415

    registry = _build_hook_registry(argparse.Namespace())

    assert isinstance(registry, HookRegistry)
    assert tuple(registry.events()) == ()


def test_runner_is_threaded_through_dispatch(
    tmp_path: Path, capsys, fake_memory_lookup, monkeypatch,
) -> None:
    """Same registry powers both CLI and dispatcher events."""
    trace = _install_hooks(
        monkeypatch,
        BEFORE_LOAD=None,
        AFTER_LOAD=None,
        BEFORE_DISPATCH=None,
        BEFORE_STEP=None,
        AFTER_DISPATCH=None,
        BEFORE_SAVE=None,
        AFTER_SAVE=None,
    )

    main([
        "--state-file", str(tmp_path / "state.json"),
        "--ticket-file", str(_write_ticket(tmp_path)),
    ])
    capsys.readouterr()

    fired = [event for _, event in trace]
    # CLI events fire in declared order and dispatcher events fire in between.
    assert fired[:2] == [HookEvent.BEFORE_LOAD, HookEvent.AFTER_LOAD]
    assert fired[2] is HookEvent.BEFORE_DISPATCH
    # At least one BEFORE_STEP fires before AFTER_DISPATCH (proves shared runner).
    before_dispatch_idx = fired.index(HookEvent.BEFORE_DISPATCH)
    after_dispatch_idx = fired.index(HookEvent.AFTER_DISPATCH)
    between = fired[before_dispatch_idx + 1:after_dispatch_idx]
    assert HookEvent.BEFORE_STEP in between
    # Save events fire after dispatch.
    assert fired[after_dispatch_idx + 1:] == [
        HookEvent.BEFORE_SAVE,
        HookEvent.AFTER_SAVE,
    ]


@pytest.mark.parametrize(
    "halt_event",
    [
        "BEFORE_LOAD",
        "AFTER_LOAD",
        "BEFORE_DISPATCH",
        "AFTER_DISPATCH",
        "BEFORE_SAVE",
    ],
)
def test_cli_halt_before_save_returns_exit_two_without_persisting_state(
    halt_event, tmp_path: Path, capsys, fake_memory_lookup, monkeypatch,
) -> None:
    """Per the P3 branch table — halts before ``_save`` exit 2 with no state on disk."""
    surface = ["> 1. Resolve the halt.", "> 2. Abort."]
    halt = HookHalt(reason="cli_test", surface=surface)
    _install_hooks(monkeypatch, **{halt_event: halt})

    state_file = tmp_path / "state.json"
    exit_code = main([
        "--state-file", str(state_file),
        "--ticket-file", str(_write_ticket(tmp_path)),
    ])

    assert exit_code == 2
    err = capsys.readouterr().err
    for line in surface:
        assert line in err
    # Halt fired before _save → state must not exist on disk.
    assert not state_file.exists()


def test_cli_halt_on_after_save_returns_exit_two_with_state_persisted(
    tmp_path: Path, capsys, fake_memory_lookup, monkeypatch,
) -> None:
    """``after_save`` halts: state already on disk, exit code still 2."""
    surface = ["> 1. Acknowledge persisted state."]
    halt = HookHalt(reason="after_save_test", surface=surface)
    _install_hooks(monkeypatch, AFTER_SAVE=halt)

    state_file = tmp_path / "state.json"
    exit_code = main([
        "--state-file", str(state_file),
        "--ticket-file", str(_write_ticket(tmp_path)),
    ])

    assert exit_code == 2
    assert surface[0] in capsys.readouterr().err
    # Halt fired after _save → state IS persisted.
    assert state_file.exists()
    # Don't assert on internal state shape (v0/v1 split lives in test_cli);
    # presence + valid JSON is enough to prove _save ran before the halt.
    assert json.loads(state_file.read_text())


def test_cli_without_hooks_is_byte_compatible_with_pre_p3(
    tmp_path: Path, capsys, fake_memory_lookup,
) -> None:
    """Default empty registry → CLI behaves identically to pre-P3 contract."""
    state_file = tmp_path / "state.json"

    exit_code = main([
        "--state-file", str(state_file),
        "--ticket-file", str(_write_ticket(tmp_path)),
    ])

    assert exit_code == 1  # BLOCKED at create-plan, same as pre-P3.
    assert state_file.exists()
    assert "@agent-directive: create-plan" in capsys.readouterr().out



# --- Phase 6: settings-driven registry construction ---


def _write_settings(tmp_path: Path, body: str) -> Path:
    cfg = tmp_path / ".agent-settings.yml"
    cfg.write_text(body, encoding="utf-8")
    return cfg


def test_build_hook_registry_honours_master_switch_off(tmp_path: Path) -> None:
    import argparse  # noqa: PLC0415

    cfg = _write_settings(tmp_path, "hooks:\n  enabled: false\n")
    args = argparse.Namespace(no_hooks=False, hooks_config=cfg)

    registry = _build_hook_registry(args)

    assert tuple(registry.events()) == ()


def test_build_hook_registry_registers_defense_in_depth_hooks(
    tmp_path: Path,
) -> None:
    """Master switch on with default per-hook fields → 3 cheap hooks register."""
    import argparse  # noqa: PLC0415

    cfg = _write_settings(tmp_path, "hooks:\n  enabled: true\n")
    args = argparse.Namespace(no_hooks=False, hooks_config=cfg)

    registry = _build_hook_registry(args)

    events = set(registry.events())
    assert HookEvent.AFTER_LOAD in events  # state shape validation
    assert HookEvent.BEFORE_SAVE in events  # state shape validation
    assert HookEvent.ON_HALT in events  # halt surface audit
    assert HookEvent.BEFORE_DISPATCH in events  # directive set guard


def test_build_hook_registry_honours_no_hooks_flag(tmp_path: Path) -> None:
    import argparse  # noqa: PLC0415

    cfg = _write_settings(
        tmp_path,
        "hooks:\n  enabled: true\n  trace: true\n",
    )
    args = argparse.Namespace(no_hooks=True, hooks_config=cfg)

    registry = _build_hook_registry(args)

    assert tuple(registry.events()) == ()


def test_build_hook_registry_includes_chat_history_when_both_switches_on(
    tmp_path: Path,
) -> None:
    import argparse  # noqa: PLC0415

    cfg = _write_settings(
        tmp_path,
        "hooks:\n"
        "  enabled: true\n"
        "  halt_surface_audit: false\n"
        "  state_shape_validation: false\n"
        "  directive_set_guard: false\n"
        "  chat_history:\n    enabled: true\n"
        "chat_history:\n  enabled: true\n",
    )
    args = argparse.Namespace(no_hooks=False, hooks_config=cfg)

    registry = _build_hook_registry(args)

    events = set(registry.events())
    # Four chat-history hooks register on BEFORE_DISPATCH (turn-check),
    # AFTER_STEP (append), ON_HALT (halt-append), BEFORE_SAVE
    # (heartbeat — runs after _sync_back so the marker survives).
    assert HookEvent.BEFORE_DISPATCH in events
    assert HookEvent.AFTER_STEP in events
    assert HookEvent.ON_HALT in events
    assert HookEvent.BEFORE_SAVE in events
