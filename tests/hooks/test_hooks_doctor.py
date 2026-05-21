"""Tests for `scripts/hooks_doctor.py` — wraps `hooks_status` with
concern, trampoline, and feedback diagnostics (Phase 2.3 of
road-to-proof-not-features.md).

Verifies:
  * `collect()` carries every concern declared in the manifest with its
    `fail_closed` posture and script-present check.
  * Trampoline detection flags platforms with bindings but no
    `<platform>-dispatcher.sh` on disk.
  * `last_feedback` resolves to the most-recent dispatcher feedback file
    under `agents/runtime/state/.dispatcher/<session>/<concern>.json`.
  * `--strict` returns non-zero when bridges, trampolines, or concern
    scripts are missing.
  * JSON output is well-formed and round-trips through `json.loads`.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "scripts" / "hooks"))

import dispatch_hook  # noqa: E402
import hooks_doctor  # noqa: E402


@pytest.fixture
def manifest() -> dict:
    return dispatch_hook._load_yaml(dispatch_hook.MANIFEST_PATH)


def test_collect_returns_every_concern(tmp_path: Path, manifest: dict) -> None:
    payload = hooks_doctor.collect(tmp_path, manifest)
    assert payload["schema_version"] == 1
    names = {c["concern"] for c in payload["concerns"]}
    assert names == set((manifest.get("concerns") or {}).keys())
    # Every concern has a fail_closed flag and a script path.
    for c in payload["concerns"]:
        assert isinstance(c["fail_closed"], bool)
        assert c["script"], c


def test_trampoline_detected_when_dispatcher_present(
    tmp_path: Path, manifest: dict
) -> None:
    payload = hooks_doctor.collect(tmp_path, manifest)
    trampolines = {t["platform"]: t for t in payload["trampolines"]}
    # Real package ships these dispatchers — they must register as present.
    for platform in ("augment", "cursor", "cline", "windsurf", "gemini", "cowork"):
        t = trampolines[platform]
        assert t["present"] is True, t
        assert t["missing"] is False, t
    # Copilot has fallback_only → no bindings → trampoline not required.
    assert trampolines["copilot"]["required"] is False
    assert trampolines["copilot"]["missing"] is False


def test_missing_trampoline_flagged(tmp_path: Path, manifest: dict, monkeypatch) -> None:
    fake_dir = tmp_path / "trampolines-empty"
    fake_dir.mkdir()
    monkeypatch.setattr(hooks_doctor, "TRAMPOLINE_DIR", fake_dir)
    payload = hooks_doctor.collect(tmp_path, manifest)
    trampolines = {t["platform"]: t for t in payload["trampolines"]}
    # Every platform with manifest bindings now reports missing.
    for platform in ("augment", "cursor", "cline", "windsurf", "gemini"):
        assert trampolines[platform]["missing"] is True
    # Copilot still not required → not missing.
    assert trampolines["copilot"]["missing"] is False


def test_last_feedback_picks_latest(tmp_path: Path, manifest: dict) -> None:
    state_dir = tmp_path / "agents" / "runtime" / "state" / ".dispatcher"
    older = state_dir / "session-a"
    newer = state_dir / "session-b"
    older.mkdir(parents=True)
    newer.mkdir(parents=True)
    (older / "chat-history.json").write_text("{}", encoding="utf-8")
    (newer / "chat-history.json").write_text("{}", encoding="utf-8")
    # Stamp older then newer so mtime ordering is deterministic.
    past = time.time() - 60
    os.utime(older / "chat-history.json", (past, past))
    payload = hooks_doctor.collect(tmp_path, manifest)
    chat = next(c for c in payload["concerns"] if c["concern"] == "chat-history")
    assert chat["last_feedback"] is not None
    assert chat["last_feedback"].endswith("session-b/chat-history.json")


def test_concern_state_file_surfaced(tmp_path: Path, manifest: dict) -> None:
    state_dir = tmp_path / "agents" / "runtime" / "state"
    state_dir.mkdir(parents=True)
    (state_dir / "context-hygiene.json").write_text("{}", encoding="utf-8")
    payload = hooks_doctor.collect(tmp_path, manifest)
    ch = next(c for c in payload["concerns"] if c["concern"] == "context-hygiene")
    assert ch["state_file"] == "agents/runtime/state/context-hygiene.json"


def test_json_format_is_well_formed(tmp_path: Path, manifest: dict, capsys) -> None:
    rc = hooks_doctor.main([
        "--format", "json",
        "--project-root", str(tmp_path),
    ])
    assert rc == 0
    captured = capsys.readouterr().out
    parsed = json.loads(captured)
    assert parsed["schema_version"] == 1
    assert "concerns" in parsed
    assert "trampolines" in parsed
    assert "platforms" in parsed


def test_strict_fails_on_missing_bridges(tmp_path: Path, capsys) -> None:
    rc = hooks_doctor.main([
        "--format", "json",
        "--project-root", str(tmp_path),
        "--strict",
    ])
    # tmp_path has no bridges installed → strict must fail.
    assert rc == 1


def test_strict_zero_when_everything_clean(
    tmp_path: Path, manifest: dict, monkeypatch
) -> None:
    # Build a project root with every required bridge present and every
    # trampoline reachable so the strict gate has nothing to flag.
    for platform, (rel, _hint) in hooks_doctor.hooks_status.PLATFORM_BRIDGES.items():
        if not rel:
            continue
        bridge = tmp_path / rel
        bridge.parent.mkdir(parents=True, exist_ok=True)
        if rel.endswith("/hooks"):
            bridge.mkdir(parents=True, exist_ok=True)
            (bridge / "placeholder").write_text("{}", encoding="utf-8")
        else:
            bridge.write_text("{}", encoding="utf-8")
    payload = hooks_doctor.collect(tmp_path, manifest)
    assert hooks_doctor._final_exit_code(payload, strict=True) == 0
