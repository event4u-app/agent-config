#!/usr/bin/env python3
"""Gate path-integrity check (R2 of road-to-test-and-gate-integrity).

Asserts that every security/quality gate which enforces something against
a fixed source target still resolves that target on disk. A move that
desyncs a gate's hard-coded path fails CI here instead of silently no-opping
(the ``aab5755`` class: the Iron-Law SHA gate pointed at a stale path and
enforced nothing while CI stayed green).

6.0.x (ADR-051) collapsed the ``packages/`` tree: the uncondensed source
container moved to ``src/agent-src/`` and the command surface to
``src/domains/``. The enforced targets therefore now resolve under ``src/``,
not ``packages/core/``. The integrity property is unchanged — every declared
target must exist on disk under the active source tree.

Design (AI council, claude-sonnet-4-5 + gpt-4o, 2026-06-02):

- The check reads each gate's ACTUAL enforced paths via its module-level
  ``GATE_CORE_PATHS`` attribute — it does NOT re-declare a copy of the path
  strings. A hand-maintained path registry would reintroduce the very
  desync risk this guards against, one layer down.
- Scope is strictly the single-root hard-coders. Multi-root gates that
  resolve via ``artefact_roots()`` (e.g. ``iron_law_sha``) are excluded:
  asserting a single ``packages/core/`` path for them would false-pass on a
  legacy layout or false-fail on a pack-only layout.

The input set is this gate list (no separate config file).

Usage:
    python3 scripts/check_gate_paths.py
Exit codes: 0 = all enforced targets resolve under the source tree ·
1 = at least one missing / out-of-tree target · 2 = a gate failed to import.
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

# Active source tree roots a gate target may legitimately resolve under.
# ``packages/`` is retained for back-compat with any pre-collapse layout that
# still ships it; post-ADR-051 the targets live under ``src/``.
_SOURCE_TREE_ROOTS = (REPO_ROOT / "src", REPO_ROOT / "packages")

# Single-root gates that enforce against a fixed packages/core/ target and
# expose it via a module-level GATE_CORE_PATHS tuple. Adding a gate here is
# the only manual step; its paths are read from the gate, never copied.
GATES: tuple[str, ...] = (
    "inventory_abstraction_budget",
    "audit_command_surface",
    "lint_agents_md",
    "audit_initial_context",
)


def _is_under_source_tree(p: Path) -> bool:
    rp = p.resolve()
    for root in _SOURCE_TREE_ROOTS:
        try:
            rp.relative_to(root.resolve())
            return True
        except ValueError:
            continue
    return False


def collect_gate_paths(gate_modules: tuple[str, ...]) -> dict[str, list[Path]]:
    """Import each gate and read its declared ``GATE_CORE_PATHS``.

    Raises ``ImportError`` (surfaced as exit 2 by ``main``) if a gate cannot
    be imported — a gate whose path logic broke at import time is itself a
    failure this check should not swallow.
    """
    out: dict[str, list[Path]] = {}
    for name in gate_modules:
        mod = importlib.import_module(name)
        paths = getattr(mod, "GATE_CORE_PATHS", None)
        if not paths:
            raise AttributeError(
                f"{name} has no non-empty GATE_CORE_PATHS — gate cannot be "
                f"checked. Declare the source targets it enforces."
            )
        out[name] = [Path(p) for p in paths]
    return out


def check_paths(named: dict[str, list[Path]]) -> list[tuple[str, str, Path]]:
    """Return ``(gate, reason, path)`` for every target that fails.

    Pure (no import side effects) so tests can drive it with fixtures.
    A target fails when it does not resolve under the source tree
    (``src/`` or ``packages/``) or does not exist on disk.
    """
    failures: list[tuple[str, str, Path]] = []
    for gate, paths in named.items():
        for p in paths:
            if not _is_under_source_tree(p):
                failures.append((gate, "not under the source tree (src/ or packages/)", p))
            elif not p.exists():
                failures.append((gate, "target does not exist", p))
    return failures


def main() -> int:
    try:
        named = collect_gate_paths(GATES)
    except (ImportError, AttributeError) as exc:
        print(f"❌  check-gate-paths: {exc}", file=sys.stderr)
        return 2
    failures = check_paths(named)
    if failures:
        print("❌  check-gate-paths: gate target(s) do not resolve under the source tree:")
        for gate, reason, path in failures:
            print(f"    {gate}: {reason} → {path}")
        print("\n  A source-tree move likely desynced a gate. Fix the gate's")
        print("  GATE_CORE_PATHS or the move.")
        return 1
    total = sum(len(v) for v in named.values())
    print(f"✅  check-gate-paths: {total} enforced target(s) across "
          f"{len(named)} gate(s) resolve under the source tree.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
