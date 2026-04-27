"""State-file migrations for the universal engine.

Each module in this package owns one direction of one schema bump. The
historical bumps must remain runnable so a freshly-cloned repository
that finds a v0 state file from a long-running branch can catch up
without manual intervention.
"""
from __future__ import annotations
