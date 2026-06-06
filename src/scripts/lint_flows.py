#!/usr/bin/env python3
"""Validate-on-load linter for the first-class flow layer (``src/flows/*.yaml``).

road-to-6.1.0 Step 8b (ADR-055). Two checks per flow file, mirroring the
shape-vs-resolution split that ``validate_pack_yaml.py`` uses for pack manifests:

1. **Shape** — the file validates against
   ``src/scripts/schemas/flow.schema.json`` (Draft-07, via ``jsonschema``).
2. **References resolve** — every ``entry_points`` / ``default_path`` /
   ``commands`` entry backs a real command (``resolve_logical("commands/<ref>.md")``);
   every ``skills`` slug backs a real ``skills/<slug>/SKILL.md``.

Plus two layer-level invariants:

3. **Closed set** — the flow ``id`` is one of the four curated user-work flows
   ``{discovery, implementation, review, delivery}`` and equals the filename
   stem. A new flow is a governance decision (ADR), not a free addition.
4. **Completeness** — every id in the closed set has exactly one file.

Exit codes: 0 = clean · 1 = violations found · 3 = internal error.

Usage:
    python3 scripts/lint_flows.py
    python3 scripts/lint_flows.py --quiet
"""
from __future__ import annotations

import argparse
import difflib
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import resolve_logical  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FLOWS_DIR = ROOT / "src" / "flows"
SCHEMA_PATH = ROOT / "src" / "scripts" / "schemas" / "flow.schema.json"

# The closed, curated user-work flow set (src/flows/README.md). agent-admin is
# deliberately NOT a flow (feedback-6): it is the platform/system surface, not a
# user-work journey. Growing this set is an ADR-gated governance decision.
CLOSED_FLOWS = {"discovery", "implementation", "review", "delivery"}

# Companion files under src/flows/ that are NOT flow definitions (validated by
# their own linters). surface-map.yaml = the command→flow classification index
# (road-to-6.1.0 Step 9), checked by scripts/lint_command_flow_coverage.py.
_NON_FLOW_FILES = {"surface-map.yaml"}

_REF_FIELDS = ("entry_points", "default_path", "commands")


@dataclass
class Violation:
    file: str
    reason: str


def _load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _command_exists(ref: str) -> bool:
    return resolve_logical(f"commands/{ref}.md") is not None


def _skill_exists(slug: str) -> bool:
    return resolve_logical(f"skills/{slug}/SKILL.md") is not None


def _known_command_refs() -> set[str]:
    """Best-effort universe of logical command refs for "did you mean?" hints.

    Resolution (``resolve_logical``) stays the source of truth for pass/fail;
    this set only feeds suggestions on a miss, so a command that lives outside
    ``.agent-src/commands/`` is never a false failure — it simply won't be
    proposed as a near-match.
    """
    base = ROOT / ".agent-src" / "commands"
    if not base.is_dir():
        return set()
    return {
        str(p.relative_to(base).with_suffix("")).replace("\\", "/")
        for p in base.rglob("*.md")
    }


def _known_skill_slugs() -> set[str]:
    base = ROOT / "src" / "skills"
    if not base.is_dir():
        return set()
    return {d.name for d in base.iterdir() if (d / "SKILL.md").is_file()}


def _suggest(ref: str, universe: set[str]) -> str:
    """Return a `` — did you mean 'X'?`` hint, or '' if no close match."""
    match = difflib.get_close_matches(ref, sorted(universe), n=1, cutoff=0.6)
    return f" — did you mean '{match[0]}'?" if match else ""


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)  # e.g. a sandboxed tmp dir in tests


def _check_file(path: Path, validator, known_cmds: set[str],
                known_skills: set[str]) -> list[Violation]:
    rel = _rel(path)
    vios: list[Violation] = []

    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        return [Violation(rel, f"not valid YAML: {exc}")]
    if not isinstance(data, dict):
        return [Violation(rel, "top-level YAML must be a mapping")]

    # 1. Shape
    for err in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        loc = "/".join(str(p) for p in err.path) or "(root)"
        vios.append(Violation(rel, f"schema: {loc}: {err.message}"))

    # 3. Closed set + id == stem
    flow_id = data.get("id")
    stem = path.stem
    if flow_id != stem:
        vios.append(Violation(rel, f"id '{flow_id}' must equal filename stem '{stem}'"))
    if flow_id not in CLOSED_FLOWS:
        vios.append(
            Violation(rel, f"id '{flow_id}' not in the closed flow set "
                           f"{sorted(CLOSED_FLOWS)} — a new flow needs an ADR")
        )

    # 2. References resolve (partial validation — each bad ref is its own
    #    violation, not a single generic "flow invalid"; misses carry a hint).
    for field in _REF_FIELDS:
        for ref in data.get(field) or []:
            if isinstance(ref, str) and not _command_exists(ref):
                vios.append(Violation(rel, f"{field}: command '{ref}' does not resolve "
                                           f"(no commands/{ref}.md)"
                                           f"{_suggest(ref, known_cmds)}"))
    for slug in data.get("skills") or []:
        if isinstance(slug, str) and not _skill_exists(slug):
            vios.append(Violation(rel, f"skills: skill '{slug}' does not resolve "
                                       f"(no skills/{slug}/SKILL.md)"
                                       f"{_suggest(slug, known_skills)}"))
    return vios


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate src/flows/*.yaml.")
    parser.add_argument("--quiet", action="store_true", help="Only print on failure.")
    args = parser.parse_args(argv)

    if not FLOWS_DIR.is_dir():
        print(f"flows dir not found: {FLOWS_DIR}", file=sys.stderr)
        return 3
    if not SCHEMA_PATH.is_file():
        print(f"schema not found: {SCHEMA_PATH}", file=sys.stderr)
        return 3

    try:
        import jsonschema
    except ImportError:
        print("lint_flows: jsonschema not installed", file=sys.stderr)
        return 3

    try:
        schema = _load_schema()
        validator = jsonschema.Draft7Validator(schema)
        known_cmds = _known_command_refs()
        known_skills = _known_skill_slugs()
        # surface-map.yaml is the companion command→flow classification index
        # (road-to-6.1.0 Step 9), NOT a flow file — it is validated by
        # scripts/lint_command_flow_coverage.py instead.
        files = sorted(
            p for p in FLOWS_DIR.glob("*.yaml") if p.name not in _NON_FLOW_FILES
        )
        vios: list[Violation] = []
        seen_ids: set[str] = set()
        for path in files:
            vios.extend(_check_file(path, validator, known_cmds, known_skills))
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("id"), str):
                seen_ids.add(data["id"])

        # 4. Completeness — every closed-set flow has a file
        missing = CLOSED_FLOWS - seen_ids
        for flow_id in sorted(missing):
            vios.append(Violation(f"src/flows/{flow_id}.yaml",
                                  f"closed-set flow '{flow_id}' has no file"))
    except Exception as exc:  # noqa: BLE001 — surface as internal error, exit 3
        print(f"lint_flows: internal error: {exc}", file=sys.stderr)
        return 3

    if vios:
        print(f"lint_flows: {len(vios)} violation(s):", file=sys.stderr)
        for v in vios:
            print(f"  {v.file}: {v.reason}", file=sys.stderr)
        return 1

    if not args.quiet:
        print(f"lint_flows: OK — {len(files)} flow file(s), "
              f"{len(CLOSED_FLOWS)} closed-set flows all present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
