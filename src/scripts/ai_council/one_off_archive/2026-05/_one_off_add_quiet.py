#!/usr/bin/env python3
"""One-off: add --quiet flag to every check_*/lint_* script that lacks one.

Target pattern (the canonical example is check_one_off_location.py):
- argparse parser exists
- parser.add_argument("--quiet", action="store_true", help="Only print on failure")
- success print lines matching `print(...✅...)` are wrapped:
      if not args.quiet:
          print("✅ ...")

For scripts without argparse, fall back to a minimal sys.argv probe.
Reports a manual-review list for anything that doesn't match the simple pattern.
"""
from __future__ import annotations

import re
from pathlib import Path

SCRIPTS = Path("scripts")
SUCCESS_RE = re.compile(r'^(\s*)(print\((?:f)?["\'].*\u2705.*\))\s*$')
# Accept any parser var name (parser, ap, p, …) — capture both lhs (args var) and rhs (parser var).
PARSE_ARGS_RE = re.compile(
    r"^(\s*)([A-Za-z_][A-Za-z_0-9]*)\s*=\s*([A-Za-z_][A-Za-z_0-9]*)\.parse_args\(.*\)\s*$"
)
TOP_IMPORT_RE = re.compile(r"^(?:import |from )\S")


def has_quiet_flag(text: str) -> bool:
    return '"--quiet"' in text or "'--quiet'" in text


def has_argparse(text: str) -> bool:
    return "argparse" in text and ".add_argument(" in text and ".parse_args(" in text


def patch_argparse_script(text: str) -> tuple[str, int]:
    """Insert --quiet arg before parse_args() call; gate ✅ print lines.

    Returns (new_text, n_prints_gated). Caller checks both for sanity.
    """
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    inserted = False
    n_gated = 0
    parse_args_var: str | None = None

    for line in lines:
        if not inserted:
            m = PARSE_ARGS_RE.match(line.rstrip("\n"))
            if m:
                indent = m.group(1)
                parse_args_var = m.group(2)  # lhs (args var)
                parser_var = m.group(3)      # rhs (parser var: parser/ap/p/…)
                out.append(
                    f'{indent}{parser_var}.add_argument("--quiet", action="store_true", '
                    'help="Only print on failure")\n'
                )
                inserted = True
        out.append(line)

    if not inserted or parse_args_var is None:
        return text, 0

    # Now rewrite: gate success prints behind `if not <var>.quiet:`
    text2 = "".join(out)
    lines2 = text2.splitlines(keepends=True)
    out2: list[str] = []
    for line in lines2:
        m = SUCCESS_RE.match(line.rstrip("\n"))
        if m:
            indent, stmt = m.group(1), m.group(2)
            out2.append(f"{indent}if not {parse_args_var}.quiet:\n")
            out2.append(f"{indent}    {stmt}\n")
            n_gated += 1
        else:
            out2.append(line)
    return "".join(out2), n_gated


def patch_plain_script(text: str) -> tuple[str, int]:
    """For scripts without argparse: add a sys.argv probe near the top.

    Inserts after the last `import` or `from` line. Gates ✅ prints behind QUIET.
    """
    lines = text.splitlines(keepends=True)
    last_import = -1
    for i, line in enumerate(lines):
        # Only TOP-LEVEL imports (column 0) — skip nested imports inside try/def.
        if TOP_IMPORT_RE.match(line):
            last_import = i
    if last_import < 0:
        return text, 0
    if "import sys" not in text:
        lines.insert(last_import + 1, "import sys\n")
        last_import += 1
    lines.insert(last_import + 1, '\nQUIET = "--quiet" in sys.argv\n')

    n_gated = 0
    out: list[str] = []
    for line in lines:
        m = SUCCESS_RE.match(line.rstrip("\n"))
        if m:
            indent, stmt = m.group(1), m.group(2)
            out.append(f"{indent}if not QUIET:\n")
            out.append(f"{indent}    {stmt}\n")
            n_gated += 1
        else:
            out.append(line)
    return "".join(out), n_gated


def main() -> int:
    targets = sorted(SCRIPTS.glob("check_*.py")) + sorted(SCRIPTS.glob("lint_*.py"))
    skipped, patched, manual = [], [], []

    for f in targets:
        text = f.read_text()
        if has_quiet_flag(text):
            skipped.append(f.name)
            continue
        if has_argparse(text):
            new, n = patch_argparse_script(text)
            if n == 0 or new == text:
                manual.append((f.name, f"argparse but no ✅-print gated (n={n})"))
                continue
            f.write_text(new)
            patched.append((f.name, n))
        else:
            new, n = patch_plain_script(text)
            if n == 0 or new == text:
                manual.append((f.name, "plain but no ✅-print to gate"))
                continue
            f.write_text(new)
            patched.append((f.name, n))

    print(f"Skipped (already had --quiet): {len(skipped)}")
    for s in skipped:
        print(f"  · {s}")
    print(f"\nPatched: {len(patched)}")
    for name, n in patched:
        print(f"  · {name} (gated {n} print(s))")
    print(f"\nManual review needed: {len(manual)}")
    for name, why in manual:
        print(f"  · {name}: {why}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
