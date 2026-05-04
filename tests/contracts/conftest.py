"""Test-time path wiring for contract tests.

Mirrors ``tests/work_engine/conftest.py`` — contract tests sometimes
import scoring helpers from
``.agent-src.uncompressed/templates/scripts/work_engine/`` (e.g. the
memory-visibility redaction test). Expose the template scripts
directory on ``sys.path`` so collection works regardless of order.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TEMPLATE_SCRIPTS = REPO_ROOT / ".agent-src.uncompressed" / "templates" / "scripts"

if str(TEMPLATE_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(TEMPLATE_SCRIPTS))
