#!/usr/bin/env python3
"""Scan generic skills/rules/commands for framework/language leakage.

Carve-out criterion: artifact filename or directory path matches an explicit
framework/language marker. Everything else MUST be framework-neutral.
TEMPORARY scanner — delete after audit roadmap is drafted.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(".agent-src.uncompressed")

CARVE_OUT_PATTERNS = [
    r"laravel", r"^php-", r"^eloquent", r"^blade", r"^livewire", r"^flux",
    r"^pest-", r"^artisan-", r"^composer-", r"^jobs-events$", r"^symfony",
    r"^nextjs", r"^react-", r"^async-python", r"^openapi$", r"^quality-tools",
    r"^sql-writing", r"^tailwind", r"^terraform", r"^terragrunt", r"^traefik",
    r"^mobile-e2e",
    r"^project-analysis-(laravel|symfony|nextjs|react|node-express|zend-laminas)",
    r"^docker", r"^aws-", r"^grafana", r"^playwright",
    r"^laravel-", r"^docker-", r"^symfony-", r"^copilot-", r"^devcontainer",
    r"-routing$",
]
CARVE_OUT_RE = re.compile("|".join(CARVE_OUT_PATTERNS), re.IGNORECASE)

LEAKAGE = {
    "Laravel": [
        r"\bLaravel\b", r"\bEloquent\b", r"\bArtisan\b", r"\bFormRequest\b",
        r"\bForm Request\b", r"\bBlade\b(?! Runner)", r"\bLivewire\b",
        r"\bResource::(make|collection)\b", r"\bModel::\b",
        r"\bapp/Http/", r"\broutes/(api|web)\.php",
        r"\bdatabase/(migrations|seeders|factories)\b",
        r"\bphp artisan\b", r"\bIlluminate\\\\", r"\bIlluminate\\",
        r"\bbootstrap/app\.php",
    ],
    "PHP": [
        r"\bPHPStan\b", r"\bPest\b(?! Control)", r"\bPHPUnit\b", r"\bRector\b",
        r"\bECS\b", r"\bcomposer\.json\b", r"\bvendor/bin/",
        r"\bdeclare\(strict_types=1\)", r"\.php\b",
        r"\bnamespace App\\\\", r"\bnamespace App\\",
        r"\bcomposer (require|install|update|dump-autoload)\b",
    ],
    "Symfony": [
        r"\bSymfony\b", r"\bbin/console\b", r"\bDoctrine\b", r"\bTwig\b",
    ],
    "JS-specific": [
        r"\bpackage\.json\b",
        r"\bnpm (install|run|test|ci)\b",
        r"\byarn (install|add|test)\b",
        r"\bpnpm (install|add|run|test)\b",
        r"\bnode_modules\b",
    ],
    "Python-specific": [
        r"\bpyproject\.toml\b", r"\brequirements\.txt\b",
        r"\bpip install\b", r"\bpytest\b",
    ],
}


def is_carve_out(path: Path) -> bool:
    for p in path.parts:
        stem = p.removesuffix(".md")
        if CARVE_OUT_RE.search(stem):
            return True
    return False


def scan_file(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    hits: dict[str, list[tuple[int, str, str]]] = {}
    for category, patterns in LEAKAGE.items():
        for pat in patterns:
            rx = re.compile(pat)
            for i, line in enumerate(lines, start=1):
                if rx.search(line):
                    hits.setdefault(category, []).append(
                        (i, pat, line.strip()[:160])
                    )
    return hits


def scan_dir(subdir: str) -> list[tuple[Path, dict]]:
    target = ROOT / subdir
    out = []
    for f in sorted(target.rglob("*.md")):
        if is_carve_out(f):
            continue
        if f.name.startswith("_"):
            continue
        hits = scan_file(f)
        if hits:
            out.append((f, hits))
    return out


def main():
    for label, sub in [("SKILLS", "skills"), ("RULES", "rules"), ("COMMANDS", "commands")]:
        print(f"\n===== {label} (generic, non-carve-out) =====")
        results = scan_dir(sub)
        if not results:
            print("  (clean)")
            continue
        for path, hits in results:
            total = sum(len(v) for v in hits.values())
            print(f"\n  [{total:3d}] {path}")
            for cat, items in hits.items():
                print(f"      {cat}: {len(items)}")
                for line_no, pat, snippet in items[:6]:
                    print(f"        L{line_no:4d}  /{pat}/  {snippet}")
                if len(items) > 6:
                    print(f"        ... +{len(items) - 6} more")


if __name__ == "__main__":
    main()
