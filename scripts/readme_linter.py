#!/usr/bin/env python3
"""
README quality linter for agent-config repositories.

Detects weak, misleading, or incomplete READMEs by cross-checking
against actual repository files (Taskfile.yml, package.json, etc.).

Checks:
- Missing title, summary, installation, usage example
- Weak quickstart (example too far from install)
- Missing compatibility/requirements for packages
- Generic boilerplate phrases
- Command mismatches (documented but not in repo)
- Bad section order (architecture before install)
- Overloaded README (too long)
- Missing dev workflow when tests/CI exist

Exit codes:
0 = pass
1 = warnings only
2 = errors
3 = internal error
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import List, Literal, Optional

Severity = Literal["error", "warning", "info"]
RepoType = Literal["package", "app", "cli", "internal", "unknown"]


# --- Patterns ---

H1_PATTERN = re.compile(r"^# .+", re.MULTILINE)
H2_PATTERN = re.compile(r"^## (.+?)\s*$", re.MULTILINE)
CODE_BLOCK_PATTERN = re.compile(r"```[\s\S]*?```", re.MULTILINE)
INLINE_COMMAND_PATTERN = re.compile(r"`((?:task|npm run|make)\s+[\w:_-]+(?:\s+[\w:_-]+)?)`")

# Built-in commands that are always valid (not custom scripts)
BUILTIN_COMMANDS = {
    "composer install", "composer update", "composer require", "composer remove",
    "npm install", "npm uninstall", "npm init", "npm test", "npm start",
    "yarn add", "yarn remove", "yarn install",
    "pnpm add", "pnpm remove", "pnpm install",
    "php artisan", "cargo build", "cargo test", "go build", "go test",
    "git clone", "git submodule",
}

INSTALL_HEADINGS = {
    "installation", "install", "setup", "getting started", "quickstart",
    "how to install", "installing",
}
USAGE_HEADINGS = {
    "usage", "quickstart", "quick start", "getting started",
    "how to use", "how it works", "basic usage", "examples",
    "minimal example", "minimal usage",
}
COMPAT_HEADINGS = {
    "requirements", "compatibility", "prerequisites", "supported versions",
    "system requirements", "dependencies",
}
DEV_HEADINGS = {
    "development", "contributing", "testing", "dev", "local development",
    "developer guide", "running tests", "development setup",
}
ARCHITECTURE_HEADINGS = {
    "architecture", "internals", "design", "how it works internally",
    "technical details", "implementation",
}

GENERIC_BOILERPLATE = [
    r"(?i)\bmodern and scalable\b",
    r"(?i)\bpowerful and flexible\b",
    r"(?i)\bsimple and intuitive\b",
    r"(?i)\bblazing fast\b",
    r"(?i)\bnext[- ]gen(?:eration)?\b",
    r"(?i)\bworld[- ]class\b",
    r"(?i)\bcutting[- ]edge\b",
    r"(?i)\bseamless(?:ly)? integrat",
    r"(?i)\brobust and reliable\b",
    r"(?i)\blightweight yet powerful\b",
]

OVERLOADED_LINE_THRESHOLD = 500
WEAK_QUICKSTART_LINE_GAP = 80


# --- Data classes ---

@dataclass
class Issue:
    severity: Severity
    code: str
    message: str


@dataclass
class ReadmeLintResult:
    file: str
    repo_type: RepoType
    status: Literal["pass", "pass_with_warnings", "fail"]
    issues: List[Issue]
    line_count: int


@dataclass
class RepoContext:
    """Extracted context about the repository."""
    repo_type: RepoType = "unknown"
    has_composer: bool = False
    has_package_json: bool = False
    has_taskfile: bool = False
    has_makefile: bool = False
    has_dockerfile: bool = False
    has_tests: bool = False
    has_ci: bool = False
    taskfile_tasks: list[str] = field(default_factory=list)
    npm_scripts: list[str] = field(default_factory=list)
    composer_scripts: list[str] = field(default_factory=list)
    make_targets: list[str] = field(default_factory=list)


# --- Repo detection ---

def detect_repo_context(root: Path) -> RepoContext:
    ctx = RepoContext()
    ctx.has_composer = (root / "composer.json").exists()
    ctx.has_package_json = (root / "package.json").exists()
    ctx.has_taskfile = (root / "Taskfile.yml").exists() or (root / "Taskfile.yaml").exists()
    ctx.has_makefile = (root / "Makefile").exists()
    ctx.has_dockerfile = (root / "Dockerfile").exists() or (root / "docker-compose.yml").exists()
    ctx.has_tests = (root / "tests").is_dir() or (root / "test").is_dir()
    ctx.has_ci = (root / ".github" / "workflows").is_dir()

    # Extract available commands
    ctx.taskfile_tasks = _extract_taskfile_tasks(root)
    ctx.npm_scripts = _extract_npm_scripts(root)
    ctx.composer_scripts = _extract_composer_scripts(root)
    ctx.make_targets = _extract_make_targets(root)

    # Detect repo type
    ctx.repo_type = _detect_repo_type(root, ctx)
    return ctx


def _detect_repo_type(root: Path, ctx: RepoContext) -> RepoType:
    # Package signals
    if ctx.has_composer:
        try:
            data = json.loads((root / "composer.json").read_text())
            pkg_type = data.get("type", "")
            if pkg_type in ("library", "composer-plugin", "symfony-bundle"):
                return "package"
            # No app bootstrap = likely package
            if not (root / "artisan").exists() and not (root / "public" / "index.php").exists():
                return "package"
        except (json.JSONDecodeError, OSError):
            pass

    if ctx.has_package_json:
        try:
            data = json.loads((root / "package.json").read_text())
            if data.get("main") or data.get("exports") or data.get("module"):
                return "package"
        except (json.JSONDecodeError, OSError):
            pass

    # CLI signals
    bin_dir = root / "bin"
    if bin_dir.is_dir() and any(bin_dir.iterdir()):
        return "cli"

    # App signals
    if (root / "artisan").exists() or (root / "public" / "index.php").exists():
        return "app"
    if ctx.has_dockerfile and (root / "src").is_dir():
        return "app"

    # Internal/config signals
    augment_dir = root / ".augment"
    agents_dir = root / "agents"
    if augment_dir.is_dir() or agents_dir.is_dir():
        return "internal"

    return "unknown"


def _extract_taskfile_tasks(root: Path) -> list[str]:
    for name in ("Taskfile.yml", "Taskfile.yaml"):
        path = root / name
        if path.exists():
            try:
                text = path.read_text()
                return re.findall(r"^\s{2}([\w_-]+):", text, re.MULTILINE)
            except OSError:
                pass
    return []


def _extract_npm_scripts(root: Path) -> list[str]:
    path = root / "package.json"
    if path.exists():
        try:
            data = json.loads(path.read_text())
            return list(data.get("scripts", {}).keys())
        except (json.JSONDecodeError, OSError):
            pass
    return []


def _extract_composer_scripts(root: Path) -> list[str]:
    path = root / "composer.json"
    if path.exists():
        try:
            data = json.loads(path.read_text())
            return list(data.get("scripts", {}).keys())
        except (json.JSONDecodeError, OSError):
            pass
    return []


def _extract_make_targets(root: Path) -> list[str]:
    path = root / "Makefile"
    if path.exists():
        try:
            text = path.read_text()
            return re.findall(r"^([\w_-]+)\s*:", text, re.MULTILINE)
        except OSError:
            pass
    return []


# --- Core checks ---

def lint_readme(readme_path: Path, repo_root: Path) -> ReadmeLintResult:
    """Run all checks on a README file."""
    issues: list[Issue] = []
    text = readme_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    line_count = len(lines)
    ctx = detect_repo_context(repo_root)

    headings = [m.group(1).strip() for m in H2_PATTERN.finditer(text)]
    headings_lower = {h.lower() for h in headings}

    # 1. Missing title
    if not H1_PATTERN.search(text):
        issues.append(Issue("error", "readme_missing_title", "No H1 heading found"))

    # 2. Missing summary
    _check_summary(text, issues)

    # 3. Missing installation
    _check_installation(headings_lower, ctx, issues)

    # 4. Missing usage example
    _check_usage_example(text, headings_lower, ctx, issues)

    # 5. Weak quickstart
    _check_quickstart_distance(text, headings, issues)

    # 6. Missing compatibility (packages)
    _check_compatibility(headings_lower, ctx, issues)

    # 7. Generic boilerplate
    _check_boilerplate(text, issues)

    # 8. Missing dev workflow
    _check_dev_workflow(headings_lower, ctx, issues)

    # 9. Command mismatches
    _check_command_mismatches(text, ctx, issues)

    # 10. Bad section order
    _check_section_order(headings, issues)

    # 11. Overloaded README
    _check_overloaded(line_count, issues)

    # Determine status
    has_errors = any(i.severity == "error" for i in issues)
    has_warnings = any(i.severity == "warning" for i in issues)
    if has_errors:
        status = "fail"
    elif has_warnings:
        status = "pass_with_warnings"
    else:
        status = "pass"

    return ReadmeLintResult(
        file=str(readme_path),
        repo_type=ctx.repo_type,
        status=status,
        issues=issues,
        line_count=line_count,
    )


# --- Individual checks ---

def _check_summary(text: str, issues: list[Issue]) -> None:
    """Check if there's a summary paragraph after the title."""
    h1 = H1_PATTERN.search(text)
    if not h1:
        return
    after_title = text[h1.end():h1.end() + 300]
    # Strip leading whitespace and check for text before next heading
    after_stripped = after_title.strip()
    if not after_stripped or after_stripped.startswith("## ") or after_stripped.startswith("```"):
        issues.append(Issue("warning", "readme_missing_summary",
                            "No summary paragraph after title"))


