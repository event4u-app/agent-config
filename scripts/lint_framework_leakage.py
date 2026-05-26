#!/usr/bin/env python3
"""Lint generic skills/rules/commands for framework/language leakage.

Exits 1 on hit; CI-blocking. Enforces
`.agent-src.uncondensed/rules/framework-neutrality-in-generic-skills.md`.

Allowlist legitimate cross-stack docs in
`scripts/lint_framework_leakage_allowlist.json`.

Carve-out semantics: an artifact whose filename or any parent directory
matches an explicit framework/language marker (e.g. `laravel-*`,
`nextjs-*`, `pest-*`) is exempt — these are correctly framework-specific.

Inventory exemption: descriptive files that name carve-outs as
*catalog entries* rather than mandating them in a generic skill are
exempt. This covers `contexts/**/*.md` (cross-reference tables,
guideline indexes) and the top-level `README.md` (skills inventory).
A linter that targets mandate-leakage cannot meaningfully scan an
inventory of mandate-bearing artifacts.

Auto cross-stack detection (Step 0.5 of audit roadmap): when a hit's
line OR any of the ±2 surrounding lines contains a pattern from a
different ecosystem family (php / js / python), the hit is marked
`cross_stack=True` and skipped without consulting the allowlist.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib.agent_src import artefact_roots  # noqa: E402

# Post-ADR-017 source artefacts live under every packages/*/.agent-src.uncondensed/;
# pre-move the flat .agent-src.uncondensed/ root still wins. The lint walks
# the three artefact subtrees (skills/, rules/, commands/) under each active root.
_SUBDIRS = ("skills", "rules", "commands")


def _default_paths() -> tuple[str, ...]:
    out: list[str] = []
    for root in artefact_roots():
        try:
            rel = root.relative_to(REPO_ROOT)
        except ValueError:
            continue
        for sub in _SUBDIRS:
            target = root / sub
            if target.is_dir():
                out.append((rel / sub).as_posix())
    return tuple(out)


DEFAULT_PATHS = _default_paths()
ALLOWLIST_FILE = REPO_ROOT / "scripts/lint_framework_leakage_allowlist.json"

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

LEAKAGE: dict[str, list[str]] = {
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

FAMILY: dict[str, str] = {
    "Laravel": "php", "PHP": "php", "Symfony": "php",
    "JS-specific": "js", "Python-specific": "python",
}


# Cross-stack hint keywords. Their presence near a hit signals legitimate
# multi-stack documentation. They do NOT themselves produce hits.
CROSS_STACK_HINTS: dict[str, list[str]] = {
    "ruby": [r"\bRails\b", r"\bbin/rails\b", r"\bGemfile\b", r"\bbundle exec\b"],
    "python": [r"\bDjango\b", r"\bFastAPI\b", r"\bFlask\b", r"\bpoetry\b",
               r"\buv (add|sync|run|pip)\b", r"\bvenv\b"],
    "node": [r"\bExpress\b", r"\bNext\.?js\b", r"\bNode\.?js\b", r"\bnpx\b",
             r"\bvitest\b", r"\bjest\b", r"\beslint\b", r"\bprettier\b"],
    "go": [r"\bgo (test|build|run|mod)\b", r"\bgolangci-lint\b", r"\bGoLand\b"],
    "rust": [r"\bcargo (test|build|run|check|fmt|clippy|add|update)\b",
             r"\bClippy\b", r"\brustfmt\b", r"\bCargo\.toml\b"],
    "dotnet": [r"\bdotnet (test|build|run|add|restore)\b", r"\b\.NET\b"],
    "java": [r"\bSpring\b", r"\bmvn (test|clean|install|package)\b",
             r"\bgradle\b", r"\bMaven\b"],
}
CROSS_STACK_RE = {fam: re.compile("|".join(pats)) for fam, pats in CROSS_STACK_HINTS.items()}

FRONTMATTER_FRAMEWORK_RE = re.compile(
    r"^---\s*\n(.*?)\n---", re.DOTALL | re.MULTILINE
)
# Match top-level `framework:` or nested `scope.framework:` (one or more
# leading spaces tolerated for the nested form).
FRAMEWORK_KEY_RE = re.compile(
    r"^(?:framework|\s+framework)\s*:\s*(\S+)", re.MULTILINE
)


def is_carve_out(path: Path) -> bool:
    for p in path.parts:
        stem = p.removesuffix(".md")
        if CARVE_OUT_RE.search(stem):
            return True
    return False


def is_inventory_file(path: Path) -> bool:
    """Descriptive files that name carve-outs in catalog tables.

    A leakage linter targets *mandates* in generic skills/rules/commands.
    Files that list carve-outs (skills inventory, guideline indexes,
    cross-reference tables) name `laravel-*`, PHPStan, npm, etc. as data,
    not as the only path. Scanning them produces structural false
    positives that no allowlist can sensibly cover.

    Exempt scopes:
      - `<src>/contexts/**/*.md` — cross-reference tables, guideline
        catalogs, infrastructure maps.
      - top-level `README.md` directly under `.agent-src.uncondensed/`
        or `.agent-src/` — package surface inventory.
    """
    try:
        rel = path.relative_to(REPO_ROOT)
    except ValueError:
        return False
    parts = rel.parts
    if "contexts" in parts:
        return True
    if rel.name == "README.md" and len(parts) == 2 and parts[0] in {
        ".agent-src.uncondensed", ".agent-src",
    }:
        return True
    return False


def has_framework_frontmatter(path: Path) -> str | None:
    """Return the framework name if the file declares one in YAML frontmatter."""
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None
    m = FRONTMATTER_FRAMEWORK_RE.match(text)
    if not m:
        return None
    fm = m.group(1)
    key = FRAMEWORK_KEY_RE.search(fm)
    if key:
        val = key.group(1).strip().strip('"').strip("'")
        if val and val.lower() not in {"none", "null", "~", ""}:
            return val
    return None


def _load_allowlist() -> dict:
    if not ALLOWLIST_FILE.is_file():
        return {"entries": []}
    try:
        data = json.loads(ALLOWLIST_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"entries": []}
    return data


def _allowlisted(rel_path: str, line_no: int, allowlist: dict) -> bool:
    # Allowlist entries cite paths under the legacy .agent-src.uncondensed/
    # prefix; post-ADR-017 files live under packages/*/.agent-src.uncondensed/.
    # Match either the literal repo-relative path or its logical id.
    from _lib.agent_src import strip_source_prefix  # noqa: E402

    logical = strip_source_prefix(rel_path)
    for entry in allowlist.get("entries", []):
        entry_file = entry.get("file")
        entry_logical = strip_source_prefix(entry_file) if isinstance(entry_file, str) else None
        if entry_file != rel_path and (logical is None or entry_logical != logical):
            continue
        lines = entry.get("lines")
        if lines == "*":
            return True
        if isinstance(lines, list) and line_no in lines:
            return True
    return False


def _families_in_window(lines: list[str], idx: int, radius: int = 10) -> set[str]:
    """Families found within ±radius lines.

    The radius is intentionally wider than a tight paragraph so multi-stack
    sections (e.g. composer / npm / pip blocks separated by a few lines of
    prose) are reliably detected as cross-stack documentation.
    """
    families: set[str] = set()
    lo = max(0, idx - radius)
    hi = min(len(lines), idx + radius + 1)
    for j in range(lo, hi):
        line = lines[j]
        for category, patterns in LEAKAGE.items():
            fam = FAMILY[category]
            if fam in families:
                continue
            for pat in patterns:
                if re.search(pat, line):
                    families.add(fam)
                    break
        # Cross-stack hints — keywords that signal multi-stack docs without
        # themselves being leakage patterns (Rails, Django, Express, Go, Rust…).
        for fam, rx in CROSS_STACK_RE.items():
            if fam in families:
                continue
            if rx.search(line):
                families.add(fam)
    return families


def scan_file(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    hits: list[dict] = []
    for category, patterns in LEAKAGE.items():
        for pat in patterns:
            rx = re.compile(pat)
            for i, line in enumerate(lines, start=1):
                if rx.search(line):
                    families = _families_in_window(lines, i - 1)
                    hits.append({
                        "line": i,
                        "category": category,
                        "pattern": pat,
                        "snippet": line.strip()[:160],
                        "cross_stack": len(families) >= 2,
                    })
    return hits


def iter_md_files(paths: Iterable[str]) -> Iterable[Path]:
    for raw in paths:
        target = (REPO_ROOT / raw) if not Path(raw).is_absolute() else Path(raw)
        if not target.exists():
            print(f"error: path does not exist: {raw}", file=sys.stderr)
            sys.exit(2)
        if target.is_file() and target.suffix == ".md":
            yield target
            continue
        for f in sorted(target.rglob("*.md")):
            if f.name.startswith("_"):
                continue
            yield f


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Lint generic skills/rules/commands for framework leakage."
    )
    parser.add_argument("--json", action="store_true", help="emit JSON to stdout")
    parser.add_argument("--quiet", action="store_true", help="only print summary line")
    parser.add_argument(
        "--paths",
        nargs="+",
        default=list(DEFAULT_PATHS),
        help="paths to scan (default: the three generic dirs)",
    )
    args = parser.parse_args(argv)

    allowlist = _load_allowlist()
    file_hits: list[tuple[Path, list[dict]]] = []
    total_hits = 0
    allowlisted_total = 0

    for f in iter_md_files(args.paths):
        if is_carve_out(f):
            continue
        if is_inventory_file(f):
            continue
        if has_framework_frontmatter(f):
            continue
        rel = str(f.relative_to(REPO_ROOT))
        raw_hits = scan_file(f)
        if not raw_hits:
            continue
        kept: list[dict] = []
        for h in raw_hits:
            if h["cross_stack"]:
                continue
            if _allowlisted(rel, h["line"], allowlist):
                h["allowlisted"] = True
                allowlisted_total += 1
                continue
            h["allowlisted"] = False
            kept.append(h)
        if kept:
            file_hits.append((f, kept))
            total_hits += len(kept)

    summary = {
        "total_hits": total_hits,
        "files": len(file_hits),
        "allowlisted": allowlisted_total,
    }

    if args.json:
        out = {
            "version": 1,
            "hits": [
                {
                    "file": str(p.relative_to(REPO_ROOT)),
                    **h,
                }
                for p, hits in file_hits
                for h in hits
            ],
            "summary": summary,
        }
        print(json.dumps(out, indent=2))
        return 1 if total_hits else 0

    if not args.quiet:
        for path, hits in file_hits:
            rel = path.relative_to(REPO_ROOT)
            print(f"\n{rel}")
            for h in hits:
                print(
                    f"  L{h['line']:4d}  {h['category']:<16s}"
                    f"  /{h['pattern']}/  {h['snippet']}"
                )

    print(
        f"\n{total_hits} hits across {len(file_hits)} files "
        f"({allowlisted_total} allowlisted)"
    )
    return 1 if total_hits else 0


if __name__ == "__main__":
    sys.exit(main())
