#!/usr/bin/env python3
"""Propose a ``modules:`` block for ``.agent-project-settings.yml``.

Phase B Step 2 of road-to-configurable-modules. Wraps the pure
:mod:`scripts._lib.module_detection` helper in a CLI surface that the
installer, the GUI wizard, and the ``/agents init`` command can all call
without re-implementing the detection table.

Usage:
    python3 scripts/propose_modules_config.py                  # interactive
    python3 scripts/propose_modules_config.py --json           # machine-readable
    python3 scripts/propose_modules_config.py --project <path> # custom root

Exit codes:
    0 — candidates surfaced (or none found, with ``modules.enabled: false``)
    2 — invalid arguments / unreachable path

The CLI never writes files. Callers consume the JSON / TTY output and
patch ``.agent-project-settings.yml`` themselves (preserves comments +
ordering per the layered-settings contract).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Re-export so consumers can import either path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts._lib.module_detection import (  # noqa: E402
    ModuleCandidate,
    detect_module_roots,
)


def _candidate_to_dict(cand: ModuleCandidate) -> dict[str, str]:
    return {
        "path": cand.path,
        "stack": cand.stack,
        "namespace_template_guess": cand.namespace_template_guess,
        "confidence": cand.confidence,
    }


def _render_interactive(candidates: list[ModuleCandidate]) -> None:
    """Print a numbered-options block — the same shape ``/agents init`` shows."""
    if not candidates:
        print("⚠️  No module roots detected.")
        print()
        print(
            "Skipping `modules:` config. Re-run after adding a module "
            "directory (app/Modules/, src/Module/, packages/, internal/, ...)."
        )
        return
    print("📦 Detected module-root candidates:")
    print()
    print("  #  Path              Stack            Confidence  Namespace template")
    print("  ─  ────────────────  ───────────────  ──────────  ────────────────────")
    for idx, cand in enumerate(candidates, start=1):
        ns = cand.namespace_template_guess or "—"
        print(
            f"  {idx:>1}  {cand.path:<16}  {cand.stack:<15}"
            f"  {cand.confidence:<10}  {ns}"
        )
    print()
    print("Suggested `modules:` block (paste into .agent-project-settings.yml):")
    print()
    print("modules:")
    print("  enabled: true")
    print(f"  root_paths: [{', '.join(c.path for c in candidates)}]")
    primary_ns = next(
        (c.namespace_template_guess for c in candidates
         if c.namespace_template_guess),
        "",
    )
    if primary_ns:
        print(f"  namespace_template: '{primary_ns}'")
    else:
        print("  # namespace_template: ''  # stack has no PHP-style namespace")
    print("  agent_folder: agents")
    print("  skip_dirs: [.module-template, .example]")


def _resolve_project_root(arg: str | None) -> Path:
    if arg:
        root = Path(arg).expanduser().resolve()
    else:
        root = Path.cwd().resolve()
    if not root.is_dir():
        print(
            f"error: project root is not a directory: {root}",
            file=sys.stderr,
        )
        sys.exit(2)
    return root


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="propose_modules_config.py",
        description=(
            "Detect module-root candidates and propose a `modules:` block "
            "for .agent-project-settings.yml. Pure read-only scan."
        ),
    )
    parser.add_argument(
        "--project",
        default=None,
        help="project root (default: cwd)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="emit machine-readable JSON instead of the TTY table",
    )
    args = parser.parse_args(argv)
    root = _resolve_project_root(args.project)
    candidates = detect_module_roots(root)
    if args.json:
        payload = {
            "project_root": str(root),
            "candidates": [_candidate_to_dict(c) for c in candidates],
            "proposed_block": {
                "enabled": bool(candidates),
                "root_paths": [c.path for c in candidates],
                "namespace_template": next(
                    (c.namespace_template_guess for c in candidates
                     if c.namespace_template_guess),
                    "",
                ),
                "agent_folder": "agents",
                "skip_dirs": [".module-template", ".example"],
            },
        }
        json.dump(payload, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0
    _render_interactive(candidates)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
