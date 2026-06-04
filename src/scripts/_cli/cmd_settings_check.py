"""``agent-config settings:check`` — validate ``.agent-settings.yml`` against the supported YAML subset.

Read-only. Implements P3.2 of road-to-proof-not-features.md. The contract
this checks against is pinned in
``docs/contracts/settings-sync-yaml-subset.md``; out-of-subset constructs
cause :class:`sync_yaml_rt` to raise ``ValueError`` during a sync. This
CLI surfaces the same findings *before* a sync runs, so users can fix
their file without watching the merge fail.

Output line format::

    line:N  <kind>  <verdict>  <fix hint>

Exit codes:

* ``0`` — file is inside the supported subset (or absent and ``--allow-missing``).
* ``1`` — one or more findings (verdict ``not supported``).
* ``2`` — file absent (without ``--allow-missing``) or unreadable.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Imported lazily inside ``main`` so a missing engine cannot break ``--help``.

DEFAULT_PATH = ".agent-settings.yml"

# Out-of-subset patterns detected by a line-level pre-scan. Each rule is
# (label, regex, fix hint). The regex is applied to the *stripped* body
# of each non-comment line so leading indent does not affect matching.
_PRESCAN_RULES: tuple[tuple[str, re.Pattern[str], str], ...] = (
    (
        "multi-doc separator",
        re.compile(r"^(---|\.\.\.)\s*(#.*)?$"),
        "remove the separator — one YAML document per file only.",
    ),
    (
        "complex key",
        re.compile(r"^\?\s"),
        "rewrite as a plain ``key: value`` mapping line.",
    ),
    (
        "block-scalar indicator",
        re.compile(r":\s*[|>][+-]?\s*(#.*)?$"),
        "inline the value as a single-line quoted scalar.",
    ),
    (
        "tagged scalar",
        re.compile(r":\s*!!?[A-Za-z_]"),
        "remove the ``!tag``; the parser does not honour it.",
    ),
    (
        "anchor / alias",
        re.compile(r":\s*[&*][A-Za-z_]"),
        "expand the anchor inline — anchors / aliases are not supported.",
    ),
    (
        "nested flow-mapping",
        re.compile(r":\s*\{[^}]*:[^}]*\}"),
        "rewrite as a block-style nested mapping (indented child keys).",
    ),
)


def _scan_line(stripped: str) -> tuple[str, str] | None:
    if not stripped or stripped.startswith("#"):
        return None
    for label, pattern, hint in _PRESCAN_RULES:
        if pattern.search(stripped):
            return label, hint
    return None


def _scan_text(text: str) -> list[dict]:
    findings: list[dict] = []
    for lineno, raw in enumerate(text.splitlines(), 1):
        stripped = raw.strip()
        if "\t" in raw[: len(raw) - len(raw.lstrip(" \t"))]:
            findings.append({
                "line": lineno,
                "kind": "tab in indent",
                "verdict": "not supported",
                "hint": "replace leading tabs with 2 or 4 spaces.",
            })
            continue
        hit = _scan_line(stripped)
        if hit is not None:
            label, hint = hit
            findings.append({
                "line": lineno,
                "kind": label,
                "verdict": "not supported",
                "hint": hint,
            })
    return findings


def _format(finding: dict) -> str:
    return (
        f"  ❌  line:{finding['line']:<4}  "
        f"{finding['kind']:<22}  {finding['verdict']:<14}  {finding['hint']}"
    )


def _parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="agent-config settings:check",
        description=(
            "Validate .agent-settings.yml against the supported YAML subset "
            "(docs/contracts/settings-sync-yaml-subset.md). Read-only."
        ),
    )
    parser.add_argument("--path", default=DEFAULT_PATH,
                        help=f"target settings file (default: ./{DEFAULT_PATH})")
    parser.add_argument("--allow-missing", action="store_true",
                        help="exit 0 when the file is absent (CI-friendly)")
    parser.add_argument("--quiet", action="store_true",
                        help="suppress non-essential output")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    opts = _parse(argv)
    target = Path(opts.path)
    if not target.is_file():
        if opts.allow_missing:
            if not opts.quiet:
                print(f"✅  {target}: file absent (allow-missing).")
            return 0
        print(f"❌  {target}: file not found.", file=sys.stderr)
        print("    Run `./agent-config sync-agent-settings` to create it.", file=sys.stderr)
        return 2
    try:
        text = target.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"❌  {target}: cannot read: {exc}", file=sys.stderr)
        return 2

    findings = _scan_text(text)
    if not findings:
        # Final gate: run the round-trip parser to catch anything the
        # pre-scan missed (mismatched indent, malformed mapping lines).
        from scripts import sync_yaml_rt as _rt  # noqa: PLC0415
        try:
            _rt.parse(text)
        except ValueError as exc:
            findings.append({
                "line": 0, "kind": "parser",
                "verdict": "not supported", "hint": str(exc),
            })

    if not findings:
        if not opts.quiet:
            print(f"✅  {target}: inside the supported subset "
                  "(docs/contracts/settings-sync-yaml-subset.md).")
        return 0
    print(f"❌  {target}: {len(findings)} finding(s) outside the supported subset.",
          file=sys.stderr)
    for finding in findings:
        print(_format(finding), file=sys.stderr)
    print("", file=sys.stderr)
    print("    Contract: docs/contracts/settings-sync-yaml-subset.md",
          file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
