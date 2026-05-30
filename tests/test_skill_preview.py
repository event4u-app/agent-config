"""skill_preview — non-destructive "what will this skill do?" preview.

Phase 5 of `road-to-leaner-core-and-discovery`. Covers: a `manual` skill renders
"instructional only", an `assisted` skill renders its proposed actions + command,
`allowed_tools` are listed, and a malformed/missing SKILL.md degrades to a
structured error rather than crashing. Read-only, no network.
"""
from __future__ import annotations

import importlib
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sp = importlib.import_module("skill_preview")

MANUAL_SKILL = """---
name: fixture-manual
description: A manual fixture skill.
domain: quality
---

# fixture-manual

## Steps

### 1. Look at the thing
Do the looking.

### 2. Report findings
Write them down.
"""

ASSISTED_SKILL = """---
name: fixture-assisted
description: An assisted fixture skill.
domain: process
execution:
  type: assisted
  handler: shell
  allowed_tools: [file-editor, shell-runner]
  command:
    - python3
    - scripts/do_thing.py
---

# fixture-assisted

## Steps

### 1. Propose the change
Run `python3 scripts/do_thing.py` against `config/thing.yml`.
"""

MALFORMED_NO_FM = "# no frontmatter here\n\njust prose.\n"
MALFORMED_BAD_YAML = "---\nname: [unclosed\n---\n# body\n"


def _write_skill(root: Path, name: str, content: str) -> None:
    d = root / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKILL.md").write_text(content, encoding="utf-8")


@pytest.fixture()
def skills_root(tmp_path, monkeypatch):
    root = tmp_path / "skills"
    root.mkdir()
    _write_skill(root, "fixture-manual", MANUAL_SKILL)
    _write_skill(root, "fixture-assisted", ASSISTED_SKILL)
    _write_skill(root, "fixture-no-fm", MALFORMED_NO_FM)
    _write_skill(root, "fixture-bad-yaml", MALFORMED_BAD_YAML)
    monkeypatch.setattr(sp, "SKILLS_DIR", root)
    return root


def test_manual_skill_is_instructional_only(skills_root):
    p = sp.load_preview("fixture-manual")
    assert p["execution_type"] == "manual"
    out = sp.render_plain(p)
    assert "instructional only" in out.lower()
    assert "Look at the thing" in out and "Report findings" in out


def test_assisted_skill_renders_proposed_actions(skills_root):
    p = sp.load_preview("fixture-assisted")
    assert p["execution_type"] == "assisted"
    out = sp.render_plain(p)
    assert "propose" in out.lower()
    assert "scripts/do_thing.py" in out


def test_allowed_tools_are_listed(skills_root):
    p = sp.load_preview("fixture-assisted")
    assert p["allowed_tools"] == ["file-editor", "shell-runner"]
    out = sp.render_plain(p)
    assert "file-editor" in out and "shell-runner" in out


def test_body_targets_are_extracted(skills_root):
    p = sp.load_preview("fixture-assisted")
    assert any("do_thing.py" in c for c in p["commands_named"])
    assert any("thing.yml" in f for f in p["paths_named"])


def test_missing_skill_raises_preview_error(skills_root):
    with pytest.raises(sp.PreviewError):
        sp.load_preview("does-not-exist")


def test_malformed_no_frontmatter_raises(skills_root):
    with pytest.raises(sp.PreviewError):
        sp.load_preview("fixture-no-fm")


def test_malformed_bad_yaml_raises(skills_root):
    with pytest.raises(sp.PreviewError):
        sp.load_preview("fixture-bad-yaml")


def test_technical_render_has_step_list(skills_root):
    p = sp.load_preview("fixture-manual")
    tech = sp.render_technical(p)
    assert "Declared steps" in tech
    assert "1. Look at the thing" in tech


def test_cli_missing_skill_exits_2_with_structured_error():
    proc = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "skill_preview.py"),
         "definitely-not-a-skill", "--format", "json"],
        capture_output=True, text=True, cwd=REPO_ROOT,
    )
    assert proc.returncode == 2
    assert "error" in proc.stdout  # structured JSON error, not a traceback


def test_cli_real_manual_skill_smoke():
    proc = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "skill_preview.py"), "accessibility-auditor"],
        capture_output=True, text=True, cwd=REPO_ROOT,
    )
    assert proc.returncode == 0, proc.stderr
    assert "instructional only" in proc.stdout.lower()
