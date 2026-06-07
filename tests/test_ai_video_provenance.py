"""Transparency-policy enforcement — embed-provenance.sh tests.

``scripts/ai-video/lib/embed-provenance.sh`` turns
``agents/settings/policies/media/transparency.md`` from prose into code.
These tests pin:

1. The always-on sidecar carries the policy's Required fields
   (assertion, provider, model, timestamp, generator) and the optional
   redacted prompt hash.
2. Determinism hook — ``AIV_PROVENANCE_NOW`` overrides the timestamp.
3. Input validation — missing mandatory fields, malformed prompt hash,
   and bad assertions are refused (exit 7); unknown subcommand exits 2.
4. ``extra`` fields merge without clobbering required ones
   (transparency.md § Allowed — additional non-conflicting fields).
5. The script ships no strip/remove path (policy: only ADD provenance).
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "src" / "scripts" / "ai-video" / "lib" / "embed-provenance.sh"

pytestmark = pytest.mark.skipif(
    shutil.which("bash") is None or shutil.which("jq") is None,
    reason="embed-provenance requires bash + jq.",
)

NOW = "2026-06-07T12:00:00Z"


def _run(*argv: str, stdin: str | None = None, env: dict[str, str] | None = None):
    base_env = {
        "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin",
        "AIV_PROVENANCE_NOW": NOW,
    }
    return subprocess.run(  # noqa: S603 — fixed args, no shell.
        ["bash", str(SCRIPT), *argv],
        input=stdin,
        capture_output=True,
        text=True,
        timeout=15,
        env={**base_env, **(env or {})},
        check=False,
    )


def _embed(tmp_path: Path, payload: dict | None = None, suffix: str = ".bin"):
    artifact = tmp_path / f"final{suffix}"
    artifact.write_bytes(b"\x00")
    body = {
        "artifact_path": str(artifact),
        "provider": "gemini-veo",
        "model": "veo-3.0",
        **(payload or {}),
    }
    return artifact, _run("embed", stdin=json.dumps(body))


def test_sidecar_carries_required_policy_fields(tmp_path: Path) -> None:
    artifact, res = _embed(tmp_path, {"prompt_sha256": "ab" * 32})
    assert res.returncode == 0, res.stderr
    out = json.loads(res.stdout)
    sidecar = Path(out["provenance_path"])
    assert sidecar == artifact.with_name(artifact.name + ".provenance.json")
    data = json.loads(sidecar.read_text())
    assert data["assertion"] == "c2pa.ai_generated"
    assert data["provider"] == "gemini-veo"
    assert data["model"] == "veo-3.0"
    assert data["created"] == NOW  # determinism hook honored
    assert data["prompt_sha256"] == "ab" * 32
    assert data["generator"]
    assert out["c2pa"] in {"c2patool", "sidecar-only"}


def test_extra_fields_merge(tmp_path: Path) -> None:
    _, res = _embed(tmp_path, {"extra": {"distribution": "internal-review"}})
    assert res.returncode == 0, res.stderr
    data = json.loads(Path(json.loads(res.stdout)["provenance_path"]).read_text())
    assert data["distribution"] == "internal-review"
    assert data["provider"] == "gemini-veo"  # not clobbered


def test_ai_edited_assertion_accepted(tmp_path: Path) -> None:
    _, res = _embed(tmp_path, {"assertion": "ai_edited"})
    assert res.returncode == 0, res.stderr
    assert json.loads(res.stdout)["assertion"] == "c2pa.ai_edited"


@pytest.mark.parametrize(
    ("payload", "fragment"),
    [
        ({"provider": ""}, "provider required"),
        ({"model": ""}, "model required"),
        ({"assertion": "human_made"}, "assertion must be"),
        ({"prompt_sha256": "nothex"}, "prompt_sha256"),
    ],
)
def test_invalid_inputs_refused(tmp_path: Path, payload: dict, fragment: str) -> None:
    _, res = _embed(tmp_path, payload)
    assert res.returncode == 7, res.stderr
    assert fragment in res.stderr


def test_missing_artifact_refused(tmp_path: Path) -> None:
    res = _run(
        "embed",
        stdin=json.dumps(
            {
                "artifact_path": str(tmp_path / "nope.mp4"),
                "provider": "p",
                "model": "m",
            }
        ),
    )
    assert res.returncode != 0


def test_unknown_subcommand_exits_2() -> None:
    res = _run("strip")
    assert res.returncode == 2


def test_script_ships_no_strip_path() -> None:
    source = SCRIPT.read_text(encoding="utf-8")
    for verb in ("remove-provenance", "strip-provenance"):
        assert verb not in source
    # Dispatch accepts exactly one operating subcommand.
    assert 'embed) shift; _prov_embed "$@" ;;' in source
