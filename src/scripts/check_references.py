#!/usr/bin/env python3
"""
Cross-reference checker for agent-config repositories.

Scans .md files in dist/agent-src/ and agents/ for internal references
(file paths, skill names, rule names) and reports broken ones.

Exit codes: 0 = clean, 1 = broken refs found, 3 = internal error
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
class BrokenRef:
    file: str
    line: int
    ref: str
    ref_type: str
    severity: Severity
    suggestion: str = ""


SCAN_DIRS = ["dist/agent-src", "agents"]
SKIP_DIRS = [
    "agents/roadmaps/archive",   # archived roadmaps have historical refs
    "agents/runtime/council/sessions",   # per-user audit trail (gitignored), captured provider output
    "agents/runtime/council/responses",  # paired council output (gitignored), captured provider output
    "agents/runtime/council/questions",  # design Q&A trail — forward-refs to planned artifacts
    "agents/evidence/analysis",           # plate-comparison working docs — forward-refs to planned artifacts
    "agents/evidence/audits",    # point-in-time audit write-ups — historical refs to then-current artefacts
    "agents/reports",            # transient run reports — historical/scratch refs, not stable artefacts
    "agents/roadmaps/skipped",   # skipped roadmaps — abandoned plans w/ forward-refs that never shipped
    "agents/runtime",            # volatile / machine-generated artefacts (gitignored)
    "agents/tmp",                # transient working docs (gitignored) — pr-bodies, council questions, manual-step scratchpads
    "agents/.harvest-local",     # deliberate gitignored evidence store (source-confidentiality) — refs to it can never resolve in CI
]

# Per-file opt-out marker. When present in the first 10 lines of a .md
# file, the entire file is skipped. Use for working docs that
# intentionally reference planned-but-not-yet-existing artifacts
# (audit bundles, design Q&A, in-flight plans).
FILE_SKIP_MARKER = "<!-- check-refs: skip -->"

# Per-line opt-out marker. When present anywhere on a line, that line's
# refs are skipped. Use for isolated forward-refs inside otherwise
# fully-checked documents.
LINE_IGNORE_MARKER = "<!-- ref-ignore -->"
ROOT = Path(".")

# YAML memory files (engineering-memory layer) live under `agents/memory/`.
# Each entry may reference skills, ADR paths, or local files via
# `source:` / `enforcement:` / `skill:`. We validate those paths so a
# memory entry cannot rot silently when a file is moved or deleted.
MEMORY_YAML_ROOT = "agents/memory"
MEMORY_FILE_EXTS = (".php", ".py", ".md", ".yml", ".yaml", ".json", ".sh",
                    ".js", ".ts", ".tsx", ".jsx")
MEMORY_SKIP_URI_PREFIXES = ("http://", "https://", "adr://", "ticket://",
                            "incident://", "pr://")

# File path references like `guidelines/agent-infra/size-and-scope.md`
PATH_PATTERN = re.compile(
    r'[`"\s]'
    r'(\.?(?:augment|agents|guidelines|rules|skills|commands|contexts|templates|patterns|personas|docs|src)'
    r'(?:/[\w._-]+)+\.(?:md|php|py|yml|yaml|json|sh))'
    r'[`"\s,;)\]]'
)

# Frontmatter `personas:` entries (skills/commands cite personas). Either
# inline list `[a, b]` or YAML block list on subsequent lines.
_FM_PERSONAS_INLINE = re.compile(r"^personas:\s*\[([^\]]*)\]\s*$")
_FM_PERSONAS_KEY = re.compile(r"^personas:\s*$")
_FM_LIST_ITEM = re.compile(r"^\s*-\s*([\w-]+)\s*$")

SKILL_REF_PATTERN = re.compile(r'`([\w-]+)`\s+skill')
RULE_REF_PATTERN = re.compile(r'`([\w-]+)`\s+rule')

# Unchecked TODO items (roadmap checkboxes) legitimately reference files
# and artifacts that do not exist yet. Skip these lines. `[~]` marks
# deferred work — same semantics as `[ ]` for reference resolution
# (forward-looking path, will materialize when the step ships).
UNCHECKED_TODO_PATTERN = re.compile(r'^\s*[-*+]\s+\[[ ~]\]\s')
_SKIP_NAMES = {"the", "a", "an", "this", "that", "your", "my", "no", "any", "each", "one",
               "always", "auto", "fail", "vue", "guidelines", "naming",
               "orderBy", "no-commit", "skill-linter", "skill-validator",
               "skill-refactor", "skill-telegraph-condensation", "skill-decondensation",
               "broad_scope", "composer"}

# Paths that are clearly example/template placeholders (not real references)
EXAMPLE_PATH_PATTERNS = [
    re.compile(r"agents/evidence/analysis/"),           # project-analyze output template
    re.compile(r"agents/roadmaps/template"),   # template reference
    re.compile(r"agents/overrides/"),           # override examples
    re.compile(r"commands/old-cmd"),            # example placeholder
    re.compile(r"agents/README"),               # README reference (may not exist in package)
    re.compile(r"agents/index[\w.-]*\.md"),     # planned auto-generated artefact index (F5)
    re.compile(r"agents/reference/docs/"),               # project-specific docs (not in package)
    re.compile(r"agents/settings/contexts/"),           # project-specific contexts (not in package)
    re.compile(r"agents/gates"),               # project-specific policy docs
    re.compile(r"agents/features/"),           # project-specific feature docs
    re.compile(r"agents/authentication"),       # project-specific auth docs
    re.compile(r"agents/roadmaps/agents-"),     # dynamically created roadmaps
    re.compile(r"agents/roadmaps/test-"),       # project-specific roadmaps
    re.compile(r"agents/ownership-map\.yml"),   # consumer-project routing data
    re.compile(r"agents/historical-bug-patterns\.yml"),  # consumer-project routing data
    re.compile(r"agents/memory/"),              # consumer-project memory data
    re.compile(r"agents/learnings/"),           # consumer-project learning notes
    re.compile(r"agents/proposals/"),           # consumer-project self-improvement proposals
    re.compile(r"agents/drafts/"),              # consumer-project artefact drafts
    re.compile(r"agents/\.event4u-bridge\.yml"),  # consumer-project bridge marker (ADR-020)
    re.compile(r"agents/\.harvest-local/"),     # gitignored harvest-evidence store (source-confidentiality)
    re.compile(r"guidelines/php-"),             # flattened override naming convention
    re.compile(r"rules/no-commit"),            # example rule in commands
    re.compile(r"skills/[\w-]+\.md"),          # short skill refs in examples (not SKILL.md path)
    re.compile(r"skills/[\w-]+/SKILL\.md"),    # example skill paths in commands
    re.compile(r"\{"),                         # template placeholders like {module}
    re.compile(r"\.condensation-hashes\.json"), # JSON file, not .md
    re.compile(r"-foo\.(md|json|yml|yaml)$"),  # `-foo.<ext>` placeholder examples
    re.compile(r"-bar\.(md|json|yml|yaml)$"),  # `-bar.<ext>` placeholder examples
    # ── docs/+src/ illustrative example paths (Phase-0 step 7a) ──
    # Each entry is a PEDAGOGICAL placeholder inside a skill/template whose
    # stated purpose is demonstrating doc structure — not a real package
    # artefact. (Council rigor: allowlist must cite the skill's intent.)
    re.compile(r"docs/foo\.md"),               # readme-reviewer skill: example doc-path placeholder
    re.compile(r"docs/decisions/foo\.md"),     # council/default command: example ADR placeholder
    re.compile(r"docs/auth\.md"),              # security skill: sample consumer auth-doc path
    re.compile(r"docs/billing\.md"),           # agents-md-anatomy context: sample consumer doc path
    re.compile(r"docs/runbooks/"),             # observability template: sample consumer runbook paths
    re.compile(r"docs/adr/00"),                # challenge-me-with-docs + architecture-decisions example: sample ADR refs (package uses docs/decisions/ADR-NNN)
    re.compile(r"src/scripts/X\.py"),          # step-execution report: `X.py` literal placeholder
    # ── docs/ forward-looking artefacts (planned, will materialise) ──
    re.compile(r"docs/contracts/domain-pack-overlap-inventory\.md"),  # domain-pack-extraction roadmap: planned contract
    # Forward references inside in-flight planning docs (road-to-
    # structural-optimization.md and its companion spike protocols).
    # Each pattern below is removed once the matching phase lands.
    re.compile(r"structural-optimization-3a-spike\.md"),       # 3a.0.2
    re.compile(r"contexts/judges/no-consolidate-rationale"),   # 3a.0.2 abort
    re.compile(r"contexts/judges/judge-shared-procedure"),     # 3a.1
    re.compile(r"contexts/analysis/project-analysis-core-procedure"),  # 3b.1
    re.compile(r"agents/roadmaps/phase6-non-overlap-evidence"),        # 6.1 conditional
]


@dataclass(frozen=True)
class AllowlistPattern:
    """A token-class allowlist entry. `reason` is mandatory and auditable."""
    pattern: "re.Pattern[str]"
    reason: str


# Content-class allowlist for known NON-reference token shapes.
#
# The skill/rule prose patterns (`X` skill / `X` rule) occasionally match
# a backtick token that is not an artifact id — an execution-type enum
# value, a pack identifier, or a bare meta-qualifier keyword. Historically
# each such false positive was dodged by *rewording the prose per file*
# (e.g. dc84ed01 "reword execution-type mentions to dodge check-refs
# false positive", bd02ef0b "avoid check-refs false-positive on pack
# name"), a treadmill that distorts natural wording release after release.
# This layer matches the token *class* centrally instead, so the natural
# wording passes without per-file edits. It is distinct from:
#   - SKIP_DIRS          (path-level, whole-directory)
#   - FILE_SKIP_MARKER   (file-level opt-out)
#   - LINE_IGNORE_MARKER (per-line opt-out)
# Every entry carries a mandatory `reason` so the allowlist stays
# auditable and a future reader can tell why a class is exempt.
ALLOWLIST_PATTERNS: List[AllowlistPattern] = [
    AllowlistPattern(
        re.compile(r"^(?:manual|assisted|automated)$"),
        "execution-type enum value (runtime-safety frontmatter), e.g. a "
        "`manual` skill — not a skill/rule id (dc84ed01)",
    ),
    AllowlistPattern(
        re.compile(r"^pack-[\w-]+$"),
        "pack / workspace identifier, e.g. `pack-ai-video` skills — not a "
        "skill/rule id (bd02ef0b)",
    ),
    AllowlistPattern(
        re.compile(r"^(?:skill|rule|command|guideline|persona|context|pack|workspace)$"),
        "bare meta-qualifier keyword used in prose (the `command` vs "
        "`skill` distinction, etc.) — not an artifact id",
    ),
]


def _is_allowlisted(name: str) -> bool:
    """True when `name` matches a known non-reference token class."""
    return any(entry.pattern.match(name) for entry in ALLOWLIST_PATTERNS)


def collect_artifacts(root: Path) -> dict[str, set[str]]:
    """Build lookup sets for skills, rules, commands, guidelines, personas."""
    arts: dict[str, set[str]] = {
        "skills": set(), "rules": set(), "commands": set(),
        "guidelines": set(), "personas": set(),
    }
    augment = root / "dist/agent-src"
    if not augment.exists():
        return arts
    for d in (augment / "skills").iterdir() if (augment / "skills").exists() else []:
        if d.is_dir() and (d / "SKILL.md").exists():
            arts["skills"].add(d.name)
    for f in (augment / "rules").glob("*.md") if (augment / "rules").exists() else []:
        arts["rules"].add(f.stem)
    cmd_dir = augment / "commands"
    if cmd_dir.exists():
        for f in cmd_dir.rglob("*.md"):
            if f.name == "AGENTS.md":
                continue
            # Top-level: bare stem ("commit"). Nested: cluster-sub ("council-default")
            # AND the cluster:sub form, since references may use either.
            rel = f.relative_to(cmd_dir).with_suffix("")
            parts = rel.parts
            if len(parts) == 1:
                arts["commands"].add(parts[0])
            else:
                arts["commands"].add("-".join(parts))
                arts["commands"].add(":".join(parts))
    gdir = augment / "guidelines"
    if gdir.exists():
        for f in gdir.rglob("*.md"):
            arts["guidelines"].add(str(f.relative_to(augment)))
    pdir = augment / "personas"
    if pdir.exists():
        for f in pdir.glob("*.md"):
            if f.stem != "README":
                arts["personas"].add(f.stem)
    return arts


def _extract_personas_frontmatter(text: str) -> list[tuple[int, str]]:
    """Parse frontmatter for `personas:` list entries. Returns (line_no, id)."""
    if not text.startswith("---"):
        return []
    end = text.find("\n---", 3)
    if end < 0:
        return []
    fm_lines = text[3:end].splitlines()
    results: list[tuple[int, str]] = []
    i = 0
    # Frontmatter starts at file line 2 (after opening `---` on line 1).
    while i < len(fm_lines):
        line = fm_lines[i]
        line_no = i + 2
        m_inline = _FM_PERSONAS_INLINE.match(line)
        if m_inline:
            inner = m_inline.group(1)
            for raw in inner.split(","):
                v = raw.strip().strip('"').strip("'")
                if v:
                    results.append((line_no, v))
            i += 1
            continue
        if _FM_PERSONAS_KEY.match(line):
            j = i + 1
            while j < len(fm_lines):
                item_m = _FM_LIST_ITEM.match(fm_lines[j])
                if not item_m:
                    break
                results.append((j + 2, item_m.group(1)))
                j += 1
            i = j
            continue
        i += 1
    return results


def _find_suggestion(path: str, root: Path) -> str:
    name = Path(path).name
    for d in [root / "dist/agent-src", root / ".agent-src.uncondensed", root / "agents"]:
        if d.exists():
            for f in d.rglob(name):
                return str(f.relative_to(root))
    return ""


def _closest_match(name: str, candidates: set[str]) -> str:
    for c in sorted(candidates):
        if name in c or c in name:
            return c
    return ""



def check_file(filepath: Path, artifacts: dict[str, set[str]], root: Path) -> List[BrokenRef]:
    """Check a single .md file for broken references."""
    broken: List[BrokenRef] = []
    try:
        text = filepath.read_text(encoding="utf-8")
    except Exception:
        return broken

    # File-level opt-out: working docs that intentionally reference
    # planned-but-not-yet-existing artifacts mark themselves with
    # `<!-- check-refs: skip -->` in the first 10 lines. Marker pairs
    # with the per-line `<!-- ref-ignore -->` below; either suffices.
    header_lines = text.splitlines()[:10]
    if any(FILE_SKIP_MARKER in line for line in header_lines):
        return broken

    # Validate `personas:` frontmatter entries against known persona ids.
    for line_no, pid in _extract_personas_frontmatter(text):
        if pid not in artifacts["personas"]:
            broken.append(BrokenRef(
                file=str(filepath), line=line_no, ref=pid,
                ref_type="persona", severity="error",
                suggestion=_closest_match(pid, artifacts["personas"]),
            ))

    in_code_block = False
    # Track whether we are inside an unchecked-TODO bullet (multi-line
    # roadmap items wrap continuation text under the `- [ ]` line and
    # those continuation lines must inherit the forward-ref exemption).
    in_unchecked_todo = False
    for i, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        # Per-line opt-out: isolated forward-refs in otherwise checked
        # documents (e.g. one ref to a planned skill, surrounded by
        # valid refs). Skip the whole line's path / skill / rule checks.
        if LINE_IGNORE_MARKER in line:
            continue

        # Unchecked TODO checkboxes document future work — their refs are
        # forward-looking and will not resolve yet. Track multi-line bullets:
        # any `- [ ]` opens a TODO context; a new top-level bullet, heading,
        # or blank line closes it.
        if UNCHECKED_TODO_PATTERN.match(line):
            in_unchecked_todo = True
            continue
        if in_unchecked_todo:
            if not stripped:
                in_unchecked_todo = False
                continue
            # A new bullet (checked or unchecked) or a heading closes the
            # current TODO context. An indented continuation line keeps it.
            if re.match(r"^[-*+]\s+\[", line) or stripped.startswith("#"):
                in_unchecked_todo = False
            elif line[:1] in (" ", "\t"):
                # Indented continuation of the unchecked TODO — skip.
                continue
            else:
                in_unchecked_todo = False

        # File path references
        for m in PATH_PATTERN.finditer(line):
            raw_ref = m.group(1)

            # Skip known example/template paths
            if any(p.search(raw_ref) for p in EXAMPLE_PATH_PATTERNS):
                continue

            # Skip references into directories already excluded from scanning
            # (gitignored audit trails, archived roadmaps). Files there are
            # not committed, so existence checks would always fail in CI.
            if any(raw_ref.startswith(skip + "/") or raw_ref == skip
                   for skip in SKIP_DIRS):
                continue

            resolved = False
            # Try raw ref as-is from root (covers dist/agent-src/..., agents/..., etc.)
            if (root / raw_ref).exists():
                resolved = True
            else:
                # Strip leading ./ and try with prefixes
                ref = raw_ref.lstrip("./")
                for prefix in [root, root / "dist/agent-src", root / ".agent-src.uncondensed"]:
                    if (prefix / ref).exists():
                        resolved = True
                        break
                # `.augment/` is a local projection of `dist/agent-src/` (gitignored).
                # In CI the projection doesn't exist, so resolve `.augment/X`
                # against the canonical source at `dist/agent-src/X` (and the
                # uncondensed authoring tree as a fallback). Note: `raw_ref`
                # keeps the leading dot; `ref` above was stripped via lstrip.
                if not resolved and raw_ref.startswith(".augment/"):
                    rel = raw_ref[len(".augment/") :]
                    for prefix in [root / "dist/agent-src", root / ".agent-src.uncondensed"]:
                        if (prefix / rel).exists():
                            resolved = True
                            break
                # `agents/runtime/state/*.json` are runtime hook state files
                # under the gitignored runtime tree. `agents/runtime/.agent-prices.md`
                # is the runtime-bootstrapped pricing cache, auto-generated by
                # scripts/ai_council/pricing.py from _default_prices.py if
                # missing. The SKIP_DIRS check above already swallows refs
                # into `agents/runtime/`, so no extra carve-out is needed.
            if not resolved:
                broken.append(BrokenRef(
                    file=str(filepath), line=i, ref=m.group(1),
                    ref_type="path", severity="error",
                    suggestion=_find_suggestion(raw_ref, root),
                ))

        # Skill name references
        for m in SKILL_REF_PATTERN.finditer(line):
            name = m.group(1)
            if name not in artifacts["skills"] and name not in _SKIP_NAMES \
                    and not _is_allowlisted(name):
                broken.append(BrokenRef(
                    file=str(filepath), line=i, ref=name,
                    ref_type="skill", severity="warning",
                    suggestion=_closest_match(name, artifacts["skills"]),
                ))

        # Rule name references
        for m in RULE_REF_PATTERN.finditer(line):
            name = m.group(1)
            if name not in artifacts["rules"] and name not in _SKIP_NAMES \
                    and not _is_allowlisted(name):
                broken.append(BrokenRef(
                    file=str(filepath), line=i, ref=name,
                    ref_type="rule", severity="warning",
                    suggestion=_closest_match(name, artifacts["rules"]),
                ))

    return broken


def _looks_like_local_path(value: str) -> bool:
    """Heuristic: treat as a path if it has a known extension and no URI scheme."""
    if not isinstance(value, str) or not value.strip():
        return False
    v = value.strip()
    if any(v.startswith(p) for p in MEMORY_SKIP_URI_PREFIXES):
        return False
    # Globs and wildcard patterns can't be resolved as files
    if any(ch in v for ch in ("*", "?", "[")):
        return False
    # Must contain a directory separator AND end with a known extension
    if "/" not in v:
        return False
    return v.lower().endswith(MEMORY_FILE_EXTS)


def _walk_yaml(data, paths: list[str], skills: list[str]) -> None:
    """Recursively collect path-like strings and `skill:` values."""
    if isinstance(data, dict):
        for k, v in data.items():
            if k in ("skill", "skills") and isinstance(v, str):
                skills.append(v)
            elif k in ("skill", "skills") and isinstance(v, list):
                skills.extend(x for x in v if isinstance(x, str))
            else:
                _walk_yaml(v, paths, skills)
    elif isinstance(data, list):
        for item in data:
            _walk_yaml(item, paths, skills)
    elif isinstance(data, str):
        if _looks_like_local_path(data):
            paths.append(data)


def check_memory_yaml(filepath: Path, artifacts: dict[str, set[str]],
                      root: Path) -> List[BrokenRef]:
    """Validate path/skill refs inside an engineering-memory YAML file."""
    broken: List[BrokenRef] = []
    try:
        import yaml  # type: ignore
    except ImportError:
        return broken  # PyYAML optional; text-ref checker still runs
    try:
        text = filepath.read_text(encoding="utf-8")
        data = yaml.safe_load(text)
    except Exception:
        return broken
    if not data:
        return broken
    paths: list[str] = []
    skills: list[str] = []
    _walk_yaml(data, paths, skills)
    for p in paths:
        if not (root / p.lstrip("./")).exists():
            broken.append(BrokenRef(
                file=str(filepath), line=0, ref=p,
                ref_type="memory-path", severity="error",
                suggestion=_find_suggestion(p, root),
            ))
    for s in skills:
        if s not in artifacts["skills"] and s not in _SKIP_NAMES:
            broken.append(BrokenRef(
                file=str(filepath), line=0, ref=s,
                ref_type="memory-skill", severity="warning",
                suggestion=_closest_match(s, artifacts["skills"]),
            ))
    return broken


def scan_all(root: Path) -> List[BrokenRef]:
    artifacts = collect_artifacts(root)
    broken: List[BrokenRef] = []
    for scan_dir in SCAN_DIRS:
        d = root / scan_dir
        if not d.exists():
            continue
        for f in sorted(d.rglob("*.md")):
            # Skip archived directories
            if any(str(f).startswith(str(root / skip)) for skip in SKIP_DIRS):
                continue
            broken.extend(check_file(f, artifacts, root))
    memory_dir = root / MEMORY_YAML_ROOT
    if memory_dir.is_dir():
        for f in sorted(memory_dir.rglob("*.yml")):
            broken.extend(check_memory_yaml(f, artifacts, root))
        for f in sorted(memory_dir.rglob("*.yaml")):
            broken.extend(check_memory_yaml(f, artifacts, root))
    return broken


def format_text(broken: List[BrokenRef]) -> str:
    if not broken:
        return "✅  No broken references found."
    lines = [f"❌  Found {len(broken)} broken reference(s):\n"]
    for b in broken:
        icon = "🔴" if b.severity == "error" else "🟡"
        line = f"  {icon} {b.file}:{b.line} — {b.ref_type} `{b.ref}`"
        if b.suggestion:
            line += f" → did you mean `{b.suggestion}`?"
        lines.append(line)
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check for broken cross-references in agent config")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    args = parser.parse_args()

    try:
        broken = scan_all(args.root)
    except Exception as e:
        print(f"Internal error: {e}", file=sys.stderr)
        return 3

    if args.format == "json":
        print(json.dumps([asdict(b) for b in broken], indent=2))
    else:
        print(format_text(broken))

    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())