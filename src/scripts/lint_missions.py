"""lint_missions — WARN-ONLY mission manifest and catalog linter.

Validates every src/missions/*/mission.yaml against mission.schema.json
and every catalog referenced by those manifests against
mission-catalog.schema.json.  Also enforces the command-prefix allowlist on
every `command:` field found in catalog entries.

Default mode always exits 0 (warn-only).  Pass --strict to exit 1 on any
ERROR finding (future CI-gate promotion path), matching the repo's pattern
established in lint_workflow_security.py.

Additionally exposes a --check-precondition mode (stub) that documents and
partially implements the single-mission-per-branch guard: before a mission
runs on a real repository, confirm no other mission branch is already active
and the target baseline is clean.  The live-repo check (git invocation) is
documented but left as a stub pending Phase 1 PoC integration.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("PyYAML is required.  Run: pip install pyyaml", file=sys.stderr)
    raise SystemExit(1)

try:
    import jsonschema
except ImportError:
    print("jsonschema is required.  Run: pip install jsonschema", file=sys.stderr)
    raise SystemExit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCHEMAS_DIR = Path(__file__).resolve().parent / "schemas"
MISSIONS_ROOT = REPO_ROOT / "src" / "missions"

MISSION_SCHEMA_PATH = SCHEMAS_DIR / "mission.schema.json"
CATALOG_SCHEMA_PATH = SCHEMAS_DIR / "mission-catalog.schema.json"

# ---------------------------------------------------------------------------
# Safe-command allowlist (mirrors mission-catalog.schema.json definition)
# ---------------------------------------------------------------------------
SAFE_COMMAND_RE = re.compile(
    r"^(composer|php|php artisan|git|sed|rector|vendor/bin/[a-zA-Z0-9._/-]+)( .+)?$"
)


def _is_safe_command(cmd: str) -> bool:
    """Return True if cmd matches the safe-prefix allowlist."""
    return bool(SAFE_COMMAND_RE.match(cmd.strip()))


# ---------------------------------------------------------------------------
# Schema loading
# ---------------------------------------------------------------------------

def _load_schema(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    return json.loads(raw)


def _rel(path: Path) -> str:
    """Return path relative to REPO_ROOT when possible; otherwise absolute string.

    Falls back gracefully when *path* is in a temp directory (e.g. during tests).
    """
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def _validate_yaml_against_schema(data: dict, schema: dict, label: str) -> list[dict]:
    """Validate *data* against *schema*.  Returns a list of ERROR finding dicts."""
    findings: list[dict] = []
    validator = jsonschema.Draft7Validator(schema)
    for error in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        findings.append({
            "severity": "ERROR",
            "rule": "schema-violation",
            "file": label,
            "detail": f"{'.'.join(str(p) for p in error.path) or '(root)'}: {error.message}",
        })
    return findings


# ---------------------------------------------------------------------------
# Catalog command-allowlist enforcement
# ---------------------------------------------------------------------------

def _extract_commands_from_catalog(catalog: dict) -> list[tuple[str, str]]:
    """Yield (location, command) pairs from all command-bearing fields in catalog."""
    pairs: list[tuple[str, str]] = []
    for i, bc in enumerate(catalog.get("breaking_changes", [])):
        bc_id = bc.get("id", f"[{i}]")
        for field in ("detection", "fix", "verification"):
            block = bc.get(field, {})
            if isinstance(block, dict) and "command" in block:
                pairs.append((f"breaking_changes[{bc_id}].{field}.command", block["command"]))
    return pairs


def lint_catalog_commands(catalog: dict, catalog_label: str) -> list[dict]:
    """Check every command in the catalog against the safe-prefix allowlist."""
    findings: list[dict] = []
    for location, cmd in _extract_commands_from_catalog(catalog):
        if not _is_safe_command(cmd):
            findings.append({
                "severity": "ERROR",
                "rule": "unsafe-command",
                "file": catalog_label,
                "detail": (
                    f"{location}: command '{cmd}' does not match the safe-prefix "
                    "allowlist (composer, php, php artisan, git, sed, rector, "
                    "vendor/bin/*).  Restrict commands to safe prefixes — "
                    "schema validation is the security gate."
                ),
            })
    return findings


# ---------------------------------------------------------------------------
# Per-mission validation
# ---------------------------------------------------------------------------

def validate_mission(
    mission_dir: Path,
    mission_schema: dict,
    catalog_schema: dict,
) -> list[dict]:
    """Validate one mission directory.  Returns a list of finding dicts."""
    findings: list[dict] = []
    manifest_path = mission_dir / "mission.yaml"

    if not manifest_path.is_file():
        findings.append({
            "severity": "ERROR",
            "rule": "missing-manifest",
            "file": _rel(manifest_path),
            "detail": "mission directory has no mission.yaml",
        })
        return findings

    # --- Parse manifest -------------------------------------------------------
    manifest_label = _rel(manifest_path)
    try:
        manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
    except Exception as exc:
        findings.append({
            "severity": "ERROR",
            "rule": "parse-error",
            "file": manifest_label,
            "detail": str(exc),
        })
        return findings

    # --- Schema validate manifest ---------------------------------------------
    findings.extend(_validate_yaml_against_schema(manifest, mission_schema, manifest_label))

    # --- Catalog (if referenced) ----------------------------------------------
    catalog_ref = manifest.get("catalog")
    if catalog_ref:
        catalog_path = mission_dir / catalog_ref
        catalog_label = _rel(catalog_path)

        if not catalog_path.is_file():
            findings.append({
                "severity": "ERROR",
                "rule": "missing-catalog",
                "file": manifest_label,
                "detail": f"catalog '{catalog_ref}' referenced in mission.yaml not found at {catalog_path}",
            })
        else:
            try:
                catalog = yaml.safe_load(catalog_path.read_text(encoding="utf-8")) or {}
            except Exception as exc:
                findings.append({
                    "severity": "ERROR",
                    "rule": "parse-error",
                    "file": catalog_label,
                    "detail": str(exc),
                })
                return findings

            # Schema validate catalog
            findings.extend(_validate_yaml_against_schema(catalog, catalog_schema, catalog_label))

            # Command allowlist
            findings.extend(lint_catalog_commands(catalog, catalog_label))

    return findings


# ---------------------------------------------------------------------------
# --check-precondition stub
# ---------------------------------------------------------------------------

def check_precondition(mission_id: str, repo_path: str) -> int:
    """Stub: single-mission-per-branch guard.

    Documented contract (~30 LoC per council):
      1. Confirm `repo_path` is a git repository (`git rev-parse --git-dir`).
      2. Confirm the working tree is clean (`git status --porcelain`).
      3. Confirm no branch matching `mission/*` is already checked out.
      4. Confirm no `.work-state.json` with a mission envelope is present.

    The live-repo invocations (git subprocess calls) are intentionally left as
    documented stubs pending Phase 1 PoC integration.  The function signature
    and contract are stable — callers can rely on the return codes:
      0 — preconditions satisfied, safe to run the mission
      1 — precondition failure surfaced; mission must NOT start
    """
    print(
        f"[precondition] Mission '{mission_id}' on repo '{repo_path}'",
        file=sys.stderr,
    )
    print(
        "[precondition] STUB: live-repo git checks deferred to Phase 1 PoC "
        "(see lint_missions.py § check_precondition for the documented contract).",
        file=sys.stderr,
    )
    # Live checks to implement in Phase 1:
    #   import subprocess
    #   subprocess.run(["git", "-C", repo_path, "rev-parse", "--git-dir"], check=True)
    #   result = subprocess.run(["git", "-C", repo_path, "status", "--porcelain"], ...)
    #   if result.stdout.strip(): return 1  # dirty tree
    #   branches = subprocess.run(["git", "-C", repo_path, "branch", "--list", "mission/*"], ...)
    #   if branches.stdout.strip(): return 1  # another mission active
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument(
        "--strict",
        action="store_true",
        help="exit 1 on any ERROR finding (post-promotion CI gate)",
    )
    ap.add_argument("--quiet", action="store_true", help="suppress per-finding output")
    ap.add_argument(
        "--check-precondition",
        nargs=2,
        metavar=("MISSION", "REPO"),
        help="check single-mission-per-branch guard for MISSION on REPO (stub)",
    )
    args = ap.parse_args(argv)

    # --check-precondition mode
    if args.check_precondition:
        mission_id, repo_path = args.check_precondition
        return check_precondition(mission_id, repo_path)

    # Load schemas
    if not MISSION_SCHEMA_PATH.is_file():
        print(
            f"❌  Mission schema not found: {MISSION_SCHEMA_PATH}",
            file=sys.stderr,
        )
        return 2 if args.strict else 0

    if not CATALOG_SCHEMA_PATH.is_file():
        print(
            f"❌  Catalog schema not found: {CATALOG_SCHEMA_PATH}",
            file=sys.stderr,
        )
        return 2 if args.strict else 0

    mission_schema = _load_schema(MISSION_SCHEMA_PATH)
    catalog_schema = _load_schema(CATALOG_SCHEMA_PATH)

    if not MISSIONS_ROOT.is_dir():
        if not args.quiet:
            print(f"No missions directory found at {MISSIONS_ROOT}", file=sys.stderr)
        return 0

    all_findings: list[dict] = []
    mission_dirs = sorted(
        p for p in MISSIONS_ROOT.iterdir()
        if p.is_dir() and not p.name.startswith(".")
    )

    for mission_dir in mission_dirs:
        findings = validate_mission(mission_dir, mission_schema, catalog_schema)
        all_findings.extend(findings)

    errors = [f for f in all_findings if f["severity"] == "ERROR"]
    warnings = [f for f in all_findings if f["severity"] == "WARN"]

    if not args.quiet:
        for f in all_findings:
            tag = f["severity"]
            print(f"  [{tag}] {f['file']}  {f['rule']} — {f['detail']}")

        print()
        print(f"lint-missions: {len(errors)} ERROR, {len(warnings)} WARN across {len(mission_dirs)} mission(s)")
        if errors:
            print("  (warn-only — run with --strict to make ERROR findings block CI)")
        else:
            print("  all missions valid")

    if args.strict and errors:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
