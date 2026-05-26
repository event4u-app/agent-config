#!/usr/bin/env python3
"""Lint `.agent-config/orchestrations/*.yaml` pipeline files.

CI gate for the orchestration DSL contract
(`docs/contracts/orchestration-dsl-v1.md`). Hard-fails on:

- missing or malformed top-level keys
  (`schema_version`, `name`, `description`, `steps`)
- `schema_version != 1`
- `name` not matching `[a-z][a-z0-9-]*` or not matching the filename
- duplicate `steps[].id`
- `steps[].kind` outside the enum (`skill` / `command` / `persona` /
  `subagent`)
- `steps[].ref` pointing at a non-existent target on disk
- `${{ ... }}` reference to an unknown input or step id
- `steps[]` length outside [1, 32]
- `outputs` referencing an unknown step

Exit codes mirror `lint_hook_manifest.py`:
  0 — clean
  1 — at least one hard failure
  2 — file or schema-load error

Invocation:

    python3 scripts/lint_orchestration_dsl.py [--dir PATH] [--file PATH]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib.agent_src import resolve_logical  # noqa: E402

DEFAULT_DIR = REPO_ROOT / ".agent-config" / "orchestrations"

NAME_RE = re.compile(r"^[a-z][a-z0-9-]*$")
STEP_ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")
INTERP_RE = re.compile(r"\$\{\{\s*(inputs|steps)\.([a-z0-9_-]+)(?:\.output)?\s*\}\}")

VALID_KINDS = {"skill", "command", "persona", "subagent"}
MAX_STEPS = 32
MIN_STEPS = 1

# Subagent-orchestration modes — kept in lock-step with
# .agent-src.uncondensed/skills/subagent-orchestration/SKILL.md.
SUBAGENT_MODES = {
    "do-and-judge", "do-and-judge-two-stage",
    "do-in-steps", "do-in-parallel", "do-in-worktrees",
    "do-competitively", "judge-with-debate",
}


def _load_yaml(path: Path) -> object:
    """Reuse the dispatcher's loader so the linter sees what the
    runtime sees — fallback parser when PyYAML is not installed."""
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from hooks.dispatch_hook import _load_yaml as _load  # noqa: E402
    return _load(path)


def _ref_exists(kind: str, ref: str) -> bool:
    if kind == "skill":
        return resolve_logical(f"skills/{ref}/SKILL.md") is not None
    if kind == "command":
        return resolve_logical(f"commands/{ref}.md") is not None
    if kind == "persona":
        return resolve_logical(f"personas/{ref}.md") is not None
    if kind == "subagent":
        return ref in SUBAGENT_MODES
    return False


def _walk_interpolations(value: object):
    """Yield (namespace, ident) tuples for every ${{ ns.ident }} in the
    nested value (dict / list / str)."""
    if isinstance(value, str):
        for match in INTERP_RE.finditer(value):
            yield match.group(1), match.group(2)
    elif isinstance(value, dict):
        for v in value.values():
            yield from _walk_interpolations(v)
    elif isinstance(value, list):
        for v in value:
            yield from _walk_interpolations(v)


def _check_unknown_namespaces(value: object, path: str, errors: list[str]) -> None:
    if isinstance(value, str):
        for match in re.finditer(r"\$\{\{\s*([a-z]+)\.", value):
            if match.group(1) not in ("inputs", "steps"):
                errors.append(f"{path}: unknown interpolation namespace '{match.group(1)}'")
    elif isinstance(value, dict):
        for k, v in value.items():
            _check_unknown_namespaces(v, f"{path}.{k}", errors)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _check_unknown_namespaces(v, f"{path}[{i}]", errors)


def _check_steps(doc: dict, input_ids: set[str], errors: list[str]) -> set[str]:
    steps = doc.get("steps")
    if not isinstance(steps, list) or not (MIN_STEPS <= len(steps) <= MAX_STEPS):
        errors.append(f"steps: must be a list of {MIN_STEPS}–{MAX_STEPS} entries")
        return set()
    step_ids: set[str] = set()
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            errors.append(f"steps[{i}]: must be a mapping")
            continue
        sid = step.get("id")
        if not isinstance(sid, str) or not STEP_ID_RE.match(sid):
            errors.append(f"steps[{i}].id: must be snake-case identifier")
            continue
        if sid in step_ids:
            errors.append(f"steps[{i}].id: duplicate id '{sid}'")
            continue
        step_ids.add(sid)
        kind = step.get("kind")
        ref = step.get("ref")
        if kind not in VALID_KINDS:
            errors.append(f"steps.{sid}.kind: must be one of {sorted(VALID_KINDS)}")
            continue
        if not isinstance(ref, str) or not _ref_exists(kind, ref):
            errors.append(f"steps.{sid}.ref: {kind} '{ref}' not found on disk")
        _check_unknown_namespaces(step.get("with"), f"steps.{sid}.with", errors)
        for ns, ident in _walk_interpolations(step.get("with") or {}):
            if ns == "inputs" and ident not in input_ids:
                errors.append(f"steps.{sid}.with: unknown input '{ident}'")
            if ns == "steps" and ident not in step_ids - {sid}:
                errors.append(f"steps.{sid}.with: unknown step '{ident}' (forward ref or self)")
    return step_ids



def _check_outputs(doc: dict, step_ids: set[str], input_ids: set[str], errors: list[str]) -> None:
    outputs = doc.get("outputs")
    if outputs is None:
        return
    if not isinstance(outputs, dict):
        errors.append("outputs: must be a mapping")
        return
    for name, value in outputs.items():
        for ns, ident in _walk_interpolations(value):
            if ns == "steps" and ident not in step_ids:
                errors.append(f"outputs.{name}: unknown step '{ident}'")
            if ns == "inputs" and ident not in input_ids:
                errors.append(f"outputs.{name}: unknown input '{ident}'")


def _check_inputs(doc: dict, errors: list[str]) -> set[str]:
    inputs = doc.get("inputs") or []
    if not isinstance(inputs, list):
        errors.append("inputs: must be a list")
        return set()
    ids: set[str] = set()
    for i, inp in enumerate(inputs):
        if not isinstance(inp, dict) or not isinstance(inp.get("id"), str):
            errors.append(f"inputs[{i}]: must be a mapping with string 'id'")
            continue
        if inp["id"] in ids:
            errors.append(f"inputs[{i}].id: duplicate id '{inp['id']}'")
        ids.add(inp["id"])
    return ids


def lint(path: Path) -> int:
    try:
        doc = _load_yaml(path)
    except Exception as exc:
        sys.stderr.write(f"lint_orchestration_dsl: load error: {exc}\n")
        return 2
    if not isinstance(doc, dict):
        sys.stderr.write(f"{path}: top-level must be a mapping\n")
        return 1

    errors: list[str] = []
    if doc.get("schema_version") != 1:
        errors.append("schema_version: must be 1")
    name = doc.get("name")
    if not isinstance(name, str) or not NAME_RE.match(name):
        errors.append("name: must be kebab-case starting with a letter")
    elif name != path.stem:
        errors.append(f"name: '{name}' must match filename stem '{path.stem}'")
    if not isinstance(doc.get("description"), str) or not doc["description"].strip():
        errors.append("description: must be a non-empty string")

    input_ids = _check_inputs(doc, errors)
    step_ids = _check_steps(doc, input_ids, errors)
    _check_outputs(doc, step_ids, input_ids, errors)

    for e in errors:
        sys.stderr.write(f"error: {path}: {e}\n")
    return 1 if errors else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", type=Path, default=DEFAULT_DIR)
    parser.add_argument("--file", type=Path, default=None)
    args = parser.parse_args(argv)
    if args.file is not None:
        return lint(args.file)
    if not args.dir.is_dir():
        return 0  # opt-in directory; absence is not a failure
    rc = 0
    for path in sorted(args.dir.glob("*.yaml")):
        rc = max(rc, lint(path))
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
