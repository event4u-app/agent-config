#!/usr/bin/env python3
"""P1.3 — MCP-config security linter (road-to-security-pillar.md). OWASP ASI04.

Scans shipped MCP configuration — named config files (``*.mcp.json``,
``mcp.json``, ``claude_desktop_config.json*``) and fenced ```json blocks that
declare ``mcpServers`` — for the supply-chain smells behind MCP tool-poisoning
and rug-pull attacks.

- HIGH (fail): a **real inline secret value** in a shipped config (an actual
  key, not the bare prefix used as documentation). Secrets belong in
  ``${env:VAR}``.
- MED (warn): ``npx -y`` auto-install, unpinned server version, ``autoApprove``
  / ``enableAllProjectMcpServers``, ``0.0.0.0`` binding, shell metacharacters in
  args, omnibus scopes (``*`` / ``all`` / ``full-access``), ``*_BASE_URL`` in a
  project-scoped env. These are smells, not leaks — templates legitimately show
  them, so they warn (and weight 0.25x in example/template files per P1.5).

Usage: python3 src/scripts/lint_mcp_config_security.py [--json]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import security_lint as sl  # noqa: E402

CHECK = "mcp-config-security"

_NAME_HINTS = re.compile(r"(^|/)(\.mcp\.json|mcp\.json|claude_desktop_config\.json)")

# Real secret VALUES (prefix + enough key chars to be a live credential).
_SECRET = re.compile(
    r"sk-ant-[A-Za-z0-9_\-]{20,}"
    r"|sk-proj-[A-Za-z0-9_\-]{20,}"
    r"|AKIA[0-9A-Z]{16}"
    r"|AIza[0-9A-Za-z_\-]{35}"
    r"|ghp_[0-9A-Za-z]{36}"
    r"|eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"
)

# Line-level smells (match on a single line).
_MED = [
    (re.compile(r"\bautoApprove\b|\benableAllProjectMcpServers\b", re.IGNORECASE), "auto-approve / auto-enable bypasses consent"),
    (re.compile(r"0\.0\.0\.0"), "0.0.0.0 bind (exposed beyond localhost)"),
    (re.compile(r'"[^"]*_BASE_URL"\s*:'), "*_BASE_URL in config (request-redirect / token-exfil vector)"),
    (re.compile(r'"(scopes?|permissions?)"\s*:\s*(\[[^\]]*"(\*|all|full-access)"|"(\*|all|full-access)")', re.IGNORECASE), "omnibus scope (* / all / full-access)"),
    (re.compile(r'"args"\s*:\s*\[[^\]]*(&&|\|\||;|`)'), "shell metacharacters in args"),
]
# Chunk-level smells (span multiple lines in pretty-printed JSON).
_NPX = re.compile(r'"command"\s*:\s*"(npx|uvx)"', re.IGNORECASE)
_NPX_YES = re.compile(r'"\s*(-y|--yes)\s*"')


def _candidate_chunks(sf: sl.ScannedFile):
    """Yield (start_lineno, [lines]) for MCP-config regions in this file."""
    if _NAME_HINTS.search(sf.rel):
        yield 1, list(enumerate(sf.lines, start=1))
        return
    if sf.path.suffix != ".md":
        return
    # fenced ```json / ```jsonc blocks that mention mcpServers / command
    in_block, start, buf = False, 0, []
    for i, text in enumerate(sf.lines, start=1):
        st = text.strip()
        if not in_block and re.match(r"`{3,}(json[c5]?|jsonc)\b", st):
            in_block, start, buf = True, i, []
            continue
        if in_block and re.match(r"`{3,}\s*$", st):
            joined = "\n".join(t for _, t in buf)
            if "mcpServers" in joined or '"command"' in joined:
                yield start, buf
            in_block, buf = False, []
            continue
        if in_block:
            buf.append((i, text))


def _scan(sf: sl.ScannedFile):
    if sf.pragma_allows(CHECK):
        return []
    out = []
    for start, numbered in _candidate_chunks(sf):
        for lineno, text in numbered:
            if _SECRET.search(text):
                out.append(sl.Finding(sf.rel, lineno, CHECK, "HIGH",
                                      "inline secret value in MCP config — use ${env:VAR}",
                                      sf.weight))
            for rx, label in _MED:
                if rx.search(text):
                    out.append(sl.Finding(sf.rel, lineno, CHECK, "MED", label, sf.weight))
        # chunk-level: npx/uvx auto-install spans command + args lines
        npx_line = next((ln for ln, t in numbered if _NPX.search(t)), start)
        chunk = "\n".join(t for _, t in numbered)
        if _NPX.search(chunk) and _NPX_YES.search(chunk):
            out.append(sl.Finding(sf.rel, npx_line, CHECK, "MED",
                                  "npx/uvx -y auto-install (supply-chain risk; pin + pre-install)",
                                  sf.weight))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, epilog=sl.GUIDELINE_EPILOG)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    findings = []
    # scan .md (fenced examples) under the default roots PLUS named MCP configs
    # under src/templates (where the shipped claude_desktop_config template lives).
    roots = (*sl.DEFAULT_SCAN_ROOTS, "src/templates")
    for sf in sl.iter_corpus(roots=roots, exts=(".md", ".json", ".template")):
        findings.extend(_scan(sf))

    if args.json:
        import json
        print(json.dumps([f.__dict__ for f in findings], indent=2))
        return 1 if any(f.is_fail for f in findings) else 0
    return sl.report(findings, check_label="mcp-config-security")


if __name__ == "__main__":
    raise SystemExit(main())
