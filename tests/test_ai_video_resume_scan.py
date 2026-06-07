"""ADR-059 — resume-from-last-green-artifact scan tests.

``scripts/ai-video/lib/resume-scan.sh`` derives the resume plan from the
per-scene sentinel files (filesystem-as-state — ADR-059 §1). These tests
pin the load-bearing properties:

1. ``hash`` canonicalization is deterministic and ignores the
   ``input_sha256`` field itself (one source of truth for stamping AND
   verification).
2. ``scan`` classifies green / stale / failed / missing correctly,
   including the tamper case (stored hash != recomputed hash) and the
   plan-mismatch case (input changed between runs).
3. A scene without a stamped ``input_sha256`` is never reused
   ("never reuse unverifiable state").
4. ``spent_usd`` sums the per-scene ``cost.json`` records.
5. ``clean`` removes failed-scene residue only — green artifacts stay.
6. Illegal scene-dir names are skipped, never followed (trust boundary).
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "src" / "scripts" / "ai-video" / "lib" / "resume-scan.sh"

pytestmark = pytest.mark.skipif(
    shutil.which("bash") is None or shutil.which("jq") is None,
    reason="resume-scan requires bash + jq.",
)


def _run(*argv: str, stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(  # noqa: S603 — fixed args, no shell.
        ["bash", str(SCRIPT), *argv],
        input=stdin,
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )


def _hash(prompt: dict) -> str:
    res = _run("hash", stdin=json.dumps(prompt))
    assert res.returncode == 0, res.stderr
    return res.stdout.strip()


def _mk_scene(
    project: Path,
    scene_id: str,
    *,
    prompt: dict | None = None,
    stamp_hash: bool = True,
    clip: bool = True,
    error: dict | None = None,
    cost: float | None = None,
) -> str:
    scene = project / "scenes" / scene_id
    scene.mkdir(parents=True)
    stored = ""
    if prompt is not None:
        if stamp_hash:
            stored = _hash(prompt)
            prompt = {**prompt, "input_sha256": stored}
        (scene / "prompt.json").write_text(json.dumps(prompt))
    if clip:
        (scene / "final.mp4").write_bytes(b"\x00")
    if error is not None:
        (scene / "error.json").write_text(json.dumps(error))
    if cost is not None:
        (scene / "cost.json").write_text(
            json.dumps({"charged_usd": cost, "adapter": "fal", "model": "m"})
        )
    return stored


def _scan(project: Path, plan: list[dict] | None = None) -> dict:
    argv = ["scan", str(project)]
    if plan is not None:
        plan_path = project / "plan.json"
        plan_path.write_text(json.dumps(plan))
        argv += ["--plan", str(plan_path)]
    res = _run(*argv)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


# ---------------------------------------------------------------------------
# hash subcommand
# ---------------------------------------------------------------------------

def test_hash_is_deterministic_and_ignores_stamp_field() -> None:
    prompt = {"prompt": {"style": "noir"}, "provider": "fal", "model": "m1"}
    h1 = _hash(prompt)
    h2 = _hash({**prompt, "input_sha256": "deadbeef"})
    h3 = _hash(dict(reversed(list(prompt.items()))))  # key order irrelevant
    assert h1 == h2 == h3
    assert len(h1) == 64


def test_hash_changes_when_input_changes() -> None:
    base = {"prompt": {"style": "noir"}, "provider": "fal", "model": "m1"}
    assert _hash(base) != _hash({**base, "model": "m2"})


# ---------------------------------------------------------------------------
# scan classification
# ---------------------------------------------------------------------------

def test_scan_classifies_green_failed_stale_missing(tmp_path: Path) -> None:
    project = tmp_path / "p"
    prompt = {"prompt": {"style": "x"}, "provider": "fal", "model": "m1"}
    stored = _mk_scene(project, "0001", prompt=prompt, cost=1.25)
    _mk_scene(
        project,
        "0002",
        error={"adapter": "fal", "exit_code": 8, "user_action": "retry"},
        clip=False,
    )
    # Tampered: stamped hash does not match content.
    scene3 = project / "scenes" / "0003"
    scene3.mkdir(parents=True)
    (scene3 / "prompt.json").write_text(
        json.dumps({"prompt": {"style": "y"}, "input_sha256": "0" * 64})
    )
    (scene3 / "final.mp4").write_bytes(b"\x00")

    plan = [
        {"scene_id": "0001", "input_sha256": stored},
        {"scene_id": "0004", "input_sha256": "a" * 64},
    ]
    out = _scan(project, plan)
    states = {s["scene_id"]: s["state"] for s in out["scenes"]}
    assert states == {
        "0001": "green",
        "0002": "failed",
        "0003": "stale",
        "0004": "missing",
    }
    assert (out["green"], out["stale"], out["failed"], out["missing"]) == (1, 1, 1, 1)
    assert out["spent_usd"] == pytest.approx(1.25)


def test_scene_with_plan_hash_mismatch_is_stale(tmp_path: Path) -> None:
    """Input changed between runs (provider/model/prompt switch) → re-render."""
    project = tmp_path / "p"
    _mk_scene(project, "0001", prompt={"prompt": {"style": "x"}, "model": "m1"})
    out = _scan(project, [{"scene_id": "0001", "input_sha256": "f" * 64}])
    (scene,) = out["scenes"]
    assert scene["state"] == "stale"
    assert "plan" in scene["reason"]


def test_unstamped_scene_is_never_reused(tmp_path: Path) -> None:
    """ADR-059: no input_sha256 → re-render (never trust unverifiable state)."""
    project = tmp_path / "p"
    _mk_scene(project, "0001", prompt={"prompt": {"style": "x"}}, stamp_hash=False)
    out = _scan(project)
    (scene,) = out["scenes"]
    assert scene["state"] == "stale"
    assert "input_sha256" in scene["reason"]


def test_scene_without_artifact_is_missing(tmp_path: Path) -> None:
    project = tmp_path / "p"
    _mk_scene(project, "0001", prompt={"prompt": {"style": "x"}}, clip=False)
    out = _scan(project)
    assert out["scenes"][0]["state"] == "missing"


def test_illegal_scene_dir_name_is_skipped(tmp_path: Path) -> None:
    project = tmp_path / "p"
    bad = project / "scenes" / "evil'name"
    bad.mkdir(parents=True)
    (bad / "final.mp4").write_bytes(b"\x00")
    out = _scan(project)
    assert out["scenes"] == []


# ---------------------------------------------------------------------------
# clean subcommand
# ---------------------------------------------------------------------------

def test_clean_removes_failed_residue_keeps_green(tmp_path: Path) -> None:
    project = tmp_path / "p"
    _mk_scene(project, "0001", prompt={"prompt": {"style": "x"}})
    _mk_scene(
        project,
        "0002",
        error={"adapter": "fal", "exit_code": 8, "user_action": "retry"},
        clip=False,
    )
    (project / "scenes" / "0002" / "dl.tmp.mp4").write_bytes(b"\x00")

    res = _run("clean", str(project))
    assert res.returncode == 0, res.stderr
    assert json.loads(res.stdout) == {"cleaned_failed_scenes": 1}
    assert not (project / "scenes" / "0002" / "error.json").exists()
    assert not (project / "scenes" / "0002" / "dl.tmp.mp4").exists()
    assert (project / "scenes" / "0001" / "final.mp4").exists()


# ---------------------------------------------------------------------------
# usage / fail-closed dispatch
# ---------------------------------------------------------------------------

def test_unknown_subcommand_exits_2() -> None:
    res = _run("bogus")
    assert res.returncode == 2
    assert "unknown subcommand" in res.stderr
