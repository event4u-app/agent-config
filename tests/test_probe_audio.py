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


# --- the honesty corpus sweep ------------------------------------------------
# AI-council closure (2026-06-02, claude-sonnet-4-5 + gpt-4o, peer-review round
# 2, agents/runtime/council/responses/corpus-closure.json): the council's
# original "real-corpus honesty experiment (≥15 varied tracks)" demand is
# satisfied by a ≥15-track SYNTHETIC sweep, BECAUSE the experiment exists only
# to prove the *honesty invariant* — the probe never presents interval cuts as
# musical structure — which is a binary omission property synthetic inputs
# verify directly. A commercial corpus could only surface signal-processing
# accuracy nuances (orthogonal: degrading to interval+warning on a brick-walled
# master is correct behaviour, not a miss). Both members converged: codify the
# sweep as a committed regression guard, THEN close. Honesty is a negative
# capability — without this test it evaporates (it is exactly what the two
# latent BSD-awk / `wc -l` bugs slipped past on a gawk-only CI).

# 16 varied synthetic builders across the four failure modes the three-tier
# degrade (silence -> rms -> interval) must handle. Each value is the list of
# ffmpeg lavfi inputs + the concat/filter that assembles one track.
_CORPUS = {
    # A. silence-gapped (clean quiet gaps)
    "sil_3gap": "sine=f=440:d=4|anull:1|sine=f=330:d=4|anull:1|sine=f=550:d=4",
    "sil_2gap": "sine=f=440:d=6|anull:1.2|sine=f=300:d=6",
    "sil_4gap": "sine=f=200:d=3|anull:0.8|sine=f=400:d=3|anull:0.8|sine=f=600:d=3|anull:0.8|sine=f=800:d=3",
    "sil_long": "sine=f=440:d=10|anull:2|sine=f=220:d=10",
    # B. dynamic energy, no silence (rms path)
    "dyn_3": "sine=f=440:d=5,volume=0.2|sine=f=440:d=5,volume=1.0|sine=f=440:d=5,volume=0.3",
    "dyn_4": "sine=f=330:d=4,volume=0.15|sine=f=330:d=4,volume=0.9|sine=f=330:d=4,volume=0.4|sine=f=330:d=4,volume=1.0",
    "dyn_2": "sine=f=500:d=6,volume=0.1|sine=f=500:d=6,volume=0.8",
    "pink": "anoisesrc=d=18:c=pink:a=0.3",
    # C. flat / brick-walled (interval fallback + warning)
    "flat": "sine=f=440:d=18",
    "flat_long": "sine=f=440:d=30",
    "white": "anoisesrc=d=20:c=white:a=0.8",
    "flat_loud": "sine=f=440:d=12,volume=0.95",
    # D. edge cases
    "tiny": "sine=f=440:d=2",
    "huge": "sine=f=440:d=45",
    "short_gap": "sine=f=440:d=8|anull:0.3|sine=f=440:d=8",
    "mixed": "sine=f=440:d=4,volume=0.5|anull:1|sine=f=440:d=4,volume=1.0|anull:1|sine=f=440:d=4,volume=0.2",
}


def _build_track(spec: str, path: Path) -> None:
    """Assemble one synthetic track from a `|`-joined lavfi spec."""
    parts = spec.split("|")
    args: list[str] = []
    for p in parts:
        if p.startswith("anull:"):
            dur = p.split(":", 1)[1]
            args += ["-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono:d={dur}"]
        else:
            args += ["-f", "lavfi", "-i", p]
    n = len(parts)
    if n > 1:
        chain = "".join(f"[{i}]" for i in range(n))
        args += ["-filter_complex", f"{chain}concat=n={n}:v=0:a=1"]
    _ffmpeg(*args, str(path))


def test_corpus_sweep_honesty_invariant(tmp_path: Path) -> None:
    """interval <=> warning across >=15 varied tracks (council closure 2026-06-02).

    The load-bearing honesty property: the probe sets a ``warning`` if and only
    if it fell back to the ``interval`` method. A ``silence``/``rms`` result must
    never carry a warning (no false "this is musical" claim); an ``interval``
    result must always carry one (no silent over-claim).
    """
    assert len(_CORPUS) >= 15, "council demanded a >=15-track sweep"
    for name, spec in _CORPUS.items():
        track = tmp_path / f"{name}.wav"
        _build_track(spec, track)
        extra = ("--interval", "6") if name in {"flat", "flat_loud", "tiny"} else ()
        data = _probe(track, *extra)
        assert data["method"] in {"silence", "rms", "interval"}, name
        assert data["sections"], f"{name}: expected >=1 section"
        has_warning = bool(data.get("warning"))
        if data["method"] == "interval":
            assert has_warning, f"{name}: interval method MUST set a warning"
        else:
            assert not has_warning, f"{name}: {data['method']} must NOT carry a warning"
