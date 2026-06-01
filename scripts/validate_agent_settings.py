#!/usr/bin/env python3
"""Agent-settings schema validator (rule_loading_tier untangle, 2026-06-01).

Validates ``config/agent-settings.template.yml`` and any local
``.agent-settings.yml`` against
``scripts/schemas/agent-settings.schema.json``. The schema is
deliberately permissive (``additionalProperties: true`` everywhere) and
only enum-constrains the value-bearing keys that have historically been
overloaded with a foreign vocabulary — the root cause of the
``rule_loading_tier`` / memory-cadence collision. Its job is to make a
value-vocabulary collision a hard CI failure.

Template placeholders (``__RULE_LOADING_TIER__``, ``__USER_TYPE__``) are
substituted with their installer defaults before validation, mirroring
``scripts/install.py``.

Exit codes:
- 0 — every checked file validates.
- 1 — at least one schema violation (unknown enum value, wrong type).
- 3 — bootstrap failure (missing dependency / schema file).

Contract: docs/contracts/cost-profile-defaults.md +
docs/contracts/memory-visibility-v1.md. Wired into ``task ci`` via
``taskfiles/ci-fast.yml``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
try:  # invocation-agnostic import (repo-root-on-path vs scripts-on-path)
    from scripts._lib.agent_settings import project_settings_path
except ModuleNotFoundError:  # pragma: no cover
    from _lib.agent_settings import project_settings_path

try:
    import yaml
except ImportError:  # pragma: no cover — bootstrap guard
    print("::error::PyYAML not installed; cannot validate agent settings")
    sys.exit(3)

try:
    import jsonschema
except ImportError:  # pragma: no cover — bootstrap guard
    print("::error::jsonschema not installed; cannot validate agent settings")
    sys.exit(3)

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "scripts" / "schemas" / "agent-settings.schema.json"
TEMPLATE_PATH = REPO_ROOT / "config" / "agent-settings.template.yml"
LOCAL_PATHS = [project_settings_path(REPO_ROOT)]

# Installer-default substitutions, mirroring scripts/install.py so the
# template validates as it would after a fresh `balanced` install.
PLACEHOLDERS = {
    "__RULE_LOADING_TIER__": "balanced",
    "__USER_TYPE__": "",
}


def _load_yaml(path: Path, *, substitute: bool) -> dict | None:
    if not path.is_file():
        return None
    text = path.read_text(encoding="utf-8")
    if substitute:
        for placeholder, value in PLACEHOLDERS.items():
            text = text.replace(placeholder, value)
    try:
        raw = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        print(f"::error file={path}::malformed YAML: {exc}")
        return {}
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        print(f"::error file={path}::top-level must be a mapping")
        return {}
    return raw


def _validate(path: Path, doc: dict, validator: jsonschema.Draft7Validator) -> int:
    errors = sorted(validator.iter_errors(doc), key=lambda e: list(e.path))
    if not errors:
        return 0
    for err in errors:
        loc = ".".join(str(p) for p in err.path) or "<root>"
        print(f"::error file={path}::{loc}: {err.message}")
    return len(errors)


def main() -> int:
    if not SCHEMA_PATH.is_file():
        print(f"::error::schema missing: {SCHEMA_PATH}")
        return 3
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = jsonschema.Draft7Validator(schema)

    total_errors = 0
    checked = 0

    template = _load_yaml(TEMPLATE_PATH, substitute=True)
    if template is None:
        print(f"::error file={TEMPLATE_PATH}::template missing")
        return 1
    total_errors += _validate(TEMPLATE_PATH, template, validator)
    checked += 1

    for local in LOCAL_PATHS:
        doc = _load_yaml(local, substitute=False)
        if doc is None:
            continue
        total_errors += _validate(local, doc, validator)
        checked += 1

    if total_errors:
        print(f"agent-settings schema: {total_errors} violation(s) across {checked} file(s)")
        return 1
    print(f"agent-settings schema: OK ({checked} file(s) validated)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
