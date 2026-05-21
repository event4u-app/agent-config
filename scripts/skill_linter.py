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

# Sibling module — stdlib-only frontmatter schema validator.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_frontmatter import (  # noqa: E402
    parse_frontmatter as parse_frontmatter_for_schema,
    load_schema,
    validate as validate_against_schema,
)
from _lib.agent_src import artefact_roots, resolve_logical  # noqa: E402

Severity = Literal["error", "warning", "info"]
ArtifactType = Literal["skill", "rule", "command", "guideline", "persona", "user-type", "unknown"]

REQUIRED_PERSONA_SECTIONS_CORE = [
    "Focus",
    "Mindset",
    "Unique Questions",
    "Output Expectations",
    "Anti-Patterns",
]
REQUIRED_PERSONA_SECTIONS_SPECIALIST = REQUIRED_PERSONA_SECTIONS_CORE + [
    "Critical Rules",
    "Workflows",
]
# Back-compat alias — used by tier-agnostic callers; defaults to the core spine.
REQUIRED_PERSONA_SECTIONS = REQUIRED_PERSONA_SECTIONS_CORE
VALID_PERSONA_TIERS = {"core", "specialist"}
# Locked in docs/contracts/persona-schema.md § 4: core ≤ 120, specialist ≤ 100.
PERSONA_LINE_BUDGETS = {"core": 120, "specialist": 100}

# User-type spine — locked in docs/contracts/user-type-schema.md § 3.
# Runtime end-user simulation lens (sister axis to personas — methodology vs
# end-user). Single tier in v1 (no core/specialist split).
REQUIRED_USERTYPE_SECTIONS = [
    "Focus",
    "Daily Workflow",
    "Vocabulary",
    "Operational Constraints",
    "Unique Questions",
    "Ticket Red Flags",
    "Anti-Patterns",
]
USERTYPE_LINE_BUDGET = 120
# Wing-scoped overrides — Wing-3 (GTM) and Wing-4 (Money/Strategy/Ops) carry
# denser cognition (funnel × channel × lifecycle, or finance × org × strategy)
# than Wing-1/2 specialists, so the line cap rises to keep the seven-section
# spine intact without amputating workflows. Persona-schema.md § 4 wing matrix.
VALID_PERSONA_WINGS = {1, 2, 3, 4}
PERSONA_LINE_BUDGETS_BY_WING = {
    ("specialist", 3): 140,
    ("specialist", 4): 140,
}


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

# --- Frugality charter validator (see road-to-token-frugality Phase 0.4) ---
# Layer 1 = writer-cite check (every writer skill carries the section + link).
# Layer 2 = charter index integrity (the four canonical rules referenced by
# the charter resolve to real H2/H3 anchors in the rule files).

FRUGALITY_WRITER_SKILLS = {
    "skill-writing", "rule-writing", "command-writing",
    "guideline-writing", "context-authoring", "agent-docs-writing",
    "conventional-commits-writing", "readme-writing",
    "readme-writing-package", "adr-create",
    "persona-writing", "roadmap-writing", "script-writing",
}
FRUGALITY_CHARTER_RELPATH = "contexts/communication/frugality-charter.md"
FRUGALITY_CHARTER_INDEX_RULES = {
    "direct-answers.md": "iron-law-3",
    "user-interaction.md": "iron-law-1",
    "no-cheap-questions.md": "pre-send-self-check",
    "token-efficiency.md": "the-iron-laws",
}

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
TYPE_PATTERN = re.compile(r'^type:\s*"?(always|auto|manual)"?\s*$', re.MULTILINE)
SOURCE_PATTERN = re.compile(r'^source:\s*"?(package|project)"?\s*$', re.MULTILINE)
STATUS_PATTERN = re.compile(r'^status:\s*"?(active|deprecated|superseded)"?\s*$', re.MULTILINE)
REPLACED_BY_PATTERN = re.compile(r'^replaced_by:\s*"?([\w-]+)"?\s*$', re.MULTILINE)
TIER_PATTERN = re.compile(r'^tier:\s*"?([\w-]+)"?\s*$', re.MULTILINE)

# --- Senior-tier required-block patterns (skill-quality.md § Senior-Tier Required Structure) ---
# Heading-only checks; detail-shape lives in skill-quality-mechanics.md.
SENIOR_RELATED_SKILLS_PATTERN = re.compile(r"^##\s+Related Skills\s*$", re.MULTILINE)
SENIOR_RELATED_WHEN_PATTERN = re.compile(r"\*\*WHEN to use this\*\*", re.IGNORECASE)
SENIOR_RELATED_WHEN_NOT_PATTERN = re.compile(r"\*\*WHEN NOT to use this\*\*", re.IGNORECASE)
SENIOR_PROACTIVE_PATTERN = re.compile(
    r"^##\s+When the agent should load this\s*$", re.MULTILINE
)
SENIOR_OUTPUT_PATTERN = re.compile(r"^##\s+Output\s*$", re.MULTILINE)
H1_PATTERN = re.compile(r"^# .+", re.MULTILINE)
DOUBLE_BLANK_PATTERN = re.compile(r"\n{3,}")

VALID_RULE_TYPES = {"always", "auto", "manual"}
VALID_RULE_SOURCES = {"package", "project"}
VALID_STATUSES = {"active", "deprecated", "superseded"}

# --- Router schema (docs/contracts/rule-router.md) ---
ROUTER_ALLOWED_TRIGGER_KEYS = {"keyword", "phrase", "intent", "file_pattern",
                               "path_prefix", "command"}
ROUTER_ALLOWED_PROFILES = {"minimal", "balanced", "full"}
KERNEL_RULE_IDS: set[str] = {
    "agent-authority", "ask-when-uncertain", "commit-policy",
    "direct-answers", "language-and-tone", "no-cheap-questions",
    "non-destructive-by-default", "scope-control",
    "verify-before-complete",
}

# --- Runtime execution metadata constants ---
VALID_EXECUTION_TYPES = {"manual", "assisted", "automated"}
VALID_EXECUTION_HANDLERS = {"none", "shell", "php", "node", "internal"}
VALID_EXECUTION_SAFETY_MODES = {"strict"}
VALID_EXECUTION_FIELDS = {"type", "handler", "timeout_seconds", "safety_mode", "allowed_tools", "command"}

# --- Wing-3 GTM cognition-boundary patterns (council Q7 / iter-2 OQ3) ---
# Triggered only when a skill's context_spine declares a Wing-3 slot.
# See docs/contracts/adr-gtm-context-spine.md and
# agents/roadmaps/road-to-gtm-and-growth.md § G2.
WING3_SPINE_SLOTS = {"channel-stage", "funnel-stage", "customer-segment"}

CONTEXT_SPINE_INLINE_PATTERN = re.compile(
    r'^context_spine:\s*\[(.*?)\]\s*$', re.MULTILINE
)

# agent-operability: external SaaS URLs the agent would have to auth against
WING3_SAAS_URL_PATTERN = re.compile(
    r"https?://[\w.-]*\.(salesforce|hubspot|marketo|pardot|mailchimp|"
    r"intercom|amplitude|mixpanel|segment|klaviyo|sendgrid|mailgun|"
    r"pendo|gong|outreach|salesloft|apollo)\.(com|io)\b",
    re.IGNORECASE,
)

# vendor-independence: brand / SDK / platform slugs that lock cognition
WING3_VENDOR_BLACKLIST = re.compile(
    r"\b(salesforce|hubspot|marketo|pardot|mailchimp|intercom|drift|"
    r"klaviyo|sendgrid|mailgun|amplitude|mixpanel|pendo|gong|"
    r"outreach\.io|salesloft|apollo\.io|zendesk|freshworks)\b",
    re.IGNORECASE,
)

# transferability: stack-locked tooling instructions
WING3_STACK_LOCKED_PATTERN = re.compile(
    r"\b(npm install|pip install|composer require|gem install|"
    r"cargo add|yarn add|pnpm add|bundle add)\s+[\w@/.-]+",
    re.IGNORECASE,
)

# channel-agnosticism: channel-specific tactical prescriptions
WING3_CHANNEL_TACTIC_PATTERN = re.compile(
    r"\b(email subject line|tweet length|linkedin (post|ad)|"
    r"facebook ad|google ads?|tiktok (post|video)|instagram (post|reel)|"
    r"sms character limit|cold email template)\b",
    re.IGNORECASE,
)

# --- Wing-4 Money/Strategy/Ops cognition-boundary patterns (council Q7 / J2) ---
# Triggered only when a skill's context_spine declares a Wing-4 slot.
# See docs/contracts/adr-wing4-context-spine.md and
# agents/roadmaps/road-to-money-strategy-ops.md § J2.
WING4_SPINE_SLOTS = {"fiscal-period", "org-stage", "regulatory-regime"}

# agent-operability: external finance / HR / legal SaaS URLs
WING4_SAAS_URL_PATTERN = re.compile(
    r"https?://[\w.-]*\.(quickbooks|intuit|netsuite|xero|sage|"
    r"carta|pulley|gusto|bamboohr|lattice|15five|justworks|"
    r"docusign|ironclad|onetrust|rippling|workday|deel|"
    r"namely|adp|paychex|trinet|hibob|cultureamp)\.(com|io|co)\b",
    re.IGNORECASE,
)

# vendor-independence: finance / HR / legal brand / SDK slugs
WING4_VENDOR_BLACKLIST = re.compile(
    r"\b(quickbooks|netsuite|xero|sage intacct|"
    r"carta|pulley|gusto|bamboohr|lattice|15five|justworks|"
    r"docusign|ironclad|onetrust|rippling|workday|deel|"
    r"namely|adp|paychex|trinet|hibob|culture amp)\b",
    re.IGNORECASE,
)

# stage-agnosticism: prescriptive stage-specific thresholds that lock cognition
# Catches hardcoded runway / ARR / burn / team-size prescriptions tied to a
# specific funding stage. Framework-style framing ("read the org-stage slot",
# "applies across seed and public") passes; hard prescriptions ("18 months of
# runway", "Series A teams must hire") fire.
WING4_STAGE_AGNOSTIC_PATTERN = re.compile(
    r"(?:"
    r"\b\d+\s+months?\s+of\s+runway\b"
    r"|\brunway\s+of\s+at\s+least\s+\d+\s+months?\b"
    r"|\bminimum\s+runway\s+of\s+\d+\b"
    r"|\b(?:seed|series\s+[a-d]|growth|pre-?ipo|post-?ipo)[-\s]stage\s+"
    r"(?:companies|startups|teams|founders|orgs)\s+(?:must|should|always|never)\b"
    r"|\bteam\s+of\s+\d+\s+(?:or\s+more|or\s+fewer)\b"
    r"|\b(?:arr|mrr|burn\s+rate)\s+(?:of|over|under|above|below)\s+\$\d+"
    r")",
    re.IGNORECASE,
)


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


