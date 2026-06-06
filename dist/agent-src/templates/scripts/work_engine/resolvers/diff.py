"""Diff resolver — wrap a unified-diff payload as an :class:`Input` envelope.

The resolver is the R3 Phase 1 entry point for the "improve this screen via
diff/PR" surface: a user (or `/work` adapter) hands the engine a patch text,
the resolver normalises it, and the dispatcher routes it through the UI-track
``ui-improve`` directive set.

Like :mod:`work_engine.resolvers.prompt`, this module is intentionally thin:
it normalises and rejects garbage payloads, nothing more. Reconstruction of
acceptance criteria + assumptions + confidence is the job of the
``refine-prompt`` skill (R2 Phase 3) running against the diff once the engine
hits the ``refine`` step. Keeping the split sharp means the envelope shape
stays cheap to round-trip through state and the heavy lifting stays with the
agent-directive halt where it belongs.

The envelope mirrors the prompt resolver's shape so a single refiner code
path can read both — ``{raw, reconstructed_ac, assumptions}``. The only
material difference is the heuristic header check that rejects payloads
that obviously are not unified-diff text.
"""
from __future__ import annotations

import re

from ..state import Input

KIND = "diff"
"""Wire value carried in :attr:`work_engine.state.Input.kind`."""

_MIN_DIFF_LEN = 1
"""Minimum non-whitespace character count before the heuristic runs.

The resolver is not a *quality* gate; it only rejects literally empty payloads
and obvious non-diffs. A semantically empty diff (e.g., headers but no hunks)
is still accepted so the refiner can score its tractability and surface a
``low``-band halt where appropriate."""

_DIFF_MARKERS = (
    re.compile(r"^diff --git ", re.MULTILINE),
    re.compile(r"^--- ", re.MULTILINE),
    re.compile(r"^\+\+\+ ", re.MULTILINE),
    re.compile(r"^@@ ", re.MULTILINE),
    re.compile(r"^Index: ", re.MULTILINE),
)
"""Heuristic markers that flag a payload as a unified or git-style diff.

A payload qualifies if **any** marker matches — the resolver accepts unified
diffs (``--- ``/``+++ ``/``@@ ``), ``git diff`` output (``diff --git``), and
the legacy ``Index: `` SVN/CVS header. The match is anchored at line start so
quoted snippets inside prose ("the function `--- foo` failed") do not pass
the gate."""


class DiffResolverError(ValueError):
    """Raised when a payload cannot be resolved into a diff envelope."""


def build_envelope(raw: str) -> Input:
    """Return an :class:`Input` carrying the raw diff + empty refinement slots.

    Parameters
    ----------
    raw:
        The user-supplied diff text. Whitespace is preserved verbatim — the
        refiner reads original spacing/casing when scoring goal clarity, and
        a unified-diff round-trip cannot tolerate normalised whitespace.

    Returns
    -------
    Input
        Envelope of shape
        ``{"kind": "diff", "data": {"raw": <raw>, "reconstructed_ac": [],
        "assumptions": []}}``. The two empty lists are placeholders the
        ``refine-prompt`` skill writes into on the rebound from ``refine``.

    Raises
    ------
    DiffResolverError
        If ``raw`` is not a string, contains no non-whitespace characters,
        or does not match any :data:`_DIFF_MARKERS`. The marker check guards
        against accidentally routing free-form prose through the diff path.
    """
    if not isinstance(raw, str):
        raise DiffResolverError(
            f"diff must be a string; got {type(raw).__name__}",
        )
    if len(raw.strip()) < _MIN_DIFF_LEN:
        raise DiffResolverError(
            "diff is empty or whitespace-only — nothing to resolve",
        )
    if not any(marker.search(raw) for marker in _DIFF_MARKERS):
        raise DiffResolverError(
            "payload does not look like a unified diff — expected one of "
            "'diff --git', '--- ', '+++ ', '@@ ', or 'Index: ' headers",
        )
    return Input(
        kind=KIND,
        data={
            "raw": raw,
            "reconstructed_ac": [],
            "assumptions": [],
        },
    )


__all__ = ["KIND", "DiffResolverError", "build_envelope"]
