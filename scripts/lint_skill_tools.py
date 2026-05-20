#!/usr/bin/env python3
"""Block D · D1 — meta-linter for ``scripts/skill_tools/*.py``.

Enforces the four pilot-tool invariants locked by the Block D council
verdict (`agents/runtime/council/responses/block-d-python-tools-pilot-verdict.md`):

  1. **stdlib-only** — no third-party imports. Internal package imports
     (``scripts.*``) are allowed.
  2. **--help and --json flags** — every tool must register both via
     ``argparse`` so callers can introspect and machine-read.
  3. **naming** — ``snake_case_verb_noun.py`` (≥ 1 underscore, lowercase).
  4. **embedded sample data** — module must define a ``_SAMPLE`` constant
     OR contain ``if __name__ == "__main__"`` with sample-mode handling
     (so the tool can run without external fixtures).
  5. **size cap** — file ≤ 200 LOC (per roadmap D1, applies to D1 itself
     and to D2/D3/D4 with their own caps validated externally).

Tool discovery is glob-based (``scripts/skill_tools/*.py`` excluding
``__init__.py``) per anthropic round-2 critique — never a hardcoded list.

Run:
  python3 scripts/lint_skill_tools.py            # human-readable
  python3 scripts/lint_skill_tools.py --json     # machine-readable

Exit codes: 0 clean · 1 violations found · 2 usage error.
"""
from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
TOOLS_DIR = ROOT / "scripts" / "skill_tools"
NAME_RE = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+\.py$")
SIZE_CAP = 200

# Python 3.9-compatible stdlib list. Kept conservative — additions are cheap,
# false negatives are not. Mirrors `sys.stdlib_module_names` from 3.10+.
STDLIB = frozenset({
    "__future__", "abc", "argparse", "ast", "base64", "collections", "configparser",
    "contextlib", "copy", "csv", "dataclasses", "datetime", "decimal", "difflib",
    "enum", "errno", "fnmatch", "functools", "glob", "gzip", "hashlib", "heapq",
    "html", "http", "importlib", "inspect", "io", "ipaddress", "itertools", "json",
    "logging", "math", "mimetypes", "os", "pathlib", "pickle", "platform", "posixpath",
    "pprint", "queue", "random", "re", "shlex", "shutil", "signal", "socket",
    "sqlite3", "ssl", "stat", "string", "struct", "subprocess", "sys", "tempfile",
    "textwrap", "threading", "time", "tomllib", "traceback", "types", "typing",
    "unicodedata", "unittest", "urllib", "uuid", "venv", "warnings", "weakref",
    "xml", "zipfile", "zlib",
})
PROJECT_PACKAGES = frozenset({"scripts", "skill_tools"})  # internal imports are fine.


def _violations_for(path: Path) -> List[str]:
    """Return a list of violation strings for one tool (empty = clean)."""
    out: List[str] = []
    name = path.name
    if not NAME_RE.match(name):
        out.append(f"naming: `{name}` is not snake_case_verb_noun.py")

    text = path.read_text(encoding="utf-8")
    loc = sum(1 for ln in text.splitlines() if ln.strip() and not ln.lstrip().startswith("#"))
    if loc > SIZE_CAP:
        out.append(f"size: {loc} LOC > {SIZE_CAP} cap")

    try:
        tree = ast.parse(text, filename=str(path))
    except SyntaxError as exc:
        out.append(f"syntax: {exc.msg} at line {exc.lineno}")
        return out

    # Imports — flag any non-stdlib, non-project top-level module + record argparse use.
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                imported.add(root)
                if root not in STDLIB and root not in PROJECT_PACKAGES:
                    out.append(f"stdlib-only: imports `{alias.name}` (third-party)")
        elif isinstance(node, ast.ImportFrom):
            if node.module is None or node.level > 0:
                continue  # relative imports — package-internal
            root = node.module.split(".")[0]
            imported.add(root)
            if root not in STDLIB and root not in PROJECT_PACKAGES:
                out.append(f"stdlib-only: imports from `{node.module}` (third-party)")

    # CLI flags — confirm argparse is imported and `--json` is registered.
    has_argparse = "argparse" in imported
    has_json_flag = re.search(r"['\"]--json['\"]", text) is not None
    if not has_argparse:
        out.append("cli: no `argparse` import detected")
    if not has_json_flag:
        out.append("cli: missing `--json` flag")
    # `--help` is auto-registered by argparse; we sanity-check that
    # add_help isn't disabled.
    if re.search(r"add_help\s*=\s*False", text):
        out.append("cli: `add_help=False` disables --help")

    # Embedded sample data — accept either a module-level _SAMPLE constant
    # or a __main__ block (the tool can self-demo).
    has_sample = bool(re.search(r"^_SAMPLE\s*[:=]", text, re.MULTILINE))
    has_main = '__name__ == "__main__"' in text or "__name__ == '__main__'" in text
    if not (has_sample or has_main):
        out.append("sample: no `_SAMPLE` constant or `__main__` block")

    return out


def lint(tools_dir: Path) -> Tuple[int, Dict[str, List[str]]]:
    tools_dir = tools_dir.resolve()
    if not tools_dir.is_dir():
        return 2, {"_error": [f"tools dir missing: {tools_dir}"]}
    findings: Dict[str, List[str]] = {}
    for path in sorted(tools_dir.glob("*.py")):
        if path.name == "__init__.py":
            continue
        viols = _violations_for(path)
        if viols:
            try:
                key = str(path.relative_to(ROOT))
            except ValueError:
                key = str(path)
            findings[key] = viols
    return (1 if findings else 0), findings


def _print_human(findings: Dict[str, List[str]]) -> None:
    if not findings:
        print(f"✅  scripts/skill_tools/ — all tools clean.")
        return
    print(f"❌  scripts/skill_tools/ — {len(findings)} tool(s) with violations:")
    for fp, viols in findings.items():
        print(f"  {fp}:")
        for v in viols:
            print(f"    - {v}")


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Lint scripts/skill_tools/*.py against Block D pilot invariants.",
    )
    parser.add_argument("--json", action="store_true", help="emit JSON instead of text")
    parser.add_argument("--quiet", action="store_true",
                        help="suppress the clean-pass success line (errors still print)")
    parser.add_argument("--tools-dir", default=str(TOOLS_DIR),
                        help="directory to lint (default: scripts/skill_tools)")
    args = parser.parse_args(argv)

    code, findings = lint(Path(args.tools_dir))
    if args.json:
        json.dump({"exit_code": code, "findings": findings}, sys.stdout, indent=2)
        sys.stdout.write("\n")
    elif findings or not args.quiet:
        _print_human(findings)
    return code


_SAMPLE = {"violations": ["stdlib-only: imports `requests` (third-party)"]}

if __name__ == "__main__":
    raise SystemExit(main())