# --- Role-contract anchor cache (see road-to-role-modes Phase 1) ---
# Populated lazily so the linter stays fast when the guideline is absent.
_ROLE_CONTRACT_CANDIDATES = (
    Path("docs/guidelines/agent-infra/role-contracts.md"),
)
_ROLE_CONTRACT_SLUGS_CACHE: Optional[set[str]] = None


def _load_role_contract_slugs() -> set[str]:
    """Return the set of H3 mode slugs defined in role-contracts.md.

    Empty set if the guideline cannot be found — callers MUST treat an
    empty cache as "no data" and skip the check rather than flagging
    every reference as broken.
    """
    global _ROLE_CONTRACT_SLUGS_CACHE
    if _ROLE_CONTRACT_SLUGS_CACHE is not None:
        return _ROLE_CONTRACT_SLUGS_CACHE
    slugs: set[str] = set()
    for candidate in _ROLE_CONTRACT_CANDIDATES:
        if not candidate.exists():
            continue
        try:
            text = candidate.read_text(encoding="utf-8")
        except OSError:
            continue
        in_skeletons = False
        for line in text.splitlines():
            if line.startswith("## "):
                in_skeletons = line.strip().lower().startswith(
                    "## contract skeletons"
                )
                continue
            if in_skeletons and line.startswith("### "):
                name = line[4:].strip().lower()
                slugs.add(re.sub(r"[^a-z0-9]+", "-", name).strip("-"))
        if slugs:
            break
    _ROLE_CONTRACT_SLUGS_CACHE = slugs
    return slugs


_ROLE_CONTRACT_REF_PATTERN = re.compile(
    r"role-contracts\.md#([a-z0-9][a-z0-9-]*)", re.IGNORECASE
)


def lint_role_contract_refs(text: str) -> List[Issue]:
    """Warn if a file references `role-contracts.md#<slug>` for a mode
    that does not exist as an H3 heading in the guideline. No-op when
    the guideline is missing or declares no modes (bootstrap safety).
    """
    slugs = _load_role_contract_slugs()
    if not slugs:
        return []
    issues: List[Issue] = []
    seen: set[str] = set()
    for match in _ROLE_CONTRACT_REF_PATTERN.finditer(text):
        slug = match.group(1).lower()
        if slug in seen:
            continue
        seen.add(slug)
        if slug not in slugs:
            issues.append(Issue(
                "warning", "unknown_role_contract",
                f"References role-contracts.md#{slug} but no such "
                f"mode is defined in the guideline (known: "
                f"{', '.join(sorted(slugs))})",
            ))
    return issues


def extract_sections(text: str) -> set[str]:
    return {match.group(1).strip() for match in SECTION_PATTERN.finditer(text)}


def _count_code_blocks(text: str) -> int:
    """Return the number of fenced code blocks (``` … ```) in *text*."""
    fence_count = 0
    for line in text.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("```"):
            fence_count += 1
    return fence_count // 2


def _fenced_content_ratio(text: str) -> float:
    """Return the fraction of non-empty lines that sit inside fenced blocks.

    Retained as a helper for backwards compatibility; the size gates use
    :func:`_density_score` from the structural model instead (Phase 3 of
    road-to-structural-linter-reform).
    """
    inside = False
    fenced_lines = 0
    non_empty = 0
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            inside = not inside
            if stripped:
                non_empty += 1
            continue
        if stripped:
            non_empty += 1
            if inside:
                fenced_lines += 1
    if non_empty == 0:
        return 0.0
    return fenced_lines / non_empty


# --- Structural-density model (docs/contracts/linter-structural-model.md) ---
# Replaces the raw line/word/fenced-ratio gates with four primitives that
# distinguish complexity from bloat. Calibrated 2026-05-08 against the full
# 310-artefact corpus (agents/runtime/density/snapshot.jsonl).

PROCEDURE_HEADING_PATTERN = re.compile(
    r"^##\s+Procedure(\s*[:\u2014\-].*)?\s*$", re.MULTILINE
)
COMMAND_FRONTMATTER_DELEGATION_KEYS = ("cluster:", "routes_to:")
MD_LINK_PATTERN = re.compile(r"\[[^\]]+\]\(([^)]+\.md[^)]*)\)")


def _density_score(text: str) -> float:
    """Return structural density 0.0–1.0 — see docs/contracts/linter-structural-model.md.

    density = structured_lines / non_blank_lines, where structured_lines =
    fenced + table + bullet + numbered + heading. Higher = more structured
    (catalogue, table, code, list); lower = prose-dominant.
    """
    inside_fence = False
    structured = 0
    non_blank = 0
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped:
            continue
        non_blank += 1
        if stripped.startswith("```"):
            inside_fence = not inside_fence
            structured += 1
            continue
        if inside_fence:
            structured += 1
            continue
        if stripped.startswith("#"):
            structured += 1
            continue
        if stripped.startswith("|") and stripped.endswith("|"):
            structured += 1
            continue
        if stripped.startswith(("- ", "* ", "+ ")):
            structured += 1
            continue
        if re.match(r"^\d+\.\s", stripped):
            structured += 1
            continue
    if non_blank == 0:
        return 0.0
    return round(structured / non_blank, 3)


def _count_procedure_sections(text: str) -> int:
    """Count `## Procedure` (or `## Procedure: <name>`) blocks in *text*."""
    return len(PROCEDURE_HEADING_PATTERN.findall(text))


def _command_delegation_signal(text: str, frontmatter: Optional[str]) -> bool:
    """Return True when a command has a delegation signal.

    Signals: frontmatter declares ``cluster:`` or ``routes_to:`` — OR — the
    body contains ≥ 3 markdown links to other ``.md`` files. Either signal
    is sufficient (council review 2026-05-08).
    """
    if frontmatter:
        for key in COMMAND_FRONTMATTER_DELEGATION_KEYS:
            if re.search(rf"^{re.escape(key)}", frontmatter, re.MULTILINE):
                return True
    if len(MD_LINK_PATTERN.findall(text)) >= 3:
        return True
    return False


def _strip_markdown_for_check(text: str) -> str:
    """Strip fenced code, inline code spans, and markdown links so heuristic
    regex matches operate on prose only.

    Used by rule-body heuristics whose targets (e.g. ``procedural_rule``)
    must not flip on legitimate skill pointers like ``[git-workflow](…)``
    or ``` `skill:symfony-workflow` ```. Frontmatter is handled by the
    caller via ``text.split("---", 2)[-1]``.
    """
    text = re.sub(r"```[^\n]*\n.*?```", "", text, flags=re.DOTALL)
    text = re.sub(r"`[^`\n]+`", "", text)
    text = re.sub(r"\[[^\]]*\]\([^)]*\)", "", text)
    return text


def _iron_law_blocks(text: str) -> int:
    """Count fenced blocks that look like verbatim Iron-Law imperatives.

    Heuristic: fenced block whose body has ≥ 30 alphabetical chars and
    ≥ 60 % uppercase across ≥ 1 non-empty line. The 30-char floor filters
    short ALL-CAPS markers (``OK``, ``WIP``); the 60 %-uppercase floor
    catches verbatim imperatives (``NEVER COMMIT.``).
    """
    blocks = 0
    inside = False
    body: list[str] = []
    for raw in text.splitlines():
        if raw.strip().startswith("```"):
            if inside and body:
                non_empty = [b for b in body if b.strip()]
                letters = "".join(non_empty)
                upper = sum(1 for c in letters if c.isalpha() and c.isupper())
                total = sum(1 for c in letters if c.isalpha())
                if total >= 30 and upper / total >= 0.6 and non_empty:
                    blocks += 1
            inside = not inside
            body = []
            continue
        if inside:
            body.append(raw)
    return blocks


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
    if "/personas/" in path_str:
        return "persona"
    if "/user-types/" in path_str:
        return "user-type"
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


_INSPECT_VERB_PATTERN = re.compile(
    r"\b(?:"
    # Direct inspection
    r"inspect|examine|audit|survey"
    # Read / look
    r"|read|look\s+at"
    # Check (word-boundary — matches "check that", "check current", "check what")
    r"|check"
    # Review (broad — matches "review existing", "review the failures")
    r"|review"
    # Comprehension / orientation
    r"|understand|identify|analyze|analyse"
    # Discovery
    r"|detect|gather|discover"
    r")\b",
    re.IGNORECASE,
)


def has_inspect_step(procedure_block: str) -> bool:
    """Return True if the procedure block opens with an inspect / read step.

    Corpus-driven verb list (see docs/contracts/linter-structural-model.md):
    the first ordered step in a skill procedure should orient the agent in
    the live system — read existing code, examine current state, detect
    stack — before mutating anything. Regex uses word boundaries to avoid
    substring matches inside unrelated words (e.g. ``read`` inside
    ``already``).
    """
    return bool(_INSPECT_VERB_PATTERN.search(procedure_block))


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
            issues.append(Issue("error", "description_too_long",
                                f"Description is {len(description)} chars (hard cap: 200) — see road-to-governance-cleanup F6"))
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
        ALLOWED_BARE_NOUNS = {"database", "devcontainer", "docker", "eloquent", "flux", "forecasting",
                              "grafana", "laravel", "livewire", "markitdown", "mcp", "openapi",
                              "performance", "security", "terraform", "terragrunt", "traefik",
                              "websocket"}
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

        # --- Senior-tier required-block check (skill-quality.md § Senior-Tier Required Structure) ---
        tier_match = TIER_PATTERN.search(frontmatter)
        if tier_match and tier_match.group(1) == "senior":
            issues.extend(lint_senior_tier_blocks(text))

        # --- Wing-3 GTM cognition-boundary check (council Q7 / adr-gtm-context-spine.md) ---
        spine_slots = parse_context_spine(frontmatter)
        if spine_slots and any(s in WING3_SPINE_SLOTS for s in spine_slots):
            issues.extend(lint_wing3_boundaries(text))

        # --- Wing-4 Money/Strategy/Ops cognition-boundary check (council Q7 / J2) ---
        if spine_slots and any(s in WING4_SPINE_SLOTS for s in spine_slots):
            issues.extend(lint_wing4_boundaries(text))

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

    # --- Size check (docs/contracts/linter-structural-model.md) ---
    # Structural-density gate replaces raw line count (Phase 3 of
    # road-to-structural-linter-reform, 2026-05-08): warn only when the skill
    # is *both* large AND prose-dominant OR ships ≥ 2 independently invocable
    # procedures. Reference catalogues (quality-tools 411 L / density 0.83)
    # pass; multi-procedure skills are flagged for split.
    #
    # Frontmatter opt-out: `meta_skill: true` exempts a skill from the size
    # warn when the skill's purpose *is* breadth (skill-writing, agent-docs-
    # writing, skill-reviewer, etc.). Meta-skills inherently bundle multiple
    # procedures and inline examples.
    total_lines = len(text.splitlines())
    is_meta_skill = bool(fm) and re.search(r"^meta_skill:\s*true\s*$", fm, re.MULTILINE)
    if total_lines > 400 and not is_meta_skill:
        density = _density_score(text)
        procedures = _count_procedure_sections(text)
        if density < 0.6 or procedures >= 2:
            reason = (
                f"density {density:.2f} < 0.60"
                if density < 0.6
                else f"{procedures} ## Procedure blocks (≥ 2)"
            )
            issues.append(Issue(
                "warning",
                "skill_too_large",
                f"Skill has {total_lines} lines and {reason}; review for split "
                f"(see linter-structural-model contract)",
            ))

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

    # --- evals.json schema validator ---
    # When a skill ships sibling `evals/evals.json` (quantitative behavior
    # eval per skill-writing § 7), validate its shape. Triggers.json is a
    # separate concern handled elsewhere. All issues here are WARN.
    issues.extend(validate_evals_json(path))

    return LintResult(
        file=str(path),
        artifact_type="skill",
        status=classify_status(issues),
        issues=issues,
        suggestions=dedupe_preserve_order(suggestions),
    )


