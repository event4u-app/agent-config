"""Internal helpers shared across work_engine submodules.

Currently houses :mod:`agent_settings` — the byte-identical mirror of
``scripts/_lib/agent_settings.py`` from the agent-config package. The
parity test in ``tests/test_template_agent_settings_parity.py`` guards
the two files against drift.
"""
