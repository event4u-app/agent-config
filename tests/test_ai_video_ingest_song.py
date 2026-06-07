"""Song-link ingest — offline safety tests.

``scripts/ai-video/lib/ingest-song.sh`` wraps an operator-installed
``yt-dlp`` (never bundled). CI has no network and usually no yt-dlp, so
these tests pin the OFFLINE properties — the input-validation and
fail-closed surfaces a hostile link would hit first:

1. https-only — http/file/local inputs are refused (exit 7).
2. Injection guard — quotes / command-substitution / control characters
   in the URL are refused before any tool runs.
3. Missing tool — without yt-dlp on PATH the script exits 3 with the
   install hint (config failure, never a silent skip).
4. Overwrite safety — an existing ``song.m4a`` is refused without
   ``--force``.
5. Rights note — the script always surfaces the platform-terms note on
   stderr (documented invariant, greppable).
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "src" / "scripts" / "ai-video" / "lib" / "ingest-song.sh"

pytestmark = pytest.mark.skipif(
    shutil.which("bash") is None,
    reason="ingest-song requires bash.",
)


def _run(*argv: str, path: str = "/usr/bin:/bin"):
    return subprocess.run(  # noqa: S603 — fixed args, no shell.
        ["bash", str(SCRIPT), *argv],
        capture_output=True,
        text=True,
        timeout=15,
        env={"PATH": path},
        check=False,
    )


def test_usage_without_args_exits_2() -> None:
    assert _run().returncode == 2


@pytest.mark.parametrize(
    "url",
    [
        "http://example.test/song",
        "file:///etc/passwd",
        "/local/path/song.mp3",
    ],
)
def test_non_https_inputs_refused(url: str, tmp_path: Path) -> None:
    res = _run(url, str(tmp_path))
    assert res.returncode == 7, res.stderr
    assert "https" in res.stderr


@pytest.mark.parametrize(
    "url",
    [
        "https://x.test/$(id)",
        "https://x.test/a'b",
        'https://x.test/a"b',
        "https://x.test/a b",
    ],
)
def test_injection_shaped_urls_refused(url: str, tmp_path: Path) -> None:
    res = _run(url, str(tmp_path))
    assert res.returncode == 7, res.stderr
    assert "illegal character" in res.stderr


def test_missing_yt_dlp_exits_3_with_hint(tmp_path: Path) -> None:
    if shutil.which("yt-dlp", path="/usr/bin:/bin"):
        pytest.skip("yt-dlp present on the restricted PATH")
    res = _run("https://example.test/song", str(tmp_path))
    assert res.returncode == 3, res.stderr
    assert "yt-dlp" in res.stderr


def test_existing_output_refused_without_force(tmp_path: Path) -> None:
    (tmp_path / "song.m4a").write_bytes(b"\x00")
    res = _run("https://example.test/song", str(tmp_path))
    assert res.returncode == 7, res.stderr
    assert "--force" in res.stderr


def test_rights_note_is_a_documented_invariant() -> None:
    source = SCRIPT.read_text(encoding="utf-8")
    assert "rights note" in source
    assert "media-governance" in source
