"""Tests for the ``/orchestrate`` state-machine stub
(``work_engine.orchestration``).

Covers pipeline iteration, interpolation, ``when`` guards, halt-on-
failure, and output resolution against the contract in
``docs/contracts/orchestration-dsl-v1.md``.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from work_engine import orchestration


PIPELINE = """\
schema_version: 1
name: smoke-pipeline
description: Smoke pipeline for orchestration state-machine tests.
inputs:
  - id: target
    description: Diff target.
    default: origin/main
steps:
  - id: first
    kind: skill
    ref: skill-reviewer
    with:
      target: ${{ inputs.target }}
  - id: second
    kind: skill
    ref: skill-reviewer
    with:
      previous: ${{ steps.first.output }}
outputs:
  report: ${{ steps.second.output }}
"""


@pytest.fixture
def pipeline_file(tmp_path: Path) -> Path:
    p = tmp_path / "smoke-pipeline.yaml"
    p.write_text(PIPELINE, encoding="utf-8")
    return p


def test_iter_steps_yields_in_order(pipeline_file: Path):
    ids: list[str] = []
    it = orchestration.iter_steps(pipeline_file, inputs={})
    for descriptor in it:
        ids.append(descriptor["id"])
        orchestration.record_result(descriptor, success=True, output="ok")
    assert ids == ["first", "second"]


def test_default_input_used_when_missing(pipeline_file: Path):
    first = next(orchestration.iter_steps(pipeline_file, inputs={}))
    assert first["with"]["target"] == "origin/main"


def test_explicit_input_overrides_default(pipeline_file: Path):
    first = next(orchestration.iter_steps(pipeline_file, inputs={"target": "feature/x"}))
    assert first["with"]["target"] == "feature/x"


def test_step_output_interpolation(pipeline_file: Path):
    it = orchestration.iter_steps(pipeline_file, inputs={})
    first = next(it)
    orchestration.record_result(first, success=True, output="hello")
    second = next(it)
    assert second["with"]["previous"] == "hello"


def test_failure_halts_pipeline(pipeline_file: Path):
    it = orchestration.iter_steps(pipeline_file, inputs={})
    first = next(it)
    orchestration.record_result(first, success=False, error="boom")
    with pytest.raises(StopIteration):
        next(it)


def test_resolve_outputs(pipeline_file: Path):
    it = orchestration.iter_steps(pipeline_file, inputs={})
    first = next(it)
    orchestration.record_result(first, success=True, output="a")
    second = next(it)
    orchestration.record_result(second, success=True, output="final")
    state = second["_state"]
    outputs = orchestration.resolve_outputs(pipeline_file, state)
    assert outputs == {"report": "final"}


def test_when_success_guard_runs(tmp_path: Path):
    body = """\
schema_version: 1
name: guarded
description: guarded pipeline
steps:
  - id: a
    kind: skill
    ref: skill-reviewer
  - id: b
    kind: skill
    ref: skill-reviewer
    when: steps.a.success
"""
    p = tmp_path / "guarded.yaml"
    p.write_text(body, encoding="utf-8")
    it = orchestration.iter_steps(p, inputs={})
    a = next(it)
    orchestration.record_result(a, success=True, output="ok")
    b = next(it)
    assert b["id"] == "b"


def test_when_failure_guard_skips_on_success(tmp_path: Path):
    body = """\
schema_version: 1
name: guarded-skip
description: guarded skip pipeline
steps:
  - id: a
    kind: skill
    ref: skill-reviewer
  - id: b
    kind: skill
    ref: skill-reviewer
    when: steps.a.failure
"""
    p = tmp_path / "guarded-skip.yaml"
    p.write_text(body, encoding="utf-8")
    it = orchestration.iter_steps(p, inputs={})
    a = next(it)
    orchestration.record_result(a, success=True, output="ok")
    with pytest.raises(StopIteration):
        next(it)


def test_unsupported_when_raises(tmp_path: Path):
    body = """\
schema_version: 1
name: bad-when
description: bad
steps:
  - id: a
    kind: skill
    ref: skill-reviewer
  - id: b
    kind: skill
    ref: skill-reviewer
    when: steps.a.output ~ /foo/
"""
    p = tmp_path / "bad-when.yaml"
    p.write_text(body, encoding="utf-8")
    it = orchestration.iter_steps(p, inputs={})
    a = next(it)
    orchestration.record_result(a, success=True, output="ok")
    with pytest.raises(ValueError):
        next(it)
