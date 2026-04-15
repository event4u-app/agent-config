#!/usr/bin/env python3
"""
Minimal skill/rule linter for agent-config repositories.

MVP checks:
- Detect skill vs rule
- Required skill sections
- Basic rule validation
- Vague validation detection
- Output format presence
- Gotchas / Do NOT presence
- Single file, --all, --changed
- Text and JSON output

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
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, List, Literal, Optional

Severity = Literal["error", "warning", "info"]
ArtifactType = Literal["skill", "rule", "unknown"]


REQUIRED_SKILL_SECTIONS = [
    "When to use",
    "Procedure",
    "Output format",
    "Gotchas",
    "Do NOT",
]

RECOMMENDED_SKILL_SECTIONS = [
    "Preconditions",
    "Decision hints",
    "Anti-patterns",
    "Examples",
    "Environment notes",
]

RULE_BAD_SIGNS = [
    "## Procedure",
    "## Output format",
    "## Gotchas",
]

VAGUE_VALIDATION_PATTERNS = [
    r"\bcheck if it works\b",
    r"\bverify it works\b",
    r"\btest manually\b",
    r"\bcheck manually\b",
    r"\bmake sure it works\b",
]

TRIGGER_WARNING_PATTERNS = [
    r"\bgeneral helper\b",
    r"\blaravel skill\b",
    r"\bgeneral coding\b",
    r"\beverything about\b",
]

ORDERED_STEP_PATTERN = re.compile(r"^\s*(\d+)\.\s+", re.MULTILINE)
SECTION_PATTERN = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
FRONTMATTER_PATTERN = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
DESCRIPTION_PATTERN = re.compile(r'^description:\s*"?(.*?)"?\s*$', re.MULTILINE)
TYPE_PATTERN = re.compile(r'^type:\s*"?(always|auto)"?\s*$', re.MULTILINE)
SOURCE_PATTERN = re.compile(r'^source:\s*"?(package|project)"?\s*$', re.MULTILINE)
H1_PATTERN = re.compile(r"^# .+", re.MULTILINE)
DOUBLE_BLANK_PATTERN = re.compile(r"\n{3,}")

VALID_RULE_TYPES = {"always", "auto"}
VALID_RULE_SOURCES = {"package", "project"}


@dataclass
class Issue:
    severity: Severity
    code: str
    message: str


@dataclass
class LintResult:
    file: str
    artifact_type: ArtifactType
    status: Literal["pass", "pass_with_warnings", "fail"]
    issues: List[Issue]
    suggestions: List[str]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def extract_sections(text: str) -> set[str]:
    return {match.group(1).strip() for match in SECTION_PATTERN.finditer(text)}


def extract_description(text: str) -> Optional[str]:
    frontmatter = FRONTMATTER_PATTERN.search(text)
    if not frontmatter:
        return None
    description = DESCRIPTION_PATTERN.search(frontmatter.group(1))
    return description.group(1).strip() if description else None


def detect_artifact_type(path: Path, text: str) -> ArtifactType:
    path_str = str(path).lower()
    has_skill_heading = "## When to use" in text and "## Procedure" in text

    if path.name.lower() == "skill.md" or "/skills/" in path_str:
        return "skill"
    if "/rules/" in path_str:
        return "rule"
    if has_skill_heading:
        return "skill"
    return "unknown"


def classify_status(issues: List[Issue]) -> Literal["pass", "pass_with_warnings", "fail"]:
    severities = {issue.severity for issue in issues}
    if "error" in severities:
        return "fail"
    if "warning" in severities:
        return "pass_with_warnings"
    return "pass"



def extract_section_block(text: str, section_name: str) -> str:
    pattern = re.compile(
        rf"^##\s+{re.escape(section_name)}\s*$" r"(.*?)(?=^##\s+|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text)
    return match.group(1).strip() if match else ""


def parse_ordered_list_items(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if re.match(r"^\s*\d+\.\s+", line)]


def count_bullets(text: str) -> int:
    return sum(1 for line in text.splitlines() if re.match(r"^\s*[*-]\s+", line))


def has_validation_step(procedure_block: str) -> bool:
    lowered = procedure_block.lower()
    if "validate" in lowered or "validation" in lowered:
        return True
    good_signals = ["expected", "status code", "no errors", "appears in", "exact check", "concrete checks"]
    return any(signal in lowered for signal in good_signals)


def has_inspect_step(procedure_block: str) -> bool:
    lowered = procedure_block.lower()
    inspect_signals = ["inspect", "check current", "review existing", "identify", "analyze"]
    return any(signal in lowered for signal in inspect_signals)


def find_vague_validation(text: str) -> list[str]:
    hits: list[str] = []
    for pattern in VAGUE_VALIDATION_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            hits.append(match.group(0))
    return hits


def is_probably_too_broad(text: str, description: Optional[str]) -> bool:
    haystacks = [text.lower()]
    if description:
        haystacks.append(description.lower())
    combined = "\n".join(haystacks)
    broad_signals = ["everything about", "general", "all laravel", "all markdown", "helper for everything"]
    return any(signal in combined for signal in broad_signals)


def dedupe_preserve_order(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def lint_skill(path: Path, text: str) -> LintResult:
    issues: List[Issue] = []
    suggestions: List[str] = []

    sections = extract_sections(text)
    description = extract_description(text)

    for section in REQUIRED_SKILL_SECTIONS:
        if section not in sections:
            issues.append(Issue("error", "missing_section", f"Missing required section: {section}"))

    for section in RECOMMENDED_SKILL_SECTIONS:
        if section not in sections:
            issues.append(Issue("warning", "missing_recommended_section", f"Missing recommended section: {section}"))

    if description:
        if len(description) > 200:
            issues.append(Issue("warning", "description_too_long", "Description is longer than 200 characters"))
        for pattern in TRIGGER_WARNING_PATTERNS:
            if re.search(pattern, description, re.IGNORECASE):
                issues.append(Issue("warning", "weak_trigger", f"Description looks too generic: {description}"))
                break
    else:
        issues.append(Issue("warning", "missing_description", "Frontmatter description is missing or unreadable"))

    if "## Procedure" in text:
        procedure_block = extract_section_block(text, "Procedure")
        if not procedure_block:
            issues.append(Issue("error", "empty_procedure", "Procedure section is empty"))
        else:
            if not ORDERED_STEP_PATTERN.search(procedure_block):
                issues.append(Issue("error", "unordered_procedure", "Procedure has no ordered steps"))
            meaningful_steps = len(ORDERED_STEP_PATTERN.findall(procedure_block))
            if meaningful_steps < 3:
                issues.append(Issue("warning", "short_procedure", "Procedure has fewer than 3 ordered steps"))
            if not has_validation_step(procedure_block):
                issues.append(Issue("error", "missing_validation", "Procedure lacks a concrete validation step"))
            vague_hits = find_vague_validation(procedure_block)
            for hit in vague_hits:
                issues.append(Issue("error", "vague_validation", f"Vague validation detected: {hit}"))
            if not has_inspect_step(procedure_block):
                issues.append(Issue("warning", "missing_inspect_step", "Procedure has no explicit inspect/check step"))

    if "## Output format" in text:
        output_block = extract_section_block(text, "Output format")
        if not output_block or len(parse_ordered_list_items(output_block)) < 2:
            issues.append(Issue("warning", "weak_output_format", "Output format should contain at least 2 ordered requirements"))
            suggestions.append("Add 2-4 ordered output requirements")
    else:
        suggestions.append("Add an Output format section with ordered response constraints")

    if "## Gotchas" in text:
        gotchas_block = extract_section_block(text, "Gotchas")
        if count_bullets(gotchas_block) < 1:
            issues.append(Issue("warning", "weak_gotchas", "Gotchas should contain at least one realistic failure mode"))
    else:
        suggestions.append("Add at least one realistic failure pattern to Gotchas")

    if "## Do NOT" in text:
        do_not_block = extract_section_block(text, "Do NOT")
        if count_bullets(do_not_block) < 1:
            issues.append(Issue("warning", "weak_do_not", "Do NOT should contain at least one enforceable constraint"))
    else:
        suggestions.append("Add at least one enforceable Do NOT constraint")

    if is_probably_too_broad(text, description):
        issues.append(Issue("warning", "broad_scope", "Skill scope appears broad and may need splitting"))
        suggestions.append("Narrow the trigger or split unrelated workflows")

    return LintResult(
        file=str(path),
        artifact_type="skill",
        status=classify_status(issues),
        issues=issues,
        suggestions=dedupe_preserve_order(suggestions),
    )


def extract_frontmatter(text: str) -> Optional[str]:
    match = FRONTMATTER_PATTERN.search(text)
    return match.group(1) if match else None


def extract_frontmatter_field(frontmatter: str, pattern: re.Pattern[str]) -> Optional[str]:
    match = pattern.search(frontmatter)
    return match.group(1).strip() if match else None


def lint_rule(path: Path, text: str) -> LintResult:
    issues: List[Issue] = []
    suggestions: List[str] = []

    # --- Frontmatter checks ---
    frontmatter = extract_frontmatter(text)
    if frontmatter is None:
        issues.append(Issue("error", "missing_frontmatter", "Rule is missing YAML frontmatter (--- block)"))
    else:
        # type field
        rule_type = extract_frontmatter_field(frontmatter, TYPE_PATTERN)
        if rule_type is None:
            issues.append(Issue("error", "missing_type", "Frontmatter missing 'type' field (must be 'always' or 'auto')"))
        elif rule_type not in VALID_RULE_TYPES:
            issues.append(Issue("error", "invalid_type", f"Invalid type '{rule_type}'; must be 'always' or 'auto'"))

        # source field
        rule_source = extract_frontmatter_field(frontmatter, SOURCE_PATTERN)
        if rule_source is None:
            issues.append(Issue("error", "missing_source", "Frontmatter missing 'source' field (must be 'package' or 'project')"))
        elif rule_source not in VALID_RULE_SOURCES:
            issues.append(Issue("error", "invalid_source", f"Invalid source '{rule_source}'; must be 'package' or 'project'"))

        # description required for auto rules
        if rule_type == "auto":
            description = extract_description(text)
            if not description:
                issues.append(Issue("error", "auto_missing_description", "Auto rules require a 'description' field for matching"))

    # --- Structure checks ---
    # H1 heading
    if not H1_PATTERN.search(text):
        issues.append(Issue("error", "missing_h1", "Rule is missing an H1 heading (# Title)"))

    # File must end with exactly one newline
    if not text.endswith("\n"):
        issues.append(Issue("error", "no_trailing_newline", "File must end with exactly one newline"))
    elif text.endswith("\n\n"):
        issues.append(Issue("warning", "extra_trailing_newlines", "File ends with multiple newlines; should be exactly one"))

    # No double/triple blank lines in content
    if DOUBLE_BLANK_PATTERN.search(text):
        issues.append(Issue("warning", "double_blank_lines", "File contains double or triple blank lines"))

    # --- Content checks (existing) ---
    line_count = len([line for line in text.splitlines() if line.strip()])
    if line_count > 50:
        issues.append(Issue("warning", "long_rule", f"Rule has {line_count} non-empty lines; rules should be concise"))

    for bad_sign in RULE_BAD_SIGNS:
        if bad_sign in text:
            issues.append(Issue("error", "rule_looks_like_skill", f"Rule contains skill-like section: {bad_sign}"))

    # Exclude frontmatter from procedural check (frontmatter may contain "type")
    body = text.split("---", 2)[-1] if frontmatter else text
    if re.search(r"\b(procedure|workflow)\b", body, re.IGNORECASE):
        issues.append(Issue("warning", "procedural_rule", "Rule looks procedural; consider a skill instead"))

    return LintResult(
        file=str(path),
        artifact_type="rule",
        status=classify_status(issues),
        issues=issues,
        suggestions=dedupe_preserve_order(suggestions),
    )


def lint_unknown(path: Path, text: str) -> LintResult:
    issues = [Issue("error", "unknown_artifact", "Could not detect whether file is a skill or rule")]
    return LintResult(
        file=str(path),
        artifact_type="unknown",
        status="fail",
        issues=issues,
        suggestions=["Move the file into a recognized skills/ or rules/ path or add recognizable structure"],
    )


def gather_all_candidate_files(root: Path) -> list[Path]:
    candidates: list[Path] = []
    skill_dirs = [root / ".augment.uncompressed" / "skills", root / ".augment" / "skills"]
    rules_dirs = [root / ".augment.uncompressed" / "rules", root / ".augment" / "rules", root / ".claude" / "rules"]

    for base in skill_dirs:
        if base.exists():
            candidates.extend(base.rglob("SKILL.md"))
    for base in rules_dirs:
        if base.exists():
            candidates.extend(base.rglob("*.md"))
    return sorted(set(candidates))


def gather_changed_candidate_files(root: Path) -> list[Path]:
    """Find changed skill/rule files using git diff.

    Tries multiple strategies:
    1. CI: diff against origin/main (PR changes)
    2. Local: staged changes (git diff --cached)
    3. Fallback: unstaged changes (git diff HEAD)
    """
    diff_commands = [
        ["git", "diff", "--name-only", "origin/main...HEAD"],
        ["git", "diff", "--name-only", "--cached", "HEAD"],
        ["git", "diff", "--name-only", "HEAD"],
    ]
    try:
        raw_lines: list[str] = []
        for cmd in diff_commands:
            result = subprocess.run(
                cmd, cwd=root, text=True, capture_output=True, check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                raw_lines = result.stdout.splitlines()
                break

        files = []
        for raw in raw_lines:
            raw = raw.strip()
            if not raw:
                continue
            path = root / raw
            if not path.exists():
                continue
            if path.name == "SKILL.md" or "/rules/" in raw.replace("\\", "/"):
                files.append(path)
        return sorted(set(files))
    except Exception:
        return []


def lint_file(path: Path) -> LintResult:
    text = read_text(path)
    artifact_type = detect_artifact_type(path, text)
    if artifact_type == "skill":
        return lint_skill(path, text)
    if artifact_type == "rule":
        return lint_rule(path, text)
    return lint_unknown(path, text)


def format_text(results: list[LintResult]) -> str:
    lines: list[str] = []
    for result in results:
        badge = {"pass": "[PASS]", "pass_with_warnings": "[WARN]", "fail": "[FAIL]"}[result.status]
        lines.append(f"{badge} {result.file} ({result.artifact_type})")
        if result.issues:
            for issue in result.issues:
                lines.append(f"  - {issue.severity.upper()} {issue.code}: {issue.message}")
        else:
            lines.append("  - No issues found")
        if result.suggestions:
            lines.append("  Suggested fixes:")
            for suggestion in result.suggestions:
                lines.append(f"    - {suggestion}")
        lines.append("")

    total = len(results)
    fails = sum(1 for r in results if r.status == "fail")
    warns = sum(1 for r in results if r.status == "pass_with_warnings")
    passes = sum(1 for r in results if r.status == "pass")
    lines.append(f"Summary: {passes} pass, {warns} warn, {fails} fail, {total} total")
    return "\n".join(lines)


def format_json(results: list[LintResult]) -> str:
    payload = {
        "summary": {
            "pass": sum(1 for r in results if r.status == "pass"),
            "pass_with_warnings": sum(1 for r in results if r.status == "pass_with_warnings"),
            "fail": sum(1 for r in results if r.status == "fail"),
            "total": len(results),
        },
        "results": [
            {
                "file": r.file,
                "artifact_type": r.artifact_type,
                "status": r.status,
                "issues": [asdict(issue) for issue in r.issues],
                "suggestions": r.suggestions,
            }
            for r in results
        ],
    }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def compute_exit_code(results: list[LintResult], strict_warnings: bool) -> int:
    if any(r.status == "fail" for r in results):
        return 2
    if any(r.status == "pass_with_warnings" for r in results) and strict_warnings:
        return 1
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Lint skills and rules.")
    parser.add_argument("paths", nargs="*", help="Files to lint")
    parser.add_argument("--all", action="store_true", help="Lint all skills/rules in the repo")
    parser.add_argument("--changed", action="store_true", help="Lint changed skills/rules")
    parser.add_argument("--format", choices=["text", "json"], default="text", help="Output format")
    parser.add_argument("--strict-warnings", action="store_true", help="Return non-zero on warnings")
    parser.add_argument("--repo-root", default=".", help="Repository root")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.repo_root).resolve()

    try:
        paths: list[Path] = []
        if args.all:
            paths.extend(gather_all_candidate_files(root))
        if args.changed:
            paths.extend(gather_changed_candidate_files(root))
        for raw in args.paths:
            path = (root / raw).resolve() if not Path(raw).is_absolute() else Path(raw)
            if path.exists():
                paths.append(path)

        paths = sorted(set(paths))
        if not paths:
            print("No matching skill/rule files found.", file=sys.stderr)
            return 0

        results = [lint_file(path) for path in paths]

        if args.format == "json":
            print(format_json(results))
        else:
            print(format_text(results))

        return compute_exit_code(results, strict_warnings=args.strict_warnings)

    except Exception as exc:  # noqa: BLE001
        print(f"Internal error: {exc}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())