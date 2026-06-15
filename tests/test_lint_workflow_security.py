"""Tests for src/scripts/lint_workflow_security.py."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "lint_workflow_security",
    REPO_ROOT / "src" / "scripts" / "lint_workflow_security.py",
)
assert SPEC and SPEC.loader
lws = importlib.util.module_from_spec(SPEC)
sys.modules["lint_workflow_security"] = lws
SPEC.loader.exec_module(lws)


# ---------------------------------------------------------------------------
# Helper: write a minimal workflow fixture
# ---------------------------------------------------------------------------

def _write_workflow(tmp_path: Path, name: str, content: str) -> Path:
    wf_dir = tmp_path / ".github" / "workflows"
    wf_dir.mkdir(parents=True, exist_ok=True)
    p = wf_dir / name
    p.write_text(content, encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# 1. Real workflows scan exits 0 in default mode
# ---------------------------------------------------------------------------

def test_real_workflows_exit_zero():
    """The committed workflows must produce no HIGH findings in warn-only mode."""
    rc = lws.main(["--quiet"])
    assert rc == 0, "lint_workflow_security default mode must always exit 0"


# ---------------------------------------------------------------------------
# 2. Fixture HIGH detections
# ---------------------------------------------------------------------------

def test_detects_dangerous_trigger_untrusted_ref(tmp_path: Path, monkeypatch):
    """pull_request_target + checkout of untrusted ref is flagged HIGH."""
    _write_workflow(
        tmp_path,
        "pwn.yml",
        """
on:
  pull_request_target:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
""",
    )
    monkeypatch.setattr(lws, "WORKFLOWS_DIR", tmp_path / ".github" / "workflows")
    monkeypatch.setattr(lws, "ALLOWLIST_PATH", tmp_path / "no_allowlist.json")
    findings = lws.scan_workflow(tmp_path / ".github" / "workflows" / "pwn.yml", [])
    high = [f for f in findings if f["severity"] == "HIGH" and f["rule"] == "dangerous-trigger-untrusted-ref"]
    assert high, f"Expected HIGH dangerous-trigger-untrusted-ref finding, got: {findings}"


def test_detects_permissions_write_all(tmp_path: Path):
    """permissions: write-all at the workflow level is flagged HIGH."""
    wf = _write_workflow(
        tmp_path,
        "write_all.yml",
        """
on: push
permissions: write-all
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
""",
    )
    findings = lws.scan_workflow(wf, [])
    high = [f for f in findings if f["severity"] == "HIGH" and f["rule"] == "permissions-write-all"]
    assert high, f"Expected HIGH permissions-write-all finding, got: {findings}"


def test_detects_npm_without_ignore_scripts_in_prt(tmp_path: Path):
    """npm ci without --ignore-scripts inside pull_request_target is flagged HIGH."""
    wf = _write_workflow(
        tmp_path,
        "npm_prt.yml",
        """
on:
  pull_request_target:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
