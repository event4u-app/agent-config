"""probe-audio.sh — hybrid audio segmentation helper for /video:from-song.

The helper degrades through three methods (silence → rms → interval) and
always reports which one produced the cut anchors, plus a ``warning`` for
the interval fallback (AI-council honesty requirement, 2026-05-30). These
tests generate synthetic tracks with ``ffmpeg`` and assert the emitted
JSON shape + method selection. They SKIP when ffmpeg/ffprobe are absent
(the helper is network-free but ffmpeg-bound); CI runners with ffmpeg
exercise them in full.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
PROBE = REPO_ROOT / "scripts" / "ai-video" / "lib" / "probe-audio.sh"

pytestmark = pytest.mark.skipif(
    shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None,
    reason="probe-audio.sh requires ffmpeg + ffprobe; not available on this host.",
)


def _ffmpeg(*args: str) -> None:
    subprocess.run(  # noqa: S603 — fixed args, no shell
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args],
        check=True,
    )


def _probe(path: Path, *extra: str) -> dict:
    proc = subprocess.run(  # noqa: S603 — fixed args, no shell
        ["bash", str(PROBE), str(path), *extra],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"probe failed ({proc.returncode}): {proc.stderr}"
    return json.loads(proc.stdout)


def _silence_track(path: Path) -> None:
    """tone 4s · silence 1.5s · tone 4s · silence 1.5s · tone 4s."""
    _ffmpeg(
        "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono:d=1.5",
        "-f", "lavfi", "-i", "sine=frequency=330:duration=4",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono:d=1.5",
        "-f", "lavfi", "-i", "sine=frequency=550:duration=4",
        "-filter_complex", "[0][1][2][3][4]concat=n=5:v=0:a=1",
        str(path),
    )


def _flat_track(path: Path) -> None:
    """constant tone, 18s — brick-walled stand-in (no structure)."""
    _ffmpeg("-f", "lavfi", "-i", "sine=frequency=440:duration=18", str(path))


def _assert_common(data: dict, expected_duration: float) -> None:
    assert data["method"] in {"silence", "rms", "interval"}
    assert abs(data["duration"] - expected_duration) < 1.5
    secs = data["sections"]
    assert secs, "expected at least one section"
    # contiguous, ordered, span the whole track
    assert secs[0]["start"] == pytest.approx(0.0, abs=0.01)
    assert secs[-1]["end"] == pytest.approx(data["duration"], abs=0.5)
    for a, b in zip(secs, secs[1:]):
        assert b["start"] == pytest.approx(a["end"], abs=0.01)
    for s in secs:
        assert 0.0 <= s["energy"] <= 1.0
        assert s["label"] in {"intro", "build", "drop", "breakdown", "outro"}


def test_silence_gaps_segment_into_multiple_sections(tmp_path: Path) -> None:
    track = tmp_path / "silence.wav"
    _silence_track(track)
    data = _probe(track)
    _assert_common(data, expected_duration=15.0)
    # real quiet gaps → the silence method, and ≥ 3 sections (3 tones).
    assert data["method"] == "silence"
    assert len(data["sections"]) >= 3


def test_flat_track_falls_back_to_interval_with_warning(tmp_path: Path) -> None:
    track = tmp_path / "flat.wav"
    _flat_track(track)
    data = _probe(track, "--interval", "6")
    _assert_common(data, expected_duration=18.0)
    # no silence, no energy variance → honest interval fallback + warning.
    assert data["method"] == "interval"
    assert "warning" in data and data["warning"]
    assert len(data["sections"]) >= 2


def test_missing_file_exits_two(tmp_path: Path) -> None:
    proc = subprocess.run(  # noqa: S603 — fixed args, no shell
        ["bash", str(PROBE), str(tmp_path / "nope.wav")],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 2
