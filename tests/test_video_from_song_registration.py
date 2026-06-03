"""`/video:from-song` — registration + dispatch-disambiguation guard.

Pins the Phase-5 wiring so a future edit cannot silently drop the
sub-command or its parse safeguard (AI-council flagged `from-song`
sub-command vs `from-song.mp3` file-path mis-dispatch as a pre-merge
risk, 2026-05-30). Pure-Python; no ffmpeg needed.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from _lib.agent_src import resolve_logical  # noqa: E402

# Commands moved into the pack-physical src/domains homes in 6.0.0-D Phase 4;
# skills into the flat src/ library in Phase 2. Resolve by logical identity so
# these pins survive the physical move.
COMMAND = resolve_logical("commands/video/from-song.md")
ORCHESTRATOR = resolve_logical("commands/video.md")
SKILL = resolve_logical("skills/song-to-script/SKILL.md")
PROBE = REPO / "scripts" / "ai-video" / "lib" / "probe-audio.sh"
CLUSTERS = REPO / "docs" / "contracts" / "command-clusters.md"


def test_artefacts_exist() -> None:
    assert COMMAND.is_file(), "from-song command missing"
    assert SKILL.is_file(), "song-to-script skill missing"
    assert PROBE.is_file(), "probe-audio.sh missing"


def test_probe_is_executable() -> None:
    import os

    assert os.access(PROBE, os.X_OK), "probe-audio.sh must be executable"


def test_orchestrator_registers_from_song() -> None:
    body = ORCHESTRATOR.read_text(encoding="utf-8")
    assert "commands/video/from-song.md" in body, "from-song not in orchestrator table"
    assert "from-song — music video" in body, "from-song missing from the dispatch prompt"


def test_orchestrator_documents_path_vs_subcommand_disambiguation() -> None:
    body = ORCHESTRATOR.read_text(encoding="utf-8")
    # The council's mis-dispatch guard: a `from-song.mp3` path must never be
    # treated as the `from-song` sub-command.
    assert "from-song.mp3" in body, "dispatch disambiguation guard not documented"


def test_cluster_registry_lists_from_song() -> None:
    body = CLUSTERS.read_text(encoding="utf-8")
    video_line = next(
        (ln for ln in body.splitlines() if ln.startswith("| `video`")), None
    )
    assert video_line is not None, "video cluster row missing"
    assert "from-song" in video_line, "from-song not registered in the video cluster line"


def test_command_declares_required_skills() -> None:
    body = COMMAND.read_text(encoding="utf-8")
    for skill in (
        "song-to-script",
        "scene-expander",
        "video-director",
        "character-consistency",
        "motion-choreographer",
    ):
        assert skill in body, f"command must declare {skill}"
