#!/usr/bin/env python3
"""P1.4 — dangerous-frontmatter linter (road-to-security-pillar.md).

Enforces the execution-safety contract from the ``runtime-safety`` rule at the
frontmatter layer, and flags the consumer-format consent-bypass headers
(``permissionMode: bypassPermissions``, wildcard ``allowed-tools``) that the
"skill supply-chain" attack class abuses.

Checks (skill / command / persona / agent frontmatter under src/):

- HIGH: ``execution.type: automated`` but the runtime-safety floor is not met —
  ``handler`` is ``none``/missing, ``safety_mode`` is not ``strict``, or no
  ``allowed_tools`` key is declared.
- HIGH: ``allowed_tools`` (or consumer ``allowed-tools``) grants a wildcard —
  ``*``, ``Bash(*)``, or bare ``Bash`` — an over-broad tool grant.
- HIGH: ``permissionMode: bypassPermissions`` (consent bypass).

Reconciles with ``validate_frontmatter.py`` (schema fill) by checking only
*safety semantics*, never re-reporting shape/required-key errors.

Usage: python3 src/scripts/lint_skill_frontmatter_safety.py [--json]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import security_lint as sl  # noqa: E402

CHECK = "dangerous-frontmatter"

# Always over-broad: a star or Bash(*) wildcard grant.
_WILDCARD_TOOL = re.compile(r"(^|[\s,\[\"'])(\*|Bash\(\*\))(\s|,|\]|\"|'|$)")
# Bare `Bash` (full shell) — over-broad only on a NON-execution skill.
_BARE_BASH = re.compile(r"(^|[\s,\[\"'])Bash(\s|,|\]|\"|'|$)")


def _frontmatter(sf: sl.ScannedFile) -> tuple[list[tuple[int, str]], int] | None:
    """Return [(lineno, text)] of the frontmatter body + its end line, or None."""
    if not sf.lines or sf.lines[0].strip() != "---":
        return None
    body = []
    for i in range(1, len(sf.lines)):
        if sf.lines[i].strip() == "---":
            return body, i + 1
        body.append((i + 1, sf.lines[i]))
    return None


def _exec_block(body: list[tuple[int, str]]) -> dict[str, tuple[int, str]]:
    """Extract execution.* sub-keys as {key: (lineno, value)} (one-level block)."""
    out: dict[str, tuple[int, str]] = {}
    in_exec = False
    base_indent = 0
    for lineno, text in body:
        if re.match(r"^execution:\s*$", text):
            in_exec = True
            base_indent = len(text) - len(text.lstrip())
            continue
        if in_exec:
            indent = len(text) - len(text.lstrip())
            if text.strip() and indent <= base_indent:
                in_exec = False
                continue
            m = re.match(r"^\s+([\w-]+):\s*(.*)$", text)
            if m:
                out[m.group(1)] = (lineno, m.group(2).strip())
    return out


def _scan(sf: sl.ScannedFile) -> list[sl.Finding]:
    if sf.pragma_allows(CHECK):
        return []
    fm = _frontmatter(sf)
    if not fm:
        return []
    body, _end = fm
    out: list[sl.Finding] = []

    ex = _exec_block(body)
    handler = ex.get("handler", (0, ""))[1].strip("'\"")
    is_execution_skill = bool(ex) and handler not in ("", "none")

    # consumer consent-bypass header + wildcard `allowed-tools` (hyphen = Claude
    # format; the underscore source key is covered by the execution block below).
    for lineno, text in body:
        if re.match(r"\s*permissionMode:\s*['\"]?bypassPermissions", text):
            out.append(sl.Finding(sf.rel, lineno, CHECK, "HIGH",
                                  "permissionMode: bypassPermissions (consent bypass)", sf.weight))
        m = re.match(r"\s*allowed-tools:\s*(.+)$", text)
        if m and (_WILDCARD_TOOL.search(m.group(1))
                  or (_BARE_BASH.search(m.group(1)) and not is_execution_skill)):
            out.append(sl.Finding(sf.rel, lineno, CHECK, "HIGH",
                                  "wildcard / bare-Bash tool grant (over-broad)", sf.weight))

    if not ex:
        return out
    etype = ex.get("type", (0, ""))[1].strip("'\"")
    safety = ex.get("safety_mode", (0, ""))[1].strip("'\"")
    exec_line = ex.get("type", ex.get("handler", (0, "")))[0]

    if etype == "automated":
        if handler in ("", "none"):
            out.append(sl.Finding(sf.rel, exec_line, CHECK, "HIGH",
                                  "automated execution with handler none/missing (runtime-safety)", sf.weight))
        if safety != "strict":
            out.append(sl.Finding(sf.rel, exec_line, CHECK, "HIGH",
                                  "automated execution without safety_mode: strict (runtime-safety)", sf.weight))
        if "allowed_tools" not in ex:
            out.append(sl.Finding(sf.rel, exec_line, CHECK, "HIGH",
                                  "automated execution without an explicit allowed_tools declaration", sf.weight))

    at_line, at_val = ex.get("allowed_tools", (0, ""))
    if at_val and _WILDCARD_TOOL.search(at_val):
        out.append(sl.Finding(sf.rel, at_line, CHECK, "HIGH",
                              "execution.allowed_tools wildcard (* / Bash(*)) grant", sf.weight))
    elif at_val and _BARE_BASH.search(at_val) and not is_execution_skill:
        out.append(sl.Finding(sf.rel, at_line, CHECK, "HIGH",
                              "bare Bash grant on a non-execution skill (handler none/missing)", sf.weight))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, epilog=sl.GUIDELINE_EPILOG)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    findings: list[sl.Finding] = []
    roots = ("src/skills", "src/agent-src", "src/domains")
    for sf in sl.iter_corpus(roots=roots, exts=(".md",)):
        findings.extend(_scan(sf))

    if args.json:
        import json
        print(json.dumps([f.__dict__ for f in findings], indent=2))
        return 1 if any(f.is_fail for f in findings) else 0
    return sl.report(findings, check_label="dangerous-frontmatter")


if __name__ == "__main__":
    raise SystemExit(main())
