#!/usr/bin/env python3
"""
Public-link checker for the agent-config public surface.

Scans the public-surface files (README.md, AGENTS.md, docs/architecture.md)
for markdown links into `docs/contracts/`, then validates each link against
the `stability:` frontmatter declared by the target file (per
`docs/contracts/STABILITY.md`).

Rules:
  - target stability=stable        → OK (no marker required).
  - target stability=beta          → OK; warns if surrounding text has no
                                     visible "(beta)" marker.
  - target stability=experimental  → ERROR. Public surface MUST NOT link
                                     to experimental contracts.
  - target outside docs/contracts/ but referenced for contract-shaped
    intent (links into agents/contexts/*.md from public files) → ERROR.
  - target file missing            → ERROR.
  - target file under docs/contracts/ without `stability:` frontmatter
    (except STABILITY.md itself) → ERROR.

Exit codes: 0 = clean, 1 = violations found, 3 = internal error.

Usage:
    python3 scripts/check_public_links.py
    python3 scripts/check_public_links.py --list      # list contracts + levels
    python3 scripts/check_public_links.py --json      # machine-readable
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_FILES = [Path("README.md"), Path("AGENTS.md"), Path("docs/architecture.md")]
CONTRACTS_DIR = Path("docs/contracts")
STABILITY_FILE = CONTRACTS_DIR / "STABILITY.md"

LINK_RE = re.compile(r"\[(?P<text>[^\]]+)\]\((?P<href>[^)\s]+)(?:\s+\"[^\"]*\")?\)")
FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
STABILITY_RE = re.compile(r"^stability:\s*(\w+)\s*$", re.MULTILINE)


@dataclass
class Violation:
    file: str
    line: int
    href: str
    reason: str
    severity: str  # "error" | "warning"


def read_stability(path: Path) -> str | None:
    if not path.exists():
        return None
    txt = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(txt)
    if not m:
        return None
    sm = STABILITY_RE.search(m.group(1))
    return sm.group(1) if sm else None


def collect_contracts() -> dict[Path, str | None]:
    out: dict[Path, str | None] = {}
    for p in sorted((ROOT / CONTRACTS_DIR).glob("*.md")):
        rel = p.relative_to(ROOT)
        out[rel] = read_stability(p)
    return out


def resolve(public_file: Path, href: str) -> Path | None:
    href = href.split("#", 1)[0]
    if not href or href.startswith(("http://", "https://", "mailto:", "tel:")):
        return None
    if href.startswith("/"):
        return Path(href.lstrip("/"))
    return (public_file.parent / href).resolve().relative_to(ROOT.resolve())


def scan_file(public_file: Path, contracts: dict[Path, str | None]) -> list[Violation]:
    abs_path = ROOT / public_file
    if not abs_path.exists():
        return []
    violations: list[Violation] = []
    for lineno, line in enumerate(abs_path.read_text(encoding="utf-8").splitlines(), 1):
        for m in LINK_RE.finditer(line):
            href = m.group("href")
            text = m.group("text")
            try:
                target = resolve(public_file, href)
            except ValueError:
                continue
            if target is None:
                continue
            if target.parts[:2] == ("agents", "contexts") and target.suffix == ".md":
                violations.append(Violation(str(public_file), lineno, href,
                    "public surface MUST NOT link into agents/contexts/ — move target to docs/contracts/",
                    "error"))
                continue
            if target.parts[:2] != ("docs", "contracts") or target.suffix != ".md":
                continue
            if target == STABILITY_FILE:
                continue
            if target not in contracts:
                violations.append(Violation(str(public_file), lineno, href,
                    f"target not found: {target}", "error"))
                continue
            level = contracts[target]
            if level is None:
                violations.append(Violation(str(public_file), lineno, href,
                    f"target missing 'stability:' frontmatter: {target}", "error"))
                continue
            if level == "experimental":
                violations.append(Violation(str(public_file), lineno, href,
                    f"public surface MUST NOT link to experimental contract: {target}",
                    "error"))
                continue
            if level == "beta":
                window = line.lower()
                if "(beta)" not in window and "[beta]" not in window:
                    violations.append(Violation(str(public_file), lineno, href,
                        f"link to beta contract '{target}' lacks visible (beta) marker",
                        "warning"))
    return violations


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true", help="list contracts + stability levels")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--strict", action="store_true",
                    help="fail on warnings as well as errors (default: errors only)")
    args = ap.parse_args()

    contracts = collect_contracts()
    if args.list:
        for p, lvl in contracts.items():
            print(f"  {lvl or '(no frontmatter)':14}  {p}")
        return 0

    missing_fm = [p for p, lvl in contracts.items() if lvl is None and p != STABILITY_FILE]
    violations: list[Violation] = []
    for p in missing_fm:
        violations.append(Violation(str(p), 0, "(self)",
            "missing 'stability:' frontmatter required by docs/contracts/STABILITY.md",
            "error"))
    for f in PUBLIC_FILES:
        violations.extend(scan_file(f, contracts))

    if args.json:
        print(json.dumps([asdict(v) for v in violations], indent=2))
    else:
        errors = [v for v in violations if v.severity == "error"]
        warnings = [v for v in violations if v.severity == "warning"]
        for v in violations:
            icon = "❌" if v.severity == "error" else "⚠️ "
            loc = f"{v.file}:{v.line}" if v.line else v.file
            print(f"{icon}  {loc}  {v.href}\n     → {v.reason}")
        if not violations:
            print(f"✅  public-link check clean — {len(contracts)} contracts scanned, "
                  f"{len(PUBLIC_FILES)} public files clean")
        else:
            print(f"\nsummary: {len(errors)} error(s), {len(warnings)} warning(s)")

    has_errors = any(v.severity == "error" for v in violations)
    has_warnings = any(v.severity == "warning" for v in violations)
    if has_errors:
        return 1
    if has_warnings and args.strict:
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"❌  internal error: {e}", file=sys.stderr)
        sys.exit(3)
