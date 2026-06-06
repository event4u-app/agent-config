"""Boundary detection + concurrent-safe recording (Phase 2).

Two responsibilities, one module:

1. ``BoundarySession`` — in-process coalescing. Multiple ``add_*`` calls
   within one task / phase-step / tool-call boundary merge into a
   single emitted event (set-union on ``consulted`` / ``applied``).
   Idempotent: calling ``flush()`` twice without new additions is a
   no-op; calling ``add_consulted("skills", ["x"])`` twice records
   ``"x"`` once.

2. ``record_event`` — cross-process durability. Uses ``fcntl.flock``
   (POSIX) so concurrent writers from separate ``./agent-config
   telemetry:record`` invocations cannot interleave inside one JSONL
   line. On non-POSIX (no ``fcntl``) we fall back to a best-effort
   append; the package only ships on POSIX-compatible CI today.

The CLI in ``cli.py`` is the only caller that should touch the log
path directly. Agent-side flows wire through ``BoundarySession``.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Iterator

try:  # POSIX advisory file locking
    import fcntl  # type: ignore[import-not-found]
    _HAS_FCNTL = True
except ImportError:  # pragma: no cover — Windows / sandbox
    _HAS_FCNTL = False

from .engagement import (
    ALLOWED_BOUNDARY_KINDS,
    ALLOWED_KINDS,
    EngagementEvent,
    EngagementSchemaError,
    now_utc_iso,
)


@dataclass
class BoundarySession:
    """Collect artefact engagements for one boundary, flush once.

    Use as a context manager — ``__exit__`` flushes on clean exit and
    suppresses on exception (so failed tasks don't pollute the log).
    """

    task_id: str
    boundary_kind: str
    log_path: Path
    consulted: dict[str, set[str]] = field(default_factory=dict)
    applied: dict[str, set[str]] = field(default_factory=dict)
    _flushed: bool = False
    _has_data: bool = False

    def __post_init__(self) -> None:
        if self.boundary_kind not in ALLOWED_BOUNDARY_KINDS:
            raise EngagementSchemaError(
                f"boundary_kind must be one of {ALLOWED_BOUNDARY_KINDS!r}"
            )
        if not isinstance(self.task_id, str) or not self.task_id:
            raise EngagementSchemaError("task_id must be a non-empty string")

    def add_consulted(self, kind: str, ids: Iterable[str]) -> None:
        self._merge(self.consulted, kind, ids)

    def add_applied(self, kind: str, ids: Iterable[str]) -> None:
        self._merge(self.applied, kind, ids)

    def _merge(self, bucket: dict[str, set[str]], kind: str, ids: Iterable[str]) -> None:
        if kind not in ALLOWED_KINDS:
            raise EngagementSchemaError(
                f"{kind!r} is not an allowed artefact kind "
                f"(allowed: {ALLOWED_KINDS!r})"
            )
        target = bucket.setdefault(kind, set())
        for art_id in ids:
            if not isinstance(art_id, str) or not art_id:
                raise EngagementSchemaError(
                    f"{kind} ids must be non-empty strings"
                )
            target.add(art_id)
            self._has_data = True

    def to_event(self) -> EngagementEvent:
        return EngagementEvent(
            ts=now_utc_iso(),
            task_id=self.task_id,
            boundary_kind=self.boundary_kind,
            consulted={k: sorted(v) for k, v in self.consulted.items() if v},
            applied={k: sorted(v) for k, v in self.applied.items() if v},
        )

    def flush(self) -> bool:
        """Write one merged event to the log. Returns True if written.

        No-op when already flushed or no data was added — keeps the
        boundary idempotent.
        """
        if self._flushed or not self._has_data:
            return False
        record_event(self.log_path, self.to_event())
        self._flushed = True
        return True

    def __enter__(self) -> "BoundarySession":
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        if exc_type is None:
            self.flush()
        # On exception: do nothing — failed boundary, no record.


def record_event(log_path: Path, event: EngagementEvent) -> None:
    """Append one event under an exclusive file lock.

    The lock guarantees that two concurrent writers append two
    complete, well-formed lines instead of one interleaved line. We
    open with ``"a"`` so each write atomically extends EOF on POSIX
    once the lock is held.
    """
    event.validate()
    payload = event.to_jsonl().encode("utf-8")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    try:
        if _HAS_FCNTL:
            fcntl.flock(fd, fcntl.LOCK_EX)
        try:
            written = 0
            while written < len(payload):
                written += os.write(fd, payload[written:])
            os.fsync(fd)
        finally:
            if _HAS_FCNTL:
                fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)


@contextmanager
def open_boundary(
    task_id: str,
    boundary_kind: str,
    log_path: Path,
) -> Iterator[BoundarySession]:
    """Convenience context manager around ``BoundarySession``.

    >>> with open_boundary("ticket-1", "task", Path(".agent-engagement.jsonl")) as s:
    ...     s.add_consulted("skills", ["php-coder"])
    ...     s.add_applied("skills", ["php-coder"])
    """
    session = BoundarySession(
        task_id=task_id,
        boundary_kind=boundary_kind,
        log_path=log_path,
    )
    with session:
        yield session


__all__ = [
    "BoundarySession",
    "open_boundary",
    "record_event",
]
