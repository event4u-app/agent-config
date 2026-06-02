"""Tests for the global-only (no-lockfile) ``doctor`` path.

ADR-020 global-only consumers have a bridge marker
(``agents/.event4u-bridge.yml``) but no ``agents/installed-tools.lock``.
``doctor`` must produce a green-capable report instead of the old hard
bail. Covers the scope split, the no-manifest branch, the consumer-type
header, the ``bridge-drift`` scope-aware verdict, the ``skipped`` JSON
shape, and the exit-code contract.

Roadmap: road-to-doctor-global-only-readiness.md (Phase 1, step 4).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_doctor as d  # noqa: E402


def _bridge(tmp_path: Path) -> None:
    """Write a minimal ADR-020 global-only bridge marker."""
    (tmp_path / "agents").mkdir(parents=True, exist_ok=True)
    (tmp_path / "agents" / ".event4u-bridge.yml").write_text(
        "global_root: ~/.event4u/agent-config\n", encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Scope split (step 1)
# ---------------------------------------------------------------------------


def test_check_id_sets_partition_the_registry() -> None:
    """Every check id is global, manifest-required, or scope-aware bridge-drift."""
    accounted = d.GLOBAL_CHECK_IDS | d.MANIFEST_REQUIRED_CHECK_IDS | {"bridge-drift"}
    assert set(d.CHECK_IDS) == accounted
    # No id is in both scope sets.
    assert not (d.GLOBAL_CHECK_IDS & d.MANIFEST_REQUIRED_CHECK_IDS)
    # Council-endorsed reclassification: `scope` is global, not manifest.
    assert "scope" in d.GLOBAL_CHECK_IDS
    assert "scope" not in d.MANIFEST_REQUIRED_CHECK_IDS
    # bridge-drift is scope-aware: in neither set.
    assert "bridge-drift" not in d.GLOBAL_CHECK_IDS
    assert "bridge-drift" not in d.MANIFEST_REQUIRED_CHECK_IDS


# ---------------------------------------------------------------------------
# bridge-drift scope-aware verdict (no manifest)
# ---------------------------------------------------------------------------


def test_bridge_drift_no_manifest_ok_when_bridge_present() -> None:
    r = d._check_bridge_drift_no_manifest(bridge_present=True)
    assert r["id"] == "bridge-drift"
    assert r["status"] == "ok"
    assert "not applicable" in r["message"]


def test_bridge_drift_no_manifest_skipped_when_uninitialised() -> None:
    r = d._check_bridge_drift_no_manifest(bridge_present=False)
    assert r["status"] == "skipped"
    assert "refresh --project" in r["remedy"]


def test_skipped_manifest_check_shape() -> None:
    r = d._skipped_manifest_check("manifest-integrity")
    assert r == {
        "id": "manifest-integrity",
        "status": "skipped",
        "message": "requires a project lockfile (agents/installed-tools.lock)",
        "remedy": "run `agent-config init` to create a project lockfile, "
                  "then re-run this check",
    }


# ---------------------------------------------------------------------------
# Bare doctor — global-only consumer is green-capable (steps 2, 3)
# ---------------------------------------------------------------------------


def test_global_only_bare_doctor_is_green_capable(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _bridge(tmp_path)
    rc = d.main([f"--project={tmp_path}"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "global-only consumer" in out
    # Manifest-required checks are skipped, not failed.
    assert "⏭️" in out
    assert "manifest-integrity" in out
    # bridge-drift reports the scope-aware "not applicable" verdict.
    assert "drift not applicable" in out


def test_global_only_header_does_not_nag_init(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    """A recognised global-only consumer must not be told to run init.

    Per-check `skipped` remedies legitimately mention init (that is how
    you would *enable* those checks); the invariant here is that the
    consumer-type header treats the missing lockfile as expected and the
    init/refresh nag — reserved for the uninitialised case — never fires.
    """
    _bridge(tmp_path)
    d.main([f"--project={tmp_path}"])
    captured = capsys.readouterr()
    # The uninitialised init/refresh note (stderr) must not fire here.
    assert captured.err == ""
    assert "expected under ADR-020" in captured.out


# ---------------------------------------------------------------------------
# --check exit-code contract
# ---------------------------------------------------------------------------


def test_global_only_check_global_binary_real_verdict(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    _bridge(tmp_path)
    monkeypatch.setattr(d.shutil, "which", lambda _: "/usr/local/bin/agent-config")
    monkeypatch.setattr(d.installed_lock, "read_lockfile",
                        lambda *a, **k: {"agent_config_version": "5.8.0"})
    monkeypatch.setattr(d, "_current_package_version", lambda: "5.8.0")
    rc = d.main([f"--project={tmp_path}", "--check", "global-binary"])
    assert rc == 0  # real verdict, exit 0/green — no lockfile needed


def test_global_only_check_bridge_drift_green(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _bridge(tmp_path)
    rc = d.main([f"--project={tmp_path}", "--check", "bridge-drift"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "drift not applicable" in out


def test_manifest_required_check_skipped_returns_2(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _bridge(tmp_path)
    rc = d.main([f"--project={tmp_path}", "--check", "manifest-integrity"])
    assert rc == 2  # the requested check genuinely cannot run
    out = capsys.readouterr().out
    assert "requires a project lockfile" in out


# ---------------------------------------------------------------------------
# Uninitialised repo (neither bridge nor lockfile) — preserves the
# "run init" signal as exit 2 + stderr note, but still prints a report.
# ---------------------------------------------------------------------------


def test_uninitialised_bare_doctor_returns_2_with_note(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    rc = d.main([f"--project={tmp_path}"])
    assert rc == 2
    captured = capsys.readouterr()
    assert "no project lockfile" in captured.err
    # A real report still prints to stdout (no hard bail before checks).
    assert "scope" in captured.out


# ---------------------------------------------------------------------------
# JSON shape stability — skipped checks are explicit entries
# ---------------------------------------------------------------------------


def test_global_only_json_keeps_stable_checks_array(
    tmp_path: Path, capsys: pytest.CaptureFixture,
) -> None:
    _bridge(tmp_path)
    rc = d.main([f"--project={tmp_path}", "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert len(payload["checks"]) == len(d.CHECK_IDS)
    skipped = {c["id"] for c in payload["checks"] if c["status"] == "skipped"}
    assert skipped == set(d.MANIFEST_REQUIRED_CHECK_IDS)
    # Every entry carries the full structured shape.
    for c in payload["checks"]:
        assert {"id", "status", "message", "remedy"} <= set(c)
