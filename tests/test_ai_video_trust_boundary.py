"""Trust-boundary tests for the AI-video adapter common lib (contract v2).

Provider-returned artifact paths and downloads are untrusted input. The
helpers in ``scripts/media/lib/adapter-common.sh`` are the enforcement
surface the live ``submit/poll/fetch`` path MUST route through. These tests
lock the load-bearing rejections so a future live adapter cannot regress the
boundary:

1. ``aiv_validate_artifact_path`` accepts an in-root file and echoes its
   canonical path.
2. It rejects a parent-traversal that escapes the scope root.
3. It rejects an absolute path outside the root.
4. It rejects injection / control characters (concat-list / log-injection).
5. It rejects a symlink artifact (provider-controlled target).
6. ``aiv_max_artifact_bytes`` honours the default and the env override.
7. ``aiv_scene_dir`` creates the scene-scoped dir and rejects a bad id.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
COMMON_LIB = REPO_ROOT / "src" / "scripts" / "media" / "lib" / "adapter-common.sh"

pytestmark = pytest.mark.skipif(
    shutil.which("bash") is None,
    reason="trust-boundary helpers require bash; not available on this host.",
)


def _call(func: str, *args: str) -> subprocess.CompletedProcess[str]:
    """Source the common lib and invoke one helper function with args."""
    script = f'. "{COMMON_LIB}"; {func} "$@"'
    return subprocess.run(  # noqa: S603 — fixed args, no shell string interpolation of args.
        ["bash", "-c", script, "_", *args],
        capture_output=True,
        text=True,
        timeout=15,
        env={"PATH": "/usr/bin:/bin"},
        check=False,
    )


def _call_env(func: str, env: dict[str, str], *args: str) -> subprocess.CompletedProcess[str]:
    script = f'. "{COMMON_LIB}"; {func} "$@"'
    return subprocess.run(  # noqa: S603
        ["bash", "-c", script, "_", *args],
        capture_output=True,
        text=True,
        timeout=15,
        env={"PATH": "/usr/bin:/bin", **env},
        check=False,
    )


# --- aiv_validate_artifact_path --------------------------------------------


def test_validate_accepts_in_root_file(tmp_path: Path) -> None:
    artifact = tmp_path / "scenes" / "0001" / "scene.mp4"
    artifact.parent.mkdir(parents=True)
    artifact.write_bytes(b"x")
    result = _call("aiv_validate_artifact_path", str(tmp_path), str(artifact))
    assert result.returncode == 0, result.stderr
    # Echoes a canonical path that still ends at the artifact basename.
    assert result.stdout.strip().endswith("/scenes/0001/scene.mp4")


def test_validate_rejects_parent_traversal(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    escape = root / ".." / "escape.mp4"
    result = _call("aiv_validate_artifact_path", str(root), str(escape))
    assert result.returncode == 10, (result.returncode, result.stderr)
    assert "escapes scope root" in result.stderr


def test_validate_rejects_absolute_outside_root(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    result = _call("aiv_validate_artifact_path", str(root), "/etc/passwd")
    assert result.returncode == 10, (result.returncode, result.stderr)
    assert "escapes scope root" in result.stderr


@pytest.mark.parametrize("evil", ["scene'.mp4", "scene`x`.mp4", "scene$(x).mp4"])
def test_validate_rejects_injection_chars(tmp_path: Path, evil: str) -> None:
    result = _call("aiv_validate_artifact_path", str(tmp_path), str(tmp_path / evil))
    assert result.returncode == 10, (result.returncode, result.stderr)
    assert "injection guard" in result.stderr


def test_validate_rejects_symlink_artifact(tmp_path: Path) -> None:
    outside = tmp_path / "outside.mp4"
    outside.write_bytes(b"x")
    root = tmp_path / "project"
    root.mkdir()
    link = root / "scene.mp4"
    link.symlink_to(outside)
    result = _call("aiv_validate_artifact_path", str(root), str(link))
    assert result.returncode == 10, (result.returncode, result.stderr)
    assert "symlink" in result.stderr


# --- aiv_max_artifact_bytes -------------------------------------------------


def test_max_artifact_bytes_default() -> None:
    result = _call("aiv_max_artifact_bytes")
    assert result.returncode == 0
    assert result.stdout.strip() == "536870912"  # 512 MiB


def test_max_artifact_bytes_override() -> None:
    result = _call_env("aiv_max_artifact_bytes", {"AIV_MAX_ARTIFACT_BYTES": "1024"})
    assert result.returncode == 0
    assert result.stdout.strip() == "1024"


# --- aiv_scene_dir ----------------------------------------------------------


def test_scene_dir_creates_scoped_dir(tmp_path: Path) -> None:
    result = _call("aiv_scene_dir", str(tmp_path), "0001")
    assert result.returncode == 0, result.stderr
    created = Path(result.stdout.strip())
    assert created.is_dir()
    assert created == tmp_path / "scenes" / "0001"


@pytest.mark.parametrize("bad", ["../evil", "a/b", "."])
def test_scene_dir_rejects_bad_scene_id(tmp_path: Path, bad: str) -> None:
    result = _call("aiv_scene_dir", str(tmp_path), bad)
    assert result.returncode == 10, (result.returncode, result.stderr)
    assert "illegal scene id" in result.stderr
