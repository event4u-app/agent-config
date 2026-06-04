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

# Post-monorepo Phase 4 the templates tree moved under
# packages/<pack>/.agent-src.uncondensed/templates/. Discover every
# active source root and add its templates/scripts/ child to sys.path.
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
from _lib.agent_src import artefact_roots  # noqa: E402

for _root in artefact_roots():
    _ts = _root / "templates" / "scripts"
    if _ts.is_dir() and str(_ts) not in sys.path:
        sys.path.insert(0, str(_ts))
