"""Contract tests for ``scripts/_lib/module_detection.py``.

Covers Phase B Step 5 of road-to-configurable-modules — every stack
shape from ``commands/module/explore.md`` Step 1 must surface as a
candidate, and confidence must downgrade correctly when the root is
empty or its contents do not match the stack signal.
"""
from __future__ import annotations

from pathlib import Path

from scripts._lib.module_detection import (
    ModuleCandidate,
    detect_module_roots,
    is_module_like_path,
)


# --- helpers ---------------------------------------------------------------

def _mkmodule(root: Path, name: str, *, package_json: bool = False,
              init_py: bool = False) -> Path:
    mod = root / name
    mod.mkdir(parents=True)
    if package_json:
        (mod / "package.json").write_text("{}", encoding="utf-8")
    if init_py:
        (mod / "__init__.py").write_text("", encoding="utf-8")
    return mod


def _by_stack(candidates: list[ModuleCandidate]) -> dict[str, ModuleCandidate]:
    return {c.stack: c for c in candidates}


# --- stack-shape coverage --------------------------------------------------

def test_empty_project_yields_no_candidates(tmp_path: Path) -> None:
    assert detect_module_roots(tmp_path) == []


def test_laravel_hmvc_detected_with_capitalized_modules(tmp_path: Path) -> None:
    _mkmodule(tmp_path / "app/Modules", "ApiClient")
    _mkmodule(tmp_path / "app/Modules", "ClientSoftware")
    result = detect_module_roots(tmp_path)
    by_stack = _by_stack(result)
    assert "laravel-hmvc" in by_stack
    cand = by_stack["laravel-hmvc"]
    assert cand.path == "app/Modules"
    assert cand.namespace_template_guess == "App\\Modules\\{ModuleName}"
    assert cand.confidence == "high"


def test_laravel_hmvc_empty_dir_downgrades_to_medium(tmp_path: Path) -> None:
    (tmp_path / "app" / "Modules").mkdir(parents=True)
    [cand] = [c for c in detect_module_roots(tmp_path) if c.stack == "laravel-hmvc"]
    assert cand.confidence == "medium"


def test_symfony_ddd_detected_at_src_module(tmp_path: Path) -> None:
    _mkmodule(tmp_path / "src/Module", "Billing")
    _mkmodule(tmp_path / "src/Module", "Catalog")
    by_stack = _by_stack(detect_module_roots(tmp_path))
    assert "symfony-ddd" in by_stack
    cand = by_stack["symfony-ddd"]
    assert cand.path == "src/Module"
    assert cand.namespace_template_guess == "App\\Module\\{ModuleName}"
    assert cand.confidence == "high"


def test_node_monorepo_detected_via_packages_with_package_json(
    tmp_path: Path,
) -> None:
    _mkmodule(tmp_path / "packages", "core", package_json=True)
    _mkmodule(tmp_path / "packages", "ui", package_json=True)
    by_stack = _by_stack(detect_module_roots(tmp_path))
    assert "node-monorepo" in by_stack
    cand = by_stack["node-monorepo"]
    assert cand.path == "packages"
    assert cand.namespace_template_guess == ""
    assert cand.confidence == "high"


def test_node_monorepo_packages_without_package_json_is_medium(
    tmp_path: Path,
) -> None:
    _mkmodule(tmp_path / "packages", "core")
    [cand] = [c for c in detect_module_roots(tmp_path)
              if c.path == "packages" and c.stack == "node-monorepo"]
    assert cand.confidence == "medium"


def test_python_src_layout_detected_via_init_py(tmp_path: Path) -> None:
    _mkmodule(tmp_path / "src", "mypkg", init_py=True)
    by_stack = _by_stack(detect_module_roots(tmp_path))
    # `src` rule fires for python-src; capitalized subdir would also hit
    # symfony-ddd but here `mypkg` is lowercase so only python-src is high.
    assert "python-src" in by_stack
    assert by_stack["python-src"].confidence == "high"


