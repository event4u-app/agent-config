"""Toolchain-resolution tests (6.1.0 Step 6).

Covers the test-runner labels the resolver emits across ecosystems
(pest / phpunit / vitest / jest / playwright / pytest / go / cargo),
the monorepo guard (fast-by-default, ``--include-slow`` / ``--include-e2e``
opt-in), the ``--php`` narrowing, task-runner-wrapper preference, the
recoverable-error contract (malformed JSON / no manifest degrade to a
LOW result, never raise), the auto-generated config, and mtime caching.

This is the AC2 evidence: a PHP, a JS/TS, and a polyglot fixture each
resolve the right toolchain, and ``php_only`` narrows.
"""
from __future__ import annotations

import json
from pathlib import Path

from work_engine.stack.runner import (
    HIGH,
    KNOWN_RUNNERS,
    LOW,
    SPEED_E2E,
    SPEED_SLOW,
    ToolchainResult,
    latest_manifest_mtime,
    resolve_toolchain,
    write_config,
)


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


def _runner_labels(result: ToolchainResult) -> set[str]:
    return {r.runner for r in result.runners}


def _selected_labels(result: ToolchainResult) -> set[str]:
    return {r.runner for r in result.selected}


# --- PHP fixture (AC2: PHP) ------------------------------------------------

def test_php_pest(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {"require-dev": {"pestphp/pest": "^2.0"}})
    result = resolve_toolchain(tmp_path)
    assert result.ecosystems == ("php",)
    assert _selected_labels(result) == {"pest"}
    runner = result.runners[0]
    assert runner.command == "vendor/bin/pest"
    assert runner.confidence == HIGH
    assert result.confidence == HIGH


def test_php_phpunit_fallback(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {"require-dev": {"phpunit/phpunit": "^11.0"}})
    result = resolve_toolchain(tmp_path)
    assert _selected_labels(result) == {"phpunit"}
    assert result.runners[0].command == "vendor/bin/phpunit"


def test_php_laravel_artisan(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {"require": {"laravel/framework": "^11"}})
    (tmp_path / "artisan").write_text("#!/usr/bin/env php\n", encoding="utf-8")
    result = resolve_toolchain(tmp_path)
    assert result.runners[0].command == "php artisan test"


def test_php_makefile_wrapper_wins(tmp_path: Path) -> None:
    """A Makefile ``test:`` target is preferred over the raw tool."""
    _write_json(tmp_path / "composer.json", {"require-dev": {"pestphp/pest": "^2.0"}})
    (tmp_path / "Makefile").write_text("test:\n\tdocker compose exec app pest\n", encoding="utf-8")
    result = resolve_toolchain(tmp_path)
    assert result.runners[0].command == "make test"


# --- JS/TS fixture (AC2: JS/TS) -------------------------------------------

def test_js_vitest(tmp_path: Path) -> None:
    _write_json(tmp_path / "package.json", {"devDependencies": {"vitest": "^2.0"}})
    result = resolve_toolchain(tmp_path)
    assert result.ecosystems == ("js",)
    assert _selected_labels(result) == {"vitest"}
    assert result.runners[0].command == "npx vitest run"


def test_js_jest(tmp_path: Path) -> None:
    _write_json(tmp_path / "package.json", {"devDependencies": {"jest": "^29"}})
    result = resolve_toolchain(tmp_path)
    assert _selected_labels(result) == {"jest"}


def test_js_vitest_beats_jest(tmp_path: Path) -> None:
    _write_json(
        tmp_path / "package.json",
        {"devDependencies": {"vitest": "^2.0", "jest": "^29"}},
    )
    result = resolve_toolchain(tmp_path)
    assert _selected_labels(result) == {"vitest"}


def test_js_package_manager_test_script(tmp_path: Path) -> None:
    """A ``test`` script + pnpm lockfile → ``pnpm test`` wrapper."""
    _write_json(
        tmp_path / "package.json",
        {"devDependencies": {"vitest": "^2.0"}, "scripts": {"test": "vitest run"}},
    )
    (tmp_path / "pnpm-lock.yaml").write_text("lockfileVersion: 9\n", encoding="utf-8")
    result = resolve_toolchain(tmp_path)
    assert result.runners[0].command == "pnpm test"


# --- Monorepo guard: e2e + slow opt-in ------------------------------------

def test_playwright_excluded_by_default(tmp_path: Path) -> None:
    _write_json(
        tmp_path / "package.json",
        {"devDependencies": {"vitest": "^2.0", "@playwright/test": "^1.4"}},
    )
    result = resolve_toolchain(tmp_path)
    assert "playwright" in _runner_labels(result)        # inventory has it
    assert "playwright" not in _selected_labels(result)  # but not selected (fast-by-default)
    assert _selected_labels(result) == {"vitest"}


def test_playwright_included_with_flag(tmp_path: Path) -> None:
    _write_json(
        tmp_path / "package.json",
        {"devDependencies": {"vitest": "^2.0", "@playwright/test": "^1.4"}},
    )
    result = resolve_toolchain(tmp_path, include_e2e=True)
    assert "playwright" in _selected_labels(result)
    pw = next(r for r in result.runners if r.runner == "playwright")
    assert pw.speed == SPEED_E2E


