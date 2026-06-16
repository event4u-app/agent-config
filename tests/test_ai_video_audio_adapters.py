"""Music-video orchestration — audio adapter contract tests (v1).

Every adapter under ``scripts/ai-video/audio-adapters/`` MUST honour the
single-source-of-truth contract at
``scripts/ai-video/lib/audio-adapter-contract.md``:

1. Strict-mode shebang + ``set -euo pipefail`` + sourcing the common lib.
2. ``capability`` returns ``{kind, provides, backend}`` with a valid kind.
3. ``dry-run`` emits the class-specific contract shape from the committed
   fixture, without network or local-ML execution.
4. ``analyze`` with the backing CLI absent exits 3 (config failure —
   the orchestrator hard-fails instead of silently degrading).
5. Unknown subcommand exits 2 with a named error (fail-closed dispatch).
6. Every adapter carries a ``Lifecycle:`` header marker.

Plus the ground-truth validator ``validate-vocal-map.sh`` — the in-code
enforcement of the media-sync-ground-truth Iron Law: vocal-map timing and
text must match the transcript; ambiguous singers stay ``"?"``.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
AUDIO_ADAPTER_DIR = REPO_ROOT / "src" / "scripts" / "ai-video" / "audio-adapters"
LIB_DIR = REPO_ROOT / "src" / "scripts" / "ai-video" / "lib"
CONTRACT = LIB_DIR / "audio-adapter-contract.md"
VALIDATOR = LIB_DIR / "validate-vocal-map.sh"
FIXTURES = REPO_ROOT / "src" / "scripts" / "media" / "lib" / "fixtures"

ADAPTERS = sorted(p.stem for p in AUDIO_ADAPTER_DIR.glob("*.sh"))
VALID_KINDS = {"audio-analysis", "lyrics"}
VALID_BACKENDS = {"local-cli", "hosted"}
VALID_LIFECYCLE = {"experimental", "beta", "stable", "deprecated"}

pytestmark = pytest.mark.skipif(
    shutil.which("bash") is None,
    reason="audio adapter contract requires bash; not available on this host.",
)

requires_jq = pytest.mark.skipif(
    shutil.which("jq") is None,
    reason="validator requires jq; not available on this host.",
)


def _adapter_path(adapter_id: str) -> Path:
    return AUDIO_ADAPTER_DIR / f"{adapter_id}.sh"


def _run_adapter(
    adapter_id: str, *argv: str, stdin: str = ""
) -> subprocess.CompletedProcess[str]:
    """Invoke an audio adapter subcommand under a restricted PATH so the
    operator-installed ML CLIs (allin1 / whisperx) are never found —
    keeps the suite deterministic on any host."""
    return subprocess.run(  # noqa: S603 — fixed args, no shell.
        ["bash", str(_adapter_path(adapter_id)), *argv],
        capture_output=True,
        text=True,
        timeout=15,
        input=stdin,
        env={"PATH": "/usr/bin:/bin", "AIV_DRYRUN": "true"},
        check=False,
    )


# ---------------------------------------------------------------------------
# Discovery + structural shape
# ---------------------------------------------------------------------------

def test_audio_adapter_directory_is_populated() -> None:
    assert ADAPTERS, f"no audio adapters discovered under {AUDIO_ADAPTER_DIR}"


def test_contract_exists_and_documents_load_bearing_points() -> None:
    text = CONTRACT.read_text(encoding="utf-8")
    for needle in (
        "analyze",
        "dry-run",
        "capability",
        "probe-audio.sh",
        "aiv_fetch_url",
        "media-sync-ground-truth",
        "75",  # transient exit code — fallback semantics (council Q4c)
    ):
        assert needle in text, f"audio-adapter-contract.md must document {needle!r}"


@pytest.mark.parametrize("adapter", ADAPTERS)
def test_adapter_uses_strict_mode_and_sources_common_lib(adapter: str) -> None:
    body = _adapter_path(adapter).read_text(encoding="utf-8")
    assert body.startswith("#!/usr/bin/env bash"), f"{adapter}: missing bash shebang"
    assert "set -euo pipefail" in body, f"{adapter}: missing strict-mode flags"
    assert "adapter-common.sh" in body, (
        f"{adapter}: does not source adapter-common.sh"
    )


@pytest.mark.parametrize("adapter", ADAPTERS)
def test_adapter_declares_lifecycle_tier(adapter: str) -> None:
    body = _adapter_path(adapter).read_text(encoding="utf-8")
    marker = None
    for line in body.splitlines()[:30]:
        stripped = line.lstrip("# ").strip()
        if stripped.lower().startswith("lifecycle:"):
            marker = stripped.split(":", 1)[1].strip().split()[0].lower().rstrip(",.;")
            break
    assert marker is not None, f"{adapter}: no 'Lifecycle:' marker in first 30 lines"
    assert marker in VALID_LIFECYCLE, f"{adapter}: tier {marker!r} invalid"


# ---------------------------------------------------------------------------
# Capability
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("adapter", ADAPTERS)
def test_capability_returns_valid_kind(adapter: str) -> None:
    result = _run_adapter(adapter, "capability")
    assert result.returncode == 0, (
        f"{adapter}: capability exit={result.returncode} stderr={result.stderr!r}"
    )
    payload = json.loads(result.stdout)
    assert payload.get("kind") in VALID_KINDS, (
        f"{adapter}: kind={payload.get('kind')!r} not in {VALID_KINDS}"
    )
    assert isinstance(payload.get("provides"), list) and payload["provides"], (
        f"{adapter}: capability.provides must be a non-empty list"
    )
    assert payload.get("backend") in VALID_BACKENDS, (
        f"{adapter}: backend={payload.get('backend')!r} not in {VALID_BACKENDS}"
    )


# ---------------------------------------------------------------------------
# Dry-run — class-specific contract shape
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("adapter", ADAPTERS)
def test_dry_run_emits_contract_shaped_stdout(adapter: str) -> None:
    cap = json.loads(_run_adapter(adapter, "capability").stdout)
    result = _run_adapter(adapter, "dry-run")
    assert result.returncode == 0, (
        f"{adapter}: dry-run exit={result.returncode} stderr={result.stderr!r}"
    )
    payload = json.loads(result.stdout)
    assert payload.get("schema") == 1, f"{adapter}: dry-run missing schema:1"
    assert isinstance(payload.get("source"), str), f"{adapter}: missing source"

    if cap["kind"] == "audio-analysis":
        for key in ("bpm", "beats", "downbeats", "sections"):
            assert key in payload, f"{adapter}: audio-analysis dry-run missing {key}"
        beats = payload["beats"]
        assert beats == sorted(beats), f"{adapter}: beats must ascend"
        for section in payload["sections"]:
            assert section["start"] < section["end"], (
                f"{adapter}: section start >= end: {section}"
            )
            assert isinstance(section.get("label"), str) and section["label"], (
                f"{adapter}: section missing label: {section}"
            )
    else:  # lyrics
        lines = payload.get("lines")
        assert isinstance(lines, list) and lines, f"{adapter}: lyrics dry-run missing lines"
        for line in lines:
            assert line["start"] < line["end"], f"{adapter}: line start >= end: {line}"
            assert isinstance(line.get("text"), str) and line["text"], (
                f"{adapter}: line missing text: {line}"
            )
            assert isinstance(line.get("speaker"), str) and line["speaker"], (
                f"{adapter}: line missing speaker — contract requires a label or '?'"
            )


def test_lyrics_fixture_demonstrates_ambiguous_speaker() -> None:
    """The committed whisperx fixture MUST carry at least one ``"?"``
    speaker so downstream consumers (song-to-script, the sign-off gate)
    exercise the ambiguous path — the Iron Law's load-bearing case."""
    payload = json.loads((FIXTURES / "whisperx" / "transcript.json").read_text())
    speakers = {line["speaker"] for line in payload["lines"]}
    assert "?" in speakers, "whisperx fixture must include an ambiguous '?' line"


