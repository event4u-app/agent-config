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
ArtifactType = Literal["skill", "rule", "command", "guideline", "unknown"]


REQUIRED_SKILL_SECTIONS = [
    "When to use",
    "Gotcha",
    "Procedure",
    "Output format",
    "Do NOT",
]

# Aliases: linter accepts any of these as matching the required section
SECTION_ALIASES = {
    "Gotcha": {"Gotcha", "Gotchas"},
    "Procedure": set(),  # prefix-matched separately
    "Do NOT": {"Do NOT", "Do not", "Anti-patterns"},
    "Output format": {"Output format", "Output"},
}

RECOMMENDED_SKILL_SECTIONS: list[str] = []

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

ORDERED_STEP_PATTERN = re.compile(r"^(?:\s*|\#{1,4}\s*)(\d+)\.\s+", re.MULTILINE)
SECTION_PATTERN = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
FRONTMATTER_PATTERN = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
DESCRIPTION_PATTERN = re.compile(r'^description:\s*"?(.*?)"?\s*$', re.MULTILINE)
TYPE_PATTERN = re.compile(r'^type:\s*"?(always|auto)"?\s*$', re.MULTILINE)
SOURCE_PATTERN = re.compile(r'^source:\s*"?(package|project)"?\s*$', re.MULTILINE)
STATUS_PATTERN = re.compile(r'^status:\s*"?(active|deprecated|superseded)"?\s*$', re.MULTILINE)
REPLACED_BY_PATTERN = re.compile(r'^replaced_by:\s*"?([\w-]+)"?\s*$', re.MULTILINE)
H1_PATTERN = re.compile(r"^# .+", re.MULTILINE)
DOUBLE_BLANK_PATTERN = re.compile(r"\n{3,}")

VALID_RULE_TYPES = {"always", "auto"}
VALID_RULE_SOURCES = {"package", "project"}
VALID_STATUSES = {"active", "deprecated", "superseded"}

# --- Runtime execution metadata constants ---
VALID_EXECUTION_TYPES = {"manual", "assisted", "automated"}
VALID_EXECUTION_HANDLERS = {"none", "shell", "php", "node", "internal"}
VALID_EXECUTION_SAFETY_MODES = {"strict"}
VALID_EXECUTION_FIELDS = {"type", "handler", "timeout_seconds", "safety_mode", "allowed_tools"}


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


NAME_PATTERN = re.compile(r'^name:\s*"?(.*?)"?\s*$', re.MULTILINE)
DISABLE_MODEL_PATTERN = re.compile(r'^disable-model-invocation:\s*"?(true|false)"?\s*$', re.MULTILINE)


def detect_artifact_type(path: Path, text: str) -> ArtifactType:
    path_str = str(path).lower()
    has_skill_heading = "## When to use" in text and "## Procedure" in text

    # Skills take priority — /skills/commands/SKILL.md is a skill, not a command
    if path.name.lower() == "skill.md" or "/skills/" in path_str:
        return "skill"
    # Commands are flat .md files in /commands/ directories (not SKILL.md)
    if "/commands/" in path_str and path.name.lower() != "skill.md":
        return "command"
    if "/rules/" in path_str:
        return "rule"
    if "/guidelines/" in path_str:
        return "guideline"
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
    good_signals = [
        "expected", "status code", "no errors", "appears in", "exact check", "concrete checks",
        "verify", "confirm", "must pass", "must fail", "assert", "check that", "ensure",
        "run test", "run phpstan", "run ecs", "run rector", "lint", "passes",
        "exit code", "should return", "should contain", "must contain", "must return",
    ]
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
    # Only check description and "When to use" for broad signals — not the entire text
    haystacks: list[str] = []
    if description:
        haystacks.append(description.lower())
    when_block = extract_section_block(text, "When to use")
    if when_block:
        haystacks.append(when_block.lower())
    if not haystacks:
        return False
    combined = "\n".join(haystacks)
    broad_signals = ["everything about", "general purpose", "general-purpose", "all markdown", "helper for everything"]
    return any(signal in combined for signal in broad_signals)