def _check_installation(headings_lower: set[str], ctx: RepoContext, issues: list[Issue]) -> None:
    """Check for installation/setup section."""
    if ctx.repo_type in ("unknown",):
        return
    if not headings_lower & INSTALL_HEADINGS:
        severity = "error" if ctx.repo_type in ("package", "app", "cli") else "warning"
        issues.append(Issue(severity, "readme_missing_installation",
                            f"No installation/setup section found ({ctx.repo_type} repo)"))


def _check_usage_example(text: str, headings_lower: set[str], ctx: RepoContext,
                          issues: list[Issue]) -> None:
    """Check for usage examples with code blocks."""
    if ctx.repo_type == "unknown":
        return
    has_usage_heading = bool(headings_lower & USAGE_HEADINGS)
    code_blocks = CODE_BLOCK_PATTERN.findall(text)
    if not code_blocks:
        issues.append(Issue("error" if ctx.repo_type == "package" else "warning",
                            "readme_missing_usage_example",
                            "No code blocks found — likely missing usage examples"))
    elif not has_usage_heading and ctx.repo_type in ("package", "cli"):
        issues.append(Issue("warning", "readme_missing_usage_example",
                            "No usage/quickstart section heading found"))


def _check_quickstart_distance(text: str, headings: list[str], issues: list[Issue]) -> None:
    """Check if first code block appears too far after install heading."""
    install_line = None
    first_code_line = None
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if install_line is None:
            heading_text = re.match(r"^## (.+)", line)
            if heading_text and heading_text.group(1).strip().lower() in INSTALL_HEADINGS:
                install_line = i
        if first_code_line is None and line.startswith("```"):
            first_code_line = i

    if install_line is not None and first_code_line is not None:
        gap = first_code_line - install_line
        if gap > WEAK_QUICKSTART_LINE_GAP:
            issues.append(Issue("warning", "readme_weak_quickstart",
                                f"First code block is {gap} lines after install heading"))