def validate_evals_json(skill_path: Path) -> list[Issue]:
    """Validate `{skill_dir}/evals/evals.json` against the schema declared
    in `skill-writing` § 7. Returns WARN-level issues only; never blocks.
    Skipped entirely when the file is absent."""
    evals_path = skill_path.parent / "evals" / "evals.json"
    if not evals_path.is_file():
        return []
    issues: list[Issue] = []
    try:
        data = json.loads(evals_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [Issue("warning", "evals_json_unreadable",
                      f"evals/evals.json could not be parsed: {exc}")]
    if not isinstance(data, dict):
        return [Issue("warning", "evals_json_shape",
                      "evals/evals.json root must be an object")]
    if "skill" not in data or not isinstance(data["skill"], str):
        issues.append(Issue("warning", "evals_json_missing_skill",
                            "evals/evals.json must declare top-level 'skill' (string)"))
    scenarios = data.get("scenarios")
    if not isinstance(scenarios, list) or len(scenarios) < 1:
        issues.append(Issue("warning", "evals_json_no_scenarios",
                            "evals/evals.json must declare 'scenarios' (non-empty array)"))
        return issues
    valid_kinds = {"contains", "file_exists", "rubric"}
    for idx, scenario in enumerate(scenarios):
        loc = f"scenarios[{idx}]"
        if not isinstance(scenario, dict):
            issues.append(Issue("warning", "evals_json_scenario_shape",
                                f"{loc} must be an object"))
            continue
        for key in ("id", "prompt"):
            if key not in scenario or not isinstance(scenario[key], str) or not scenario[key].strip():
                issues.append(Issue("warning", "evals_json_scenario_missing_field",
                                    f"{loc} missing required string field '{key}'"))
        assertions = scenario.get("assertions")
        if not isinstance(assertions, list) or len(assertions) < 1:
            issues.append(Issue("warning", "evals_json_scenario_no_assertions",
                                f"{loc}.assertions must be a non-empty array"))
            continue
        for a_idx, assertion in enumerate(assertions):
            a_loc = f"{loc}.assertions[{a_idx}]"
            if not isinstance(assertion, dict):
                issues.append(Issue("warning", "evals_json_assertion_shape",
                                    f"{a_loc} must be an object"))
                continue
            kind = assertion.get("kind")
            if kind not in valid_kinds:
                issues.append(Issue("warning", "evals_json_assertion_kind",
                                    f"{a_loc}.kind must be one of {sorted(valid_kinds)}, got {kind!r}"))
                continue
            required_field = {"contains": "value", "file_exists": "path", "rubric": "criterion"}[kind]
            if required_field not in assertion or not isinstance(assertion[required_field], str):
                issues.append(Issue("warning", "evals_json_assertion_missing_field",
                                    f"{a_loc} (kind={kind}) missing required string field '{required_field}'"))
    return issues


def extract_frontmatter(text: str) -> Optional[str]:
    match = FRONTMATTER_PATTERN.search(text)
    return match.group(1) if match else None


def _parse_trust_level(frontmatter: str) -> Optional[str]:
    """Parse `trust.level:` from the nested `trust:` mapping in frontmatter.

    Returns the level string (e.g. ``"core"``, ``"advisory"``) or ``None``
    if absent. Stdlib-only — mirrors the line-walking approach of
    ``_parse_yaml_list`` so the linter stays pyyaml-free.
    """
    lines = frontmatter.splitlines()
    in_block = False
    for line in lines:
        if not in_block:
            if line.startswith("trust:"):
                rhs = line[len("trust:"):].strip()
                if rhs == "":
                    in_block = True
            continue
        if line.startswith("  level:"):
            return line[len("  level:"):].strip().strip('"').strip("'")
        if line.startswith("  "):
            continue
        break
    return None


def _parse_yaml_list(frontmatter: str, key: str) -> Optional[list]:
    """Parse a simple top-level YAML list `key:` from frontmatter.

    Supports the two shapes we emit in rule frontmatter:
      triggers:
        - keyword: "foo"
        - phrase: "bar baz"
      routes_to:
        - skill:php-coder
        - guideline:agent-infra/asking-and-brevity-examples

    Returns ``None`` if the key is absent (so the caller can distinguish
    "missing" from "empty"); returns ``[]`` for an explicitly empty list.
    """
    lines = frontmatter.splitlines()
    out: list = []
    in_block = False
    for line in lines:
        if not in_block:
            if line.startswith(f"{key}:"):
                rhs = line[len(key) + 1:].strip()
                if rhs in ("", "[]"):
                    if rhs == "[]":
                        return []
                    in_block = True
                else:
                    return None  # unexpected scalar shape
            continue
        if line.startswith("  - "):
            item = line[4:].strip()
            if ":" in item and not item.startswith(("'", '"')):
                k, _, v = item.partition(":")
                out.append({k.strip(): v.strip().strip('"').strip("'")})
            else:
                out.append(item.strip('"').strip("'"))
        elif line.strip() == "" or line.startswith("    "):
            continue
        else:
            break
    return out if in_block else None


def lint_router_frontmatter(rule_id: str, frontmatter: str,
                             rule_type: Optional[str]) -> List[Issue]:
    """Validate `triggers:` / `routes_to:` per docs/contracts/rule-router.md.

    Strict checks (always errors): kernel rules MUST NOT carry router fields;
    `triggers:` items must use one allowed key; `routes_to:` items must
    follow `kind:id` with kind ∈ {skill, guideline} and the target file
    must exist on disk.

    Lenient checks (info-level until Phase 4 migrations land): non-kernel
    rules without `triggers:` / `routes_to:` get an informational note,
    not an error — the existing description-matching path still works.

    Trust-tier carve-out: rules with ``trust.level: core`` are exempt from
    the ``router_routes_to_missing`` migration hint — they are authoritative
    by design and their body legitimately lives inline.
    """
    issues: List[Issue] = []
    triggers = _parse_yaml_list(frontmatter, "triggers")
    routes_to = _parse_yaml_list(frontmatter, "routes_to")

    # Manual rules are reference-only — not auto-injected, not router-routed
    # (ADR-004). Skip router validation so legacy triggers/routes_to fields
    # remain documented in the rule body without forcing maintenance.
    if rule_type == "manual":
        return issues

    is_kernel = rule_id in KERNEL_RULE_IDS or rule_type == "always"

    if is_kernel:
        if triggers is not None:
            issues.append(Issue("error", "kernel_has_triggers",
                "Kernel rules MUST NOT declare triggers: (kernel is unconditional)"))
        if routes_to is not None:
            issues.append(Issue("error", "kernel_has_routes_to",
                "Kernel rules MUST NOT declare routes_to: (kernel body stays inline)"))
        return issues

    # Non-kernel rule path
    if triggers is None:
        issues.append(Issue("info", "router_triggers_missing",
            "Non-kernel rule has no triggers: — falls back to description matching "
            "until Phase 4 migration lands"))
    else:
        for idx, item in enumerate(triggers):
            if not isinstance(item, dict) or len(item) != 1:
                issues.append(Issue("error", "trigger_shape_invalid",
                    f"triggers[{idx}] must be a single-key mapping"))
                continue
            (k,) = item.keys()
            if k not in ROUTER_ALLOWED_TRIGGER_KEYS:
                allowed = ", ".join(sorted(ROUTER_ALLOWED_TRIGGER_KEYS))
                issues.append(Issue("error", "trigger_key_unknown",
                    f"triggers[{idx}] key '{k}' not in allowed set ({allowed})"))

    if routes_to is None:
        # Trust-tier carve-out: rules pinned at trust.level: core are
        # authoritative — their body IS the behavior and may legitimately
        # live inline without a routes_to: delegation. The Phase 4
        # migration hint applies only to lower-trust rules.
        trust_level = _parse_trust_level(frontmatter)
        if trust_level != "core":
            issues.append(Issue("info", "router_routes_to_missing",
                "Non-kernel rule has no routes_to: — body should migrate to skill / "
                "guideline in Phase 4"))
    else:
        repo_root = Path(__file__).resolve().parent.parent
        for idx, item in enumerate(routes_to):
            if not isinstance(item, str) or ":" not in item:
                issues.append(Issue("error", "route_shape_invalid",
                    f"routes_to[{idx}] must be 'kind:id'"))
                continue
            kind, _, target_id = item.partition(":")
            # Multi-root aware (ADR-017): resolve logical paths via every
            # source root so kernel rules keep routing to skills/commands
            # that moved into packages/*/.
            target: Optional[Path] = None
            if kind == "skill":
                target = resolve_logical(f"skills/{target_id}/SKILL.md")
            elif kind == "guideline":
                gpath = repo_root / "docs" / "guidelines" / f"{target_id}.md"
                target = gpath if gpath.exists() else None
            elif kind == "command":
                target = resolve_logical(f"commands/{target_id}.md")
            elif kind == "contract":
                # Contracts live in two places: stable host docs in
                # docs/contracts/ and load-bearing flows under
                # contexts/contracts/ inside any source root (road-to-path-fixes
                # P4 / Council R2). Try both before failing.
                cpath = repo_root / "docs" / "contracts" / f"{target_id}.md"
                if cpath.exists():
                    target = cpath
                else:
                    target = resolve_logical(f"contexts/contracts/{target_id}.md")
            else:
                issues.append(Issue("error", "route_kind_unknown",
                    f"routes_to[{idx}] kind '{kind}' must be 'skill', 'guideline', 'command', or 'contract'"))
                continue
            if target is None or not target.exists():
                issues.append(Issue("error", "route_target_missing",
                    f"routes_to[{idx}] target '{item}' not found under any artefact root"))
    return issues


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


def lint_senior_tier_blocks(text: str) -> List[Issue]:
    """Validate the four required blocks for `tier: senior` skills.

    Per .agent-src.uncompressed/rules/skill-quality.md § Senior-Tier
    Required Structure: Context-First lead (description), Related Skills
    (with WHEN / WHEN NOT lists), Proactive Triggers, Output Artifacts.

    The Context-First lead is checked structurally via description length
    + content; here we enforce the three section blocks and the WHEN /
    WHEN NOT two-list pattern inside Related Skills.
    """
    issues: List[Issue] = []

    if not SENIOR_RELATED_SKILLS_PATTERN.search(text):
        issues.append(Issue(
            "error",
            "missing_senior_related_skills",
            "Senior-tier skill missing `## Related Skills` block (skill-quality.md § Senior-Tier Required Structure)",
        ))
    else:
        related_block = extract_section_block(text, "Related Skills") or ""
        if not SENIOR_RELATED_WHEN_PATTERN.search(related_block):
            issues.append(Issue(
                "error",
                "missing_senior_related_when",
                "Senior-tier `## Related Skills` block missing `**WHEN to use this**` list",
            ))
        if not SENIOR_RELATED_WHEN_NOT_PATTERN.search(related_block):
            issues.append(Issue(
                "error",
                "missing_senior_related_when_not",
                "Senior-tier `## Related Skills` block missing `**WHEN NOT to use this**` list",
            ))

    if not SENIOR_PROACTIVE_PATTERN.search(text):
        issues.append(Issue(
            "error",
            "missing_senior_proactive_triggers",
            "Senior-tier skill missing `## When the agent should load this` block",
        ))

    if not SENIOR_OUTPUT_PATTERN.search(text):
        issues.append(Issue(
            "error",
            "missing_senior_output_artifacts",
            "Senior-tier skill missing `## Output` block declaring artifact name + shape",
        ))

    return issues


def parse_context_spine(frontmatter: str) -> Optional[List[str]]:
    """Parse `context_spine:` from frontmatter.

    Supports the inline form `context_spine: [a, b, c]` (most skills) and
    the block form via `_parse_yaml_list`. Returns the slot list, ``[]``
    for an explicitly empty array, or ``None`` if the key is absent.
    """
    match = CONTEXT_SPINE_INLINE_PATTERN.search(frontmatter)
    if match is not None:
        inner = match.group(1).strip()
        if not inner:
            return []
        return [s.strip().strip('"').strip("'") for s in inner.split(",") if s.strip()]
    block = _parse_yaml_list(frontmatter, "context_spine")
    return block


def _strip_wing3_carve_outs(text: str) -> str:
    """Remove fenced code, inline backticks, the ``## Do NOT`` block, and
    ``**WHEN NOT to use this**`` bullets so legitimate citations of vendor
    names (as off-scope examples) do not trip Wing-3 boundary checks.
    """
    text = re.sub(r"```[^\n]*\n.*?```", "", text, flags=re.DOTALL)
    text = re.sub(r"`[^`]+`", "", text)
    text = re.sub(
        r"^##\s+Do NOT\s*$.*?(?=^##\s+|\Z)",
        "", text, flags=re.MULTILINE | re.DOTALL,
    )
    text = re.sub(
        r"\*\*WHEN NOT to use this\*\*.*?(?=\*\*WHEN|^##\s+|\Z)",
        "", text, flags=re.DOTALL | re.IGNORECASE,
    )
    return text


def lint_wing3_boundaries(text: str) -> List[Issue]:
    """Four Wing-3 GTM cognition-boundary checks.

    Triggered when a skill's ``context_spine`` declares at least one
    Wing-3 slot (channel-stage, funnel-stage, customer-segment). Enforces
    council Q7 / iter-2 OQ3 verdict that GTM cognition stays:

    - **agent-operability** — no external SaaS URLs the agent would auth against.
    - **vendor-independence** — no platform / SDK / brand slugs.
    - **transferability** — no stack-locked tooling instructions.
    - **channel-agnosticism** — no channel-specific tactical prescriptions.

    Carve-outs: fenced code, inline backticks, the ``## Do NOT`` block,
    and ``**WHEN NOT to use this**`` lists — so authors can cite a vendor
    as off-scope without tripping the linter.
    """
    issues: List[Issue] = []
    body = _strip_wing3_carve_outs(text)

    match = WING3_SAAS_URL_PATTERN.search(body)
    if match:
        issues.append(Issue(
            "warning", "wing3_agent_operability",
            f"Wing-3 skill cites external SaaS URL `{match.group(0)}` outside "
            f"carve-outs — cognition skills must operate without SaaS auth "
            f"(council Q7 boundary)",
        ))

    match = WING3_VENDOR_BLACKLIST.search(body)
    if match:
        issues.append(Issue(
            "warning", "wing3_vendor_independence",
            f"Wing-3 skill names vendor `{match.group(0)}` outside carve-outs "
            f"— keep cognition vendor-agnostic (council Q7 boundary)",
        ))

    match = WING3_STACK_LOCKED_PATTERN.search(body)
    if match:
        issues.append(Issue(
            "warning", "wing3_transferability",
            f"Wing-3 skill includes stack-locked instruction `{match.group(0)}` "
            f"outside carve-outs — cognition should transfer across stacks "
            f"(council Q7 boundary)",
        ))

    match = WING3_CHANNEL_TACTIC_PATTERN.search(body)
    if match:
        issues.append(Issue(
            "warning", "wing3_channel_agnosticism",
            f"Wing-3 skill prescribes channel-specific tactic "
            f"`{match.group(0)}` outside carve-outs — keep cognition "
            f"channel-agnostic (council Q7 boundary)",
        ))

    return issues


def lint_wing4_boundaries(text: str) -> List[Issue]:
    """Four Wing-4 Money/Strategy/Ops cognition-boundary checks.

    Triggered when a skill's ``context_spine`` declares at least one
    Wing-4 slot (fiscal-period, org-stage, regulatory-regime). Enforces
    council Q7 / J2 verdict that Money/Strategy/Ops cognition stays:

    - **agent-operability** — no external finance/HR/legal SaaS URLs.
    - **vendor-independence** — no QuickBooks/Carta/Gusto-class brand slugs.
    - **transferability** — no stack-locked tooling instructions.
    - **stage-agnosticism** — no prescriptive stage-specific thresholds.

    Carve-outs are identical to Wing-3: fenced code, inline backticks,
    the ``## Do NOT`` block, and ``**WHEN NOT to use this**`` lists.
    Regulatory regime names (GDPR / HIPAA / SOC2 / PCI / CCPA) are
    cognition-relevant constraints, not vendors — they pass.
    """
    issues: List[Issue] = []
    body = _strip_wing3_carve_outs(text)

    match = WING4_SAAS_URL_PATTERN.search(body)
    if match:
        issues.append(Issue(
            "warning", "wing4_agent_operability",
            f"Wing-4 skill cites external SaaS URL `{match.group(0)}` outside "
            f"carve-outs — cognition skills must operate without SaaS auth "
            f"(council Q7 boundary)",
        ))

    match = WING4_VENDOR_BLACKLIST.search(body)
    if match:
        issues.append(Issue(
            "warning", "wing4_vendor_independence",
            f"Wing-4 skill names vendor `{match.group(0)}` outside carve-outs "
            f"— keep cognition vendor-agnostic (council Q7 boundary)",
        ))

    match = WING3_STACK_LOCKED_PATTERN.search(body)
    if match:
        issues.append(Issue(
            "warning", "wing4_transferability",
            f"Wing-4 skill includes stack-locked instruction `{match.group(0)}` "
            f"outside carve-outs — cognition should transfer across stacks "
            f"(council Q7 boundary)",
        ))

    match = WING4_STAGE_AGNOSTIC_PATTERN.search(body)
    if match:
        issues.append(Issue(
            "warning", "wing4_stage_agnosticism",
            f"Wing-4 skill prescribes stage-locked threshold "
            f"`{match.group(0)}` outside carve-outs — cognition must "
            f"transfer across seed and public (council Q7 boundary)",
        ))

    return issues


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

    # Validate command shape if present. Skills that declare `command` are
    # runtime-executable; skills without it stay in proposal-only mode.
    command = execution.get("command")
    if command is not None:
        if not isinstance(command, list) or not all(isinstance(c, str) for c in command):
            issues.append(Issue("error", "invalid_command",
                                "command must be a list of strings (argv form)"))
        elif len(command) == 0:
            issues.append(Issue("error", "empty_command",
                                "command must not be empty"))

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
            issues.append(Issue("error", "missing_type", "Frontmatter missing 'type' field (must be 'always', 'auto', or 'manual')"))
        elif rule_type not in VALID_RULE_TYPES:
            issues.append(Issue("error", "invalid_type", f"Invalid type '{rule_type}'; must be 'always', 'auto', or 'manual'"))

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

        # description length cap (F6 — 200-char hard cap, see road-to-governance-cleanup)
        rule_description = extract_description(text)
        if rule_description and len(rule_description) > 200:
            issues.append(Issue("error", "description_too_long",
                                f"Description is {len(rule_description)} chars (hard cap: 200) — see road-to-governance-cleanup F6"))

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

        # Router schema validation (docs/contracts/rule-router.md, Phase 3.3).
        issues.extend(lint_router_frontmatter(path.stem, frontmatter, rule_type))

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

    # --- Content checks (docs/contracts/linter-structural-model.md) ---
    # Structural-density gate replaces fenced-ratio + dual-threshold (Phase 3
    # of road-to-structural-linter-reform, 2026-05-08): warn only when the
    # rule is long, prose-dominant, AND ships no Iron-Law block. Hard error
    # at 200 lines stays unconditional.
    line_count = len([line for line in text.splitlines() if line.strip()])
    total_lines = len(text.splitlines())
    if total_lines > 200:
        issues.append(Issue("error", "rule_too_large", f"Rule has {total_lines} lines (hard limit: 200); must split or move to guideline"))
    elif line_count > 60:
        density = _density_score(text)
        iron_blocks = _iron_law_blocks(text)
        if density < 0.5 and iron_blocks == 0:
            issues.append(Issue(
                "warning",
                "long_rule",
                f"Rule has {line_count} non-empty lines, density {density:.2f} < 0.50, "
                f"no Iron-Law block; rules should be concise "
                f"(see linter-structural-model contract)",
            ))

    for bad_sign in RULE_BAD_SIGNS:
        if bad_sign in text:
            issues.append(Issue("error", "rule_looks_like_skill", f"Rule contains skill-like section: {bad_sign}"))

    # Procedural-rule heuristic: a rule "looks procedural" only when its own
    # prose AND its own structure both signal a procedure. We:
    #   1. Exclude frontmatter (may contain "type", path strings, etc.).
    #   2. Strip code spans, fenced blocks, and markdown links — so legitimate
    #      pointers to procedural skills (e.g. `skill:git-workflow`,
    #      [symfony-workflow](…)) do not flip the keyword count.
    #   3. Require ≥ 2 keyword occurrences in stripped prose AND ≥ 3 ordered
    #      steps AND no Iron-Law block — that combination distinguishes a
    #      mis-classified procedure from a rule that merely references one.
    body = text.split("---", 2)[-1] if frontmatter else text
    stripped_body = _strip_markdown_for_check(body)
    kw_count = len(re.findall(r"\b(procedure|workflow)\b", stripped_body, re.IGNORECASE))
    ordered_steps = len(re.findall(r"^\s*\d+\.\s+", body, re.MULTILINE))
    if kw_count >= 2 and ordered_steps >= 3 and _iron_law_blocks(text) == 0:
        issues.append(Issue("warning", "procedural_rule", "Rule looks procedural; consider a skill instead"))

    return LintResult(
        file=str(path),
        artifact_type="rule",
        status=classify_status(issues),
        issues=issues,
        suggestions=dedupe_preserve_order(suggestions),
    )


def _lint_command_suggestion_block(text: str) -> List[Issue]:
    """Validate the suggestion frontmatter block (road-to-context-aware-command-suggestion).

    Schema-shape is enforced upstream by validate_frontmatter; this function adds the
    *conditional* content rules that JSON Schema (Draft-07 subset used here) cannot
    express: trigger fields must be non-empty when eligible, rationale must be
    non-empty when ineligible.
    """
    issues: List[Issue] = []
    data, _offset = parse_frontmatter_for_schema(text)
    if data is None:
        return issues
    suggestion = data.get("suggestion")
    if suggestion is None:
        issues.append(Issue(
            "error", "missing_suggestion_block",
            "Command frontmatter is missing the 'suggestion' block — required by "
            "road-to-context-aware-command-suggestion Phase 2.",
        ))
        return issues
    if not isinstance(suggestion, dict):
        issues.append(Issue("error", "invalid_suggestion_block", "'suggestion' must be a mapping"))
        return issues
    eligible = suggestion.get("eligible")
    if eligible is True:
        td = (suggestion.get("trigger_description") or "").strip()
        tc = (suggestion.get("trigger_context") or "").strip()
        if not td:
            issues.append(Issue(
                "error", "missing_trigger_description",
                "suggestion.eligible=true requires a non-empty 'trigger_description'.",
            ))
        elif len(td) < 10:
            issues.append(Issue(
                "warning", "trigger_description_too_short",
                "suggestion.trigger_description is suspiciously short (<10 chars); "
                "linter rejects empty or overly generic patterns.",
            ))
        if not tc:
            issues.append(Issue(
                "error", "missing_trigger_context",
                "suggestion.eligible=true requires a non-empty 'trigger_context'.",
            ))
        elif len(tc) < 10:
            issues.append(Issue(
                "warning", "trigger_context_too_short",
                "suggestion.trigger_context is suspiciously short (<10 chars); "
                "linter rejects empty or overly generic patterns.",
            ))
    elif eligible is False:
        rationale = (suggestion.get("rationale") or "").strip()
        if not rationale:
            issues.append(Issue(
                "error", "missing_suggestion_rationale",
                "suggestion.eligible=false requires a non-empty 'rationale'.",
            ))
    else:
        issues.append(Issue(
            "error", "invalid_suggestion_eligible",
            "suggestion.eligible must be true or false.",
        ))
    return issues


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
        elif len(description) > 200:
            issues.append(Issue("error", "description_too_long",
                                f"Description is {len(description)} chars (hard cap: 200) — see road-to-governance-cleanup F6"))

        # suggestion block (road-to-context-aware-command-suggestion Phase 2)
        issues.extend(_lint_command_suggestion_block(text))

        # deprecation-shim warning line (P0.8b — command-clusters contract)
        if "superseded_by:" in frontmatter:
            shim_warning = re.search(
                r"⚠️\s+/[a-z][a-z0-9-]*\s+is deprecated;\s+use\s+/[a-z][a-z0-9 -]+\s+instead",
                text,
            )
            if not shim_warning:
                issues.append(Issue(
                    "error", "shim_missing_warning",
                    "Deprecation shim must contain a one-line warning matching "
                    "'⚠️  /<old-name> is deprecated; use /<cluster> <sub> instead.'"
                    " (or '/<cluster> --<flag>' for flag-clusters)"
                    " (see docs/contracts/command-clusters.md § Deprecation shim contract)"
                ))

    # --- Structure checks ---
    if not H1_PATTERN.search(text):
        issues.append(Issue("error", "missing_h1", "Command is missing an H1 heading (# Title)"))

    # Must have at least one ## section with steps. Cluster-head and
    # router-style commands (frontmatter cluster:/routes_to: or ≥ 3 .md
    # links) are exempt — they delegate procedure to sub-commands or
    # skills (road-to-feedback-followups P2.1).
    sections = extract_sections(text)
    has_steps = any(s.lower().startswith("step") for s in sections)
    # Accept both ``## 1.`` / ``### 1.`` numbered headings AND
    # ``### Step N`` / ``## Step N`` step-prefixed sub-headings.
    has_numbered = bool(re.search(r"^###?\s+(?:\d+\.|step\s+\d+)\s+", text, re.MULTILINE | re.IGNORECASE))
    if not has_steps and not has_numbered:
        delegated = _command_delegation_signal(text, frontmatter)
        if not delegated:
            issues.append(Issue("warning", "no_steps", "Command has no Steps section or numbered sub-headings"))

    # --- Size check (docs/contracts/linter-structural-model.md) ---
    # Structural-density gate replaces sub-section + code-block heuristic
    # (Phase 3 of road-to-structural-linter-reform, 2026-05-08): warn only
    # when the command is large, lacks a delegation signal (frontmatter
    # cluster:/routes_to: OR ≥ 3 markdown links to other .md files), AND
    # has density < 0.65.
    word_count = len(text.split())
    if word_count > 1000:
        density = _density_score(text)
        delegated = _command_delegation_signal(text, frontmatter)
        if not delegated and density < 0.65:
            issues.append(Issue(
                "warning",
                "large_command",
                f"Command has {word_count} words, density {density:.2f} < 0.65, "
                f"no delegation signal (frontmatter cluster:/routes_to: or "
                f"≥ 3 .md links); review for split or delegation "
                f"(see linter-structural-model contract)",
            ))

    # File must end with exactly one newline
    if not text.endswith("\n"):
        issues.append(Issue("error", "no_trailing_newline", "File must end with exactly one newline"))
    elif text.endswith("\n\n"):
        issues.append(Issue("warning", "extra_trailing_newlines", "File ends with multiple newlines; should be exactly one"))

    # Role-contract anchor validity (road-to-role-modes Phase 1).
    issues.extend(lint_role_contract_refs(text))

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


def lint_persona(path: Path, text: str) -> LintResult:
    """Lint a persona .md file (frontmatter schema + required sections + size)."""
    issues: List[Issue] = []

    # Frontmatter required
    frontmatter = extract_frontmatter(text)
    if not frontmatter:
        issues.append(Issue("error", "missing_frontmatter", "Persona requires YAML frontmatter"))
        return LintResult(
            file=str(path),
            artifact_type="persona",
            status="fail",
            issues=issues,
            suggestions=["See .agent-src.uncompressed/templates/persona.md for the schema"],
        )

    # Required frontmatter fields
    required = {
        "id": re.compile(r'^id:\s*"?([\w-]+)"?\s*$', re.MULTILINE),
        "role": re.compile(r'^role:\s*"?(.+?)"?\s*$', re.MULTILINE),
        "description": re.compile(r'^description:\s*"?(.+?)"?\s*$', re.MULTILINE),
        "tier": re.compile(r'^tier:\s*"?(\w+)"?\s*$', re.MULTILINE),
        "version": re.compile(r'^version:\s*"?(.+?)"?\s*$', re.MULTILINE),
        "source": re.compile(r'^source:\s*"?(package|project)"?\s*$', re.MULTILINE),
    }
    parsed: dict = {}
    for field, pattern in required.items():
        value = extract_frontmatter_field(frontmatter, pattern)
        if not value:
            issues.append(Issue("error", f"missing_{field}", f"Persona frontmatter must declare `{field}`"))
        else:
            parsed[field] = value

    # id matches filename stem
    if "id" in parsed and parsed["id"] != path.stem:
        issues.append(Issue(
            "error",
            "id_filename_mismatch",
            f"Persona id `{parsed['id']}` must match filename stem `{path.stem}`",
        ))

    # tier in valid set
    if "tier" in parsed and parsed["tier"] not in VALID_PERSONA_TIERS:
        issues.append(Issue(
            "error",
            "invalid_tier",
            f"Persona tier `{parsed['tier']}` must be one of {sorted(VALID_PERSONA_TIERS)}",
        ))

    # wing — optional; when present must be one of {1,2,3,4} (per
    # docs/contracts/package-self-orientation.md § The four wings).
    wing_match = re.search(r'^wing:\s*"?(\d+)"?\s*$', frontmatter, re.MULTILINE)
    if wing_match:
        try:
            wing_value = int(wing_match.group(1))
            if wing_value in VALID_PERSONA_WINGS:
                parsed["wing"] = wing_value
            else:
                issues.append(Issue(
                    "error",
                    "invalid_wing",
                    f"Persona wing `{wing_value}` must be one of {sorted(VALID_PERSONA_WINGS)}",
                ))
        except ValueError:
            issues.append(Issue(
                "error",
                "invalid_wing",
                f"Persona wing `{wing_match.group(1)}` must be an integer 1–4",
            ))

    # description length
    if "description" in parsed and len(parsed["description"]) > 160:
        issues.append(Issue(
            "warning",
            "long_description",
            f"Persona description is {len(parsed['description'])} chars (target ≤ 160)",
        ))

    # Required sections — tier-aware (per docs/contracts/persona-schema.md § 3).
    # Core: 5 sections. Specialist: Core-5 + Critical Rules + Workflows.
    sections = extract_sections(text)
    tier = parsed.get("tier")
    if tier == "specialist":
        required_sections = REQUIRED_PERSONA_SECTIONS_SPECIALIST
    else:
        # Default to core sections when tier is missing or invalid; the
        # tier-enum check above already raised an error in that case.
        required_sections = REQUIRED_PERSONA_SECTIONS_CORE
    for required_section in required_sections:
        if required_section not in sections:
            issues.append(Issue(
                "error",
                "missing_section",
                f"Persona is missing required section `## {required_section}`",
            ))

    # Unique Questions must have ≥ 3 bullet items
    uq_block = extract_section_block(text, "Unique Questions")
    if uq_block:
        bullet_count = len(re.findall(r"^\s*[-*]\s+", uq_block, re.MULTILINE))
        if bullet_count < 3:
            issues.append(Issue(
                "warning",
                "too_few_unique_questions",
                f"Persona has {bullet_count} unique questions (target ≥ 3)",
            ))

    # Size budget by tier — wing-overrides apply when the persona declares a
    # `wing:` field; defaults to the tier baseline otherwise.
    if "tier" in parsed and parsed["tier"] in PERSONA_LINE_BUDGETS:
        tier_value = parsed["tier"]
        wing_value = parsed.get("wing")
        budget = PERSONA_LINE_BUDGETS_BY_WING.get(
            (tier_value, wing_value), PERSONA_LINE_BUDGETS[tier_value]
        )
        line_count = len(text.splitlines())
        if line_count > budget:
            scope = f"{tier_value}" if wing_value is None else f"{tier_value}, wing {wing_value}"
            issues.append(Issue(
                "warning",
                "size_budget",
                f"Persona has {line_count} lines ({scope} budget ≤ {budget})",
            ))

    # H1 heading
    if not H1_PATTERN.search(text):
        issues.append(Issue("warning", "missing_h1", "Persona is missing an H1 heading"))

    # Trailing newline
    if not text.endswith("\n"):
        issues.append(Issue("warning", "no_trailing_newline", "File must end with exactly one newline"))

    return LintResult(
        file=str(path),
        artifact_type="persona",
        status=classify_status(issues),
        issues=issues,
        suggestions=[],
    )


def lint_usertype(path: Path, text: str) -> LintResult:
    """Lint a user-type .md file (frontmatter schema + required sections + size).

    User-types are the runtime end-user simulation lens (sister axis to
    personas — methodology vs end-user). Contract:
    docs/contracts/user-type-schema.md.
    """
    issues: List[Issue] = []

    frontmatter = extract_frontmatter(text)
    if not frontmatter:
        issues.append(Issue("error", "missing_frontmatter", "User-type requires YAML frontmatter"))
        return LintResult(
            file=str(path),
            artifact_type="user-type",
            status="fail",
            issues=issues,
            suggestions=[".agent-src.uncompressed/user-types/_template/user-type.md"],
        )

    # Required keys per docs/contracts/user-type-schema.md § 1.
    required = {
        "id": re.compile(r'^id:\s*"?([\w-]+)"?\s*$', re.MULTILINE),
        "kind": re.compile(r'^kind:\s*"?([\w-]+)"?\s*$', re.MULTILINE),
        "description": re.compile(r'^description:\s*"?([^"\n]+?)"?\s*$', re.MULTILINE),
        "version": re.compile(r'^version:\s*"?([\d.]+)"?\s*$', re.MULTILINE),
        "source": re.compile(r'^source:\s*"?(package|project)"?\s*$', re.MULTILINE),
    }
    parsed: dict = {}
    for field, pattern in required.items():
        value = extract_frontmatter_field(frontmatter, pattern)
        if not value:
            issues.append(Issue("error", f"missing_{field}", f"User-type frontmatter must declare `{field}`"))
        else:
            parsed[field] = value

    if "id" in parsed and parsed["id"] != path.stem:
        issues.append(Issue(
            "error",
            "id_filename_mismatch",
            f"User-type id `{parsed['id']}` must match filename stem `{path.stem}`",
        ))

    if "kind" in parsed and parsed["kind"] != "user-type":
        issues.append(Issue(
            "error",
            "invalid_kind",
            f"User-type kind must be `user-type` (got `{parsed['kind']}`)",
        ))

    if "description" in parsed and len(parsed["description"]) > 160:
        issues.append(Issue(
            "warning",
            "long_description",
            f"User-type description is {len(parsed['description'])} chars (target ≤ 160)",
        ))

    sections = extract_sections(text)
    for required_section in REQUIRED_USERTYPE_SECTIONS:
        if required_section not in sections:
            issues.append(Issue(
                "error",
                "missing_section",
                f"User-type is missing required section `## {required_section}`",
            ))

    # Anti-Generic Quality Bar: ≥ 3 Unique Questions
    uq_block = extract_section_block(text, "Unique Questions")
    if uq_block:
        bullet_count = len(re.findall(r"^\s*[-*]\s+", uq_block, re.MULTILINE))
        if bullet_count < 3:
            issues.append(Issue(
                "warning",
                "too_few_unique_questions",
                f"User-type has {bullet_count} unique questions (target ≥ 3)",
            ))

    line_count = len(text.splitlines())
    if line_count > USERTYPE_LINE_BUDGET:
        issues.append(Issue(
            "warning",
            "size_budget",
            f"User-type has {line_count} lines (budget ≤ {USERTYPE_LINE_BUDGET})",
        ))

    if not H1_PATTERN.search(text):
        issues.append(Issue("warning", "missing_h1", "User-type is missing an H1 heading"))

    if not text.endswith("\n"):
        issues.append(Issue("warning", "no_trailing_newline", "File must end with exactly one newline"))

    return LintResult(
        file=str(path),
        artifact_type="user-type",
        status=classify_status(issues),
        issues=issues,
        suggestions=[],
    )


def gather_all_candidate_files(root: Path) -> list[Path]:
    """Gather all lintable files across every source root (ADR-017 multi-root).

    Walks ``artefact_roots()`` (legacy ``.agent-src.uncompressed/`` plus every
    ``packages/*/.agent-src.uncompressed/``). Falls back to ``.agent-src/``
    only when no source root exists. Skips symlinks to avoid double-counting.
    Deduplicates on logical relpath \u2014 first root wins per the agent_src
    contract.
    """
    candidates: list[Path] = []
    seen_logical: set[str] = set()

    def _add(file: Path, source_root: Path) -> None:
        if file.is_symlink() or not file.is_file():
            return
        try:
            logical = file.relative_to(source_root).as_posix()
        except ValueError:
            logical = file.name
        # Namespace by artefact-kind subdir so the same skill name across
        # packs would still dedupe (but the agent_src layout guarantees
        # each logical path lives in exactly one root post-move).
        if logical in seen_logical:
            return
        seen_logical.add(logical)
        candidates.append(file)

    sources = artefact_roots()
    if sources:
        for src_root in sources:
            for f in (src_root / "skills").rglob("SKILL.md") if (src_root / "skills").exists() else []:
                _add(f, src_root)
            for sub in ("rules", "commands", "guidelines"):
                base = src_root / sub
                if base.exists():
                    for f in base.rglob("*.md"):
                        _add(f, src_root)
            for sub in ("personas", "user-types"):
                base = src_root / sub
                if base.exists():
                    for f in base.glob("*.md"):
                        if f.name.lower() == "readme.md":
                            continue
                        _add(f, src_root)
            charter = src_root / FRUGALITY_CHARTER_RELPATH
            if charter.exists() and not charter.is_symlink():
                _add(charter, src_root)
    else:
        # Pure-compressed fallback (.agent-src/ only). Used by consumer
        # projects that vendor the compressed tree without sources.
        augment_root = root / ".agent-src"
        if augment_root.exists():
            for sub_pattern in (
                ("skills", "SKILL.md"),
                ("rules", "*.md"),
                ("commands", "*.md"),
                ("guidelines", "*.md"),
            ):
                base = augment_root / sub_pattern[0]
                if base.exists():
                    for f in base.rglob(sub_pattern[1]):
                        _add(f, augment_root)
            for sub in ("personas", "user-types"):
                base = augment_root / sub
                if base.exists():
                    for f in base.glob("*.md"):
                        if f.name.lower() == "readme.md":
                            continue
                        _add(f, augment_root)
            charter = augment_root / FRUGALITY_CHARTER_RELPATH
            if charter.exists() and not charter.is_symlink():
                _add(charter, augment_root)

    return sorted(set(candidates))


def gather_candidate_files_under(src_root: Path) -> list[Path]:
    """Gather lintable files under an arbitrary source root.

    Mirrors the per-root walk used by ``gather_all_candidate_files`` but
    scoped to a single directory \u2014 e.g. ``packages/pack-laravel/.agent-src.uncompressed/``
    so CI can lint a single pack in parallel (ADR-017 Phase 4.4).
    Skips symlinks and ``README.md`` siblings under ``personas/`` /
    ``user-types/``.
    """
    out: list[Path] = []
    if not src_root.is_dir():
        return out
    seen: set[Path] = set()

    def _push(file: Path) -> None:
        if file.is_symlink() or not file.is_file():
            return
        resolved = file.resolve()
        if resolved in seen:
            return
        seen.add(resolved)
        out.append(file)

    skills_dir = src_root / "skills"
    if skills_dir.exists():
        for f in skills_dir.rglob("SKILL.md"):
            _push(f)
    for sub in ("rules", "commands", "guidelines"):
        base = src_root / sub
        if base.exists():
            for f in base.rglob("*.md"):
                _push(f)
    for sub in ("personas", "user-types"):
        base = src_root / sub
        if base.exists():
            for f in base.glob("*.md"):
                if f.name.lower() == "readme.md":
                    continue
                _push(f)
    charter = src_root / FRUGALITY_CHARTER_RELPATH
    if charter.exists() and not charter.is_symlink():
        _push(charter)
    return sorted(set(out))


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
            # Skip symlinks to avoid double-counting (e.g. .claude/skills/ → .agent-src/commands/)
            if path.is_symlink():
                continue
            norm = raw.replace("\\", "/")
            # Only lint source-of-truth and source-mirror dirs. Projection
            # dirs (.windsurf/, .cursor/, .clinerules/, .claude/) use
            # tool-native frontmatter (e.g. Windsurf's trigger/globs) that
            # the linter does not validate — they regenerate from source.
            # ADR-017: accept legacy flat layout AND
            # packages/*/.agent-src.uncompressed/ paths.
            in_source = (
                norm.startswith(".agent-src.uncompressed/")
                or norm.startswith(".agent-src/")
                or "/.agent-src.uncompressed/" in norm
                or "/.agent-src/" in norm
            )
            if not in_source:
                continue
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

    # Exclude commands, guidelines, personas, user-types — not execution-oriented
    if (
        "/commands/" in path_lower
        or "/guidelines/" in path_lower
        or "/personas/" in path_lower
        or "/user-types/" in path_lower
    ):
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
        # Commands tagged `type: orchestrator` aggregate other commands /
        # routers — they intentionally do not declare a `skills:` list and
        # are exempt from the no-skill-reference check. The tag is the
        # contract; no hard-coded path list.
        is_orchestrator = False
        if frontmatter:
            skills_match = re.search(r'skills:\s*\[(.+)\]', frontmatter)
            has_skills_field = bool(skills_match and skills_match.group(1).strip())
            type_match = re.search(r'^type:\s*[\'"]?orchestrator[\'"]?\s*$',
                                   frontmatter, re.MULTILINE)
            is_orchestrator = bool(type_match)

        # Also check body for skill references
        has_skill_ref = bool(re.search(r'skill|SKILL\.md', text))

        if not has_skills_field and not has_skill_ref and not is_orchestrator:
            issues.append(Issue("warning", "command_missing_skill_references",
                                "Command does not reference any skills — "
                                "commands should orchestrate skills, not contain domain logic "
                                "(use `type: orchestrator` in frontmatter to exempt routers)"))

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


# --- Frugality validator helpers + Layers 1 & 2 ---

def _heading_to_slug(heading: str) -> str:
    """Slugify a markdown heading using GitHub's algorithm: lowercase,
    drop punctuation (em-dash, period, etc.), spaces -> hyphens,
    preserve adjacent hyphens (so `Iron Law 3 — Brevity` becomes
    `iron-law-3--brevity`, matching the anchor GitHub renders)."""
    s = heading.strip().lower()
    s = re.sub(r"[^a-z0-9 \-]", "", s)
    s = s.replace(" ", "-")
    return s.strip("-")


def _extract_heading_slugs(text: str) -> set[str]:
    """Return the set of slugs for every H2/H3 heading in a markdown body."""
    slugs: set[str] = set()
    for line in text.splitlines():
        if line.startswith("## ") or line.startswith("### "):
            heading = line.split(" ", 1)[1].strip()
            slugs.add(_heading_to_slug(heading))
    return slugs


def _skill_id_from_path(path: Path) -> Optional[str]:
    """Extract the writer-skill id from a SKILL.md path. Returns the
    parent-directory name, or None if the file is not a SKILL.md."""
    if path.name.lower() != "skill.md":
        return None
    return path.parent.name


def _is_frugality_charter(path: Path) -> bool:
    """True iff the path ends in the canonical charter relpath, regardless
    of whether it lives under .agent-src/ or .agent-src.uncompressed/."""
    norm = str(path).replace("\\", "/")
    return norm.endswith("/" + FRUGALITY_CHARTER_RELPATH)


# Section header recognised by Layer 1. Literal H2 only — sub-headings
# inside the section do not count as the section itself.
_FRUGALITY_STANDARDS_PATTERN = re.compile(
    r"^##\s+Frugality Standards\s*$", re.MULTILINE
)
_FRUGALITY_CHARTER_LINK_PATTERN = re.compile(
    r"\]\([^)]*frugality-charter\.md[^)]*\)"
)


def lint_frugality_writer_cite(path: Path, text: str,
                                artifact_type: str) -> List[Issue]:
    """Layer 1 — every writer skill must carry a `## Frugality Standards`
    section that links to the charter. No-op for non-writer skills and
    non-skill artifacts."""
    if artifact_type != "skill":
        return []
    skill_id = _skill_id_from_path(path)
    if skill_id is None or skill_id not in FRUGALITY_WRITER_SKILLS:
        return []
    issues: List[Issue] = []
    section_match = _FRUGALITY_STANDARDS_PATTERN.search(text)
    if not section_match:
        issues.append(Issue(
            "error", "frugality_section_missing",
            "Writer skill must carry a `## Frugality Standards` section "
            "(road-to-token-frugality Phase 0.4 Layer 1)",
        ))
        return issues
    # Section body = from match-end to next H2 or EOF.
    body_start = section_match.end()
    next_h2 = re.search(r"^##\s+", text[body_start:], re.MULTILINE)
    body_end = body_start + next_h2.start() if next_h2 else len(text)
    body = text[body_start:body_end]
    if not _FRUGALITY_CHARTER_LINK_PATTERN.search(body):
        issues.append(Issue(
            "error", "frugality_charter_cite_missing",
            "`## Frugality Standards` section must link to "
            "`frugality-charter.md` (road-to-token-frugality Phase 0.4 "
            "Layer 1)",
        ))
    return issues


# Markdown link pattern: [text](path#anchor) — anchor optional.
_MD_LINK_PATTERN = re.compile(
    r"\[[^\]]+\]\(([^)#]+)(?:#([^)]+))?\)"
)


def lint_frugality_charter_index(path: Path, text: str) -> List[Issue]:
    """Layer 2 — every cited anchor must resolve to a real H2/H3 heading
    in the target rule file, AND each of the four canonical rules must
    be cited at least once with the required canonical anchor substring.
    Additional citations to the same rule (net-new sections referencing
    other anchors) are validated for resolution but do not need the
    canonical substring."""
    if not _is_frugality_charter(path):
        return []
    issues: List[Issue] = []
    rules_dir = path.parent.parent.parent / "rules"
    rule_slugs_cache: dict[str, set[str]] = {}
    canonical_satisfied: set[str] = set()
    for link_match in _MD_LINK_PATTERN.finditer(text):
        link_path, link_anchor = link_match.group(1), link_match.group(2)
        rule_name = Path(link_path).name
        if rule_name not in FRUGALITY_CHARTER_INDEX_RULES:
            continue
        if link_anchor is None:
            continue
        anchor_lc = link_anchor.lower()
        required_substr = FRUGALITY_CHARTER_INDEX_RULES[rule_name]
        if required_substr in anchor_lc:
            canonical_satisfied.add(rule_name)
        if rule_name not in rule_slugs_cache:
            rule_file = rules_dir / rule_name
            if not rule_file.exists():
                issues.append(Issue(
                    "error", "frugality_charter_rule_missing",
                    f"Charter cites {rule_name} but the rule file does "
                    f"not exist at {rule_file}",
                ))
                rule_slugs_cache[rule_name] = set()
                continue
            try:
                rule_text = rule_file.read_text(encoding="utf-8")
            except OSError as e:
                issues.append(Issue(
                    "error", "frugality_charter_rule_unreadable",
                    f"Cannot read {rule_name}: {e}",
                ))
                rule_slugs_cache[rule_name] = set()
                continue
            rule_slugs_cache[rule_name] = _extract_heading_slugs(rule_text)
        if anchor_lc not in rule_slugs_cache[rule_name]:
            issues.append(Issue(
                "error", "frugality_charter_anchor_unresolved",
                f"Charter cites {rule_name}#{link_anchor} but no H2/H3 "
                f"heading with that slug exists in the rule file",
            ))
    missing = set(FRUGALITY_CHARTER_INDEX_RULES) - canonical_satisfied
    for rule_name in sorted(missing):
        required_substr = FRUGALITY_CHARTER_INDEX_RULES[rule_name]
        issues.append(Issue(
            "error", "frugality_charter_canonical_missing",
            f"Charter index lacks a canonical citation of {rule_name} "
            f"with anchor containing '{required_substr}' "
            f"(road-to-token-frugality Phase 0.4 Layer 2)",
        ))
    return issues


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
    is_compressed = "/.agent-src/" in path_str and "/.agent-src.uncompressed/" not in path_str
    is_uncompressed = "/.agent-src.uncompressed/" in path_str

    if not is_compressed and not is_uncompressed:
        return issues

    # --- Check: compressed/uncompressed pair exists ---
    # ADR-017: sources live under packages/*/.agent-src.uncompressed/ but
    # all packs project into the single repo-root .agent-src/ tree. The
    # pair-check now resolves via logical relpath, not a path-swap.
    from _lib.agent_src import strip_source_prefix as _strip
    norm = path_str.replace("\\", "/")
    if is_uncompressed:
        # Compute logical path then map to .agent-src/ at repo root.
        # Try direct strip first; fall back to substring split for absolute paths.
        logical = _strip(norm)
        if logical is None:
            marker = "/.agent-src.uncompressed/"
            idx = norm.rfind(marker)
            logical = norm[idx + len(marker):] if idx != -1 else None
        if logical:
            compressed_path = repo_root / ".agent-src" / logical
            if not compressed_path.exists():
                issues.append(Issue("warning", "compressed_variant_missing",
                                    f"Uncompressed file exists but compressed variant missing: "
                                    f"{compressed_path.name}"))
    elif is_compressed:
        # Compressed lives at repo-root .agent-src/<logical>. Source could
        # be at any source root \u2014 resolve via artefact_roots.
        marker = "/.agent-src/"
        idx = norm.rfind(marker)
        logical = norm[idx + len(marker):] if idx != -1 else None
        if logical:
            uncompressed_path = resolve_logical(logical)
            if uncompressed_path is None or not uncompressed_path.exists():
                issues.append(Issue("warning", "uncompressed_variant_missing",
                                    f"Compressed file exists but uncompressed source missing: "
                                    f"{Path(logical).name}"))

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


# --- Structural malice check (see road-to-suite-closure Phase 5) ---
#
# Five regex patterns scan skill / rule / command bodies for **structural**
# (not semantic) malice. Findings surface as ``Issue("error",
# "malice:<pattern>", "<line>:<matched>")`` so ``compute_exit_code`` can
# emit exit code 3 (security-failure), distinct from 2 (build-failure).
# Semantic checks (PII leakage, prompt injection) are deferred to v2.

# (a) credential exfil — curl|wget piping ${TOKEN}/${KEY}/${SECRET}/...
#     env vars or hitting ~/.aws/ ~/.ssh/ secrets.
_MALICE_CRED_EXFIL = re.compile(
    r"\b(?:curl|wget)\b[^\n]*"
    r"(?:\$\{?[A-Z_]*(?:TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|API)[A-Z_]*\}?"
    r"|~/\.(?:aws|ssh)/)"
)
# (b) arbitrary execution — eval/exec over a network-fetched payload, or
#     `bash <(curl ...)` / `sh <(wget ...)` style remote-execution.
_MALICE_REMOTE_EXEC = re.compile(
    r"(?:\b(?:eval|exec)\s*\([^)]*(?:curl|wget|requests\.get|urllib)"
    r"|\b(?:bash|sh|zsh)\s*<\s*\(\s*(?:curl|wget))"
)
# (c) force-push to a protected ref.
_MALICE_FORCE_PUSH = re.compile(
    r"\bgit\s+push\b[^\n]*--force(?:-with-lease)?\b[^\n]*"
    r"\b(?:main|master|prod|production|release)\b"
)
# (d) world-readable secrets — chmod 0?[4567]xx on .pem/.key/.env files.
_MALICE_CHMOD_SECRETS = re.compile(
    r"\bchmod\s+0?[4567]\d{2}\s+[^\n]*\.(?:pem|key|env)\b"
)
# (e) unbounded subprocess shell injection — shell=True interpolating ${VAR}.
_MALICE_SHELL_INJECT = re.compile(
    r"\bsubprocess\.[A-Za-z_]+\s*\([^)]*shell\s*=\s*True[^)]*\$\{"
)

_MALICE_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("cred_exfil", _MALICE_CRED_EXFIL),
    ("remote_exec", _MALICE_REMOTE_EXEC),
    ("force_push_protected", _MALICE_FORCE_PUSH),
    ("chmod_secrets", _MALICE_CHMOD_SECRETS),
    ("shell_injection", _MALICE_SHELL_INJECT),
]


