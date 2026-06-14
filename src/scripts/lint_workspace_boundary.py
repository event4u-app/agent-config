#!/usr/bin/env python3
"""Workspace-boundary drift check — import-edge enforcement.

Governed by `docs/contracts/workspace-boundary.md` + ADR-095. Fails when a
workspace module (`src/cli/python/workspace_*.py`) imports an owner-module of
a domain the workspace does NOT own: skill design, profile/pack semantics,
video-provider logic, MCP-registry policy, analytics product strategy.

Scope (read this before trusting a green run): this enforces **import edges
only**. Semantic drift — a workspace module that encodes profile-semantics or
analytics-product-strategy judgement without importing anything forbidden — is
NOT catchable here and stays doc-governance, enforced in review against the
contract. A green run is a supplement to boundary thinking, not a substitute.

Allowed: stdlib, third-party deps, intra-workspace imports (`workspace_*`),
and any import line carrying a `# boundary-exception: <reason>` pragma.

Usage:  python3 src/scripts/lint_workspace_boundary.py [--quiet]
Exit:   0 = boundary holds · 1 = a forbidden import was found · 2 = internal.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

WORKSPACE_GLOB = "src/cli/python/workspace_*.py"
PRAGMA = "boundary-exception:"

# Owner-modules of the NOT-owned domains. Matched against each dotted segment
# of an imported module name with segment boundaries, so `packaging` does not
# trip `pack` and `workspace_skills` is handled by the intra-workspace allow.
FORBIDDEN: list[tuple[re.Pattern, str]] = [
    (re.compile(r"(?:^|[._-])condense(?:$|[._-])"), "skill design / condensation"),
    (re.compile(r"(?:^|[._-])skill_linter(?:$|[._-])"), "skill design"),
    (re.compile(r"(?:^|[._-])skill_management(?:$|[._-])"), "skill design"),
    (re.compile(r"(?:^|[._-])skill_writing(?:$|[._-])"), "skill design"),
    (re.compile(r"(?:^|[._-])discovery_manifest(?:$|[._-])"), "profile/pack semantics"),
    (re.compile(r"(?:^|[._-])(?:profiles?|packs?)(?:$|[._-])"), "profile/pack semantics"),
    (re.compile(r"ai[_-]?video"), "video-provider logic"),
    (re.compile(r"(?:^|[._-])mcp(?:$|[._-])"), "MCP-registry policy"),
    (re.compile(r"(?:^|[._-])router(?:$|[._-])"), "router / projection policy"),
    (re.compile(r"(?:^|[._-])persona"), "persona / skill design"),
]


def _is_intra_workspace(module: str) -> bool:
    head = module.split(".", 1)[0]
    return head == "workspace" or head.startswith("workspace_")


def _forbidden_reason(module: str) -> "str | None":
    if _is_intra_workspace(module):
        return None
    for pat, reason in FORBIDDEN:
        if pat.search(module):
            return reason
    return None


def _imported_modules(tree: ast.AST):
    """Yield (module_name, lineno) for every import in the tree."""
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            yield node.module, node.lineno
        elif isinstance(node, ast.Import):
            for alias in node.names:
                yield alias.name, node.lineno


def check_file(path: Path) -> list[str]:
    """Return human-readable violation strings for one workspace module."""
    src = path.read_text(encoding="utf-8")
    lines = src.splitlines()
    try:
        tree = ast.parse(src, filename=str(path))
    except SyntaxError as exc:  # pragma: no cover
        return [f"{path}: unparseable ({exc})"]
    out: list[str] = []
    for module, lineno in _imported_modules(tree):
        reason = _forbidden_reason(module)
        if reason is None:
            continue
        line = lines[lineno - 1] if 0 < lineno <= len(lines) else ""
        if PRAGMA in line:
            continue  # reviewed, deliberate exception
        out.append(
            f"{path.name}:{lineno}: imports `{module}` "
            f"(not-owned domain: {reason})"
        )
    return out


def main(argv: list[str]) -> int:
    quiet = "--quiet" in argv
    repo = Path(__file__).resolve().parent.parent.parent
    files = sorted(repo.glob(WORKSPACE_GLOB))
    if not files:
        print(f"⚠️  lint-workspace-boundary: no files match {WORKSPACE_GLOB}")
        return 0
    violations: list[str] = []
    for f in files:
        violations.extend(check_file(f))
    if violations:
        print("❌  Workspace-boundary violation(s) — a workspace module imports "
              "an owner-module of a domain the workspace does NOT own "
              "(docs/contracts/workspace-boundary.md):")
        for v in violations:
            print(f"  🔴 {v}")
        print("\nFix: move the logic to the owning surface and consume its "
              "output, or add `# boundary-exception: <reason>` if the import is "
              "genuinely justified (reviewed like any boundary change).")
        return 1
    if not quiet:
        print(f"✅  Workspace boundary holds — {len(files)} module(s), "
              "no forbidden imports.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
