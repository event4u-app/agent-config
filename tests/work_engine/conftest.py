"""Test-time path wiring for the ``work_engine`` template package.

Mirrors ``tests/implement_ticket/conftest.py`` — the production code
ships under ``.agent-src.uncompressed/templates/scripts/work_engine/``,
so we expose the template scripts directory on ``sys.path`` for the
duration of the test run.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TEMPLATE_SCRIPTS = REPO_ROOT / ".agent-src.uncompressed" / "templates" / "scripts"

if str(TEMPLATE_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(TEMPLATE_SCRIPTS))
