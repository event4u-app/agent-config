"""Concurrency-safe state writes for hook concerns.

Per `docs/contracts/hook-architecture-v1.md` § Concurrency, every concern
that writes under `agents/state/` MUST:

1. Acquire `fcntl.flock(LOCK_EX)` on `agents/state/.dispatcher.lock`.
2. Write to a sibling `<dest>.tmp.<pid>` file in the same directory.
3. `os.replace(tmp, dest)` — POSIX-atomic on the same filesystem.
4. Release the lock.

The single shared lock is intentional: serialising state writes across
concerns is cheaper than per-file locks, and concerns already run
sequentially within one dispatcher invocation. Concurrent dispatcher
invocations (e.g. two platforms firing into the same workspace) are the
case this lock guards.

Cross-platform notes
--------------------
- `fcntl` is POSIX-only. On Windows the contract degrades gracefully:
  the lock acquire is a no-op, atomic replace via `os.replace` still
  holds, and torn-write risk is accepted (Windows is not a primary
  agent-config platform — Cline tracks the upstream Windows-path issue
  separately).
- The lock file lives under `agents/state/` which is gitignored.
- The lock is process-scoped, not session-scoped: each call opens,
  locks, writes, releases, closes. No long-lived file handles.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

try:
    import fcntl  # type: ignore[import-not-found]
    _HAS_FCNTL = True
except ImportError:  # pragma: no cover — Windows
    _HAS_FCNTL = False

LOCK_BASENAME = ".dispatcher.lock"


def _lock_path(state_dir: Path) -> Path:
    return state_dir / LOCK_BASENAME


def atomic_write_json(target: Path, payload: Any, *, indent: int = 2) -> None:
    """Write `payload` as JSON to `target` atomically and concurrency-safely.

    `target` MUST sit under an `agents/state/` directory (or any other
    directory the caller treats as the lock scope). The lock file is
    `<target.parent>/.dispatcher.lock`. Caller does not need to create
    the directory in advance — this function ensures it.
    """
    target = Path(target)
    state_dir = target.parent
    state_dir.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, indent=indent) + "\n"
    _atomic_write_text(target, body)


def atomic_write_text(target: Path, text: str) -> None:
    """Write text to `target` atomically and concurrency-safely. Same
    locking discipline as `atomic_write_json` — useful for non-JSON
    state payloads (chat-history transcript, status text)."""
    target = Path(target)
    state_dir = target.parent
    state_dir.mkdir(parents=True, exist_ok=True)
    _atomic_write_text(target, text)


def _atomic_write_text(target: Path, text: str) -> None:
    tmp = target.with_suffix(target.suffix + f".tmp.{os.getpid()}")
    lock_path = _lock_path(target.parent)
    # `os.O_CREAT | os.O_RDWR` — we don't truncate the lock file, just
    # need an fd to flock. Mode 0o644 is fine; the file holds no data.
    if _HAS_FCNTL:
        fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR, 0o644)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            try:
                tmp.write_text(text, encoding="utf-8")
                os.replace(str(tmp), str(target))
            finally:
                fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)
    else:  # pragma: no cover — Windows fallback, no flock
        tmp.write_text(text, encoding="utf-8")
        os.replace(str(tmp), str(target))


FEEDBACK_DIRNAME = ".dispatcher"


def feedback_dir(state_root: Path, session_id: str) -> Path:
    """Return the per-session feedback directory under state_root.

    Layout:
        <state_root>/.dispatcher/<session_id>/
            <concern>.json     — one per concern that ran
            summary.json       — rollup written by the dispatcher

    Per Council Round 2 (2026-05-04): exit-code reduction collapses
    multiple concern signals into a single platform-native code; the
    feedback dir surfaces the per-concern detail to humans and
    `task hooks-status` without re-routing control flow.
    """
    safe_session = session_id or "unknown-session"
    # Defence-in-depth: refuse path traversal in session_id.
    safe_session = safe_session.replace("/", "_").replace("\\", "_").replace("..", "_")
    return Path(state_root) / FEEDBACK_DIRNAME / safe_session


__all__ = [
    "atomic_write_json",
    "atomic_write_text",
    "feedback_dir",
    "LOCK_BASENAME",
    "FEEDBACK_DIRNAME",
]
