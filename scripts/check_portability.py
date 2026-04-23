#!/usr/bin/env python3
"""
Portability checker for agent-config packages.

Scans .agent-src/ and .agent-src.uncompressed/ for project-specific references
that violate package portability (the package must work in ANY project).

Allowed: references to packages/libraries (laravel, pest, phpstan, etc.)
Forbidden: references to specific projects, repos, domains, teams, customers

Exit codes: 0 = clean, 1 = violations found, 3 = internal error
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Literal

Severity = Literal["error", "warning"]


@dataclass
class Violation:
    file: str
    line: int
    match: str
    pattern_name: str
    severity: Severity
    context: str  # the full line for review


# ── Auto-detected project identifiers ────────────────────────────────────
# Instead of hardcoding project names, we auto-detect them from:
# 1. Git remote URL (org name, repo name)
# 2. composer.json / package.json (package name)
# 3. Directory name (workspace root)
# This makes the checker portable across ANY project.


def _detect_project_identifiers(root: Path) -> set[str]:
    """Auto-detect project-specific identifiers from the project context."""
    identifiers: set[str] = set()

    # 1. Git remote URL
    try:
        import subprocess
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True, text=True, cwd=root, timeout=5,
        )
        if result.returncode == 0:
            url = result.stdout.strip()
            # Extract from SSH: git@github.com:org/repo.git
            # Extract from HTTPS: https://github.com/org/repo.git
            parts = re.split(r"[:/]", url.replace(".git", ""))
            # Last 2 parts are typically org and repo
            for part in parts[-2:]:
                part = part.strip()
                if part and part not in ("git", "github.com", "gitlab.com", "bitbucket.org", "com"):
                    identifiers.add(part)
                    # Also add sub-parts split by hyphen (e.g., "event4u-app" → "event4u")
                    for sub in part.split("-"):
                        if len(sub) >= 3:
                            identifiers.add(sub)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # 2. composer.json
    composer = root / "composer.json"
    if composer.exists():
        try:
            data = json.loads(composer.read_text(encoding="utf-8"))
            name = data.get("name", "")
            if "/" in name:
                vendor, pkg = name.split("/", 1)
                identifiers.add(vendor)
                identifiers.add(pkg)
                for sub in pkg.split("-"):
                    if len(sub) >= 3:
                        identifiers.add(sub)
        except (json.JSONDecodeError, ValueError):
            pass

    # 3. package.json
    pkgjson = root / "package.json"
    if pkgjson.exists():
        try:
            data = json.loads(pkgjson.read_text(encoding="utf-8"))
            name = data.get("name", "").lstrip("@")
            if "/" in name:
                scope, pkg = name.split("/", 1)
                identifiers.add(scope)
                identifiers.add(pkg)
            elif name:
                identifiers.add(name)
        except (json.JSONDecodeError, ValueError):
            pass

    # 4. Directory name (parent directories of .agent-src/)
    augment_dir = root / ".agent-src"
    if augment_dir.exists():
        dir_name = root.name
        if len(dir_name) >= 3:
            identifiers.add(dir_name)
        # Also check parent (often the org/group directory)
        parent_name = root.parent.name
        if len(parent_name) >= 3 and parent_name not in ("projects", "src", "code", "repos", "home", "Users"):
            identifiers.add(parent_name)

    # Filter out generic terms that would cause false positives
    generic = {"app", "api", "web", "src", "lib", "pkg", "core", "main", "test",
               "config", "agent", "tools", "packages", "server", "client", "common"}
    identifiers -= generic

    return identifiers


def _build_patterns(root: Path) -> tuple[list[tuple[re.Pattern, str, Severity]], list[str]]:
    """Build regex patterns from auto-detected project identifiers."""
    identifiers = _detect_project_identifiers(root)
    patterns: list[tuple[re.Pattern, str, Severity]] = []
    detected: list[str] = sorted(identifiers)

    for ident in identifiers:
        escaped = re.escape(ident)
        # Word boundary match (case-insensitive)
        patterns.append((re.compile(rf"\b{escaped}\b", re.IGNORECASE), "project-name", "error"))
        # As prefix with separator (db names, container names, env vars)
        patterns.append((re.compile(rf"\b{escaped}[-_]\w+", re.IGNORECASE), "project-derivative", "warning"))
        # Domain patterns (name.tld)
        patterns.append((re.compile(rf"\b{escaped}\.\w{{2,6}}\b", re.IGNORECASE), "project-domain", "error"))
        # GitHub org/user patterns
        patterns.append((re.compile(rf"@{escaped}\b", re.IGNORECASE), "project-org", "error"))

    return patterns, detected

# ── Allowed patterns (NOT violations even if they match above) ──────────
# Generic Laravel/framework patterns that are NOT project-specific
ALLOWLIST = [
    r"\.agent-settings\.yml",      # config file reference (YAML)
    r"\.agent-settings\b",         # legacy reference (key=value, migration window)
    r"agents/overrides/",          # override system
    r"app/Modules/",               # generic Laravel module pattern
    r"`App\\",                     # namespace pattern explanation
    r"app/Http/Controllers/",      # generic Laravel path pattern
    r"app/Repositories/",          # generic pattern in skills/guidelines
    r"\.module-template",          # module template
    r"ModuleServiceProvider",      # generic module concept
    r"app/Services/MyService",     # example placeholder
    r"app/Models/\{",              # template placeholder like {Model}
    r"app/Services/\{",            # template placeholder like {Service}
    r"agent-config",               # refers to the package concept, not a specific project
    r"shared.*package",            # "shared package" concept
    r"package repository",         # "package repository" concept
]

# Directories to scan (only package files, not project-specific agents/)
SCAN_DIRS = [".agent-src", ".agent-src.uncompressed"]

# Additional root-level files shipped by the package that must also stay
# portable. These are read by agents working on the package itself and —
# for AGENTS.md and copilot-instructions.md — serve as meta docs about
# the package. They must never leak consumer-project identifiers.
SCAN_ROOT_FILES = ["AGENTS.md", ".github/copilot-instructions.md"]

# Skip these subdirectories (they ARE allowed to be project-specific)
SKIP_PATTERNS = [
    "agents/",              # project-specific by design
    ".agent-settings.yml",  # project config (YAML)
    ".agent-settings",      # legacy project config (migration window)
]

# Optional blocklist of identifiers from past/adjacent projects that must
# never appear anywhere in the shared package, even when the auto-detector
# would not flag them (e.g. because the repo was renamed or split). The
# list is loaded from the environment variable AGENT_CONFIG_BLOCKLIST
# (comma-separated) so the package itself ships without hardcoding any
# consumer-specific names. Maintainers of a fork with legacy debt can set
# the variable in their CI to catch regressions.
def _load_forbidden_identifiers() -> list[str]:
    raw = __import__("os").environ.get("AGENT_CONFIG_BLOCKLIST", "")
    return [part.strip() for part in raw.split(",") if part.strip()]


FORBIDDEN_IDENTIFIERS: list[str] = _load_forbidden_identifiers()


def _compile_patterns(root: Path) -> tuple[list[tuple[re.Pattern, str, Severity]], list[str]]:
    """Build patterns from auto-detected project identifiers."""
    return _build_patterns(root)


def _compile_forbidden_patterns() -> list[tuple[re.Pattern, str, Severity]]:
    """Build regex patterns for hardcoded FORBIDDEN_IDENTIFIERS.

    These apply to every scanned file regardless of auto-detection. They
    catch leakage from renamed or adjacent projects.
    """
    patterns: list[tuple[re.Pattern, str, Severity]] = []
    for ident in FORBIDDEN_IDENTIFIERS:
        escaped = re.escape(ident)
        patterns.append((re.compile(rf"\b{escaped}\b", re.IGNORECASE), "forbidden-identifier", "error"))
    return patterns


def _compile_allowlist() -> list[re.Pattern]:
    return [re.compile(p) for p in ALLOWLIST]


def check_file(filepath: Path, patterns: list, allowlist: list) -> List[Violation]:
    violations: List[Violation] = []
    try:
        lines = filepath.read_text(encoding="utf-8").splitlines()
    except Exception:
        return violations

    in_code_block = False
    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Skip YAML frontmatter
        if i <= 10 and stripped == "---":
            continue

        # Track code blocks
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        # Check allowlist first
        if any(a.search(line) for a in allowlist):
            continue

        for pattern, name, severity in patterns:
            for m in pattern.finditer(line):
                violations.append(Violation(
                    file=str(filepath), line=i, match=m.group(0),
                    pattern_name=name, severity=severity, context=stripped,
                ))

    return violations


# ── Task-command detector ───────────────────────────────────────────────
# Artefact files shipped in the package must not reference `task <name>`
# invocations (per augment-portability rule). Consumer projects may not
# have Taskfile installed; agents must use direct script paths instead.
ARTIFACT_SUBDIRS = ["skills", "rules", "commands", "guidelines", "personas", "contexts"]

# Inline code: `task foo` or `task foo-bar` or `task foo:bar`
_TASK_INLINE_RE = re.compile(r"`task\s+([a-z][a-z0-9:_-]*)`")
# Code-fence line: "task foo …" (optional leading whitespace)
_TASK_FENCE_RE = re.compile(r"^\s*task\s+([a-z][a-z0-9:_-]*)\b")

# Files that legitimately document the forbidden pattern — they define
# the rule itself. Any path containing one of these suffixes is skipped
# by the task-invocation detector (but still scanned for layer 1 + 2).
_TASK_DETECTOR_SKIP = (
    "rules/augment-portability.md",
)


def check_task_invocations(filepath: Path) -> List[Violation]:
    """Flag `task <cmd>` invocations in inline code or code fence lines."""
    violations: List[Violation] = []
    try:
        lines = filepath.read_text(encoding="utf-8").splitlines()
    except Exception:
        return violations

    in_code_block = False
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            m = _TASK_FENCE_RE.search(line)
            if m:
                violations.append(Violation(
                    file=str(filepath), line=i, match=m.group(0).strip(),
                    pattern_name="task-invocation", severity="error",
                    context=stripped,
                ))
        else:
            for m in _TASK_INLINE_RE.finditer(line):
                violations.append(Violation(
                    file=str(filepath), line=i, match=m.group(0),
                    pattern_name="task-invocation", severity="error",
                    context=stripped,
                ))

    return violations


# ── Direct script-invocation detector ───────────────────────────────────
# Artefacts shipped to consumers must use the `./agent-config` CLI for
# commands it already covers. Direct `python3 scripts/…` / `bash scripts/…`
# invocations only work inside the package repo, not in a consumer project
# where the scripts live under node_modules/ or vendor/.
#
# Each entry: (regex, suggested replacement). Patterns match inside inline
# backticks OR anywhere on a code-fence line.
_CLI_INVOCATION_MAP: list[tuple[re.Pattern, str]] = [
    (
        re.compile(r"python3\s+scripts/mcp_render\.py\s+--check\b"),
        "./agent-config mcp:check",
    ),
    (
        re.compile(r"python3\s+scripts/mcp_render\.py\b"),
        "./agent-config mcp:render",
    ),
    (
        re.compile(r"python3\s+\.(?:agent-src|augment)/scripts/update_roadmap_progress\.py\s+--check\b"),
        "./agent-config roadmap:progress-check",
    ),
    (
        re.compile(r"python3\s+\.(?:agent-src|augment)/scripts/update_roadmap_progress\.py\b"),
        "./agent-config roadmap:progress",
    ),
    (
        re.compile(r"bash\s+scripts/first-run\.sh\b"),
        "./agent-config first-run",
    ),
]

# Paths that legitimately document the raw invocations (e.g. the CLI's
# own help, the portability rule that defines the mapping).
_CLI_DETECTOR_SKIP = (
    "rules/augment-portability.md",
)


def check_cli_invocations(filepath: Path) -> List[Violation]:
    """Flag direct script invocations that should go through `./agent-config`."""
    violations: List[Violation] = []
    try:
        lines = filepath.read_text(encoding="utf-8").splitlines()
    except Exception:
        return violations

    in_code_block = False
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            continue

        # In prose lines, only check content inside inline `...` spans to
        # avoid false positives in running text. In code fences, check the
        # whole line.
        if in_code_block:
            segments = [line]
        else:
            segments = re.findall(r"`([^`]+)`", line)

        for seg in segments:
            for pattern, replacement in _CLI_INVOCATION_MAP:
                m = pattern.search(seg)
                if m:
                    violations.append(Violation(
                        file=str(filepath), line=i, match=m.group(0),
                        pattern_name=f"cli-bypass → use `{replacement}`",
                        severity="error", context=stripped,
                    ))
                    break  # one hit per segment is enough

    return violations


def scan_all(root: Path) -> tuple[List[Violation], list[str]]:
    """Scan all package files for portability violations. Returns (violations, detected_identifiers).

    Scanning has four layers:
    1. Auto-detected identifiers — applied to `.agent-src/` and
       `.agent-src.uncompressed/` only. The package's own root AGENTS.md and
       copilot-instructions.md are meta docs ABOUT the package, so the
       detector's own hits (e.g. "event4u", "agent-config") are expected.
    2. Optional FORBIDDEN_IDENTIFIERS from AGENT_CONFIG_BLOCKLIST —
       applied to every scanned file, including the root files. Catches
       leakage from renamed or adjacent projects in downstream forks.
    3. `task <name>` invocations inside artefact subdirs — skills, rules,
       commands, guidelines, personas, contexts. These shipped artefacts
       run in consumer projects that may not have Taskfile installed.
    4. Direct script invocations that bypass the `./agent-config` CLI
       (e.g. `python3 scripts/mcp_render.py`). Same artefact-subdir scope
       as layer 3; consumer projects only have the package under
       `node_modules/` or `vendor/`, so the raw paths never resolve.
    """
    patterns, detected = _compile_patterns(root)
    forbidden = _compile_forbidden_patterns()
    allowlist = _compile_allowlist()
    violations: List[Violation] = []

    # Layer 1 + 2: full package content
    for scan_dir in SCAN_DIRS:
        d = root / scan_dir
        if not d.exists():
            continue
        for f in sorted(d.rglob("*.md")):
            violations.extend(check_file(f, patterns + forbidden, allowlist))

    # Layer 2 only: root files (auto-detected identifiers are expected here)
    for rel in SCAN_ROOT_FILES:
        f = root / rel
        if f.is_file():
            violations.extend(check_file(f, forbidden, allowlist))

    # Layer 3 + 4: artefact-subdir-only scans (task invocations, CLI bypass)
    for scan_dir in SCAN_DIRS:
        base = root / scan_dir
        if not base.exists():
            continue
        for sub in ARTIFACT_SUBDIRS:
            d = base / sub
            if not d.exists():
                continue
            for f in sorted(d.rglob("*.md")):
                path_str = str(f)
                if not any(path_str.endswith(skip) for skip in _TASK_DETECTOR_SKIP):
                    violations.extend(check_task_invocations(f))
                if not any(path_str.endswith(skip) for skip in _CLI_DETECTOR_SKIP):
                    violations.extend(check_cli_invocations(f))

    return violations, detected



def format_text(violations: List[Violation], detected: list[str]) -> str:
    header = f"Auto-detected identifiers: {', '.join(detected)}\n" if detected else ""
    if not violations:
        return f"{header}✅  No portability violations found."
    lines = [f"{header}❌  Found {len(violations)} portability violation(s):\n"]
    for v in violations:
        icon = "🔴" if v.severity == "error" else "🟡"
        lines.append(f"  {icon} {v.file}:{v.line} — [{v.pattern_name}] `{v.match}`")
        lines.append(f"      {v.context}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check agent-config package portability")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    args = parser.parse_args()

    try:
        violations, detected = scan_all(args.root)
    except Exception as e:
        print(f"Internal error: {e}", file=sys.stderr)
        return 3

    if args.format == "json":
        payload = {"detected": detected, "violations": [asdict(v) for v in violations]}
        print(json.dumps(payload, indent=2))
    else:
        print(format_text(violations, detected))

    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())