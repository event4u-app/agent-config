"""Install-layout ABI version.

The *install layout* is the on-disk shape the installer writes into a host
(paths created, JSON-pointer keys claimed, the surgical-uninstall pointer
schema, the lockfile shapes). It is frozen as a versioned contract in
``docs/contracts/install-layout.md``.

This module owns the single source of truth for the layout version. The
installer stamps :data:`INSTALL_LAYOUT_VERSION` into the global lockfile
(``~/.event4u/agent-config/installed.lock``) so an installed tree
self-declares which ABI it was written under.

Back-compat: a lockfile written before the freeze has no
``install_layout_version`` key. Readers treat an absent value as
:data:`PRE_FREEZE_LAYOUT_VERSION` (v0 / pre-freeze), which the installer
migrates in place on the next run. A bump to :data:`INSTALL_LAYOUT_VERSION`
is a declared layout change governed by the deprecation-window rule in
``BREAKING_CHANGES.md``.
"""
from __future__ import annotations

#: A lockfile with no ``install_layout_version`` predates the freeze.
PRE_FREEZE_LAYOUT_VERSION = 0

#: Current on-disk install-layout ABI version. Bump only with a declared
#: layout change + a deprecation-window entry in ``BREAKING_CHANGES.md``.
INSTALL_LAYOUT_VERSION = 1


def coerce_layout_version(value: object) -> int:
    """Normalise a recorded layout-version value to an int.

    Absent / unparseable → :data:`PRE_FREEZE_LAYOUT_VERSION`, so a
    hand-edited or pre-freeze lockfile reads as v0 rather than raising.
    """
    if value is None:
        return PRE_FREEZE_LAYOUT_VERSION
    try:
        return int(value)
    except (TypeError, ValueError):
        return PRE_FREEZE_LAYOUT_VERSION


def needs_migration(recorded: object) -> bool:
    """True when an installed tree's layout version is older than current."""
    return coerce_layout_version(recorded) < INSTALL_LAYOUT_VERSION
