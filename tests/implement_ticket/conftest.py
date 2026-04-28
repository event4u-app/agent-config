"""Test-time path wiring for the ``implement_ticket`` deprecation shim.

The engine itself moved to ``work_engine`` in R1 Phase 3; the main
test suite lives under ``tests/work_engine/``. This directory keeps
only the shim contract tests (see ``test_shim.py``) which prove that
the legacy ``implement_ticket`` module still imports, re-exports the
public surface, and aliases submodule paths during the deprecation
window. The sys.path wiring mirrors ``tests/work_engine/conftest.py``
so the shim resolves against the on-disk template scripts.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TEMPLATE_SCRIPTS = REPO_ROOT / ".agent-src.uncompressed" / "templates" / "scripts"

if str(TEMPLATE_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(TEMPLATE_SCRIPTS))