def check_structural_malice(text: str) -> List[Issue]:
    """Return one Issue per malice match. Empty list when clean.

    Issue shape: ``Issue("error", f"malice:{name}", f"{line}:{matched}")``.
    The ``format_text`` renderer special-cases the ``malice:`` code prefix
    to emit ``<path>:<line>:malice:<pattern>:<matched>`` per Phase 5.2.
    """
    issues: List[Issue] = []
    for lineno, raw in enumerate(text.splitlines(), start=1):
        for name, pattern in _MALICE_PATTERNS:
            match = pattern.search(raw)
            if match:
                issues.append(Issue(
                    severity="error",
                    code=f"malice:{name}",
                    message=f"{lineno}:{match.group(0).strip()}",
                ))
    return issues


# --- Output-schema check (see road-to-trigger-evals Phase 3.5) ---
#
# Skills that freeze an output shape (`refine-ticket`, `estimate-ticket`)
# ship an optional `evals/output-schema.yml` listing the `##`-headers
# their output template MUST carry. The linter fails if a header drifts.

_OUTPUT_SCHEMA_KEY_PATTERN = re.compile(r'^(\w+):\s*(.*?)\s*$')


def parse_output_schema(text: str) -> dict:
    """Tiny YAML-like parser for ``evals/output-schema.yml`` — no PyYAML dep.

    Supported shape::

        version: 1
        required_headers:
          - "Refined ticket"
          - "Top-5 risks"

    Unknown keys are preserved but ignored by :func:`lint_output_schema`.
    """
    result: dict = {}
    current_list: Optional[str] = None
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("- "):
            if current_list is None:
                continue
            value = stripped[2:].strip().strip('"').strip("'")
            result[current_list].append(value)
            continue
        match = _OUTPUT_SCHEMA_KEY_PATTERN.match(stripped)
        if not match:
            continue
        key, value = match.group(1), match.group(2).strip('"').strip("'")
        if value == "":
            result[key] = []
            current_list = key
        else:
            current_list = None
            try:
                result[key] = int(value)
            except ValueError:
                result[key] = value
    return result


