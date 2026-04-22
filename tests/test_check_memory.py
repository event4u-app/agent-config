"""Tests for scripts/check_memory.py — the engineering-memory validator."""

from __future__ import annotations

import subprocess
import textwrap
from pathlib import Path

import pytest

SCRIPT = Path("scripts/check_memory.py")


def _run(path: Path, fmt: str = "text") -> subprocess.CompletedProcess:
    return subprocess.run(
        ["python3", str(SCRIPT), "--path", str(path), "--format", fmt],
        capture_output=True, text=True,
    )


def _write(tmp_path: Path, name: str, body: str) -> Path:
    root = tmp_path / "memory" / name.replace(".example.yml", "")
    root.mkdir(parents=True, exist_ok=True)
    f = root / "entry.yml"
    f.write_text(textwrap.dedent(body), encoding="utf-8")
    return tmp_path / "memory"


def test_example_templates_are_valid():
    result = _run(Path(".agent-src.uncompressed/templates/agents/memory"))
    assert result.returncode == 0, result.stdout + result.stderr


def test_missing_required_field_fails(tmp_path):
    root = _write(tmp_path, "domain-invariants", """
        version: 1
        entries:
          - id: bad
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
        """)
    result = _run(root)
    assert result.returncode == 1
    assert "missing required field: last_validated" in result.stdout
    assert "missing required field: review_after_days" in result.stdout


def test_invalid_enum_fails(tmp_path):
    root = _write(tmp_path, "domain-invariants", """
        version: 1
        entries:
          - id: bad
            status: wrong
            confidence: super
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
        """)
    result = _run(root)
    assert result.returncode == 1
    assert "invalid status 'wrong'" in result.stdout
    assert "invalid confidence 'super'" in result.stdout


def test_duplicate_id_fails(tmp_path):
    root = tmp_path / "memory" / "domain-invariants"
    root.mkdir(parents=True)
    (root / "a.yml").write_text(textwrap.dedent("""
        version: 1
        entries:
          - id: dup
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
          - id: dup
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
    """), encoding="utf-8")
    result = _run(tmp_path / "memory")
    assert result.returncode == 1
    assert "duplicate id 'dup'" in result.stdout


def test_credential_redaction_fails(tmp_path):
    root = _write(tmp_path, "domain-invariants", """
        version: 1
        entries:
          - id: ok
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
            rule: "api_key=sk-1234567890abcdef"
        """)
    result = _run(root)
    assert result.returncode == 1
    assert "inline credential" in result.stdout


def test_stale_entry_is_info_not_error(tmp_path):
    root = _write(tmp_path, "domain-invariants", """
        version: 1
        entries:
          - id: stale
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2020-01-01
            review_after_days: 90
        """)
    result = _run(root)
    assert result.returncode == 0
    assert "stale:" in result.stdout


def test_missing_path_is_not_error(tmp_path):
    result = _run(tmp_path / "does-not-exist")
    assert result.returncode == 0


def test_yaml_parse_error_is_reported(tmp_path):
    root = tmp_path / "memory" / "domain-invariants"
    root.mkdir(parents=True)
    (root / "broken.yml").write_text("entries: [\nnot valid yaml: `bad\n", encoding="utf-8")
    result = _run(tmp_path / "memory")
    assert result.returncode == 1
    assert "YAML parse error" in result.stdout


def test_json_format_output(tmp_path):
    root = _write(tmp_path, "domain-invariants", """
        version: 1
        entries:
          - id: bad
            status: wrong
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
        """)
    result = _run(root, fmt="json")
    assert result.returncode == 1
    import json as _json
    payload = _json.loads(result.stdout)
    assert any("invalid status" in f["message"] for f in payload["findings"])



# --- append-only mode ---------------------------------------------------------


def _git_init_repo(tmp_path: Path) -> None:
    import subprocess as sp
    sp.run(["git", "init", "-q", "-b", "main"], cwd=tmp_path, check=True)
    sp.run(["git", "config", "user.email", "t@e.x"], cwd=tmp_path, check=True)
    sp.run(["git", "config", "user.name", "t"], cwd=tmp_path, check=True)
    sp.run(["git", "config", "commit.gpgsign", "false"], cwd=tmp_path, check=True)


