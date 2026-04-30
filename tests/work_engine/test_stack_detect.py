"""Stack detection heuristics for the UI directive set (R3 Phase 1).

Covers the four labels the dispatcher needs (`blade-livewire-flux`,
`react-shadcn`, `vue`, `plain`), priority ordering when more than one
signal is present, mtime caching, and the recoverable-error contract
(malformed JSON downgrades to ``plain``, never raises).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from work_engine.stack.detect import (
    DEFAULT_STACK,
    KNOWN_STACKS,
    StackResult,
    detect_stack,
    latest_manifest_mtime,
)


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_blade_livewire_flux(tmp_path: Path) -> None:
    _write_json(
        tmp_path / "composer.json",
        {"require": {"livewire/livewire": "^3.0", "livewire/flux": "^1.0"}},
    )
    result = detect_stack(tmp_path)
    assert result.frontend == "blade-livewire-flux"
    assert result.mtime > 0


def test_blade_livewire_flux_via_require_dev(tmp_path: Path) -> None:
    """Flux pulled in only as a dev dependency still counts."""
    _write_json(
        tmp_path / "composer.json",
        {
            "require": {"livewire/livewire": "^3.0"},
            "require-dev": {"livewire/flux": "^1.0"},
        },
    )
    assert detect_stack(tmp_path).frontend == "blade-livewire-flux"


def test_livewire_alone_is_not_flux(tmp_path: Path) -> None:
    """Livewire without Flux falls through to ``plain`` (no Flux skill)."""
    _write_json(
        tmp_path / "composer.json",
        {"require": {"livewire/livewire": "^3.0"}},
    )
    assert detect_stack(tmp_path).frontend == "plain"


def test_react_shadcn_via_radix(tmp_path: Path) -> None:
    _write_json(
        tmp_path / "package.json",
        {
            "dependencies": {
                "react": "^18",
                "@radix-ui/react-dialog": "^1.0",
            },
        },
    )
    assert detect_stack(tmp_path).frontend == "react-shadcn"


def test_react_shadcn_via_components_json(tmp_path: Path) -> None:
    """The shadcn CLI marker file is enough even without @radix-ui in deps."""
    _write_json(tmp_path / "package.json", {"dependencies": {"react": "^18"}})
    (tmp_path / "components.json").write_text("{}", encoding="utf-8")
    assert detect_stack(tmp_path).frontend == "react-shadcn"


def test_react_alone_is_plain(tmp_path: Path) -> None:
    """React without shadcn/Radix/components.json falls through to ``plain``."""
    _write_json(tmp_path / "package.json", {"dependencies": {"react": "^18"}})
    assert detect_stack(tmp_path).frontend == "plain"


def test_vue(tmp_path: Path) -> None:
    _write_json(tmp_path / "package.json", {"dependencies": {"vue": "^3.4"}})
    assert detect_stack(tmp_path).frontend == "vue"


def test_plain_when_no_manifests(tmp_path: Path) -> None:
    result = detect_stack(tmp_path)
    assert result.frontend == "plain"
    assert result.mtime == 0.0


def test_plain_when_manifest_is_malformed(tmp_path: Path) -> None:
    """Bad JSON must not crash the dispatcher \u2014 downgrade to plain."""
    (tmp_path / "package.json").write_text("not json", encoding="utf-8")
    assert detect_stack(tmp_path).frontend == "plain"


def test_priority_blade_flux_beats_react_shadcn(tmp_path: Path) -> None:
    """Both manifests present \u2014 Blade+Flux wins (Laravel-first project)."""
    _write_json(
        tmp_path / "composer.json",
        {"require": {"livewire/livewire": "^3.0", "livewire/flux": "^1.0"}},
    )
    _write_json(
        tmp_path / "package.json",
        {"dependencies": {"react": "^18", "@radix-ui/react-dialog": "^1.0"}},
    )
    assert detect_stack(tmp_path).frontend == "blade-livewire-flux"


def test_priority_react_shadcn_beats_vue(tmp_path: Path) -> None:
    """React+shadcn signal wins over a stray ``vue`` dep in the same manifest."""
    _write_json(
        tmp_path / "package.json",
        {
            "dependencies": {
                "react": "^18",
                "@radix-ui/react-dialog": "^1.0",
                "vue": "^3.4",
            },
        },
    )
    assert detect_stack(tmp_path).frontend == "react-shadcn"


def test_mtime_tracks_latest_manifest(tmp_path: Path) -> None:
    """``mtime`` is the max across consulted manifests, used for cache invalidation."""
    _write_json(tmp_path / "composer.json", {"require": {}})
    _write_json(tmp_path / "package.json", {"dependencies": {"vue": "^3.4"}})
    result = detect_stack(tmp_path)
    assert result.mtime == latest_manifest_mtime(tmp_path)
    assert result.mtime > 0


def test_default_stack_in_known_set() -> None:
    """The fallback label is itself a valid stack."""
    assert DEFAULT_STACK in KNOWN_STACKS


def test_result_is_frozen() -> None:
    """``StackResult`` is immutable so it cannot drift after caching."""
    result = StackResult(frontend="plain", mtime=0.0)
    with pytest.raises(Exception):
        result.frontend = "vue"  # type: ignore[misc]
