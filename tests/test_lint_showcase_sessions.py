"""Tests for scripts/lint_showcase_sessions.py.

Covers the gate behavior:
  - empty state (no references, no files) → exit 0
  - reference resolves to file with valid frontmatter → exit 0
  - reference points to missing file → exit 1
  - file exists but missing commit_sha → exit 1
  - file exists but missing metrics block → exit 1
  - file on disk but not referenced → orphan, exit 1
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lint_showcase_sessions as mod  # noqa: E402


VALID_FRONTMATTER = """\
---
slug: "demo"
task_class: "implement-ticket"
host_agent: "augment"
model: "claude-opus-4.7"
commit_sha: "abc123"
started: "2026-05-04T10:00:00Z"
ended: "2026-05-04T11:00:00Z"
metrics:
  tool_call_count: 42
  reply_chars_mean: 512.0
  memory_hit_ratio: null
  verify_pass_rate: 1.0
---
body
"""


def _setup(tmp_path: Path, showcase_text: str, sessions: dict[str, str]) -> Path:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "showcase.md").write_text(showcase_text, encoding="utf-8")
    sessions_dir = docs / "showcase" / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    for slug, content in sessions.items():
        (sessions_dir / f"{slug}.log").write_text(content, encoding="utf-8")
    return tmp_path


def _run(tmp_path: Path) -> int:
    with mock.patch.object(mod, "ROOT", tmp_path), \
         mock.patch.object(mod, "SHOWCASE_MD", tmp_path / "docs" / "showcase.md"), \
         mock.patch.object(
             mod, "SESSIONS_DIR",
             tmp_path / "docs" / "showcase" / "sessions",
         ):
        return mod.main()


def test_empty_state_passes(tmp_path: Path) -> None:
    _setup(tmp_path, "# showcase — no sessions yet\n", {})
    assert _run(tmp_path) == 0


def test_valid_reference_passes(tmp_path: Path) -> None:
    _setup(
        tmp_path,
        "see docs/showcase/sessions/demo.log\n",
        {"demo": VALID_FRONTMATTER},
    )
    assert _run(tmp_path) == 0


def test_missing_file_fails(tmp_path: Path) -> None:
    _setup(tmp_path, "see docs/showcase/sessions/ghost.log\n", {})
    assert _run(tmp_path) == 1


def test_missing_commit_sha_fails(tmp_path: Path) -> None:
    bad = VALID_FRONTMATTER.replace('commit_sha: "abc123"\n', "")
    _setup(
        tmp_path,
        "see docs/showcase/sessions/demo.log\n",
        {"demo": bad},
    )
    assert _run(tmp_path) == 1


def test_missing_metrics_block_fails(tmp_path: Path) -> None:
    bad = VALID_FRONTMATTER.split("metrics:")[0] + "---\nbody\n"
    _setup(
        tmp_path,
        "see docs/showcase/sessions/demo.log\n",
        {"demo": bad},
    )
    assert _run(tmp_path) == 1


def test_metrics_block_missing_keys_fails(tmp_path: Path) -> None:
    bad = """\
---
commit_sha: "abc123"
metrics:
  tool_call_count: 1
---
body
"""
    _setup(
        tmp_path,
        "see docs/showcase/sessions/demo.log\n",
        {"demo": bad},
    )
    assert _run(tmp_path) == 1


def test_orphan_session_fails(tmp_path: Path) -> None:
    _setup(
        tmp_path,
        "# showcase\n",
        {"orphan": VALID_FRONTMATTER},
    )
    assert _run(tmp_path) == 1


def test_no_frontmatter_fails(tmp_path: Path) -> None:
    _setup(
        tmp_path,
        "see docs/showcase/sessions/raw.log\n",
        {"raw": "no frontmatter here\n"},
    )
    assert _run(tmp_path) == 1
