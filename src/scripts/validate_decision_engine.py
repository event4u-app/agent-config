#!/usr/bin/env python3
"""
Decision-engine settings validator (road-to-productization P2).

Walks every ``agent-settings.yml`` / ``agent-settings.template.yml``
under the repo, parses any ``decision_engine`` block via the canonical
``work_engine.scoring.decision_engine.parse`` schema, and surfaces:

- hard errors → exit 1 (unknown keys, invalid enum values, bad types).
- warnings    → exit 0 with a ``::warning::`` line per finding
  (gates active but ``hooks.enabled`` is false → gates won't fire).

Contract: ``docs/contracts/decision-engine-gates.md``. Wired into
``task ci`` via ``taskfiles/ci-fast.yml`` so configuration drift is
caught before a Decision Engine surprise lands in main.
"""

from __future__ import annotations

import sys
from pathlib import Path
try:  # invocation-agnostic import (repo-root-on-path vs scripts-on-path)
    from scripts._lib.agent_settings import project_settings_path
except ModuleNotFoundError:  # pragma: no cover
    from _lib.agent_settings import project_settings_path

try:
    import yaml
except ImportError:  # pragma: no cover — bootstrap guard
    print("::error::PyYAML not installed; cannot validate decision_engine block")
    sys.exit(3)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
from _lib.agent_src import resolve_logical  # noqa: E402

# Post-ADR-017 the templates/ tree lives under packages/core/; fall back
# to the legacy root for pre-move checkouts.
_template_scripts = resolve_logical("templates/scripts")
TEMPLATE_SCRIPTS = _template_scripts or (
    REPO_ROOT / ".agent-src.uncondensed" / "templates" / "scripts"
)
if str(TEMPLATE_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(TEMPLATE_SCRIPTS))

from work_engine.scoring.decision_engine import (  # noqa: E402
    DecisionEngineConfigError,
    parse,
)

# Files we always validate, even if they don't exist (template is
# canonical — its absence is itself a regression).
TEMPLATE_PATH = REPO_ROOT / "config" / "agent-settings.template.yml"
# Project-level overrides developers may have on disk locally.
LOCAL_PATHS = [project_settings_path(REPO_ROOT)]


def _load_yaml(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        print(f"::error file={path}::malformed YAML: {exc}")
        return {}
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        print(f"::error file={path}::top-level must be a mapping")
        return {}
    return raw


def _validate(path: Path, doc: dict) -> tuple[int, int]:
    """Return ``(errors, warnings)`` counts for ``doc``."""
    errors = 0
    warnings = 0
    block = doc.get("decision_engine")
    if block is None:
        return 0, 0
    try:
        settings = parse(block)
    except DecisionEngineConfigError as exc:
        rel = path.relative_to(REPO_ROOT)
        print(f"::error file={rel}::decision_engine: {exc}")
        return 1, 0
    if settings.any_gate_active:
        hooks_block = doc.get("hooks") or {}
        if isinstance(hooks_block, dict) and hooks_block.get("enabled") is False:
            rel = path.relative_to(REPO_ROOT)
            print(
                f"::warning file={rel}::decision_engine gates configured "
                "(min_confidence/block_on_risk/require_memory_hits) but "
                "hooks.enabled=false — gates will not fire. Either enable "
                "hooks or remove the gate keys."
            )
            warnings += 1
    return errors, warnings


def main() -> int:
    total_errors = 0
    total_warnings = 0
    paths: list[Path] = []
    if TEMPLATE_PATH.is_file():
        paths.append(TEMPLATE_PATH)
    else:
        print(f"::error file={TEMPLATE_PATH}::template missing")
        return 1
    for candidate in LOCAL_PATHS:
        if candidate.is_file():
            paths.append(candidate)
    for path in paths:
        doc = _load_yaml(path)
        if doc is None:
            continue
        errors, warnings = _validate(path, doc)
        total_errors += errors
        total_warnings += warnings
    if total_errors:
        return 1
    if total_warnings:
        # Warnings already printed; CI treats exit 0 + ::warning:: as
        # green-with-note. Surface a summary for human readers.
        print(
            f"decision_engine: {total_warnings} warning(s); see ::warning:: lines above"
        )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"::error::validate_decision_engine internal error: {exc}")
        sys.exit(3)
