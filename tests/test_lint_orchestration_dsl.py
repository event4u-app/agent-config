"""Tests for scripts/lint_orchestration_dsl.py.

Covers the orchestration DSL contract
(docs/contracts/orchestration-dsl-v1.md): top-level shape, name vs
filename, step kinds and ref resolution, interpolation namespaces,
duplicate ids, and exit-code behaviour.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import lint_orchestration_dsl as mod  # noqa: E402


VALID_PIPELINE = """\
schema_version: 1
name: smoke-pipeline
description: |
  Smoke pipeline for the linter test suite.
inputs:
  - id: target
    description: Diff target.
    default: origin/main
steps:
  - id: review
    kind: skill
    ref: skill-reviewer
    with:
      target: ${{ inputs.target }}
outputs:
  report: ${{ steps.review.output }}
"""


def _write(tmp_path: Path, body: str, name: str = "smoke-pipeline.yaml") -> Path:
    p = tmp_path / name
    p.write_text(body, encoding="utf-8")
    return p


def test_missing_directory_is_clean(tmp_path: Path):
    assert mod.main(["--dir", str(tmp_path / "nope")]) == 0


def test_valid_pipeline_passes(tmp_path: Path):
    p = _write(tmp_path, VALID_PIPELINE)
    assert mod.lint(p) == 0


def test_wrong_schema_version_fails(tmp_path: Path):
    body = VALID_PIPELINE.replace("schema_version: 1", "schema_version: 2")
    p = _write(tmp_path, body)
    assert mod.lint(p) == 1


def test_name_must_match_filename(tmp_path: Path):
    p = _write(tmp_path, VALID_PIPELINE, name="other-name.yaml")
    assert mod.lint(p) == 1


def test_duplicate_step_id_fails(tmp_path: Path):
    body = """\
schema_version: 1
name: dup-pipeline
description: dup
steps:
  - id: review
    kind: skill
    ref: skill-reviewer
  - id: review
    kind: skill
    ref: skill-reviewer
"""
    p = tmp_path / "dup-pipeline.yaml"
    p.write_text(body, encoding="utf-8")
    assert mod.lint(p) == 1


def test_unknown_kind_fails(tmp_path: Path):
    body = VALID_PIPELINE.replace("kind: skill", "kind: wizard")
    p = _write(tmp_path, body)
    assert mod.lint(p) == 1


def test_missing_skill_ref_fails(tmp_path: Path):
    body = VALID_PIPELINE.replace("ref: skill-reviewer", "ref: not-a-skill")
    p = _write(tmp_path, body)
    assert mod.lint(p) == 1


def test_unknown_input_interpolation_fails(tmp_path: Path):
    body = VALID_PIPELINE.replace("${{ inputs.target }}", "${{ inputs.nope }}")
    p = _write(tmp_path, body)
    assert mod.lint(p) == 1


def test_unknown_output_step_fails(tmp_path: Path):
    body = VALID_PIPELINE.replace(
        "${{ steps.review.output }}", "${{ steps.ghost.output }}"
    )
    p = _write(tmp_path, body)
    assert mod.lint(p) == 1


def test_unknown_namespace_fails(tmp_path: Path):
    body = VALID_PIPELINE.replace("${{ inputs.target }}", "${{ env.PATH }}")
    p = _write(tmp_path, body)
    assert mod.lint(p) == 1


def test_subagent_mode_accepted(tmp_path: Path):
    body = """\
schema_version: 1
name: subagent-pipeline
description: subagent smoke
steps:
  - id: judge
    kind: subagent
    ref: do-and-judge
"""
    p = tmp_path / "subagent-pipeline.yaml"
    p.write_text(body, encoding="utf-8")
    assert mod.lint(p) == 0


def test_bad_subagent_mode_fails(tmp_path: Path):
    body = """\
schema_version: 1
name: bad-subagent
description: bad
steps:
  - id: judge
    kind: subagent
    ref: do-something-imaginary
"""
    p = tmp_path / "bad-subagent.yaml"
    p.write_text(body, encoding="utf-8")
    assert mod.lint(p) == 1