def test_slow_script_opt_in(tmp_path: Path) -> None:
    _write_json(
        tmp_path / "package.json",
        {
            "devDependencies": {"vitest": "^2.0"},
            "scripts": {"test:slow": "vitest run integration/"},
        },
    )
    default = resolve_toolchain(tmp_path)
    assert all(r.speed != SPEED_SLOW for r in default.selected)
    with_slow = resolve_toolchain(tmp_path, include_slow=True)
    assert any(r.speed == SPEED_SLOW for r in with_slow.selected)


# --- Python / Go / Rust ----------------------------------------------------

def test_python_pytest(tmp_path: Path) -> None:
    (tmp_path / "pyproject.toml").write_text(
        "[tool.pytest.ini_options]\naddopts = '-q'\n", encoding="utf-8",
    )
    result = resolve_toolchain(tmp_path)
    assert _selected_labels(result) == {"pytest"}
    assert result.runners[0].command == "pytest"


def test_go(tmp_path: Path) -> None:
    (tmp_path / "go.mod").write_text("module example.com/x\n\ngo 1.22\n", encoding="utf-8")
    result = resolve_toolchain(tmp_path)
    assert result.runners[0].command == "go test ./..."


def test_cargo(tmp_path: Path) -> None:
    (tmp_path / "Cargo.toml").write_text("[package]\nname = 'x'\n", encoding="utf-8")
    result = resolve_toolchain(tmp_path)
    assert result.runners[0].command == "cargo test"


# --- Polyglot fixture (AC2: polyglot) + --php narrowing -------------------

def test_polyglot_php_and_js(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {"require-dev": {"pestphp/pest": "^2.0"}})
    _write_json(tmp_path / "package.json", {"devDependencies": {"vitest": "^2.0"}})
    result = resolve_toolchain(tmp_path)
    assert set(result.ecosystems) == {"php", "js"}
    # Fast-by-default selects one fast runner per ecosystem.
    assert _selected_labels(result) == {"pest", "vitest"}


def test_php_only_narrows_polyglot(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {"require-dev": {"pestphp/pest": "^2.0"}})
    _write_json(tmp_path / "package.json", {"devDependencies": {"vitest": "^2.0"}})
    result = resolve_toolchain(tmp_path, php_only=True)
    assert _selected_labels(result) == {"pest"}
    # Inventory still carries the JS runner — narrowing affects selection only.
    assert "vitest" in _runner_labels(result)


# --- Quality tools ---------------------------------------------------------

def test_quality_php_and_js(tmp_path: Path) -> None:
    _write_json(
        tmp_path / "composer.json",
        {"require-dev": {"pestphp/pest": "^2", "phpstan/phpstan": "^1", "laravel/pint": "^1"}},
    )
    _write_json(
        tmp_path / "package.json",
        {"devDependencies": {"vitest": "^2", "typescript": "^5", "eslint": "^9"}},
    )
    result = resolve_toolchain(tmp_path)
    assert "vendor/bin/phpstan analyse" in result.quality
    assert "vendor/bin/pint" in result.quality
    assert "npx tsc --noEmit" in result.quality
    assert "npx eslint ." in result.quality


# --- Recoverable-error contract -------------------------------------------

def test_no_manifest_is_low_confidence(tmp_path: Path) -> None:
    result = resolve_toolchain(tmp_path)
    assert result.runners == ()
    assert result.selected == ()
    assert result.confidence == LOW
    assert result.mtime == 0.0


def test_malformed_json_degrades(tmp_path: Path) -> None:
    (tmp_path / "composer.json").write_text("{ not valid json", encoding="utf-8")
    result = resolve_toolchain(tmp_path)
    # composer.json exists (so PHP ecosystem fires) but its content is junk —
    # falls back to the MEDIUM phpunit default rather than crashing.
    assert result.confidence in {HIGH, "MEDIUM"}
    assert _selected_labels(result) == {"phpunit"}


def test_known_runners_is_closed_set(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {"require-dev": {"pestphp/pest": "^2.0"}})
    _write_json(
        tmp_path / "package.json",
        {"devDependencies": {"vitest": "^2.0", "@playwright/test": "^1.4"}},
    )
    result = resolve_toolchain(tmp_path, include_e2e=True)
    assert _runner_labels(result) <= KNOWN_RUNNERS


# --- Auto-generated config + mtime cache -----------------------------------

def test_write_config(tmp_path: Path) -> None:
    _write_json(tmp_path / "composer.json", {"require-dev": {"pestphp/pest": "^2.0"}})
    result = resolve_toolchain(tmp_path)
    target = write_config(tmp_path, result)
    assert target.is_file()
    config = json.loads(target.read_text(encoding="utf-8"))
    assert config["ecosystems"] == ["php"]
    assert "vendor/bin/pest" in config["selected"]


def test_mtime_tracks_manifests(tmp_path: Path) -> None:
    assert latest_manifest_mtime(tmp_path) == 0.0
    _write_json(tmp_path / "composer.json", {"require": {}})
    assert latest_manifest_mtime(tmp_path) > 0.0
