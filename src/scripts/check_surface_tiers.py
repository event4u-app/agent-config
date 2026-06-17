#!/usr/bin/env python3
"""Surface-tier boundary guard (road-to-install-contract-stability Phase 2).

Two assertions, council-locked 2026-06-17 (claude-sonnet-4-5 + gpt-4o):

1. **Exhaustive registry.** Every `src/scripts/*/` cluster directory must be
   classified in `src/scripts/surface-tiers.yml`. A new unclassified cluster
   fails CI, forcing the core/lab decision at creation time.

2. **No core → lab hard import.** A `core`-tier Python module must not import a
   `lab`-tier module at module scope. A `try/except (ModuleNotFoundError |
   ImportError | Exception)`-guarded optional import is ALLOWED — core degrades
   gracefully when lab is absent. Distinguished via AST (guarded = lexically
   inside such a `try`).

Kill-switch (council refinement): `--skip-imports` or
`AGENT_CONFIG_SKIP_SURFACE_TIER_CHECK=1` disables assertion 2 without a code
change, so a misfiring guard never blocks all merges while a fix is drafted.

Exit 0 = clean; 1 = violation(s) with a remediation hint.
"""
from __future__ import annotations

import argparse
import ast
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "src" / "scripts"
REGISTRY = SCRIPTS / "surface-tiers.yml"

# Cluster dirs that are not first-class clusters (generated / dunder).
_IGNORE_DIRS = {"__pycache__"}
_GUARD_HANDLERS = {"ModuleNotFoundError", "ImportError", "Exception"}


def _load_registry() -> tuple[dict[str, str], set[str]]:
    import yaml

    data = yaml.safe_load(REGISTRY.read_text(encoding="utf-8")) or {}
    clusters = {str(k): str(v) for k, v in (data.get("clusters") or {}).items()}
    lab_modules = {str(m) for m in (data.get("lab_modules") or [])}
    return clusters, lab_modules


def check_exhaustive(clusters: dict[str, str]) -> list[str]:
    """Every src/scripts/*/ dir must be classified."""
    errors: list[str] = []
    for child in sorted(SCRIPTS.iterdir()):
        if not child.is_dir() or child.name in _IGNORE_DIRS:
            continue
        if child.name not in clusters:
            errors.append(
                f"cluster '{child.name}' missing from surface-tiers.yml — "
                f"add it under clusters: as 'core' or 'lab'."
            )
    return errors


def _module_tier(dotted: str, clusters: dict[str, str], lab_modules: set[str]) -> str:
    """Resolve an imported module's tier. Default core (stdlib / core libs)."""
    segments = [s for s in dotted.split(".") if s]
    if segments and segments[0] == "scripts":
        segments = segments[1:]
    if not segments:
        return "core"
    head = segments[0]
    if head in clusters:
        return clusters[head]
    if head in lab_modules:
        return "lab"
    return "core"


def _file_tier(path: Path, clusters: dict[str, str], lab_modules: set[str]) -> str:
    """Tier of a source file under src/scripts/."""
    rel = path.relative_to(SCRIPTS)
    parts = rel.parts
    if len(parts) >= 2:  # under a cluster dir
        return clusters.get(parts[0], "core")
    return "lab" if path.stem in lab_modules else "core"


def _guarded_import_lines(tree: ast.AST) -> set[int]:
    """Line numbers of import statements lexically inside a guarding try/except."""
    guarded: set[int] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Try):
            continue
        handles_import = any(
            isinstance(h.type, ast.Name) and h.type.id in _GUARD_HANDLERS
            or (
                isinstance(h.type, ast.Tuple)
                and any(
                    isinstance(e, ast.Name) and e.id in _GUARD_HANDLERS
                    for e in h.type.elts
                )
            )
            or h.type is None  # bare except
            for h in node.handlers
        )
        if not handles_import:
            continue
        # Both the try body AND the except-handler bodies count: the common
        # `try: import X / except ModuleNotFoundError: <fix path>; import X`
        # fallback re-imports in the handler and is still graceful degradation.
        bodies = list(node.body)
        for h in node.handlers:
            bodies.extend(h.body)
        for stmt in bodies:
            for sub in ast.walk(stmt):
                if isinstance(sub, (ast.Import, ast.ImportFrom)):
                    guarded.add(sub.lineno)
    return guarded


def check_imports(clusters: dict[str, str], lab_modules: set[str]) -> list[str]:
    """No core module may hard-import a lab module."""
    errors: list[str] = []
    for py in sorted(SCRIPTS.rglob("*.py")):
        if "__pycache__" in py.parts:
            continue
        if _file_tier(py, clusters, lab_modules) != "core":
            continue
        try:
            tree = ast.parse(py.read_text(encoding="utf-8"), filename=str(py))
        except (SyntaxError, OSError):
            continue
        guarded = _guarded_import_lines(tree)
        for node in ast.walk(tree):
            mods: list[str] = []
            if isinstance(node, ast.Import):
                mods = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                mods = [node.module]
            else:
                continue
            if node.lineno in guarded:
                continue
            for m in mods:
                if _module_tier(m, clusters, lab_modules) == "lab":
                    rel = py.relative_to(ROOT)
                    errors.append(
                        f"{rel}:{node.lineno} — core module hard-imports lab "
                        f"module '{m}'. Guard it (try/except ModuleNotFoundError) "
                        f"or extract the shared code into a core _lib module."
                    )
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Surface-tier boundary guard.")
    parser.add_argument(
        "--skip-imports",
        action="store_true",
        help="kill-switch: skip the core→lab import check (exhaustiveness still runs).",
    )
    args = parser.parse_args(argv)
    skip_imports = args.skip_imports or os.environ.get(
        "AGENT_CONFIG_SKIP_SURFACE_TIER_CHECK"
    ) in ("1", "true", "yes")

    clusters, lab_modules = _load_registry()
    errors = check_exhaustive(clusters)
    if skip_imports:
        print("surface-tiers: import boundary check SKIPPED (kill-switch).")
    else:
        errors += check_imports(clusters, lab_modules)

    if errors:
        print(f"❌ surface-tier boundary: {len(errors)} violation(s)")
        for e in errors:
            print(f"   {e}")
        return 1
    print(
        f"✅ surface-tiers: {len(clusters)} clusters classified, "
        "no unguarded core→lab imports."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
