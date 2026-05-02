"""Outer-pytest collection rules for the golden capture sandbox.

The toy domain under ``tests/golden/sandbox/repo/`` ships its own
``pytest.ini`` and is intended to be exercised **only** when the
capture harness drives ``pytest`` inside the sandbox cwd. Letting the
top-level pytest invocation collect those files causes a name clash
(``tests.test_calculator`` collides with the rootdir ``tests/`` tree)
and breaks unrelated test runs.

We exclude the sandbox repository from outer collection here; the
captures still execute it directly via subprocess in
``tests.golden.sandbox.runner``.
"""
from __future__ import annotations

collect_ignore_glob = [
    "sandbox/repo/*",
    "sandbox/repo/**/*",
]


def pytest_configure(config) -> None:
    """Register the ``smoke`` marker used by ``test_replay``.

    Smoke-tagged Golden Transcripts run on every PR via
    ``pytest -m smoke`` (see ``Taskfile.yml::golden-replay-smoke``);
    the full matrix is locked in by the nightly freeze-guard run.
    """
    config.addinivalue_line(
        "markers",
        "smoke: representative GT subset for fast PR feedback",
    )
