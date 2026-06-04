"""Smoke tests for `scripts/mine_session.py` — Phase-1 single-host miner.

Covers the four contract gates from
`agents/roadmaps/road-to-dream-skill-adoption.md` § Phase 1 exit criteria:
opt-in transcript access, ≤ 5 normalised facts per cycle, redaction of
user names, and `--preview` writes nothing.
"""

from __future__ import annotations

import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "tests/fixtures/dream-skill/session.jsonl"
SCRIPT = ROOT / "src/scripts/mine_session.py"


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True, text=True, cwd=ROOT, timeout=20,
    )


def test_opt_in_required_no_transcript_read(tmp_path: Path) -> None:
    """Without --confirm-transcript-access, miner reads zero turns."""
    out_root = tmp_path / "intake"
    result = run([
        "--transcript", str(FIXTURE),
        "--intake-root", str(out_root),
        "--commit-intake",
    ])
    assert result.returncode == 0
    assert "--confirm-transcript-access" in result.stdout
    assert not out_root.exists()


def test_unsupported_host_exits_clean(tmp_path: Path) -> None:
    """Non-claude-code host prints the not-supported hint and exits 0."""
    result = run([
        "--confirm-transcript-access",
        "--host", "cursor",
        "--transcript", str(FIXTURE),
    ])
    assert result.returncode == 0
    assert "No TranscriptAdapter for host=cursor" in result.stdout
    assert "claude-code" in result.stdout


def test_preview_default_writes_nothing(tmp_path: Path) -> None:
    """--preview is the default; intake-root must not be created/written."""
    out_root = tmp_path / "intake"
    result = run([
        "--confirm-transcript-access",
        "--transcript", str(FIXTURE),
        "--intake-root", str(out_root),
        "--since", "2026-05-01",
    ])
    assert result.returncode == 0
    assert "Mining preview" in result.stdout
    assert not out_root.exists()


def test_preview_redacts_user_names(tmp_path: Path) -> None:
    """Matze / Mathias must not appear in rendered preview."""
    result = run([
        "--confirm-transcript-access",
        "--transcript", str(FIXTURE),
        "--intake-root", str(tmp_path / "intake"),
        "--since", "2026-05-01",
    ])
    assert result.returncode == 0
    assert "Matze" not in result.stdout
    assert "Mathias" not in result.stdout
    assert "<user>" in result.stdout


def test_preview_caps_facts_at_five(tmp_path: Path) -> None:
    """Miner is a strict gate: ≤ 5 facts per cycle."""
    result = run([
        "--confirm-transcript-access",
        "--transcript", str(FIXTURE),
        "--intake-root", str(tmp_path / "intake"),
        "--since", "2026-05-01",
    ])
    assert result.returncode == 0
    rows = [ln for ln in result.stdout.splitlines()
            if ln.startswith("| ") and not ln.startswith("| #")
            and not ln.startswith("|---")]
    assert len(rows) <= 5


def test_commit_intake_appends_jsonl(tmp_path: Path) -> None:
    """--commit-intake writes one JSONL line per fact, contract-shaped."""
    out_root = tmp_path / "intake"
    result = run([
        "--confirm-transcript-access",
        "--commit-intake",
        "--transcript", str(FIXTURE),
        "--intake-root", str(out_root),
        "--since", "2026-05-01",
    ])
    assert result.returncode == 0
    assert out_root.exists()
    files = sorted(out_root.glob("*.jsonl"))
    assert files, "commit-intake must create at least one JSONL file"

    required = {"ts", "type", "key", "observation", "source",
                "session_id", "tags"}
    total = 0
    for f in files:
        for line in f.read_text().splitlines():
            obj = json.loads(line)
            assert required.issubset(obj.keys()), (
                f"missing fields: {required - obj.keys()}")
            assert obj["source"] == "agent"
            assert isinstance(obj["tags"], list)
            assert "Matze" not in obj["observation"]
            assert "Mathias" not in obj["observation"]
            total += 1
    assert 1 <= total <= 5


def test_mine_function_returns_three_signal_classes() -> None:
    """Direct call: corrections, conventions, invariants all surface."""
    from scripts.mine_session import mine

    since = dt.datetime(2026, 5, 1, tzinfo=dt.timezone.utc)
    facts = mine(FIXTURE, since, extra_patterns=[])
    types = {f["type"] for f in facts}
    # The fixture seeds preference (convention), correction (gotcha),
    # decision (invariant), and a recurring path → pattern.
    assert {"convention", "gotcha", "invariant"}.issubset(types), types
