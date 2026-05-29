"""Tests for the linked-projects sibling detector (Phase 1, Option A)."""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from scripts._lib import linked_projects as lp  # noqa: E402


def _make_git_repo(path: Path, files: int = 1) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    (path / ".git").mkdir(exist_ok=True)
    for i in range(files):
        (path / f"f{i}.txt").write_text("x", encoding="utf-8")
    return path


def _write_idea_modules(project: Path, sibling_rel: str) -> None:
    idea = project / ".idea"
    idea.mkdir(parents=True, exist_ok=True)
    (idea / "modules.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<project version="4">\n'
        '  <component name="ProjectModuleManager">\n'
        "    <modules>\n"
        '      <module fileurl="file://$PROJECT_DIR$/.idea/main.iml" '
        'filepath="$PROJECT_DIR$/.idea/main.iml" />\n'
        f'      <module fileurl="file://$PROJECT_DIR$/{sibling_rel}/.idea/s.iml" '
        f'filepath="$PROJECT_DIR$/{sibling_rel}/.idea/s.iml" />\n'
        "    </modules>\n"
        "  </component>\n"
        "</project>\n",
        encoding="utf-8",
    )


def _write_idea_vcs(project: Path, sibling_rel: str) -> None:
    idea = project / ".idea"
    idea.mkdir(parents=True, exist_ok=True)
    (idea / "vcs.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<project version="4">\n'
        '  <component name="VcsDirectoryMappings">\n'
        '    <mapping directory="$PROJECT_DIR$" vcs="Git" />\n'
        f'    <mapping directory="$PROJECT_DIR$/{sibling_rel}" vcs="Git" />\n'
        "  </component>\n"
        "</project>\n",
        encoding="utf-8",
    )


def test_phpstorm_modules_detects_sibling(tmp_path: Path) -> None:
    project = tmp_path / "main"
    project.mkdir()
    sibling = _make_git_repo(tmp_path / "web")
    _write_idea_modules(project, "../web")

    result = lp.detect_linked_projects(project)

    assert [e["path"] for e in result] == [str(sibling.resolve())]
    assert result[0]["detected_via"] == "phpstorm_modules"


def test_phpstorm_vcs_detects_sibling(tmp_path: Path) -> None:
    project = tmp_path / "main"
    project.mkdir()
    sibling = _make_git_repo(tmp_path / "web")
    _write_idea_vcs(project, "../web")

    result = lp.detect_linked_projects(project)
    assert [e["path"] for e in result] == [str(sibling.resolve())]
    assert result[0]["detected_via"] == "phpstorm_vcs"


def test_vscode_workspace_detects_sibling(tmp_path: Path) -> None:
    project = tmp_path / "main"
    project.mkdir()
    sibling = _make_git_repo(tmp_path / "web")
    (project / "app.code-workspace").write_text(
        '{\n  // workspace\n  "folders": [ {"path": "."}, {"path": "../web"} ],\n}\n',
        encoding="utf-8",
    )

    result = lp.detect_linked_projects(project)
    assert [e["path"] for e in result] == [str(sibling.resolve())]
    assert result[0]["detected_via"] == "vscode_workspace"


def test_malformed_xml_is_skipped_not_crashed(tmp_path: Path) -> None:
    project = tmp_path / "main"
    (project / ".idea").mkdir(parents=True)
    (project / ".idea" / "modules.xml").write_text("<not valid xml", encoding="utf-8")

    assert lp.detect_linked_projects(project) == []


def test_non_git_target_is_skipped(tmp_path: Path) -> None:
    project = tmp_path / "main"
    project.mkdir()
    plain = tmp_path / "web"
    plain.mkdir()  # no .git
    (plain / "f.txt").write_text("x", encoding="utf-8")
    _write_idea_modules(project, "../web")

    assert lp.detect_linked_projects(project) == []


def test_missing_target_is_skipped(tmp_path: Path) -> None:
    project = tmp_path / "main"
    project.mkdir()
    _write_idea_modules(project, "../does-not-exist")

    assert lp.detect_linked_projects(project) == []


def test_oversized_sibling_is_flagged_not_skipped(tmp_path: Path) -> None:
    # Under Option A (passive awareness) size never excludes — a real frontend
    # routinely exceeds the threshold and must still be surfaced, just flagged.
    project = tmp_path / "main"
    project.mkdir()
    sibling = _make_git_repo(tmp_path / "web", files=3)
    _write_idea_modules(project, "../web")

    result = lp.detect_linked_projects(project, max_files=2)
    assert [e["path"] for e in result] == [str(sibling.resolve())]
    assert result[0]["large"] is True


def test_small_sibling_not_flagged_large(tmp_path: Path) -> None:
    project = tmp_path / "main"
    project.mkdir()
    _make_git_repo(tmp_path / "web", files=1)
    _write_idea_modules(project, "../web")

    result = lp.detect_linked_projects(project)
    assert result[0]["large"] is False


def test_dedupe_across_sources(tmp_path: Path) -> None:
    project = tmp_path / "main"
    project.mkdir()
    sibling = _make_git_repo(tmp_path / "web")
    _write_idea_modules(project, "../web")
    _write_idea_vcs(project, "../web")  # same sibling via two sources

    result = lp.detect_linked_projects(project)
    assert [e["path"] for e in result] == [str(sibling.resolve())]


def test_inside_project_is_not_a_sibling(tmp_path: Path) -> None:
    project = tmp_path / "main"
    project.mkdir()
    _make_git_repo(project / "submodule")  # inside the project
    _write_idea_vcs(project, "submodule")  # maps an in-tree dir

    assert lp.detect_linked_projects(project) == []