def load_output_schema(skill_path: Path) -> Optional[dict]:
    """Return the parsed schema sibling to ``skill_path`` or ``None``.

    Lookup: ``<skill-dir>/evals/output-schema.yml``. Callers MUST use the
    real path (not the repo-relative display path) so the sibling lookup
    hits the actual directory.
    """
    if skill_path.name != "SKILL.md":
        return None
    schema_path = skill_path.parent / "evals" / "output-schema.yml"
    if not schema_path.exists():
        return None
    try:
        return parse_output_schema(schema_path.read_text(encoding="utf-8"))
    except OSError:
        return None


def lint_output_schema(path: Path, text: str) -> List[Issue]:
    """Fail if any required header declared in the sibling schema is
    missing from the skill's output template.

    No-op when the schema file does not exist or declares no
    ``required_headers`` — keeps the check opt-in per skill.
    """
    schema = load_output_schema(path)
    if schema is None:
        return []
    required = schema.get("required_headers") or []
    if not isinstance(required, list) or not required:
        return []
    issues: List[Issue] = []
    # Scan the whole skill text. Template headers live inside a fenced
    # code block, but the `^## <header>$` line still matches — a drift
    # (rename/removal) makes the line disappear from the file entirely.
    for header in required:
        if not isinstance(header, str) or not header.strip():
            continue
        pattern = re.compile(
            rf"^##\s+{re.escape(header.strip())}\s*$", re.MULTILINE,
        )
        if not pattern.search(text):
            issues.append(Issue(
                "error", "output_schema_drift",
                f"Output template is missing required header "
                f"`## {header}` (declared in evals/output-schema.yml)",
            ))
    return issues


