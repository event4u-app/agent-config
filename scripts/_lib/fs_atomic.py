"""Atomic file-write primitive shared by lockfile-schema-v2 writers.

P1.0 of road-to-multi-package-coexistence. Single source of truth for
crash-safe writes used by ``installed_tools.write_manifest``,
P1.5 merge tracking, P2.2 uninstall, and P3.x conflict-resolution
paths. Centralising the mechanism prevents per-phase implementation
drift (Council amendment, Anthropic 2026-05-12).

Guarantees, in order:

1. Write to ``<path>.tmp.<pid>.<rand>`` in the same directory as the
   target. Same-directory keeps the final ``os.replace`` atomic on
   every POSIX filesystem we support; cross-fs renames are not atomic.
2. ``fsync(tmp_fd)`` flushes the file's data + metadata to disk before
   we let the temp file become the visible target.
3. ``os.replace(tmp, path)`` is the atomic rename. Either the old or
   the new content is visible to readers; never a half-written mix.
4. ``fsync(parent_dir_fd)`` durably commits the directory entry so a
   crash immediately after the rename does not resurrect the old file
   on next boot. Skipped on platforms where directory fsync is
   unsupported (Windows) — the rename is still atomic from the
   filesystem's perspective, only durability across power loss is
   weaker there.

The temp file is always cleaned up on failure, so a raise mid-write
never leaves orphaned ``.tmp.*`` siblings behind.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Union

__all__ = ["write_atomic"]


def write_atomic(
    path: Union[str, Path],
    data: Union[str, bytes],
    *,
    encoding: str = "utf-8",
) -> Path:
    """Atomically write ``data`` to ``path``; return the resolved path.

    ``data`` may be ``str`` (encoded via ``encoding``) or ``bytes``
    (written verbatim, ``encoding`` ignored). The parent directory is
    created if missing — callers don't have to ``mkdir`` beforehand.

    On failure (any exception raised by the OS during write / fsync /
    rename), the temporary file is unlinked and the original target —
    if any — is untouched. The exception propagates so callers can
    distinguish disk-full from permission errors etc.
    """
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)

    if isinstance(data, str):
        payload = data.encode(encoding)
    elif isinstance(data, (bytes, bytearray)):
        payload = bytes(data)
    else:
        raise TypeError(
            f"write_atomic: data must be str or bytes, got {type(data).__name__}"
        )

    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{target.name}.tmp.",
        dir=str(target.parent),
    )
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(payload)
            fh.flush()
            try:
                os.fsync(fh.fileno())
            except OSError:
                # File-level fsync unsupported (e.g. some tmpfs).
                # Continue — os.replace is still atomic.
                pass
        os.replace(tmp_path, target)
    except Exception:
        try:
            tmp_path.unlink()
        except OSError:
            pass
        raise

    _fsync_dir(target.parent)
    return target


def _fsync_dir(directory: Path) -> None:
    """Best-effort directory fsync; silent no-op on unsupported platforms.

    Directory fsync is required on POSIX for the rename's durability
    across power loss. Windows does not expose ``open(dir)`` /
    ``fsync(dir_fd)`` semantics — the kernel commits the directory
    entry implicitly. We swallow the OSError there rather than fail
    the write.
    """
    try:
        dir_fd = os.open(str(directory), os.O_RDONLY)
    except OSError:
        return
    try:
        try:
            os.fsync(dir_fd)
        except OSError:
            # Some filesystems / mounts reject directory fsync.
            # The rename is still atomic — durability is weaker but
            # the write is not corrupted.
            pass
    finally:
        os.close(dir_fd)
