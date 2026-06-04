"""Tests for scripts/roadmap_progress_hook.py — PostToolUse hook core.

Path-filter logic, write-tool gating, regenerator dispatch, and the
"never block" guarantee. The regenerator is replaced with a sentinel
script so we can detect invocation without importing the real one.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))
import roadmap_progress_hook as rph  # noqa: E402


@pytest.fixture
def consumer_root(tmp_path: Path) -> Path:
    """Build a fake consumer root with a sentinel regenerator that
    creates a marker file when invoked, so the test can assert
    regeneration without running the real updater."""
    scripts_dir = tmp_path / ".augment" / "scripts"
    scripts_dir.mkdir(parents=True)
    sentinel = tmp_path / "regen.marker"
    script = scripts_dir / "update_roadmap_progress.py"
    script.write_text(
        "import pathlib, sys\n"
        f"pathlib.Path({str(sentinel)!r}).write_text('ok')\n"
        "sys.exit(0)\n"
    )
    return tmp_path


def _payload(tool: str, *, paths: list[str] | None = None,
             file_changes: list[dict] | None = None) -> str:
    body: dict = {"hook_event_name": "PostToolUse", "tool_name": tool}
    if paths is not None:
        body["tool_input"] = {"path": paths[0]} if paths else {}
    if file_changes is not None:
        body["file_changes"] = file_changes
    return json.dumps(body)


def _marker(consumer_root: Path) -> Path:
    return consumer_root / "regen.marker"


# --- path filter ---------------------------------------------------------

@pytest.mark.parametrize("path,expected", [
    ("agents/roadmaps/my-feature.md", True),
    ("./agents/roadmaps/my-feature.md", True),
    ("agents/roadmaps/archive/old.md", False),
    ("agents/roadmaps/skipped/abandoned.md", False),
    ("agents/roadmaps-progress.md", False),
    ("agents/roadmaps/README.md", True),  # README inside dir still triggers
    ("agents/settings/contexts/some-doc.md", False),
    ("src/foo.php", False),
    ("agents/roadmaps/notes.txt", False),  # non-md skipped
])
def test_is_roadmap_touch(path: str, expected: bool) -> None:
    assert rph._is_roadmap_touch(path) is expected


# --- candidate path extraction ------------------------------------------

def test_candidate_paths_prefers_file_changes() -> None:
    payload = json.loads(_payload(
        "str-replace-editor",
        paths=["agents/roadmaps/foo.md"],
        file_changes=[{"path": "agents/roadmaps/bar.md", "changeType": "edit"}],
    ))
    paths = rph._candidate_paths(payload)
    assert "agents/roadmaps/bar.md" in paths
    assert "agents/roadmaps/foo.md" in paths


def test_candidate_paths_handles_missing_fields() -> None:
    assert rph._candidate_paths({}) == []
    assert rph._candidate_paths({"tool_input": "not-a-dict"}) == []


# --- run() — full hook behaviour ----------------------------------------

def test_run_regenerates_on_roadmap_str_replace(consumer_root: Path) -> None:
    stdin = _payload("str-replace-editor",
                     file_changes=[{"path": "agents/roadmaps/my-feature.md",
                                    "changeType": "edit"}])
    rc = rph.run(stdin, consumer_root=consumer_root)
    assert rc == 0
    assert _marker(consumer_root).exists()


def test_run_regenerates_on_save_file(consumer_root: Path) -> None:
    stdin = _payload("save-file", paths=["agents/roadmaps/new.md"])
    assert rph.run(stdin, consumer_root=consumer_root) == 0
    assert _marker(consumer_root).exists()


def test_run_skips_when_tool_is_not_a_writer(consumer_root: Path) -> None:
    stdin = _payload("view", file_changes=[{"path": "agents/roadmaps/x.md"}])
    assert rph.run(stdin, consumer_root=consumer_root) == 0
    assert not _marker(consumer_root).exists()


def test_run_skips_when_path_is_outside_roadmaps(consumer_root: Path) -> None:
    stdin = _payload("save-file", paths=["src/foo.php"])
    assert rph.run(stdin, consumer_root=consumer_root) == 0
    assert not _marker(consumer_root).exists()


def test_run_skips_archive_paths(consumer_root: Path) -> None:
    stdin = _payload("str-replace-editor",
                     file_changes=[{"path": "agents/roadmaps/archive/old.md"}])
    assert rph.run(stdin, consumer_root=consumer_root) == 0
    assert not _marker(consumer_root).exists()


def test_run_skips_dashboard_itself(consumer_root: Path) -> None:
    """Defensive — guarantees no infinite regeneration loop."""
    stdin = _payload("save-file", paths=["agents/roadmaps-progress.md"])
    assert rph.run(stdin, consumer_root=consumer_root) == 0
    assert not _marker(consumer_root).exists()


def test_run_handles_malformed_stdin(consumer_root: Path) -> None:
    assert rph.run("not json {", consumer_root=consumer_root) == 0
    assert rph.run("", consumer_root=consumer_root) == 0
    assert not _marker(consumer_root).exists()


def test_run_handles_missing_regenerator(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """No regenerator anywhere → silent no-op, exit 0.

    The package-root fallback (added for global-only consumers) is pointed
    at an empty dir so this exercises the true "nothing installed" path
    rather than silently resolving the real package copy.
    """
    empty_pkg = tmp_path / "empty-pkg"
    empty_pkg.mkdir()
    monkeypatch.setattr(rph, "_package_roots", lambda: [empty_pkg])
    stdin = _payload("save-file", paths=["agents/roadmaps/x.md"])
    assert rph.run(stdin, consumer_root=tmp_path) == 0


def test_run_regenerates_from_package_root_for_global_only_consumer(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regression (road-to-self-update Phase 5): an ADR-020 global-only
    consumer has NO project-local .augment/ or .agent-src/ tree — the
    regenerator ships only in the globally-installed package. The hook
    must resolve it from the package root (passed by the dispatcher via
    AGENT_CONFIG_PACKAGE_ROOT) and still regenerate the dashboard.

    Before the fix, _resolve_regenerator searched only the consumer root,
    so the hook fired, matched, and then silently no-opped — the exact
    failure this roadmap's Phase 5 surfaced against agent-ide-plugin.
    """
    # Consumer repo carries no distributed content (global-only).
    consumer = tmp_path / "consumer"
    (consumer / "agents" / "roadmaps").mkdir(parents=True)

    # Globally-installed package ships the regenerator under .agent-src/.
    pkg = tmp_path / "global-pkg"
    pkg_scripts = pkg / ".agent-src" / "scripts"
    pkg_scripts.mkdir(parents=True)
    marker = tmp_path / "pkg-regen.marker"
    (pkg_scripts / "update_roadmap_progress.py").write_text(
        "import pathlib, sys\n"
        f"pathlib.Path({str(marker)!r}).write_text('ok')\n"
        "sys.exit(0)\n"
    )
    # The dispatcher exports this; simulate it here.
    monkeypatch.setenv("AGENT_CONFIG_PACKAGE_ROOT", str(pkg))

    abs_path = str(consumer / "agents" / "roadmaps" / "my-feature.md")
    stdin = json.dumps({
        "hook_event_name": "PostToolUse",
        "tool_name": "Edit",
        "tool_input": {"file_path": abs_path},
    })
    assert rph.run(stdin, consumer_root=consumer) == 0
    assert marker.exists(), "global-only consumer must regen from package root"