# Artefact types that carry a JSON-Schema contract for their frontmatter.
_SCHEMA_ARTEFACT_TYPES = {"skill", "rule", "command", "persona", "user-type"}


def lint_frontmatter_schema(path: Path, text: str, artifact_type: str) -> List[Issue]:
    """Validate the frontmatter of an artefact against its JSON-Schema.

    Schemas live in ``scripts/schemas/``. One schema per artefact type;
    see ``agents/reference/docs/frontmatter-contract.md`` for the human-readable
    contract the schemas encode. Guidelines have no frontmatter and are
    skipped.
    """
    if artifact_type not in _SCHEMA_ARTEFACT_TYPES:
        return []
    try:
        schema = load_schema(artifact_type)
    except FileNotFoundError:
        return []

    data, _ = parse_frontmatter_for_schema(text)
    if data is None:
        # Other linter checks already emit a missing-frontmatter error for
        # rules/commands/personas; avoid double-reporting here.
        return []

    issues: List[Issue] = []
    for error in validate_against_schema(data, schema):
        code = f"schema_{error.rule}"
        message = f"{error.path} – {error.message}"
        issues.append(Issue("error", code, message))
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
    elif artifact_type == "persona":
        result = lint_persona(display_path, text)
    elif artifact_type == "user-type":
        result = lint_usertype(display_path, text)
    else:
        # Frugality charter lives in contexts/ (artifact_type == unknown)
        # but still needs Layer 2 index-integrity validation.
        if _is_frugality_charter(path):
            charter_issues = lint_frugality_charter_index(path, text)
            return LintResult(
                file=str(display_path),
                artifact_type="unknown",
                status=classify_status(charter_issues),
                issues=charter_issues,
                suggestions=[],
            )
        return lint_unknown(display_path, text)

    # Post-processing: frontmatter schema validation (errors). Runs first
    # so schema failures surface before the softer quality checks below.
    schema_issues = lint_frontmatter_schema(display_path, text, artifact_type)
    if schema_issues:
        result.issues.extend(schema_issues)
        result.status = classify_status(result.issues)

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

    # Post-processing: output-schema drift (errors). Skills only — schema
    # lookup walks a sibling `evals/` directory off the real SKILL.md.
    if artifact_type == "skill":
        schema_issues = lint_output_schema(path, text)
        if schema_issues:
            result.issues.extend(schema_issues)
            result.status = classify_status(result.issues)

    # Post-processing: structural malice scan (errors). Skills, rules,
    # and commands carry executable patterns; guidelines/personas are
    # prose-only and skipped to keep noise low.
    if artifact_type in ("skill", "rule", "command"):
        malice_issues = check_structural_malice(text)
        if malice_issues:
            result.issues.extend(malice_issues)
            result.status = classify_status(result.issues)

    # Post-processing: frugality validator Layer 1 (writer-cite). Errors
    # if a writer skill lacks the `## Frugality Standards` section or its
    # link to the charter.
    frugality_issues = lint_frugality_writer_cite(
        display_path, text, artifact_type
    )
    if frugality_issues:
        result.issues.extend(frugality_issues)
        result.status = classify_status(result.issues)

    return result


