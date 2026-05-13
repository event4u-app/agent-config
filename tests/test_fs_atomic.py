"""Tests for ``scripts/_lib/fs_atomic.py``.

P1.0 of road-to-multi-package-coexistence. Covers the shared
atomic-write primitive used by every v2 lockfile writer:

- str payload round-trips with default UTF-8 encoding.
- bytes payload round-trips verbatim, encoding ignored.
- Missing parent directory is created.
- Existing target file is overwritten cleanly (no temp leftovers).
- Crash mid-write (raise inside the writer) leaves the original
  target untouched and the ``.tmp.*`` sibling cleaned up.
- Invalid payload type raises ``TypeError`` before any disk write.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._lib.fs_atomic import write_atomic  # noqa: E402


def test_write_str_round_trip(tmp_path: Path) -> None:
    target = tmp_path / "out.txt"
    write_atomic(target, "hello\nworld\n")
    assert target.read_text(encoding="utf-8") == "hello\nworld\n"


def test_write_bytes_round_trip(tmp_path: Path) -> None:
    target = tmp_path / "out.bin"
    payload = b"\x00\x01\x02\xff\xfe"
    write_atomic(target, payload)
    assert target.read_bytes() == payload


def test_creates_missing_parent_dirs(tmp_path: Path) -> None:
    target = tmp_path / "a" / "b" / "c" / "deep.txt"
    write_atomic(target, "deep")
    assert target.read_text(encoding="utf-8") == "deep"


def test_overwrite_leaves_no_temp_siblings(tmp_path: Path) -> None:
    target = tmp_path / "lock.yml"
    write_atomic(target, "v1")
    write_atomic(target, "v2")
    assert target.read_text(encoding="utf-8") == "v2"
    siblings = [p.name for p in tmp_path.iterdir()]
    assert siblings == ["lock.yml"], f"unexpected leftovers: {siblings}"


def test_crash_midwrite_preserves_original(tmp_path: Path) -> None:
    """Simulate a crash between fdopen-write and os.replace.

    The original target must remain byte-identical and no ``.tmp.*``
    siblings may linger. We patch ``os.replace`` to raise; the writer
    is expected to unlink the temp file and re-raise.
    """
    target = tmp_path / "lock.yml"
    write_atomic(target, "original")
    original_bytes = target.read_bytes()

    with patch("scripts._lib.fs_atomic.os.replace", side_effect=OSError("boom")):
        with pytest.raises(OSError, match="boom"):
            write_atomic(target, "would-corrupt")

    assert target.read_bytes() == original_bytes
    siblings = sorted(p.name for p in tmp_path.iterdir())
    assert siblings == ["lock.yml"], f"orphan temp file: {siblings}"


def test_crash_midwrite_no_target_yet(tmp_path: Path) -> None:
    """Crash on first write — target must not appear at all."""
    target = tmp_path / "fresh.yml"
    with patch("scripts._lib.fs_atomic.os.replace", side_effect=OSError("boom")):
        with pytest.raises(OSError, match="boom"):
            write_atomic(target, "anything")
    assert not target.exists()
    siblings = sorted(p.name for p in tmp_path.iterdir())
    assert siblings == [], f"orphan temp file: {siblings}"


def test_invalid_payload_type_raises(tmp_path: Path) -> None:
    target = tmp_path / "out.txt"
    with pytest.raises(TypeError, match="str or bytes"):
        write_atomic(target, 42)  # type: ignore[arg-type]
    assert not target.exists()


def test_custom_encoding(tmp_path: Path) -> None:
    target = tmp_path / "out.txt"
    write_atomic(target, "héllo", encoding="latin-1")
    assert target.read_bytes() == "héllo".encode("latin-1")


def test_returns_path_object(tmp_path: Path) -> None:
    target = tmp_path / "out.txt"
    result = write_atomic(str(target), "x")
    assert isinstance(result, Path)
    assert result == target


def test_parent_dir_fsync_failure_is_silent(tmp_path: Path) -> None:
    """Directory fsync failures must not break the write."""
    target = tmp_path / "out.txt"

    original_fsync = os.fsync
    calls = {"count": 0}

    def flaky_fsync(fd: int) -> None:
        calls["count"] += 1
        # First call is the file fsync — let it succeed.
        # Second call is the parent dir fsync — make it raise.
        if calls["count"] >= 2:
            raise OSError("EINVAL on dir fsync")
        original_fsync(fd)

    with patch("scripts._lib.fs_atomic.os.fsync", side_effect=flaky_fsync):
        write_atomic(target, "ok")

    assert target.read_text(encoding="utf-8") == "ok"