def test_go_internal_detected_with_any_subdirs(tmp_path: Path) -> None:
    _mkmodule(tmp_path / "internal", "auth")
    _mkmodule(tmp_path / "internal", "billing")
    by_stack = _by_stack(detect_module_roots(tmp_path))
    assert "go-internal" in by_stack
    cand = by_stack["go-internal"]
    assert cand.path == "internal"
    assert cand.namespace_template_guess == ""
    assert cand.confidence == "high"


def test_composer_library_src_layout_surfaces_as_python_src_rule(
    tmp_path: Path,
) -> None:
    # `src/` with capitalized PHP-style subdir (no __init__.py) →
    # python-src rule fires at medium, symfony-ddd only fires when
    # `src/Module/` exists (this is the explicit Symfony shape).
    _mkmodule(tmp_path / "src", "MyLib")
    candidates = detect_module_roots(tmp_path)
    paths = {(c.path, c.stack) for c in candidates}
    assert ("src", "python-src") in paths


# --- ordering + skip-dirs --------------------------------------------------

def test_high_confidence_candidates_listed_before_medium(tmp_path: Path) -> None:
    # Empty laravel root (medium) + populated node monorepo (high)
    (tmp_path / "app" / "Modules").mkdir(parents=True)
    _mkmodule(tmp_path / "packages", "core", package_json=True)
    result = detect_module_roots(tmp_path)
    confidences = [c.confidence for c in result]
    # Every high precedes every medium.
    assert confidences == sorted(confidences, key=lambda c: 0 if c == "high" else 1)


def test_skip_dirs_are_excluded_from_subdir_scoring(tmp_path: Path) -> None:
    _mkmodule(tmp_path / "app/Modules", ".module-template")
    _mkmodule(tmp_path / "app/Modules", ".example")
    [cand] = [c for c in detect_module_roots(tmp_path) if c.stack == "laravel-hmvc"]
    # Only skip-dir entries present → no capitalized modules → medium.
    assert cand.confidence == "medium"


def test_absent_directories_never_appear(tmp_path: Path) -> None:
    # Only laravel exists; node/python/go rules must all skip silently.
    _mkmodule(tmp_path / "app/Modules", "Billing")
    result = detect_module_roots(tmp_path)
    stacks = {c.stack for c in result}
    assert stacks == {"laravel-hmvc"}


# --- is_module_like_path() ------------------------------------------------

def test_is_module_like_path_accepts_laravel_hmvc_shape() -> None:
    assert is_module_like_path("app/Modules/User/Models/User.php")
    assert is_module_like_path("Modules/Billing/Service.php")


def test_is_module_like_path_accepts_node_monorepo_shape() -> None:
    assert is_module_like_path("packages/ui/src/index.ts")
    assert is_module_like_path("apps/web/pages/index.tsx")


def test_is_module_like_path_accepts_go_internal_shape() -> None:
    assert is_module_like_path("internal/auth/handler.go")


def test_is_module_like_path_rejects_vendor_and_build_paths() -> None:
    # Even with module-shaped parent, noise segments hard-disqualify.
    assert not is_module_like_path("vendor/foo/Modules/Bar/file.php")
    assert not is_module_like_path("node_modules/pkg/packages/x.js")
    assert not is_module_like_path("dist/Modules/User.js")
    assert not is_module_like_path("storage/Modules/x.log")


def test_is_module_like_path_rejects_flat_paths() -> None:
    assert not is_module_like_path("src/App.php")
    assert not is_module_like_path("README.md")
    assert not is_module_like_path("config/app.php")


def test_is_module_like_path_rejects_bare_parent_without_child() -> None:
    # "Modules" alone (last segment) is not module-like.
    assert not is_module_like_path("app/Modules")
    assert not is_module_like_path("packages")


def test_is_module_like_path_rejects_skip_dir_children() -> None:
    assert not is_module_like_path("Modules/.module-template/stub.php")
    assert not is_module_like_path("packages/.example/file.ts")


def test_is_module_like_path_handles_empty_and_windows_input() -> None:
    assert not is_module_like_path("")
    assert not is_module_like_path("/")
    # Backslashes normalised; trailing/leading slashes stripped.
    assert is_module_like_path("app\\Modules\\User\\file.php")
