"""Test-time path wiring for the ``telemetry`` template package.

Mirrors ``tests/work_engine/conftest.py`` — the production code ships
under ``.agent-src.uncondensed/templates/scripts/telemetry/``, so we
expose the template scripts directory on ``sys.path`` for the
duration of the test run.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Post-monorepo Phase 4 the templates tree moved under
# packages/<pack>/.agent-src.uncondensed/templates/. Discover every
# active source root and add its templates/scripts/ child to sys.path.
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib.agent_src import artefact_roots  # noqa: E402

for _root in artefact_roots():
    _ts = _root / "templates" / "scripts"
    if _ts.is_dir() and str(_ts) not in sys.path:
        sys.path.insert(0, str(_ts))