def _check_compatibility(headings_lower: set[str], ctx: RepoContext,
                          issues: list[Issue]) -> None:
    """Check for requirements/compatibility section in packages."""
    if ctx.repo_type != "package":
        return
    if not headings_lower & COMPAT_HEADINGS:
        issues.append(Issue("warning", "readme_missing_compatibility",
                            "Package repo has no requirements/compatibility section"))


def _check_boilerplate(text: str, issues: list[Issue]) -> None:
    """Detect generic marketing boilerplate."""
    matches = []
    for pattern in GENERIC_BOILERPLATE:
        found = re.findall(pattern, text)
        matches.extend(found)
    if matches:
        examples = ", ".join(f'"{m}"' for m in matches[:3])
        issues.append(Issue("warning", "readme_generic_boilerplate",
                            f"Generic boilerplate detected: {examples}"))


def _check_dev_workflow(headings_lower: set[str], ctx: RepoContext,
                         issues: list[Issue]) -> None:
    """Check for dev/testing section when repo has tests or CI."""
    if not (ctx.has_tests or ctx.has_ci):
        return
    if not headings_lower & DEV_HEADINGS:
        issues.append(Issue("warning", "readme_missing_dev_workflow",
                            "Repo has tests/CI but README has no development/testing section"))


def _check_command_mismatches(text: str, ctx: RepoContext, issues: list[Issue]) -> None:
    """Check if commands in README actually exist in the repo."""
    documented_commands = INLINE_COMMAND_PATTERN.findall(text)
    if not documented_commands:
        return

    known_commands: set[str] = set()
    for task in ctx.taskfile_tasks:
        known_commands.add(f"task {task}")
    for script in ctx.npm_scripts:
        known_commands.add(f"npm {script}")
        known_commands.add(f"npm run {script}")
    for script in ctx.composer_scripts:
        known_commands.add(f"composer {script}")
    for target in ctx.make_targets:
        known_commands.add(f"make {target}")

    if not known_commands:
        return  # Can't verify without extracted commands

    mismatches = []
    for cmd in documented_commands:
        cmd_clean = cmd.strip()
        # Check if any known command is a prefix match
        if not any(cmd_clean.startswith(known) or known.startswith(cmd_clean)
                   for known in known_commands):
            mismatches.append(cmd_clean)

    if mismatches:
        examples = ", ".join(f"`{m}`" for m in mismatches[:5])
        issues.append(Issue("warning", "readme_command_mismatch",
                            f"Commands in README not found in repo: {examples}"))


