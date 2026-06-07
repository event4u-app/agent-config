"""Per-adapter telemetry — success / cost / latency (promotion evidence).

``scripts/ai-video/lib/telemetry.sh`` records one JSONL line per
network-bound adapter subcommand (wired through ``aiv_dispatch``).
These tests pin:

1. Record shape — ts / adapter / subcommand / status / duration_ms
   (+ optional cost_usd), nothing else (privacy floor: no prompts, no
   URLs, no paths, no keys).
2. Kill-switch — ``AIV_TELEMETRY=false`` records nothing.
3. Sink discipline — without ``AIV_TELEMETRY_FILE`` and without an
   ``agents/runtime`` dir in CWD, nothing is written (never litter).
4. Dispatch integration — a refused live ``submit`` (exit 4) still
   records ``exit_4`` AND preserves the adapter's exit code; ``dry-run``
   is never wrapped (byte-exact fixture output, no telemetry).
5. Summary aggregation — runs / ok_rate / total_cost per adapter.
6. Best-effort contract — a hostile status value is dropped, never a
   broken JSONL line.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
LIB = REPO_ROOT / "src" / "scripts" / "ai-video" / "lib"
SCRIPT = LIB / "telemetry.sh"
FAL = REPO_ROOT / "src" / "scripts" / "ai-video" / "adapters" / "fal.sh"

pytestmark = pytest.mark.skipif(
    shutil.which("bash") is None or shutil.which("jq") is None,
    reason="telemetry requires bash + jq.",
)

BASE_PATH = "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"


def _run(script: Path, *argv: str, env: dict[str, str] | None = None, cwd: Path | None = None):
    return subprocess.run(  # noqa: S603 — fixed args, no shell.
        ["bash", str(script), *argv],
        capture_output=True,
        text=True,
        timeout=15,
        env={"PATH": BASE_PATH, **(env or {})},
        cwd=cwd,
        check=False,
    )


def test_record_shape_and_optional_cost(tmp_path: Path) -> None:
    sink = tmp_path / "t.jsonl"
    env = {"AIV_TELEMETRY_FILE": str(sink)}
    assert _run(SCRIPT, "record", "fal", "submit", "ok", "1234", "0.4", env=env).returncode == 0
    assert _run(SCRIPT, "record", "fal", "fetch", "exit_8", "90", env=env).returncode == 0
    lines = [json.loads(line) for line in sink.read_text().splitlines()]
    assert set(lines[0]) == {"ts", "adapter", "subcommand", "status", "duration_ms", "cost_usd"}
    assert lines[0]["cost_usd"] == 0.4
    assert set(lines[1]) == {"ts", "adapter", "subcommand", "status", "duration_ms"}
    assert lines[1]["status"] == "exit_8"


def test_kill_switch_records_nothing(tmp_path: Path) -> None:
    sink = tmp_path / "t.jsonl"
    res = _run(
        SCRIPT, "record", "fal", "submit", "ok", "10",
        env={"AIV_TELEMETRY_FILE": str(sink), "AIV_TELEMETRY": "false"},
    )
    assert res.returncode == 0
    assert not sink.exists()


def test_no_sink_no_litter(tmp_path: Path) -> None:
    res = _run(SCRIPT, "record", "fal", "submit", "ok", "10", cwd=tmp_path)
    assert res.returncode == 0
    assert list(tmp_path.iterdir()) == []


def test_hostile_status_dropped_not_broken(tmp_path: Path) -> None:
    sink = tmp_path / "t.jsonl"
    res = _run(
        SCRIPT, "record", "fal", "submit", 'ok","inject":"x', "10",
        env={"AIV_TELEMETRY_FILE": str(sink)},
    )
    assert res.returncode == 0
    assert not sink.exists()  # dropped entirely — never a broken line


def test_summary_aggregates(tmp_path: Path) -> None:
    sink = tmp_path / "t.jsonl"
    env = {"AIV_TELEMETRY_FILE": str(sink)}
    _run(SCRIPT, "record", "fal", "submit", "ok", "100", "0.4", env=env)
    _run(SCRIPT, "record", "fal", "submit", "exit_8", "300", env=env)
    out = json.loads(_run(SCRIPT, "summary", str(sink)).stdout)
    fal = out["adapters"]["fal"]
    assert fal["runs"] == 2
    assert fal["ok"] == 1
    assert fal["ok_rate"] == 0.5
    assert fal["total_cost_usd"] == 0.4


def test_dispatch_records_refused_submit_and_preserves_exit(tmp_path: Path) -> None:
    sink = tmp_path / "d.jsonl"
    res = _run(
        FAL, "submit",
        env={"AIV_TELEMETRY_FILE": str(sink), "AIV_DRYRUN": "true"},
    )
    assert res.returncode == 4  # contract exit code unchanged
    assert "live call refused" in res.stderr
    (line,) = [json.loads(x) for x in sink.read_text().splitlines()]
    assert line["adapter"] == "fal"
    assert line["subcommand"] == "submit"
    assert line["status"] == "exit_4"


def test_dry_run_is_never_wrapped(tmp_path: Path) -> None:
    sink = tmp_path / "x.jsonl"
    res = _run(
        FAL, "dry-run",
        env={"AIV_TELEMETRY_FILE": str(sink), "AIV_DRYRUN": "true"},
    )
    assert res.returncode == 0
    fixture = (LIB / "fixtures" / "fal" / "result.json").read_text()
    assert res.stdout == fixture  # byte-exact fixture output
    assert not sink.exists()