# ---------------------------------------------------------------------------
# Analyze — config failure is loud, dispatch is fail-closed
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("adapter", ADAPTERS)
def test_analyze_without_backend_cli_exits_3(adapter: str) -> None:
    """Restricted PATH → the ML CLI is absent → exit 3 with an install
    hint. Per council Q4(c) this is a CONFIG failure the orchestrator
    must surface, never a silent fallback."""
    result = _run_adapter(adapter, "analyze", stdin='{"audio_path":"/nonexistent.wav"}')
    assert result.returncode == 3, (
        f"{adapter}: analyze without backend CLI must exit 3 "
        f"(exit={result.returncode} stderr={result.stderr!r})"
    )


@pytest.mark.parametrize("adapter", ADAPTERS)
def test_unknown_subcommand_is_rejected_fail_closed(adapter: str) -> None:
    result = _run_adapter(adapter, "nonsense-subcommand")
    assert result.returncode == 2, (
        f"{adapter}: unknown subcommand not rejected with exit 2 "
        f"(exit={result.returncode} stderr={result.stderr!r})"
    )
    assert "unknown subcommand" in result.stderr, (
        f"{adapter}: rejection message missing sentinel (stderr={result.stderr!r})"
    )


# ---------------------------------------------------------------------------
# validate-vocal-map.sh — ground-truth enforcement (Iron Law in code)
# ---------------------------------------------------------------------------

