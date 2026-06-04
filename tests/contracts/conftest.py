"""Test-time path wiring for contract tests.

Mirrors ``tests/work_engine/conftest.py`` — contract tests sometimes
import scoring helpers from
``.agent-src.uncondensed/templates/scripts/work_engine/`` (e.g. the
memory-visibility redaction test). Expose the template scripts
directory on ``sys.path`` so collection works regardless of order.
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