def test_run_remote_path_variants(consumer_root: Path) -> None:
    """Backslash paths (Windows-style) and ./-prefixed paths normalise."""
    for path in ("./agents/roadmaps/x.md", "agents\\roadmaps\\x.md"):
        marker = _marker(consumer_root)
        if marker.exists():
            marker.unlink()
        rc = rph.run(_payload("save-file", paths=[path]),
                     consumer_root=consumer_root)
        assert rc == 0
        assert marker.exists(), f"expected regen for path={path!r}"


# --- absolute-path normalisation (Claude) --------------------------------

def test_relativize_makes_absolute_project_relative(tmp_path: Path) -> None:
    abs_path = str(tmp_path / "agents" / "roadmaps" / "x.md")
    assert rph._relativize(abs_path, tmp_path) == "agents/roadmaps/x.md"


def test_relativize_leaves_relative_untouched(tmp_path: Path) -> None:
    assert rph._relativize("agents/roadmaps/x.md", tmp_path) == "agents/roadmaps/x.md"


def test_relativize_leaves_out_of_tree_untouched(tmp_path: Path) -> None:
    """An absolute path outside the project stays absolute → fails the
    prefix check downstream (correct: a roadmap in another repo must not
    trigger this project's dashboard)."""
    other = str((tmp_path.parent / "elsewhere" / "agents" / "roadmaps" / "x.md"))
    assert rph._relativize(other, tmp_path) == other


def test_run_regenerates_on_absolute_claude_file_path(consumer_root: Path) -> None:
    """Regression: Claude passes an ABSOLUTE tool_input.file_path; the old
    relative-only prefix check missed it and the hook silently no-opped."""
    abs_path = str(consumer_root / "agents" / "roadmaps" / "my-feature.md")
    stdin = json.dumps({
        "hook_event_name": "PostToolUse",
        "tool_name": "Edit",                       # Claude write-tool name
        "tool_input": {"file_path": abs_path},     # Claude uses file_path, absolute
    })
    assert rph.run(stdin, consumer_root=consumer_root) == 0
    assert _marker(consumer_root).exists()