def _check_section_order(headings: list[str], issues: list[Issue]) -> None:
    """Check if architecture/internals appear before installation/usage."""
    install_idx = None
    arch_idx = None
    for i, h in enumerate(headings):
        h_lower = h.lower()
        if install_idx is None and h_lower in INSTALL_HEADINGS | USAGE_HEADINGS:
            install_idx = i
        if arch_idx is None and h_lower in ARCHITECTURE_HEADINGS:
            arch_idx = i

    if arch_idx is not None and install_idx is not None and arch_idx < install_idx:
        issues.append(Issue("warning", "readme_bad_section_order",
                            "Architecture/internals section appears before installation/usage"))


def _check_overloaded(line_count: int, issues: list[Issue]) -> None:
    """Check if README is too long."""
    if line_count > OVERLOADED_LINE_THRESHOLD:
        issues.append(Issue("warning", "readme_overloaded",
                            f"README has {line_count} lines (threshold: {OVERLOADED_LINE_THRESHOLD})."
                            " Consider moving deep content to /docs"))


# --- Output formatting ---

def format_text(result: ReadmeLintResult) -> str:
    """Format result as human-readable text."""
    status_icon = {"pass": "✅", "pass_with_warnings": "⚠️", "fail": "❌"}
    lines = [f"{status_icon.get(result.status, '?')} {result.file} "
             f"(type: {result.repo_type}, {result.line_count} lines)"]

    if not result.issues:
        lines.append("  No issues found.")
        return "\n".join(lines)

    severity_icon = {"error": "❌", "warning": "⚠️", "info": "ℹ️"}
    for issue in result.issues:
        icon = severity_icon.get(issue.severity, "?")
        lines.append(f"  {icon} [{issue.code}] {issue.message}")

    return "\n".join(lines)


def format_json(result: ReadmeLintResult) -> str:
    """Format result as JSON."""
    data = {
        "file": result.file,
        "repo_type": result.repo_type,
        "status": result.status,
        "line_count": result.line_count,
        "issues": [asdict(i) for i in result.issues],
        "summary": {
            "error": sum(1 for i in result.issues if i.severity == "error"),
            "warning": sum(1 for i in result.issues if i.severity == "warning"),
            "info": sum(1 for i in result.issues if i.severity == "info"),
        },
    }
    return json.dumps(data, indent=2)


def format_markdown(result: ReadmeLintResult) -> str:
    """Format result as markdown for PR comments."""
    lines = [f"## 📝 README Lint: {result.file}", ""]
    lines.append(f"**Repo type:** {result.repo_type} · **Lines:** {result.line_count}")
    lines.append("")

    if not result.issues:
        lines.append("✅ No issues found.")
        return "\n".join(lines)

    errors = [i for i in result.issues if i.severity == "error"]
    warnings = [i for i in result.issues if i.severity == "warning"]
    infos = [i for i in result.issues if i.severity == "info"]

    lines.append(f"| Errors | Warnings | Info |")
    lines.append(f"|---|---|---|")
    lines.append(f"| {len(errors)} | {len(warnings)} | {len(infos)} |")
    lines.append("")

    if errors:
        lines.append("### ❌ Errors")
        lines.append("")
        for i in errors:
            lines.append(f"- `{i.code}`: {i.message}")
        lines.append("")

    if warnings:
        lines.append("### ⚠️ Warnings")
        lines.append("")
        for i in warnings:
            lines.append(f"- `{i.code}`: {i.message}")
        lines.append("")

    if infos:
        lines.append("### ℹ️ Info")
        lines.append("")
        for i in infos:
            lines.append(f"- `{i.code}`: {i.message}")

    return "\n".join(lines)


# --- CLI ---

def main() -> int:
    parser = argparse.ArgumentParser(description="README quality linter")
    parser.add_argument("readme", nargs="?", default="README.md",
                        help="Path to README file (default: README.md)")
    parser.add_argument("--root", default=".",
                        help="Repository root directory (default: cwd)")
    parser.add_argument("--format", choices=["text", "json", "markdown"], default="text",
                        help="Output format (default: text)")
    parser.add_argument("--strict", action="store_true",
                        help="Treat warnings as errors")
    args = parser.parse_args()

    readme_path = Path(args.readme)
    repo_root = Path(args.root)

    if not readme_path.exists():
        print(f"❌ README not found: {readme_path}", file=sys.stderr)
        return 3

    try:
        result = lint_readme(readme_path, repo_root)
    except Exception as e:
        print(f"❌ Internal error: {e}", file=sys.stderr)
        return 3

    if args.format == "json":
        print(format_json(result))
    elif args.format == "markdown":
        print(format_markdown(result))
    else:
        print(format_text(result))

    if result.status == "fail":
        return 2
    if result.status == "pass_with_warnings" and args.strict:
        return 2
    if result.status == "pass_with_warnings":
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())