def format_text(results: list[LintResult], quiet: bool = False) -> str:
    lines: list[str] = []
    # Phase 5.2: malice findings render in the spec shape
    # ``<path>:<line>:malice:<pattern>:<matched>`` ahead of the badge
    # block so security-failures are grep-able from the top.
    malice_total = 0
    for result in results:
        for issue in result.issues:
            if issue.code.startswith("malice:"):
                pattern_name = issue.code.split(":", 1)[1]
                lineno, _, matched = issue.message.partition(":")
                lines.append(
                    f"{result.file}:{lineno}:malice:{pattern_name}:{matched}"
                )
                malice_total += 1
    if malice_total:
        lines.append("")

    # P10.5: quiet mode skips PASS-without-issues; malice + WARN/FAIL still rendered.
    for result in results:
        if quiet and result.status == "pass" and not result.issues and not result.suggestions:
            continue
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
    suffix = f", {malice_total} malice" if malice_total else ""
    lines.append(f"Summary: {passes} pass, {warns} warn, {fails} fail, {total} total{suffix}")
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
        # ADR-017: union across every source root.
        compressed_dir = root / ".agent-src" / subdir
        uncompressed_names: set[str] = set()
        any_source = False
        for src_root in artefact_roots():
            uncompressed_dir = src_root / subdir
            if not uncompressed_dir.exists():
                continue
            any_source = True
            if is_nested:
                uncompressed_names |= {d.name for d in uncompressed_dir.iterdir() if d.is_dir() and (d / pattern).exists()}
            else:
                uncompressed_names |= {f.name for f in uncompressed_dir.glob(pattern) if f.is_file()}

        if not any_source:
            continue

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
            path_str = f".agent-src/{subdir}/{name}/{pattern}" if is_nested else f".agent-src/{subdir}/{name}"
            results.append(LintResult(
                file=path_str,
                artifact_type=subdir.rstrip("s"),
                status="fail",
                issues=[Issue("error", "missing_compressed", f"Uncompressed exists but compressed version is missing")],
                suggestions=[f"Run /compress to generate .agent-src/{subdir}/{name}"],
            ))

        # Orphaned compressed (no source)
        for name in sorted(compressed_names - uncompressed_names):
            path_str = f".agent-src/{subdir}/{name}/{pattern}" if is_nested else f".agent-src/{subdir}/{name}"
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
    compressed_dir = root / ".agent-src" / "skills"
    if not compressed_dir.exists():
        return results

    # ADR-017: collect skill dirs from every source root.
    skill_sources: list[Path] = []
    for src_root in artefact_roots():
        uncompressed_dir = src_root / "skills"
        if uncompressed_dir.exists():
            skill_sources.extend(sorted(uncompressed_dir.iterdir()))
    if not skill_sources:
        return results

    # Sections that MUST exist in compressed if they exist in uncompressed
    preserved_sections = ["When to use", "Procedure", "Gotcha", "Gotchas", "Do NOT", "Output format", "Output"]

    for skill_dir in skill_sources:
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
            rel_path = f".agent-src/skills/{skill_dir.name}/SKILL.md"
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
    # ADR-017: collect skill dirs across every source root, dedup by name.
    skill_dirs: list[Path] = []
    seen: set[str] = set()
    for src_root in artefact_roots():
        sd = src_root / "skills"
        if not sd.exists():
            continue
        for d in sorted(sd.iterdir()):
            if d.is_dir() and d.name not in seen:
                seen.add(d.name)
                skill_dirs.append(d)
    if not skill_dirs:
        return results

    # Collect all skill names and descriptions
    skill_data: list[tuple[str, str, Path]] = []
    for skill_dir in skill_dirs:
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
                        rel_a = f".agent-src.uncompressed/skills/{name_a}/SKILL.md"
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
    # Phase 5.2: structural-malice findings emit exit code 3 (security-
    # failure), distinct from 2 (build-failure) so CI surfaces can split.
    for r in results:
        if any(issue.code.startswith("malice:") for issue in r.issues):
            return 3
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
    parser.add_argument("--quiet", action="store_true",
                        help="suppress per-file PASS lines; keep malice + WARN/FAIL + summary (P10.5)")
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
            short = fpath.replace(".agent-src.uncompressed/", "")
            lines.append(f"| `{short}` | {count} | {status} |")

    # Per-file quality breakdown (skills only)
    skill_results = [r for r in results if r.artifact_type == "skill" and "/pair-check/" not in r.file]
    if skill_results:
        lines.extend(["", "## Per-File Quality (Skills)", ""])
        lines.append("| Skill | Structure | Validation | Scope | Dependency | Lines |")
        lines.append("|---|---|---|---|---|---|")
        for r in sorted(skill_results, key=lambda x: x.file):
            short = r.file.replace(".agent-src.uncompressed/skills/", "").replace(".agent-src/skills/", "").replace("/SKILL.md", "")
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
            if not path.exists():
                continue
            if path.is_dir():
                # Walk the directory like a source root so callers can pass
                # `packages/pack-laravel/.agent-src.uncompressed/` (ADR-017 Phase 4.4).
                paths.extend(gather_candidate_files_under(path))
            else:
                paths.append(path)

        paths = sorted(set(paths))
        if not paths:
            # Emit a valid empty payload when a structured format was requested
            # so downstream parsers (e.g. PR-summary workflows) don't fail on an
            # empty stdout. stderr keeps the human-readable note.
            if args.report:
                print(format_report([]))
            elif args.format == "json":
                print(format_json([]))
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
            print(format_text(results, quiet=args.quiet))

        return compute_exit_code(results, strict_warnings=args.strict_warnings)

    except Exception as exc:  # noqa: BLE001
        print(f"Internal error: {exc}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())