def _git_commit_all(tmp_path: Path, msg: str) -> None:
    import subprocess as sp
    sp.run(["git", "add", "-A"], cwd=tmp_path, check=True)
    sp.run(["git", "commit", "-q", "-m", msg], cwd=tmp_path, check=True)


def _run_append_only(tmp_path: Path, base: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["python3", str(SCRIPT.resolve()), "--append-only", "--base", base],
        capture_output=True, text=True, cwd=tmp_path,
    )


def test_append_only_appending_is_clean(tmp_path):
    _git_init_repo(tmp_path)
    intake = tmp_path / "agents" / "memory" / "intake"
    intake.mkdir(parents=True)
    jsonl = intake / "learnings.jsonl"
    jsonl.write_text('{"id":"a","ts":"2026-01-01T00:00Z","type":"learning"}\n')
    _git_commit_all(tmp_path, "base")
    # Append a new line — this is allowed.
    with jsonl.open("a") as fh:
        fh.write('{"id":"b","ts":"2026-01-02T00:00Z","type":"learning"}\n')
    _git_commit_all(tmp_path, "append")
    result = _run_append_only(tmp_path, "HEAD~1")
    assert result.returncode == 0, result.stdout + result.stderr
    assert "append-only violation" not in result.stdout


def test_append_only_in_place_edit_fails(tmp_path):
    _git_init_repo(tmp_path)
    intake = tmp_path / "agents" / "memory" / "intake"
    intake.mkdir(parents=True)
    jsonl = intake / "learnings.jsonl"
    jsonl.write_text(
        '{"id":"a","ts":"2026-01-01T00:00Z","type":"learning"}\n'
        '{"id":"b","ts":"2026-01-02T00:00Z","type":"learning"}\n'
    )
    _git_commit_all(tmp_path, "base")
    # Modify an existing line — MUST fail the check.
    jsonl.write_text(
        '{"id":"a","ts":"2026-01-01T00:00Z","type":"MODIFIED"}\n'
        '{"id":"b","ts":"2026-01-02T00:00Z","type":"learning"}\n'
    )
    _git_commit_all(tmp_path, "mutate")
    result = _run_append_only(tmp_path, "HEAD~1")
    assert result.returncode == 1, result.stdout + result.stderr
    assert "append-only violation" in result.stdout


def test_append_only_deletion_fails(tmp_path):
    _git_init_repo(tmp_path)
    intake = tmp_path / "agents" / "memory" / "intake"
    intake.mkdir(parents=True)
    jsonl = intake / "learnings.jsonl"
    jsonl.write_text(
        '{"id":"a","ts":"2026-01-01T00:00Z","type":"learning"}\n'
        '{"id":"b","ts":"2026-01-02T00:00Z","type":"learning"}\n'
    )
    _git_commit_all(tmp_path, "base")
    # Delete a line — MUST fail the check.
    jsonl.write_text(
        '{"id":"b","ts":"2026-01-02T00:00Z","type":"learning"}\n'
    )
    _git_commit_all(tmp_path, "shrink")
    result = _run_append_only(tmp_path, "HEAD~1")
    assert result.returncode == 1
    assert "append-only violation" in result.stdout


def test_append_only_new_file_is_clean(tmp_path):
    _git_init_repo(tmp_path)
    (tmp_path / "README.md").write_text("init\n")
    _git_commit_all(tmp_path, "init")
    intake = tmp_path / "agents" / "memory" / "intake"
    intake.mkdir(parents=True)
    (intake / "learnings.jsonl").write_text(
        '{"id":"a","ts":"2026-01-01T00:00Z","type":"learning"}\n'
    )
    _git_commit_all(tmp_path, "new-intake")
    result = _run_append_only(tmp_path, "HEAD~1")
    assert result.returncode == 0, result.stdout + result.stderr
    assert "append-only violation" not in result.stdout