TRANSCRIPT = {
    "schema": 1,
    "source": "whisperx",
    "lines": [
        {"start": 8.40, "end": 11.20, "text": "cold light over the harbor", "speaker": "SPEAKER_00"},
        {"start": 12.00, "end": 15.10, "text": "we sail before the storm", "speaker": "SPEAKER_01"},
    ],
}


def _run_validator(tmp_path: Path, vocal_map: object, *argv: str):
    map_file = tmp_path / "vocal-map.json"
    tr_file = tmp_path / "transcript.json"
    map_file.write_text(json.dumps(vocal_map))
    tr_file.write_text(json.dumps(TRANSCRIPT))
    return subprocess.run(  # noqa: S603
        ["bash", str(VALIDATOR), str(map_file), str(tr_file), *argv],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )


@requires_jq
def test_validator_accepts_transcript_derived_map(tmp_path: Path) -> None:
    good = [
        {"start": 8.40, "end": 11.20, "text": "cold light over the harbor", "singer": "Freya"},
        {"start": 12.00, "end": 15.10, "text": "we sail before the storm", "singer": "?"},
    ]
    result = _run_validator(tmp_path, good)
    assert result.returncode == 0, result.stderr
    assert "transcript-derived" in result.stdout


@requires_jq
def test_validator_rejects_retimed_line(tmp_path: Path) -> None:
    """A line whose text exists but whose timing was stretched/re-timed
    beyond tolerance is the canonical odins-beard failure — must fail."""
    retimed = [
        {"start": 20.00, "end": 23.00, "text": "cold light over the harbor", "singer": "Freya"},
    ]
    result = _run_validator(tmp_path, retimed)
    assert result.returncode == 7, result.stdout + result.stderr
    assert "re-timed" in result.stderr


@requires_jq
def test_validator_rejects_brief_derived_line(tmp_path: Path) -> None:
    invented = [
        {"start": 8.40, "end": 11.20, "text": "a line the singer never sang", "singer": "Freya"},
    ]
    result = _run_validator(tmp_path, invented)
    assert result.returncode == 7
    assert "not in the transcript" in result.stderr


@requires_jq
def test_validator_rejects_missing_singer(tmp_path: Path) -> None:
    no_singer = [
        {"start": 8.40, "end": 11.20, "text": "cold light over the harbor"},
    ]
    result = _run_validator(tmp_path, no_singer)
    assert result.returncode == 7
    assert "singer missing" in result.stderr


@requires_jq
def test_validator_enforces_roster_but_allows_question_mark(tmp_path: Path) -> None:
    mapped = [
        {"start": 8.40, "end": 11.20, "text": "cold light over the harbor", "singer": "NotInCast"},
        {"start": 12.00, "end": 15.10, "text": "we sail before the storm", "singer": "?"},
    ]
    result = _run_validator(tmp_path, mapped, "--roster", "Freya,Odin")
    assert result.returncode == 7
    assert "not in roster" in result.stderr

    mapped[0]["singer"] = "Freya"
    result = _run_validator(tmp_path, mapped, "--roster", "Freya,Odin")
    assert result.returncode == 0, result.stderr


@requires_jq
def test_validator_accepts_empty_map(tmp_path: Path) -> None:
    """No lip-sync lines (instrumental / style mode) is valid."""
    result = _run_validator(tmp_path, [])
    assert result.returncode == 0
