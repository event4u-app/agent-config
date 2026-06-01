"""Test-time path wiring for the ``work_engine`` template package.

Mirrors ``tests/implement_ticket/conftest.py`` — the production code
ships under ``.agent-src.uncondensed/templates/scripts/work_engine/``,
so we expose the template scripts directory on ``sys.path`` for the
duration of the test run.

The ``_isolate_user_global_settings`` autouse fixture redirects the
agent-settings loader's user-global path to a non-existent file so the
developer's real ``~/.event4u/agent-config/agent-settings.yml`` (or the
legacy ``~/.config/agent-config/agent-settings.yml``) cannot leak into
``load_hook_settings`` tests (road-to-portable-dev-prefs P3).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

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


@pytest.fixture(autouse=True)
def _isolate_user_global_settings(
    tmp_path_factory: pytest.TempPathFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Redirect the agent-settings user-global path away from ``$HOME``.

    Without this, a developer with a real
    ``~/.event4u/agent-config/agent-settings.yml`` (or legacy
    ``~/.config/agent-config/agent-settings.yml``) would see test
    assertions flip whenever their global config sets e.g.
    ``rule_loading_tier``. Pointing the default at an empty tmp_path keeps
    every test deterministic and machine-portable.
    """
    sandbox = tmp_path_factory.mktemp("user-global-isolation") / "missing.yml"
    monkeypatch.setattr(
        "work_engine._lib.agent_settings.DEFAULT_USER_GLOBAL_FILE",
        sandbox,
    )