def dedupe_preserve_order(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def section_matches(required: str, sections: set[str]) -> bool:
    """Check if a required section name matches any extracted section, supporting aliases and prefix matching."""
    # Direct match
    if required in sections:
        return True
    # Alias match (e.g. "Gotcha" matches "Gotchas")
    aliases = SECTION_ALIASES.get(required, set())
    if aliases & sections:
        return True
    # Prefix match (e.g. "Procedure" matches "Procedure: Create X")
    for s in sections:
        if s.startswith(required + ":") or s.startswith(required + " "):
            return True
    return False


def find_procedure_block(text: str) -> Optional[str]:
    """Find the procedure section block, supporting prefix-named variants."""
    block = extract_section_block(text, "Procedure")
    if block:
        return block
    # Try prefix match: find "## Procedure: ..." or "## Procedure " headings
    match = re.search(r"^##\s+Procedure[:\s]", text, re.MULTILINE)
    if match:
        # Extract from this heading to the next ## heading
        start = match.end()
        next_heading = re.search(r"^##\s+", text[start:], re.MULTILINE)
        if next_heading:
            return text[start:start + next_heading.start()].strip()
        return text[start:].strip()
    return None


def lint_skill(path: Path, text: str) -> LintResult:
    issues: List[Issue] = []
    suggestions: List[str] = []

    sections = extract_sections(text)
    description = extract_description(text)

    for section in REQUIRED_SKILL_SECTIONS:
        if not section_matches(section, sections):
            issues.append(Issue("error", "missing_section", f"Missing required section: {section}"))

    for section in RECOMMENDED_SKILL_SECTIONS:
        if not section_matches(section, sections):
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

    # --- Bare-noun name check ---
    skill_name = path.parent.name if path.name == "SKILL.md" else path.stem
    if skill_name and "-" not in skill_name and len(skill_name) >= 3:
        # Single word without qualifier — likely too generic
        ALLOWED_BARE_NOUNS = {"database", "devcontainer", "docker", "eloquent", "flux", "grafana",
                              "laravel", "livewire", "mcp", "openapi", "performance", "security",
                              "terraform", "terragrunt", "traefik", "websocket"}
        if skill_name.lower() not in ALLOWED_BARE_NOUNS:
            issues.append(Issue("warning", "bare_noun_name",
                                f"Bare-noun skill name `{skill_name}` — consider adding a qualifier (e.g., `{skill_name}-management`)"))

    # --- Status lifecycle check ---
    frontmatter = extract_frontmatter(text)
    if frontmatter:
        status_match = STATUS_PATTERN.search(frontmatter)
        if status_match:
            status = status_match.group(1)
            if status == "deprecated":
                replaced_by = extract_frontmatter_field(frontmatter, REPLACED_BY_PATTERN)
                msg = f"Skill is deprecated"
                if replaced_by:
                    msg += f" (replaced by: {replaced_by})"
                issues.append(Issue("warning", "deprecated_skill", msg))
            elif status == "superseded":
                replaced_by = extract_frontmatter_field(frontmatter, REPLACED_BY_PATTERN)
                msg = f"Skill is superseded — should be removed"
                if replaced_by:
                    msg += f" (replaced by: {replaced_by})"
                issues.append(Issue("warning", "superseded_skill", msg))

        # --- Execution metadata check ---
        execution = parse_execution_block(frontmatter)
        if execution is not None:
            issues.extend(lint_execution_metadata(execution))

    procedure_block = find_procedure_block(text)
    if procedure_block is not None:
        if not procedure_block:
            issues.append(Issue("error", "empty_procedure", "Procedure section is empty"))
        else:
            # Check for ordered steps OR sub-headings as structural indicators
            has_ordered = ORDERED_STEP_PATTERN.search(procedure_block)
            has_subheadings = bool(re.search(r"^###\s+", procedure_block, re.MULTILINE))
            if not has_ordered and not has_subheadings:
                issues.append(Issue("error", "unordered_procedure", "Procedure has no ordered steps or sub-headings"))
            meaningful_steps = len(ORDERED_STEP_PATTERN.findall(procedure_block))
            if meaningful_steps < 3:
                issues.append(Issue("warning", "short_procedure", "Procedure has fewer than 3 ordered steps"))
            # Check validation in procedure block OR in the full skill text
            # (some skills have ### Validate under a sibling ## section)
            if not has_validation_step(procedure_block) and not has_validation_step(text):
                issues.append(Issue("error", "missing_validation", "Skill lacks a concrete validation step"))
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

    # Check Gotcha/Gotchas section (alias support)
    gotcha_block = extract_section_block(text, "Gotchas") or extract_section_block(text, "Gotcha")
    if gotcha_block:
        if count_bullets(gotcha_block) < 1:
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

    # --- Developer judgment check for assisted skills ---
    fm = extract_frontmatter(text)
    exec_block = parse_execution_block(fm) if fm else None
    exec_type = exec_block.get("type", "") if exec_block else ""
    if exec_type == "assisted" and procedure_block:
        validation_terms = ["validat", "check", "verify", "confirm", "challenge",
                          "existing", "duplicate", "contradict", "fit", "misfit"]
        has_validation = any(term in procedure_block.lower() for term in validation_terms)
        if not has_validation:
            issues.append(Issue("warning", "missing_validation_step",
                              "Assisted skill has no validation/challenge step in procedure"))
            suggestions.append("Add a requirement-checking or validation step before implementation")

    # --- Size check (see guidelines/agent-infra/size-and-scope.md) ---
    total_lines = len(text.splitlines())
    if total_lines > 300:
        issues.append(Issue("warning", "skill_too_large", f"Skill has {total_lines} lines; review for split (see size-and-scope guideline)"))

    # --- Pointer-only / guideline-dependent skill detection ---
    if procedure_block:
        proc_lines = [line.strip() for line in procedure_block.splitlines() if line.strip()]

        # Delegation patterns: references to external docs instead of own workflow
        delegation_patterns = re.findall(
            r"(?:see|read|check|follow|refer\s+to|consult|per|apply\s+.*from)\s+.*"
            r"(?:guideline|skill|rule|doc|documentation)",
            procedure_block, re.IGNORECASE)
        delegation_count = len(delegation_patterns)

        # Action verbs that indicate the skill has its own operational workflow
        action_verbs = re.findall(
            r"\b(?:run|execute|create|write|validate|verify|inspect|check|ensure|test|build|"
            r"generate|compare|extract|parse|detect|fix|update|add|remove|install|configure|"
            r"deploy|trace|review|map|resolve|measure|confirm)\b",
            procedure_block, re.IGNORECASE)
        action_count = len(set(v.lower() for v in action_verbs))

        # Count actual ordered steps
        meaningful_steps = len(ORDERED_STEP_PATTERN.findall(procedure_block))

        # Thin procedure: few steps AND few lines
        has_thin_procedure = meaningful_steps < 3 and len(proc_lines) < 8

        # Error: effectively a pointer, not a real skill
        if delegation_count >= 3 and action_count <= 1 and has_thin_procedure:
            issues.append(Issue("error", "guideline_dependent_skill",
                               f"Skill is effectively a pointer to guidelines/docs "
                               f"({delegation_count} delegations, {action_count} action verbs, "
                               f"{meaningful_steps} steps) — not an executable workflow"))
            suggestions.append("Add concrete steps, decision points, and validation directly into the skill")
        # Warning: likely too dependent on external guidance
        elif delegation_count >= 2 and action_count <= 2 and has_thin_procedure:
            issues.append(Issue("warning", "pointer_only_skill",
                               f"Skill appears too guideline-dependent "
                               f"({delegation_count} delegations, {action_count} action verbs, "
                               f"{meaningful_steps} steps) — may lack its own executable workflow"))
            suggestions.append("Expand the skill so it remains executable without opening a guideline")

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


def parse_execution_block(frontmatter: str) -> Optional[dict]:
    """Parse the execution block from YAML frontmatter.

    Uses simple line-based parsing to avoid requiring PyYAML.
    Returns None if no execution block is present.
    """
    lines = frontmatter.splitlines()
    exec_start = None
    for i, line in enumerate(lines):
        if re.match(r'^execution:\s*$', line):
            exec_start = i
            break
    if exec_start is None:
        return None

    result: dict = {}
    for line in lines[exec_start + 1:]:
        # Stop at next top-level key (no indentation)
        if line and not line[0].isspace():
            break
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        # Handle list items (for allowed_tools)
        if stripped.startswith('- '):
            if '_current_list' in result:
                result[result['_current_list']].append(stripped[2:].strip().strip('"').strip("'"))
            continue
        # Handle key: value pairs
        match = re.match(r'^(\w+):\s*(.*?)\s*$', stripped)
        if match:
            key = match.group(1)
            value = match.group(2).strip('"').strip("'")
            if value == '[]':
                result[key] = []
                result['_current_list'] = key
            elif re.match(r'^\[.*\]$', value):
                # Inline YAML/JSON array like [github] or ["github", "jira"]
                inner = value[1:-1].strip()
                if inner:
                    items = [item.strip().strip('"').strip("'") for item in inner.split(',')]
                    result[key] = items
                else:
                    result[key] = []
                result['_current_list'] = key
            elif value == '':
                # Could be a list starting on next line
                result[key] = []
                result['_current_list'] = key
            else:
                # Try to parse as int
                try:
                    result[key] = int(value)
                except ValueError:
                    result[key] = value
                result.pop('_current_list', None)

    result.pop('_current_list', None)
    return result


def lint_execution_metadata(execution: dict) -> List[Issue]:
    """Validate the execution block of a skill."""
    issues: List[Issue] = []

    # Validate type
    exec_type = execution.get("type")
    if exec_type is not None:
        if exec_type not in VALID_EXECUTION_TYPES:
            issues.append(Issue("error", "invalid_execution_type",
                                f"Invalid execution.type '{exec_type}'; "
                                f"must be one of: {', '.join(sorted(VALID_EXECUTION_TYPES))}"))
    else:
        issues.append(Issue("error", "missing_execution_type",
                            "Execution block present but missing 'type' field"))

    # Validate handler
    handler = execution.get("handler")
    if handler is not None:
        if handler not in VALID_EXECUTION_HANDLERS:
            issues.append(Issue("error", "invalid_execution_handler",
                                f"Invalid execution.handler '{handler}'; "
                                f"must be one of: {', '.join(sorted(VALID_EXECUTION_HANDLERS))}"))

    # Automated-specific checks
    if exec_type == "automated":
        if handler is None or handler == "none":
            issues.append(Issue("error", "automated_missing_handler",
                                "Automated execution requires a handler other than 'none'"))
        safety_mode = execution.get("safety_mode")
        if safety_mode is None:
            issues.append(Issue("error", "automated_missing_safety_mode",
                                "Automated execution requires 'safety_mode: strict'"))
        elif safety_mode not in VALID_EXECUTION_SAFETY_MODES:
            issues.append(Issue("error", "invalid_safety_mode",
                                f"Invalid safety_mode '{safety_mode}'; must be 'strict'"))
        if "allowed_tools" not in execution:
            issues.append(Issue("warning", "automated_missing_allowed_tools",
                                "Automated execution should declare 'allowed_tools' (use [] for none)"))

    # Validate safety_mode if present (even for non-automated)
    safety_mode = execution.get("safety_mode")
    if safety_mode is not None and safety_mode not in VALID_EXECUTION_SAFETY_MODES:
        issues.append(Issue("error", "invalid_safety_mode",
                            f"Invalid safety_mode '{safety_mode}'; must be 'strict'"))

    # Validate timeout_seconds
    timeout = execution.get("timeout_seconds")
    if timeout is not None:
        if not isinstance(timeout, int) or timeout <= 0:
            issues.append(Issue("warning", "invalid_timeout",
                                f"timeout_seconds should be a positive integer, got '{timeout}'"))

    # Validate allowed_tools is a list of strings
    allowed_tools = execution.get("allowed_tools")
    if allowed_tools is not None:
        if not isinstance(allowed_tools, list):
            issues.append(Issue("error", "invalid_allowed_tools",
                                "allowed_tools must be a list"))
        elif not all(isinstance(t, str) for t in allowed_tools):
            issues.append(Issue("error", "invalid_allowed_tools_entries",
                                "All entries in allowed_tools must be strings"))

    # Check for unknown fields
    known_fields = VALID_EXECUTION_FIELDS
    unknown = set(execution.keys()) - known_fields
    for field in sorted(unknown):
        issues.append(Issue("warning", "unknown_execution_field",
                            f"Unknown field in execution block: '{field}'"))

    return issues


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

        # always-rules that look like auto candidates (rule-type-governance check)
        if rule_type == "always":
            description = extract_description(text) or ""
            # If description contains topic-specific keywords, it might be an auto candidate
            topic_keywords = re.findall(
                r"\b(?:PHP|Laravel|Docker|Git|E2E|Playwright|SQL|Blade|Livewire|"
                r"Terraform|Jira|Sentry|translations|i18n)\b",
                description, re.IGNORECASE)
            if len(topic_keywords) >= 2:
                issues.append(Issue("info", "always_auto_candidate",
                                    f"Always-rule with topic-specific description ({', '.join(topic_keywords)}) — "
                                    f"consider auto type per rule-type-governance"))

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

    # --- Content checks (see guidelines/agent-infra/size-and-scope.md) ---
    line_count = len([line for line in text.splitlines() if line.strip()])
    total_lines = len(text.splitlines())
    if total_lines > 200:
        issues.append(Issue("error", "rule_too_large", f"Rule has {total_lines} lines (hard limit: 200); must split or move to guideline"))
    elif line_count > 60:
        issues.append(Issue("warning", "long_rule", f"Rule has {line_count} non-empty lines; prefer < 60 (see size-and-scope guideline)"))
    elif line_count > 40:
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


def lint_command(path: Path, text: str) -> LintResult:
    issues: List[Issue] = []
    suggestions: List[str] = []

    # --- Frontmatter checks ---
    frontmatter = extract_frontmatter(text)
    if frontmatter is None:
        issues.append(Issue("error", "missing_frontmatter", "Command is missing YAML frontmatter (--- block)"))
    else:
        # name field
        name_match = NAME_PATTERN.search(frontmatter)
        if not name_match or not name_match.group(1).strip():
            issues.append(Issue("error", "missing_name", "Frontmatter missing 'name' field"))

        # disable-model-invocation field
        dmi_match = DISABLE_MODEL_PATTERN.search(frontmatter)
        if not dmi_match:
            issues.append(Issue("error", "missing_disable_model_invocation",
                                "Frontmatter missing 'disable-model-invocation: true' (required for Claude Code)"))
        elif dmi_match.group(1) != "true":
            issues.append(Issue("warning", "disable_model_invocation_false",
                                "disable-model-invocation should be 'true' for commands"))

        # description field
        description = extract_description(text)
        if not description:
            issues.append(Issue("warning", "missing_description", "Frontmatter description is missing"))

    # --- Structure checks ---
    if not H1_PATTERN.search(text):
        issues.append(Issue("error", "missing_h1", "Command is missing an H1 heading (# Title)"))

    # Must have at least one ## section with steps
    sections = extract_sections(text)
    has_steps = any(s.lower().startswith("step") for s in sections)
    has_numbered = bool(re.search(r"^###?\s+\d+\.\s+", text, re.MULTILINE))
    if not has_steps and not has_numbered:
        issues.append(Issue("warning", "no_steps", "Command has no Steps section or numbered sub-headings"))

    # --- Size check (see guidelines/agent-infra/size-and-scope.md) ---
    word_count = len(text.split())
    if word_count > 1000:
        issues.append(Issue("warning", "large_command", f"Command has {word_count} words (target: 200-600, max ~1000)"))

    # File must end with exactly one newline
    if not text.endswith("\n"):
        issues.append(Issue("error", "no_trailing_newline", "File must end with exactly one newline"))
    elif text.endswith("\n\n"):
        issues.append(Issue("warning", "extra_trailing_newlines", "File ends with multiple newlines; should be exactly one"))

    return LintResult(
        file=str(path),
        artifact_type="command",
        status=classify_status(issues),
        issues=issues,
        suggestions=dedupe_preserve_order(suggestions),
    )


def lint_unknown(path: Path, text: str) -> LintResult:
    issues = [Issue("error", "unknown_artifact", "Could not detect whether file is a skill, rule, or command")]
    return LintResult(
        file=str(path),
        artifact_type="unknown",
        status="fail",
        issues=issues,
        suggestions=["Move the file into a recognized skills/, rules/, or commands/ path"],
    )


def lint_guideline(path: Path, text: str) -> LintResult:
    """Lint a guideline .md file (size + structure checks)."""
    issues: List[Issue] = []

    # H1 heading
    if not H1_PATTERN.search(text):
        issues.append(Issue("warning", "missing_h1", "Guideline is missing an H1 heading"))

    # Size check (guidelines/agent-infra/size-and-scope.md: target 400-1500 words)
    word_count = len(text.split())
    if word_count > 1500:
        issues.append(Issue("info", "large_guideline", f"Guideline has {word_count} words (target: 400-1500)"))

    # Trailing newline
    if not text.endswith("\n"):
        issues.append(Issue("warning", "no_trailing_newline", "File must end with exactly one newline"))

    return LintResult(
        file=str(path),
        artifact_type="guideline",
        status=classify_status(issues),
        issues=issues,
        suggestions=[],
    )


def gather_all_candidate_files(root: Path) -> list[Path]:
    """Gather all lintable files. Prefers .augment.uncompressed/ (source of truth).
    Falls back to .augment/ only if uncompressed doesn't exist.
    Skips symlinks to avoid double-counting."""
    candidates: list[Path] = []

    # Source of truth directories
    uncompressed_skills = root / ".augment.uncompressed" / "skills"
    uncompressed_rules = root / ".augment.uncompressed" / "rules"
    uncompressed_commands = root / ".augment.uncompressed" / "commands"
    uncompressed_guidelines = root / ".augment.uncompressed" / "guidelines"

    # Fallback directories (only if uncompressed doesn't exist)
    augment_skills = root / ".augment" / "skills"
    augment_rules = root / ".augment" / "rules"
    augment_commands = root / ".augment" / "commands"
    augment_guidelines = root / ".augment" / "guidelines"

    # Skills
    skills_base = uncompressed_skills if uncompressed_skills.exists() else augment_skills
    if skills_base.exists():
        for f in skills_base.rglob("SKILL.md"):
            if not f.is_symlink():
                candidates.append(f)

    # Rules
    rules_base = uncompressed_rules if uncompressed_rules.exists() else augment_rules
    if rules_base.exists():
        for f in rules_base.rglob("*.md"):
            if not f.is_symlink():
                candidates.append(f)

    # Commands
    commands_base = uncompressed_commands if uncompressed_commands.exists() else augment_commands
    if commands_base.exists():
        for f in commands_base.rglob("*.md"):
            if not f.is_symlink():
                candidates.append(f)

    # Guidelines
    guidelines_base = uncompressed_guidelines if uncompressed_guidelines.exists() else augment_guidelines
    if guidelines_base.exists():
        for f in guidelines_base.rglob("*.md"):
            if not f.is_symlink():
                candidates.append(f)

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
            # Skip symlinks to avoid double-counting (e.g. .claude/skills/ → .augment/commands/)
            if path.is_symlink():
                continue
            norm = raw.replace("\\", "/")
            if path.name == "SKILL.md" or "/rules/" in norm or "/commands/" in norm:
                files.append(path)
        return sorted(set(files))
    except Exception:
        return []


# --- Interaction quality checks (keyword-based, for meta/interaction artifacts only) ---

# File name patterns that indicate an interaction/meta artifact (strict — avoids false positives)
_INTERACTION_NAME_PATTERNS = re.compile(
    r"skill-router|handoff|analysis-skill|skill-writing|skill-reviewer|"
    r"model-recommendation|developer-like-execution|universal-project-analysis|"
    r"interaction|autonomous-mode|feature-planning",
    re.IGNORECASE,
)
_INTERACTION_CONTENT_KEYWORDS = {"handoff", "model switch", "clarification", "ask the user", "framework choice", "requirements are unclear"}


def _is_interaction_artifact(path: Path, text: str) -> bool:
    """Check if file is an interaction/meta artifact that should get question-quality checks."""
    name = str(path).lower()
    # Strict name match — only truly interaction-focused artifacts
    if _INTERACTION_NAME_PATTERNS.search(name):
        return True
    # Content match needs 3+ keywords to avoid false positives on analysis/coding skills
    text_lower = text.lower()
    matches = sum(1 for kw in _INTERACTION_CONTENT_KEYWORDS if kw in text_lower)
    return matches >= 3


def lint_interaction_quality(path: Path, text: str) -> List[Issue]:
    """Check interaction/meta artifacts for question strategy, handoff order, etc."""
    if not _is_interaction_artifact(path, text):
        return []

    issues: List[Issue] = []
    text_lower = text.lower()

    # Only check files that explicitly discuss user questioning strategy
    has_question_context = any(kw in text_lower for kw in (
        "ask the user", "ask clarification", "numbered options", "present options",
        "question strategy", "ask before",
    ))

    # Check 1: Question strategy — distinguishes simple grouped vs complex sequential
    if has_question_context:
        has_simple = any(kw in text_lower for kw in ("simple", "binary", "independent"))
        has_complex = any(kw in text_lower for kw in ("complex", "one at a time", "one question"))
        if not (has_simple and has_complex):
            issues.append(Issue("warning", "question_strategy_missing",
                                "Interaction guidance does not distinguish simple grouped questions "
                                "from complex sequential questions"))

    # Check 2: Handoff ordering — handoff/model-switch questions should come last
    has_handoff = any(kw in text_lower for kw in ("handoff", "model switch", "model-switch"))
    if has_handoff:
        has_ordering = any(kw in text_lower for kw in (
            "last", "after context", "after clarification", "after all",
        ))
        if not has_ordering:
            issues.append(Issue("warning", "handoff_order_missing",
                                "Handoff/model-switch guidance does not specify asking handoff "
                                "questions AFTER context/domain questions"))

    # Check 3: Framework choice guard — only when file explicitly discusses choosing between systems
    has_impl = any(kw in text_lower for kw in ("implement", "component", "ui component", "ui framework"))
    has_multi = any(kw in text_lower for kw in ("multiple frameworks", "multiple systems", "competing", "which framework"))
    if has_impl and has_multi:
        has_guard = any(kw in text_lower for kw in (
            "ask which", "ask before", "do not implement blindly", "analyze what exists",
            "do not pick", "clarif",
        ))
        if not has_guard:
            issues.append(Issue("warning", "framework_choice_guard_missing",
                                "Discusses implementation choices but does not require clarification "
                                "when multiple frameworks/patterns exist"))

    # Check 4: Clarification guard — only for files with explicit interaction/execution guidance
    has_execution_guidance = any(kw in text_lower for kw in ("procedure", "workflow", "step 1", "### 1."))
    if has_execution_guidance:
        has_clarification = any(kw in text_lower for kw in (
            "requirements are unclear", "ask clarification", "do not assume",
            "clarification question", "missing instructions", "incomplete",
        ))
        if not has_clarification:
            issues.append(Issue("info", "clarification_guard_missing",
                                "Contains action guidance but no explicit clarification behavior "
                                "for incomplete requirements"))

    # Check 5: Feedback learning — meta/reviewer artifacts should support learning
    is_meta = any(kw in str(path).lower() for kw in ("review", "improve", "learn", "audit", "optim"))
    if is_meta:
        has_learning = any(kw in text_lower for kw in (
            "learning", "feedback", "frustration", "capture", "improve the system",
            "rule / skill", "rule/skill",
        ))
        if not has_learning:
            issues.append(Issue("info", "feedback_learning_missing",
                                "Meta/reviewer artifact does not mention learning from negative "
                                "feedback or converting failures into system improvements"))

    return issues


# --- Execution quality checks ---

# File name signals for execution-oriented artifacts
_EXEC_FILE_SIGNALS = (
    "execution", "debug", "implement", "developer", "action",
    "validation", "testing", "coder", "bug", "fix",
)

# Content signals that indicate execution-oriented artifact
_EXEC_CONTENT_SIGNALS = (
    "implement", "debug", "refactor", "modify", "fix",
    "verify", "validate", "runtime", "test", "coding",
    "before acting", "before coding", "before changing",
)


def _is_execution_artifact(path: Path, text: str) -> bool:
    """Detect if artifact is execution/implementation oriented.

    Only skills and rules qualify — commands and guidelines are excluded
    because commands are workflows (not execution guidance) and guidelines
    are coding patterns (not developer workflow enforcement).
    """
    path_lower = str(path).lower()
    text_lower = text.lower()

    # Exclude commands and guidelines — they are not execution-oriented
    if "/commands/" in path_lower or "/guidelines/" in path_lower:
        return False

    # File name match — strong signal
    if any(sig in path_lower for sig in _EXEC_FILE_SIGNALS):
        return True

    # Content match — need at least 5 signals to avoid false positives
    # (many artifacts mention "implement" or "fix" without being execution-focused)
    matches = sum(1 for sig in _EXEC_CONTENT_SIGNALS if sig in text_lower)
    return matches >= 5


def lint_execution_quality(path: Path, text: str) -> List[Issue]:
    """Check execution-oriented artifacts for developer workflow quality."""
    if not _is_execution_artifact(path, text):
        return []

    issues: List[Issue] = []
    text_lower = text.lower()
    path_lower = str(path).lower()

    # Strong match = file name signal; weak match = content-only signal
    is_strong_match = any(sig in path_lower for sig in _EXEC_FILE_SIGNALS)

    # --- Signal groups ---
    # Each group uses broad synonyms to reduce false negatives.
    # Skills often express analysis/verification concepts without using
    # the exact words "analyze" or "verify".
    analysis_signals = (
        "analyze", "inspect", "understand", "read relevant",
        "review existing", "trace flow", "read affected",
        "check current", "before acting", "before coding",
        # Synonyms added in Phase 2b
        "examine", "study", "investigate", "check existing",
        "gather context", "read project", "read the changelog",
        "identify break", "assess", "before upgrading",
        "before changing", "before creating", "before modifying",
        "read docs", "read module", "read agents",
    )

    verification_signals = (
        "verify", "validate", "test", "real execution",
        "run endpoint", "playwright", "curl", "postman",
        "debugger", "run tests", "hit the endpoint",
        # Synonyms added in Phase 2b
        "confirm", "assert", "check result", "observe",
        "run phpstan", "run rector", "build and verify",
        "must pass", "response shape",
    )

    verification_tool_signals = (
        "playwright", "curl", "postman", "xdebug",
        "browser", "http::fake",
        # Synonyms added in Phase 2b
        "phpstan", "rector", "phpunit", "pest",
        "devcontainer build",
    )

    debug_runtime_signals = (
        "debugger", "xdebug", "mcp debugger", "runtime inspection",
        "trace execution", "breakpoint", "step through",
        # Synonyms added in Phase 2b
        "runtime", "stack trace", "dump", "dd(",
    )

    efficient_tooling_signals = (
        "jq", " rg ", "grep", "filter", "selective",
        "extract", "targeted", "--json", "--filter",
        # Synonyms added in Phase 2b
        "narrow", "scoped", "specific field", "only relevant",
    )

    anti_bruteforce_signals = (
        "avoid retr", "do not brute", "do not guess",
        "do not retry blind", "analyze before retry",
        "blind retr", "trial-and-error", "trial and error",
        "max 2 retries", "stop and rethink",
        # Synonyms added in Phase 2b
        "diagnose", "root cause", "targeted fix",
        "do not blindly", "never guess",
    )

    clarification_signals = (
        "ask", "clarif", "unclear", "missing information",
        "do not assume", "don't assume", "instead of assuming",
        # Synonyms added in Phase 2b
        "confirm with user", "verify requirement", "ambiguous",
        "if unsure", "when in doubt",
    )

    # Helper
    def has_any(signals: tuple[str, ...]) -> bool:
        return any(s in text_lower for s in signals)

    # --- Section-based detection (complement to keyword matching) ---
    # Detects structural signals: sections whose names imply analysis or verification.
    import re
    section_headers = re.findall(r'^#{1,4}\s+(.+)$', text, re.MULTILINE)
    section_headers_lower = [h.lower() for h in section_headers]

    # Section names that imply analysis-before-action
    has_analysis_section = any(
        any(kw in h for kw in ("understand", "analyze", "assess", "context", "review",
                                "current setup", "current state", "before"))
        for h in section_headers_lower
    )

    # Section names that imply verification
    has_verification_section = any(
        any(kw in h for kw in ("verify", "validat", "test", "acceptance", "quality gate"))
        for h in section_headers_lower
    )

    # Section names that imply anti-patterns / gotchas
    has_antipattern_section = any(
        any(kw in h for kw in ("do not", "don't", "gotcha", "anti-pattern", "avoid"))
        for h in section_headers_lower
    )

    # Detect implementation/change language
    change_signals = ("implement", "modify", "fix", "refactor", "change", "update", "code")
    has_change_language = any(s in text_lower for s in change_signals)

    # Combine keyword + section signals
    has_analysis = has_any(analysis_signals) or has_analysis_section
    has_verification = has_any(verification_signals) or has_verification_section

    # --- Check 1: Missing analysis-before-action (ERROR, skills only) ---
    # Rules describe constraints, not workflows — they don't need analysis sections
    is_skill = "/skills/" in str(path).lower()
    if is_skill and has_change_language and not has_analysis:
        issues.append(Issue("error", "missing_analysis_before_action",
                            "Execution-oriented skill encourages implementation "
                            "without requiring prior analysis of existing system"))

    # --- Check 2: Missing real verification (ERROR, skills with strong match) ---
    if is_skill and is_strong_match and has_change_language and not has_verification:
        issues.append(Issue("error", "missing_real_verification",
                            "Implementation/debugging skill does not require "
                            "real verification after changes"))

    # Checks 3-7 only apply to strong matches (file name signal) to avoid noise
    # on generic skills that happen to mention "implement" or "fix"
    if is_strong_match:
        # --- Check 3: Missing verification tool mapping (WARNING) ---
        if has_any(verification_signals) and not has_any(verification_tool_signals):
            issues.append(Issue("warning", "missing_verification_tool_mapping",
                                "Verification is generic — does not reference concrete "
                                "tools (Playwright, curl, Postman, Xdebug)"))

        # --- Check 4: Missing runtime debug guidance (WARNING) ---
        debug_context = any(s in text_lower for s in ("debug", "execution flow", "trace", "unexpected behavior"))
        if debug_context and not has_any(debug_runtime_signals):
            issues.append(Issue("warning", "missing_runtime_debug_guidance",
                                "Debugging/execution artifact does not mention "
                                "runtime debug tools (Xdebug, debugger, breakpoints)"))

        # --- Check 5: Missing efficient tooling guidance (WARNING) ---
        data_context = any(s in text_lower for s in ("api", "log", "json", "response", "output", "data"))
        if data_context and not has_any(efficient_tooling_signals):
            issues.append(Issue("warning", "missing_efficient_tooling_guidance",
                                "Artifact does not encourage targeted filtering tools "
                                "(jq, rg, grep) for reducing output"))

        # --- Check 6: Missing anti-bruteforce guidance (WARNING, skills only) ---
        if is_skill and has_change_language and not has_any(anti_bruteforce_signals):
            issues.append(Issue("warning", "missing_anti_bruteforce_guidance",
                                "Execution guidance lacks explicit anti-retry / "
                                "anti-bruteforce behavior"))

        # --- Check 7: Missing clarification guard (WARNING, skills only) ---
        if is_skill and has_change_language and not has_any(clarification_signals):
            issues.append(Issue("warning", "missing_clarification_guard",
                                "Implementation guidance does not require clarification "
                                "when requirements are incomplete"))

    return issues


# --- Type boundary checks ---


def lint_type_boundaries(path: Path, text: str, artifact_type: str) -> List[Issue]:
    """Check that artifacts respect their type boundaries.

    - Guidelines should not contain executable procedures
    - Commands should reference skills
    - Skills should have concrete validation (not vague)
    """
    issues: List[Issue] = []
    text_lower = text.lower()
    import re

    # --- Guideline: should not have executable procedures ---
    if artifact_type == "guideline":
        # Count numbered steps (1. 2. 3. etc.) — guidelines shouldn't have >5
        numbered_steps = re.findall(r'^\d+\.\s+\*?\*?(?:Step|Run|Create|Execute|Implement)',
                                     text, re.MULTILINE | re.IGNORECASE)
        if len(numbered_steps) >= 5:
            issues.append(Issue("warning", "guideline_contains_executable_procedure",
                                f"Guideline has {len(numbered_steps)} executable numbered steps — "
                                "consider extracting into a skill or command"))

    # --- Command: should reference skills ---
    if artifact_type == "command":
        # Check frontmatter skills field
        frontmatter = extract_frontmatter(text)
        has_skills_field = False
        if frontmatter:
            skills_match = re.search(r'skills:\s*\[(.+)\]', frontmatter)
            has_skills_field = bool(skills_match and skills_match.group(1).strip())

        # Also check body for skill references
        has_skill_ref = bool(re.search(r'skill|SKILL\.md', text))

        if not has_skills_field and not has_skill_ref:
            issues.append(Issue("warning", "command_missing_skill_references",
                                "Command does not reference any skills — "
                                "commands should orchestrate skills, not contain domain logic"))

    # --- Skill: validation should be concrete, not vague ---
    if artifact_type == "skill":
        # Find validation/verify sections
        validation_section = re.search(
            r'(?:^#{1,4}\s+(?:Validat|Verif|Quality|Accept).+?\n)((?:.*\n)*?)(?=^#{1,4}\s|\Z)',
            text, re.MULTILINE | re.IGNORECASE
        )
        if validation_section:
            validation_text = validation_section.group(1).lower()
            vague_patterns = ("check if it works", "make sure it's correct",
                              "verify it works", "should work", "looks correct")
            concrete_patterns = ("run ", "curl ", "phpstan", "rector", "pest",
                                 "playwright", "assert", "exit code", "must pass",
                                 "0 fail", "0 error")
            has_vague = any(p in validation_text for p in vague_patterns)
            has_concrete = any(p in validation_text for p in concrete_patterns)
            if has_vague and not has_concrete:
                issues.append(Issue("warning", "skill_validation_too_generic",
                                    "Validation section uses vague language — "
                                    "add concrete checks (commands, expected output, conditions)"))

    return issues


# --- Verification maturity checks ---

# Task type detection signals
_TASK_TYPE_SIGNALS = {
    "backend": ("api", "endpoint", "controller", "route", "service", "repository",
                "eloquent", "migration", "artisan", "middleware", "job", "queue"),
    "frontend": ("blade", "livewire", "component", "view", "ui", "frontend",
                 "tailwind", "flux", "css", "template"),
    "cli": ("artisan command", "cli", "console", "schedule", "cron"),
    "database": ("migration", "database", "schema", "index", "query", "sql",
                 "mariadb", "mysql", "seeder"),
    "debugging": ("debug", "xdebug", "error", "exception", "sentry", "trace",
                  "breakpoint", "log"),
}

# Expected verification tools per task type
_VERIFICATION_TOOLS = {
    "backend": ("curl", "postman", "http::fake", "actingas", "api/"),
    "frontend": ("playwright", "browser", "screenshot", "snapshot", "livewire test"),
    "cli": ("exit code", "command output", "artisan test", "expectsoutput"),
    "database": ("query", "assertdatabase", "migration", "seedandassert", "table"),
    "debugging": ("xdebug", "breakpoint", "dump", "dd(", "stack trace", "log"),
}


def lint_verification_maturity(path: Path, text: str, artifact_type: str) -> List[Issue]:
    """Check that verification matches the skill's task type."""
    if artifact_type != "skill":
        return []

    # Only check skills with strong execution signals
    path_lower = str(path).lower()
    if not any(sig in path_lower for sig in _EXEC_FILE_SIGNALS):
        return []

    issues: List[Issue] = []
    text_lower = text.lower()

    # Detect task types present in the skill
    detected_types: list[str] = []
    for task_type, signals in _TASK_TYPE_SIGNALS.items():
        matches = sum(1 for s in signals if s in text_lower)
        if matches >= 2:  # Need at least 2 signals to classify
            detected_types.append(task_type)

    if not detected_types:
        return []

    # Check if appropriate verification tools are mentioned
    for task_type in detected_types:
        tools = _VERIFICATION_TOOLS.get(task_type, ())
        has_tool = any(t in text_lower for t in tools)
        if not has_tool:
            issues.append(Issue("warning", f"missing_{task_type}_verification_example",
                                f"Skill covers {task_type} tasks but does not mention "
                                f"verification tools for that context "
                                f"(e.g. {', '.join(tools[:3])})"))

    return issues


# --- Governance & packaging checks ---


def lint_governance(path: Path, text: str, artifact_type: str, repo_root: Path | None = None) -> List[Issue]:
    """Check governance and packaging consistency.

    - Compressed/uncompressed pairs must exist
    - No duplicate skill names
    - Files must be in correct location for their type
    """
    issues: List[Issue] = []
    if repo_root is None:
        return issues

    path_str = str(path)
    path_relative = path_str

    # Determine if this is a compressed or uncompressed artifact
    is_compressed = "/.augment/" in path_str and "/.augment.uncompressed/" not in path_str
    is_uncompressed = "/.augment.uncompressed/" in path_str

    if not is_compressed and not is_uncompressed:
        return issues

    # --- Check: compressed/uncompressed pair exists ---
    if is_uncompressed:
        # Find expected compressed path
        compressed_path = Path(path_str.replace("/.augment.uncompressed/", "/.augment/"))
        if not compressed_path.exists():
            issues.append(Issue("warning", "compressed_variant_missing",
                                f"Uncompressed file exists but compressed variant missing: "
                                f"{compressed_path.name}"))
    elif is_compressed:
        # Find expected uncompressed path
        uncompressed_path = Path(path_str.replace("/.augment/", "/.augment.uncompressed/"))
        if not uncompressed_path.exists():
            issues.append(Issue("warning", "uncompressed_variant_missing",
                                f"Compressed file exists but uncompressed source missing: "
                                f"{uncompressed_path.name}"))

    # --- Check: file in correct location for type ---
    location_map = {
        "skill": "/skills/",
        "rule": "/rules/",
        "command": "/commands/",
        "guideline": "/guidelines/",
    }
    expected_loc = location_map.get(artifact_type)
    if expected_loc and expected_loc not in path_str:
        issues.append(Issue("warning", "invalid_location_for_type",
                            f"Artifact detected as '{artifact_type}' but not in "
                            f"expected location ({expected_loc})"))

    return issues


def lint_file(path: Path, repo_root: Path | None = None) -> LintResult:
    # Skip README files — they are not lintable artifacts
    if path.name.lower() == "readme.md":
        return LintResult(
            file=str(path),
            artifact_type="unknown",
            status="pass",
            issues=[],
            suggestions=[],
        )
    text = read_text(path)
    artifact_type = detect_artifact_type(path, text)
    # Use relative path for output if repo_root is provided
    display_path = path
    if repo_root:
        try:
            display_path = path.relative_to(repo_root)
        except ValueError:
            pass
    if artifact_type == "skill":
        result = lint_skill(display_path, text)
    elif artifact_type == "rule":
        result = lint_rule(display_path, text)
    elif artifact_type == "command":
        result = lint_command(display_path, text)
    elif artifact_type == "guideline":
        result = lint_guideline(display_path, text)
    else:
        return lint_unknown(display_path, text)

    # Post-processing: interaction quality checks (warnings/info only)
    interaction_issues = lint_interaction_quality(display_path, text)
    if interaction_issues:
        result.issues.extend(interaction_issues)
        result.status = classify_status(result.issues)

    # Post-processing: execution quality checks (errors/warnings)
    execution_issues = lint_execution_quality(display_path, text)
    if execution_issues:
        result.issues.extend(execution_issues)
        result.status = classify_status(result.issues)

    # Post-processing: type boundary checks (warnings)
    boundary_issues = lint_type_boundaries(display_path, text, artifact_type)
    if boundary_issues:
        result.issues.extend(boundary_issues)
        result.status = classify_status(result.issues)

    # Post-processing: verification maturity checks (warnings)
    maturity_issues = lint_verification_maturity(display_path, text, artifact_type)
    if maturity_issues:
        result.issues.extend(maturity_issues)
        result.status = classify_status(result.issues)

    # Post-processing: governance and packaging checks (warnings)
    governance_issues = lint_governance(path, text, artifact_type, repo_root)
    if governance_issues:
        result.issues.extend(governance_issues)
        result.status = classify_status(result.issues)

    return result


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


def check_compression_pairs(root: Path) -> list[LintResult]:
    """Check that every uncompressed skill/rule/command has a compressed counterpart and vice versa."""
    results: list[LintResult] = []

    pairs = [
        ("skills", "SKILL.md", True),   # (subdir, filename, is_nested)
        ("rules", "*.md", False),
        ("commands", "*.md", False),
    ]

    for subdir, pattern, is_nested in pairs:
        uncompressed_dir = root / ".augment.uncompressed" / subdir
        compressed_dir = root / ".augment" / subdir

        if not uncompressed_dir.exists():
            continue

        # Collect names from uncompressed
        if is_nested:
            uncompressed_names = {d.name for d in uncompressed_dir.iterdir() if d.is_dir() and (d / pattern).exists()}
        else:
            uncompressed_names = {f.name for f in uncompressed_dir.glob(pattern) if f.is_file()}

        # Collect names from compressed
        if compressed_dir.exists():
            if is_nested:
                compressed_names = {d.name for d in compressed_dir.iterdir() if d.is_dir() and (d / pattern).exists()}
            else:
                compressed_names = {f.name for f in compressed_dir.glob(pattern) if f.is_file()}
        else:
            compressed_names = set()

        # Missing compressed
        for name in sorted(uncompressed_names - compressed_names):
            path_str = f".augment/{subdir}/{name}/{pattern}" if is_nested else f".augment/{subdir}/{name}"
            results.append(LintResult(
                file=path_str,
                artifact_type=subdir.rstrip("s"),
                status="fail",
                issues=[Issue("error", "missing_compressed", f"Uncompressed exists but compressed version is missing")],
                suggestions=[f"Run /compress to generate .augment/{subdir}/{name}"],
            ))

        # Orphaned compressed (no source)
        for name in sorted(compressed_names - uncompressed_names):
            path_str = f".augment/{subdir}/{name}/{pattern}" if is_nested else f".augment/{subdir}/{name}"
            results.append(LintResult(
                file=path_str,
                artifact_type=subdir.rstrip("s"),
                status="fail",
                issues=[Issue("error", "orphaned_compressed", f"Compressed exists but uncompressed source is missing")],
                suggestions=[f"Delete orphaned file or restore uncompressed source"],
            ))

    return results


def check_compression_quality(root: Path) -> list[LintResult]:
    """Check that compressed skills preserve key content from their uncompressed source."""
    results: list[LintResult] = []
    uncompressed_dir = root / ".augment.uncompressed" / "skills"
    compressed_dir = root / ".augment" / "skills"

    if not uncompressed_dir.exists() or not compressed_dir.exists():
        return results

    # Sections that MUST exist in compressed if they exist in uncompressed
    preserved_sections = ["When to use", "Procedure", "Gotcha", "Gotchas", "Do NOT", "Output format", "Output"]

    for skill_dir in sorted(uncompressed_dir.iterdir()):
        src = skill_dir / "SKILL.md"
        dst = compressed_dir / skill_dir.name / "SKILL.md"
        if not src.exists() or not dst.exists():
            continue

        src_text = read_text(src)
        dst_text = read_text(dst)
        src_sections = extract_sections(src_text)
        dst_sections = extract_sections(dst_text)

        issues: list[Issue] = []
        suggestions: list[str] = []

        # Check required sections survived compression
        for section in preserved_sections:
            if section_matches(section, src_sections) and not section_matches(section, dst_sections):
                issues.append(Issue("warning", "compression_lost_section",
                                    f"Compressed version lost '{section}' section"))

        # Check validation keywords survived
        src_proc = find_procedure_block(src_text) or ""
        dst_proc = find_procedure_block(dst_text) or ""
        validation_patterns = [r"\bverif", r"\bcheck\b", r"\bconfirm\b", r"\bvalidat", r"\binspect"]
        src_has_validation = any(re.search(p, src_proc, re.IGNORECASE) for p in validation_patterns)
        dst_has_validation = any(re.search(p, dst_proc, re.IGNORECASE) for p in validation_patterns)
        if src_has_validation and not dst_has_validation:
            issues.append(Issue("warning", "compression_lost_validation",
                                "Compressed procedure lost validation keywords present in uncompressed"))

        # Check code blocks / examples survived
        src_code_blocks = len(re.findall(r"```", src_text))  # pairs of ``` = blocks
        dst_code_blocks = len(re.findall(r"```", dst_text))
        if src_code_blocks > 0 and dst_code_blocks < src_code_blocks // 2:
            issues.append(Issue("warning", "compression_lost_example",
                                f"Compressed version has fewer code blocks "
                                f"({dst_code_blocks // 2} vs {src_code_blocks // 2} in source)"))

        # Check anti-pattern / "Do NOT" bullets survived
        src_donot = len(re.findall(r"(?:Do NOT|NEVER|MUST NOT)\b", src_text))
        dst_donot = len(re.findall(r"(?:Do NOT|NEVER|MUST NOT)\b", dst_text))
        if src_donot > 0 and dst_donot < src_donot // 2:
            issues.append(Issue("warning", "compression_lost_antipattern",
                                f"Compressed version lost anti-pattern constraints "
                                f"({dst_donot} vs {src_donot} in source)"))

        if issues:
            rel_path = f".augment/skills/{skill_dir.name}/SKILL.md"
            results.append(LintResult(
                file=rel_path,
                artifact_type="skill",
                status="pass_with_warnings",
                issues=issues,
                suggestions=suggestions or ["Re-compress to preserve lost content"],
            ))

    return results


def check_duplication(root: Path) -> list[LintResult]:
    """Detect skills with highly similar names or descriptions."""
    results: list[LintResult] = []
    skills_dir = root / ".augment.uncompressed" / "skills"
    if not skills_dir.exists():
        return results

    # Collect all skill names and descriptions
    skill_data: list[tuple[str, str, Path]] = []
    for skill_dir in sorted(skills_dir.iterdir()):
        skill_file = skill_dir / "SKILL.md"
        if not skill_file.exists():
            continue
        text = read_text(skill_file)
        desc = extract_description(text) or ""
        skill_data.append((skill_dir.name, desc.lower(), skill_file))

    # Check for name prefix overlap (e.g. "laravel" and "laravel-validation")
    # Only flag if descriptions are also similar
    for i, (name_a, desc_a, path_a) in enumerate(skill_data):
        for name_b, desc_b, path_b in skill_data[i + 1:]:
            # Skip known patterns: skill-X and skill-X-subtype is intentional
            if name_a == name_b:
                continue
            # Check description word overlap
            if desc_a and desc_b:
                words_a = set(desc_a.split())
                words_b = set(desc_b.split())
                if len(words_a) > 3 and len(words_b) > 3:
                    overlap = len(words_a & words_b) / min(len(words_a), len(words_b))
                    if overlap > 0.7:
                        rel_a = f".augment.uncompressed/skills/{name_a}/SKILL.md"
                        results.append(LintResult(
                            file=rel_a,
                            artifact_type="skill",
                            status="pass_with_warnings",
                            issues=[Issue("warning", "similar_description",
                                         f"Description highly similar to '{name_b}' ({overlap:.0%} word overlap)")],
                            suggestions=[f"Consider merging with '{name_b}' or differentiating descriptions"],
                        ))

    return results


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
    parser.add_argument("--pairs", action="store_true", help="Check compression pairs (uncompressed vs compressed)")
    parser.add_argument("--duplicates", action="store_true", help="Detect skills with similar descriptions")
    parser.add_argument("--compression-quality", action="store_true", help="Check compressed skills preserve key content")
    parser.add_argument("--strict-warnings", action="store_true", help="Return non-zero on warnings")
    parser.add_argument("--report", action="store_true", help="Output quality score report")
    parser.add_argument("--repo-root", default=".", help="Repository root")
    return parser.parse_args()


def format_report(results: list[LintResult]) -> str:
    """Generate a quality score report grouped by artifact type."""
    lines = ["# Quality Report", ""]

    # Group by artifact type
    by_type: dict[str, list[LintResult]] = {}
    for r in results:
        by_type.setdefault(r.artifact_type, []).append(r)

    # Summary table
    lines.append("| Type | Total | Pass | Warn | Fail | Score |")
    lines.append("|---|---|---|---|---|---|")
    total_score = 0.0
    total_count = 0
    for atype in sorted(by_type):
        items = by_type[atype]
        n = len(items)
        n_pass = sum(1 for r in items if r.status == "pass")
        n_warn = sum(1 for r in items if r.status in ("warn", "pass_with_warnings"))
        n_fail = sum(1 for r in items if r.status == "fail")
        # Score: pass=10, warn=8, fail=3
        type_score = (n_pass * 10 + n_warn * 8 + n_fail * 3) / max(n, 1)
        total_score += type_score * n
        total_count += n
        lines.append(f"| {atype} | {n} | {n_pass} | {n_warn} | {n_fail} | {type_score:.1f}/10 |")
    overall = total_score / max(total_count, 1)
    lines.append(f"| **TOTAL** | **{total_count}** | | | | **{overall:.1f}/10** |")

    # Top issues
    issue_counts: dict[str, int] = {}
    for r in results:
        for i in r.issues:
            issue_counts[i.code] = issue_counts.get(i.code, 0) + 1
    if issue_counts:
        lines.extend(["", "## Top Issues", ""])
        lines.append("| Issue | Count | Severity |")
        lines.append("|---|---|---|")
        for code, count in sorted(issue_counts.items(), key=lambda x: -x[1])[:15]:
            # Find severity from first occurrence
            sev = "?"
            for r in results:
                for i in r.issues:
                    if i.code == code:
                        sev = i.severity
                        break
                if sev != "?":
                    break
            lines.append(f"| `{code}` | {count} | {sev} |")

    # Files with most issues (top 10)
    files_with_issues = [
        (r.file, len(r.issues), r.status)
        for r in results
        if r.issues
    ]
    files_with_issues.sort(key=lambda x: -x[1])
    if files_with_issues:
        lines.extend(["", "## Files with Most Issues (Top 10)", ""])
        lines.append("| File | Issues | Status |")
        lines.append("|---|---|---|")
        for fpath, count, status in files_with_issues[:10]:
            short = fpath.replace(".augment.uncompressed/", "")
            lines.append(f"| `{short}` | {count} | {status} |")

    # Per-file quality breakdown (skills only)
    skill_results = [r for r in results if r.artifact_type == "skill" and "/pair-check/" not in r.file]
    if skill_results:
        lines.extend(["", "## Per-File Quality (Skills)", ""])
        lines.append("| Skill | Structure | Validation | Scope | Dependency | Lines |")
        lines.append("|---|---|---|---|---|---|")
        for r in sorted(skill_results, key=lambda x: x.file):
            short = r.file.replace(".augment.uncompressed/skills/", "").replace(".augment/skills/", "").replace("/SKILL.md", "")
            codes = {i.code for i in r.issues}

            # Structure: fail if missing required sections
            struct = "❌" if codes & {"missing_section", "empty_procedure", "unordered_procedure"} else "✅"

            # Validation: weak if missing or vague
            if codes & {"missing_validation", "vague_validation"}:
                valid = "❌ weak"
            elif codes & {"missing_inspect_step"}:
                valid = "⚠️ partial"
            else:
                valid = "✅ strong"

            # Scope: broad if flagged
            scope = "⚠️ broad" if "broad_scope" in codes else "✅ focused"

            # Guideline dependency
            if "guideline_dependent_skill" in codes:
                dep = "❌ high"
            elif "pointer_only_skill" in codes:
                dep = "⚠️ medium"
            else:
                dep = "✅ low"

            # Line count
            total_lines = 0
            try:
                total_lines = Path(r.file).read_text(encoding="utf-8").count("\n")
            except OSError:
                pass

            lines.append(f"| `{short}` | {struct} | {valid} | {scope} | {dep} | {total_lines} |")

    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    root = Path(args.repo_root).resolve()

    try:
        paths: list[Path] = []
        if args.all or args.report:
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

        results = [lint_file(path, repo_root=root) for path in paths]

        # Additional checks
        if args.pairs or args.report:
            results.extend(check_compression_pairs(root))
        if args.duplicates:
            results.extend(check_duplication(root))
        if args.compression_quality or args.report:
            results.extend(check_compression_quality(root))

        if args.report:
            print(format_report(results))
        elif args.format == "json":
            print(format_json(results))
        else:
            print(format_text(results))

        return compute_exit_code(results, strict_warnings=args.strict_warnings)

    except Exception as exc:  # noqa: BLE001
        print(f"Internal error: {exc}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())