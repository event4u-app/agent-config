"""File resolver — wrap a path reference as an :class:`Input` envelope.

The resolver is the R3 Phase 1 entry point for the "improve this existing
component/page" surface: a user hands the engine a path (e.g.,
``resources/views/dashboard.blade.php`` or ``src/components/Sidebar.tsx``),
the resolver normalises it, and the dispatcher routes the envelope through
the UI-track ``ui-improve`` directive set.

Like :mod:`work_engine.resolvers.prompt` and :mod:`.diff`, this module is
intentionally thin: it normalises and rejects garbage payloads, nothing
more. Existence checks, mtime caching, and content reads are deferred to
the ``analyze`` step / the audit directive — a resolver doing I/O at the
command-shell boundary would couple the envelope build to filesystem state
and break replay-against-state-files.

The envelope mirrors the prompt and diff resolvers so a single refiner code
path can read all three — ``{path, reconstructed_ac, assumptions}``. The
only material difference is the path-shape check that rejects values that
are obviously not paths (absolute URLs, empty strings, control chars).
"""
from __future__ import annotations

import os

from ..state import Input

KIND = "file"
"""Wire value carried in :attr:`work_engine.state.Input.kind`."""

_MIN_PATH_LEN = 1
"""Minimum non-whitespace character count for a resolvable path.

A 1-char path is rare but legal (``a``); the bar exists only to reject
literal empty / whitespace-only payloads which carry no signal at all."""

_FORBIDDEN_PREFIXES = ("http://", "https://", "ftp://", "file://")
"""Prefixes that signal the caller passed a URL, not a filesystem path.

The diff resolver handles patch URLs at a future R3 layer; the file
resolver only accepts on-disk references. Rejecting URLs explicitly
keeps misuse loud instead of letting the audit step discover it later.
The check is case-insensitive."""


class FileResolverError(ValueError):
    """Raised when a payload cannot be resolved into a file envelope."""


def build_envelope(path: str) -> Input:
    """Return an :class:`Input` carrying the path + empty refinement slots.

    Parameters
    ----------
    path:
        The user-supplied path reference. The resolver normalises only by
        stripping leading/trailing whitespace; case, separators, and the
        relative-vs-absolute distinction are all preserved verbatim so the
        downstream audit step reads exactly what the user wrote.

    Returns
    -------
    Input
        Envelope of shape
        ``{"kind": "file", "data": {"path": <path>, "reconstructed_ac": [],
        "assumptions": []}}``. The two empty lists are placeholders the
        ``refine-prompt`` skill writes into on the rebound from ``refine``;
        they are kept to preserve a single-shape envelope across all
        prompt-like resolvers.

    Raises
    ------
    FileResolverError
        If ``path`` is not a string, is empty / whitespace-only, contains a
        NUL byte (filesystem-illegal everywhere), or is a URL (use the
        diff resolver for remote-PR / patch URLs in a future R3 phase).
    """
    if not isinstance(path, str):
        raise FileResolverError(
            f"path must be a string; got {type(path).__name__}",
        )
    stripped = path.strip()
    if len(stripped) < _MIN_PATH_LEN:
        raise FileResolverError(
            "path is empty or whitespace-only — nothing to resolve",
        )
    if "\x00" in stripped:
        raise FileResolverError(
            "path contains a NUL byte; filesystem references must be "
            "NUL-free",
        )
    lowered = stripped.lower()
    if any(lowered.startswith(prefix) for prefix in _FORBIDDEN_PREFIXES):
        raise FileResolverError(
            f"path looks like a URL ({stripped[:32]!r}); the file resolver "
            "only accepts on-disk references — use the diff resolver for "
            "PR or patch URLs",
        )
    # Normalise separators *only* on Windows-style backslashes so
    # ``resources\\views\\foo.blade.php`` round-trips as POSIX. Native
    # POSIX paths are returned untouched so the audit step's identity
    # comparison against directory listings stays trivial.
    normalised = stripped.replace("\\", "/") if os.sep == "/" else stripped
    return Input(
        kind=KIND,
        data={
            "path": normalised,
            "reconstructed_ac": [],
            "assumptions": [],
        },
    )


__all__ = ["KIND", "FileResolverError", "build_envelope"]