""",
    )
    findings = lws.scan_workflow(wf, [])
    high = [f for f in findings if f["severity"] == "HIGH" and f["rule"] == "npm-install-without-ignore-scripts"]
    assert high, f"Expected HIGH npm-install-without-ignore-scripts finding, got: {findings}"


def test_detects_mutable_third_party_action(tmp_path: Path):
    """A third-party action pinned by mutable tag is flagged MEDIUM."""
    wf = _write_workflow(
        tmp_path,
        "mutable.yml",
        """
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: some-org/some-action@v3
""",
    )
    findings = lws.scan_workflow(wf, [])
    medium = [f for f in findings if f["severity"] == "MEDIUM" and f["rule"] == "mutable-action-tag"]
    assert medium, f"Expected MEDIUM mutable-action-tag finding, got: {findings}"


def test_first_party_action_not_flagged(tmp_path: Path):
    """First-party actions/* with mutable tags are NOT flagged."""
    wf = _write_workflow(
        tmp_path,
        "first_party.yml",
        """
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
""",
    )
    findings = lws.scan_workflow(wf, [])
    medium = [f for f in findings if f["severity"] == "MEDIUM"]
    assert not medium, f"First-party actions should not be flagged, got: {findings}"


def test_sha_pinned_action_not_flagged(tmp_path: Path):
    """A third-party action pinned to a full 40-char SHA is NOT flagged."""
    sha = "a" * 40
    wf = _write_workflow(
        tmp_path,
        "sha_pinned.yml",
        f"""
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: some-org/some-action@{sha}
""",
    )
    findings = lws.scan_workflow(wf, [])
    medium = [f for f in findings if f["severity"] == "MEDIUM"]
    assert not medium, f"SHA-pinned action should not be flagged, got: {findings}"


# ---------------------------------------------------------------------------
# 3. Clean fixture passes
# ---------------------------------------------------------------------------

def test_clean_workflow_no_findings(tmp_path: Path):
    """A well-written workflow with no security issues produces no findings."""
    sha = "b" * 40
    wf = _write_workflow(
        tmp_path,
        "clean.yml",
        f"""
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: some-org/some-action@{sha}
      - run: npm ci --ignore-scripts
""",
    )
    findings = lws.scan_workflow(wf, [])
    assert not findings, f"Clean workflow should produce no findings, got: {findings}"


# ---------------------------------------------------------------------------
# 4. Allowlist suppresses a finding
# ---------------------------------------------------------------------------

def test_allowlist_suppresses_medium_finding(tmp_path: Path):
    """An entry in the allowlist marks the matching finding as allowlisted."""
    wf = _write_workflow(
        tmp_path,
        "mutable.yml",
        """
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: some-org/some-action@v3
""",
    )
    allowlist = [{"workflow": "mutable.yml", "rule": "mutable-action-tag", "reason": "test"}]
    findings = lws.scan_workflow(wf, allowlist)
    assert findings, "Finding should still be present"
    assert all(f.get("allowlisted") for f in findings), (
        f"All findings should be allowlisted, got: {findings}"
    )


def test_allowlist_cap_raises(tmp_path: Path, monkeypatch):
    """An allowlist with > 20 entries raises SystemExit(2)."""
    al_path = tmp_path / "allowlist.json"
    entries = [{"workflow": f"wf{i}.yml", "rule": "mutable-action-tag", "reason": "x"} for i in range(21)]
    al_path.write_text(json.dumps({"findings": entries}), encoding="utf-8")
    monkeypatch.setattr(lws, "ALLOWLIST_PATH", al_path)
    with pytest.raises(SystemExit) as exc_info:
        lws.load_allowlist()
    assert exc_info.value.code == 2


# ---------------------------------------------------------------------------
# 5. --strict exits 1 on HIGH findings
# ---------------------------------------------------------------------------

def test_strict_exits_1_on_high(tmp_path: Path, monkeypatch):
    """--strict exits 1 when there are non-allowlisted HIGH findings."""
    _write_workflow(
        tmp_path,
        "pwn.yml",
        """
on:
  pull_request_target:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
""",
    )
    monkeypatch.setattr(lws, "WORKFLOWS_DIR", tmp_path / ".github" / "workflows")
    monkeypatch.setattr(lws, "ALLOWLIST_PATH", tmp_path / "no_allowlist.json")
    rc = lws.main(["--strict", "--quiet"])
    assert rc == 1, f"Expected exit 1 in --strict mode with HIGH findings, got {rc}"


def test_strict_exits_0_when_no_high(tmp_path: Path, monkeypatch):
    """--strict exits 0 when there are only MEDIUM findings."""
    _write_workflow(
        tmp_path,
        "mutable.yml",
        """
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: some-org/some-action@v3
""",
    )
    monkeypatch.setattr(lws, "WORKFLOWS_DIR", tmp_path / ".github" / "workflows")
    monkeypatch.setattr(lws, "ALLOWLIST_PATH", tmp_path / "no_allowlist.json")
    rc = lws.main(["--strict", "--quiet"])
    assert rc == 0, f"Expected exit 0 in --strict mode with only MEDIUM findings, got {rc}"


def test_default_mode_exits_0_even_with_high(tmp_path: Path, monkeypatch):
    """Without --strict, HIGH findings still result in exit 0 (warn-only)."""
    _write_workflow(
        tmp_path,
        "pwn.yml",
        """
on:
  pull_request_target:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}
""",
    )
    monkeypatch.setattr(lws, "WORKFLOWS_DIR", tmp_path / ".github" / "workflows")
    monkeypatch.setattr(lws, "ALLOWLIST_PATH", tmp_path / "no_allowlist.json")
    rc = lws.main(["--quiet"])
    assert rc == 0, f"Default mode must always exit 0, got {rc}"
